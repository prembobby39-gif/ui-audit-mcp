import type { Page } from "puppeteer-core";
import { createPage, navigateAndWait, closePage } from "../utils/browser.js";
import type {
  ConsoleEntry,
  ConsoleLevel,
  ConsoleCaptureResult,
  NetworkEntry,
  NetworkSummary,
  NetworkCaptureResult,
  PageError,
  PageErrorKind,
  ErrorCaptureResult,
} from "../types.js";

// ── Constants ─────────────────────────────────────────────────────

const DEFAULT_WAIT_MS = 3000;
const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_VIEWPORT_HEIGHT = 900;

const CONSOLE_LEVEL_MAP: Readonly<Record<string, ConsoleLevel>> = {
  log: "log",
  warning: "warn",
  error: "error",
  info: "info",
  debug: "debug",
};

const ZERO_LEVEL_COUNTS: Readonly<Record<ConsoleLevel, number>> = {
  log: 0,
  warn: 0,
  error: 0,
  info: 0,
  debug: 0,
};

const ZERO_KIND_COUNTS: Readonly<Record<PageErrorKind, number>> = {
  exception: 0,
  "unhandled-rejection": 0,
  "resource-load-failure": 0,
};

// ── Options ───────────────────────────────────────────────────────

export interface CaptureOptions {
  readonly waitMs?: number;
}

// ── Internal: attach console listeners ────────────────────────────

interface ConsoleCollector {
  readonly entries: ConsoleEntry[];
  readonly exceptions: string[];
}

function attachConsoleListeners(page: Page): ConsoleCollector {
  const collector: ConsoleCollector = { entries: [], exceptions: [] };

  page.on("console", (msg) => {
    const rawType = msg.type();
    const level = CONSOLE_LEVEL_MAP[rawType] ?? "log";
    const entry: ConsoleEntry = {
      level,
      text: msg.text(),
      timestamp: new Date().toISOString(),
      location: msg.location()?.url || undefined,
    };
    collector.entries.push(entry);
  });

  page.on("pageerror", (raw: unknown) => {
    const error = raw instanceof Error ? raw : new Error(String(raw));
    collector.exceptions.push(error.message);
  });

  return collector;
}

// ── Internal: attach network listeners ────────────────────────────

interface PendingRequest {
  readonly url: string;
  readonly method: string;
  readonly resourceType: string;
  readonly startTime: number;
}

interface NetworkCollector {
  readonly pending: Map<string, PendingRequest>;
  readonly entries: NetworkEntry[];
}

function attachNetworkListeners(page: Page): NetworkCollector {
  const collector: NetworkCollector = {
    pending: new Map(),
    entries: [],
  };

  page.on("request", (request) => {
    const pending: PendingRequest = {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      startTime: Date.now(),
    };
    collector.pending.set(request.url(), pending);
  });

  page.on("response", (response) => {
    const requestUrl = response.url();
    const pending = collector.pending.get(requestUrl);
    const startTime = pending?.startTime ?? Date.now();

    const entry: NetworkEntry = {
      url: requestUrl,
      method: pending?.method ?? "GET",
      resourceType: pending?.resourceType ?? "other",
      status: response.status(),
      size: Number(response.headers()["content-length"] ?? 0),
      duration: Date.now() - startTime,
      failed: false,
    };
    collector.entries.push(entry);
    collector.pending.delete(requestUrl);
  });

  page.on("requestfailed", (request) => {
    const requestUrl = request.url();
    const pending = collector.pending.get(requestUrl);
    const startTime = pending?.startTime ?? Date.now();

    const entry: NetworkEntry = {
      url: requestUrl,
      method: pending?.method ?? request.method(),
      resourceType: pending?.resourceType ?? request.resourceType(),
      status: 0,
      size: 0,
      duration: Date.now() - startTime,
      failed: true,
      failureReason: request.failure()?.errorText ?? "Unknown failure",
    };
    collector.entries.push(entry);
    collector.pending.delete(requestUrl);
  });

  return collector;
}

// ── Internal: attach error listeners ──────────────────────────────

interface ErrorCollector {
  readonly errors: PageError[];
}

function attachErrorListeners(page: Page): ErrorCollector {
  const collector: ErrorCollector = { errors: [] };

  page.on("pageerror", (raw: unknown) => {
    const error = raw instanceof Error ? raw : new Error(String(raw));
    const pageError: PageError = {
      kind: "exception",
      message: error.message,
      timestamp: new Date().toISOString(),
      source: error.stack?.split("\n")[1]?.trim() || undefined,
    };
    collector.errors.push(pageError);
  });

  page.on("requestfailed", (request) => {
    const resourceType = request.resourceType();
    const isResourceLoad = ["image", "stylesheet", "script", "font"].includes(resourceType);
    if (isResourceLoad) {
      const pageError: PageError = {
        kind: "resource-load-failure",
        message: `Failed to load ${resourceType}: ${request.url()}`,
        timestamp: new Date().toISOString(),
        source: request.url(),
      };
      collector.errors.push(pageError);
    }
  });

  return collector;
}

// ── Internal: build network summary ───────────────────────────────

function buildNetworkSummary(entries: readonly NetworkEntry[]): NetworkSummary {
  const failedRequests = entries.filter((e) => e.failed).length;
  const totalTransferSize = entries.reduce((sum, e) => sum + e.size, 0);

  const typeMap = new Map<string, { count: number; totalSize: number }>();
  for (const entry of entries) {
    const existing = typeMap.get(entry.resourceType);
    if (existing) {
      typeMap.set(entry.resourceType, {
        count: existing.count + 1,
        totalSize: existing.totalSize + entry.size,
      });
    } else {
      typeMap.set(entry.resourceType, { count: 1, totalSize: entry.size });
    }
  }

  const byType = Array.from(typeMap.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    totalSize: data.totalSize,
  }));

  return {
    totalRequests: entries.length,
    failedRequests,
    totalTransferSize,
    byType,
  };
}

// ── Internal: count by level / kind ───────────────────────────────

function countByLevel(entries: readonly ConsoleEntry[]): Readonly<Record<ConsoleLevel, number>> {
  return entries.reduce(
    (counts, entry) => ({
      ...counts,
      [entry.level]: (counts[entry.level] ?? 0) + 1,
    }),
    { ...ZERO_LEVEL_COUNTS }
  );
}

function countByKind(errors: readonly PageError[]): Readonly<Record<PageErrorKind, number>> {
  return errors.reduce(
    (counts, error) => ({
      ...counts,
      [error.kind]: (counts[error.kind] ?? 0) + 1,
    }),
    { ...ZERO_KIND_COUNTS }
  );
}

// ── Public: captureConsoleLogs ────────────────────────────────────

/**
 * Navigate to a URL and capture all console messages during page load.
 * Also captures uncaught exceptions via pageerror events.
 * Note: Console messages may contain sensitive data.
 */
export async function captureConsoleLogs(
  url: string,
  options?: CaptureOptions
): Promise<ConsoleCaptureResult> {
  const waitMs = options?.waitMs ?? DEFAULT_WAIT_MS;
  const page = await createPage(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT);

  try {
    const collector = attachConsoleListeners(page);
    await navigateAndWait(page, url);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    const entries = [...collector.entries];
    const uncaughtExceptions = [...collector.exceptions];

    return {
      url,
      timestamp: new Date().toISOString(),
      entries,
      uncaughtExceptions,
      totalCount: entries.length,
      countByLevel: countByLevel(entries),
    };
  } finally {
    await closePage(page);
  }
}

// ── Public: captureNetworkRequests ────────────────────────────────

/**
 * Navigate to a URL and capture all network requests during page load.
 * Records request/response details including status, size, and timing.
 */
export async function captureNetworkRequests(
  url: string,
  options?: CaptureOptions
): Promise<NetworkCaptureResult> {
  const waitMs = options?.waitMs ?? DEFAULT_WAIT_MS;
  const page = await createPage(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT);

  try {
    const collector = attachNetworkListeners(page);
    await navigateAndWait(page, url);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    const entries = [...collector.entries];

    return {
      url,
      timestamp: new Date().toISOString(),
      entries,
      summary: buildNetworkSummary(entries),
    };
  } finally {
    await closePage(page);
  }
}

// ── Public: capturePageErrors ─────────────────────────────────────

/**
 * Navigate to a URL and capture all JavaScript errors, unhandled rejections,
 * and failed resource loads.
 */
export async function capturePageErrors(url: string): Promise<ErrorCaptureResult> {
  const page = await createPage(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT);

  try {
    const collector = attachErrorListeners(page);
    await navigateAndWait(page, url);
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_WAIT_MS));

    const errors = [...collector.errors];

    return {
      url,
      timestamp: new Date().toISOString(),
      errors,
      totalCount: errors.length,
      countByKind: countByKind(errors),
    };
  } finally {
    await closePage(page);
  }
}

// ── Format: Console Report ────────────────────────────────────────

/**
 * Format console capture results into a human-readable markdown report.
 */
export function formatConsoleReport(result: ConsoleCaptureResult): string {
  const lines: string[] = [
    `## Console Log Report`,
    ``,
    `**URL:** ${result.url}`,
    `**Captured:** ${result.timestamp}`,
    `**Total messages:** ${result.totalCount}`,
    ``,
    `### Messages by Level`,
    `| Level | Count |`,
    `|-------|-------|`,
  ];

  for (const [level, count] of Object.entries(result.countByLevel)) {
    lines.push(`| ${level} | ${count} |`);
  }

  if (result.uncaughtExceptions.length > 0) {
    lines.push(``);
    lines.push(`### Uncaught Exceptions (${result.uncaughtExceptions.length})`);
    for (const exception of result.uncaughtExceptions) {
      lines.push(`- \`${exception}\``);
    }
  }

  if (result.entries.length > 0) {
    lines.push(``);
    lines.push(`### Console Messages`);
    for (const entry of result.entries) {
      const location = entry.location ? ` (${entry.location})` : "";
      lines.push(`- **[${entry.level.toUpperCase()}]** ${entry.text}${location}`);
    }
  } else {
    lines.push(``);
    lines.push(`No console messages captured during page load.`);
  }

  return lines.join("\n");
}

// ── Format: Network Report ────────────────────────────────────────

/**
 * Format network capture results into a human-readable markdown report.
 */
export function formatNetworkReport(result: NetworkCaptureResult): string {
  const { summary } = result;
  const sizeKb = (summary.totalTransferSize / 1024).toFixed(1);

  const lines: string[] = [
    `## Network Request Report`,
    ``,
    `**URL:** ${result.url}`,
    `**Captured:** ${result.timestamp}`,
    `**Total requests:** ${summary.totalRequests}`,
    `**Failed requests:** ${summary.failedRequests}`,
    `**Total transfer size:** ${sizeKb} KB`,
    ``,
    `### Requests by Type`,
    `| Type | Count | Size (KB) |`,
    `|------|-------|-----------|`,
  ];

  for (const typeSummary of summary.byType) {
    const typeSize = (typeSummary.totalSize / 1024).toFixed(1);
    lines.push(`| ${typeSummary.type} | ${typeSummary.count} | ${typeSize} |`);
  }

  const failedEntries = result.entries.filter((e) => e.failed);
  if (failedEntries.length > 0) {
    lines.push(``);
    lines.push(`### Failed Requests (${failedEntries.length})`);
    for (const entry of failedEntries) {
      lines.push(`- **${entry.method} ${entry.url}** — ${entry.failureReason ?? "Unknown"}`);
    }
  }

  if (result.entries.length > 0) {
    lines.push(``);
    lines.push(`### All Requests`);
    lines.push(`| Method | URL | Status | Size | Duration |`);
    lines.push(`|--------|-----|--------|------|----------|`);
    for (const entry of result.entries) {
      const shortUrl = entry.url.length > 60 ? `${entry.url.slice(0, 57)}...` : entry.url;
      const status = entry.failed ? "FAILED" : String(entry.status);
      lines.push(
        `| ${entry.method} | ${shortUrl} | ${status} | ${entry.size} | ${entry.duration}ms |`
      );
    }
  } else {
    lines.push(``);
    lines.push(`No network requests captured during page load.`);
  }

  return lines.join("\n");
}

// ── Format: Error Report ──────────────────────────────────────────

/**
 * Format error capture results into a human-readable markdown report.
 */
export function formatErrorReport(result: ErrorCaptureResult): string {
  const lines: string[] = [
    `## Page Error Report`,
    ``,
    `**URL:** ${result.url}`,
    `**Captured:** ${result.timestamp}`,
    `**Total errors:** ${result.totalCount}`,
    ``,
    `### Errors by Kind`,
    `| Kind | Count |`,
    `|------|-------|`,
  ];

  for (const [kind, count] of Object.entries(result.countByKind)) {
    lines.push(`| ${kind} | ${count} |`);
  }

  if (result.errors.length > 0) {
    lines.push(``);
    lines.push(`### Error Details`);
    for (const error of result.errors) {
      const source = error.source ? ` (${error.source})` : "";
      lines.push(`- **[${error.kind}]** ${error.message}${source}`);
    }
  } else {
    lines.push(``);
    lines.push(`No errors captured during page load.`);
  }

  return lines.join("\n");
}
