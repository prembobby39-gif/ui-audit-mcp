import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────

export interface LighthouseAudit {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly score: number | null;
  readonly displayValue: string | null;
  readonly numericValue: number | null;
  readonly numericUnit: string | null;
}

export interface LighthouseScores {
  readonly performance: number | null;
  readonly accessibility: number | null;
  readonly bestPractices: number | null;
  readonly seo: number | null;
}

export interface LighthouseResult {
  readonly scores: LighthouseScores;
  readonly audits: readonly LighthouseAudit[];
  readonly url: string;
  readonly timestamp: string;
  readonly lighthouseVersion: string;
  readonly runWarnings: readonly string[];
}

// ── Constants ──────────────────────────────────────────────────────

/** Audits we always extract from the full report. */
const KEY_AUDIT_IDS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
  "interactive",
  "render-blocking-resources",
  "uses-optimized-images",
  "uses-text-compression",
  "uses-responsive-images",
  "unminified-javascript",
  "unminified-css",
  "unused-javascript",
  "unused-css-rules",
  "dom-size",
  "bootup-time",
  "mainthread-work-breakdown",
  "server-response-time",
  "redirects",
  "uses-rel-preconnect",
  "efficient-animated-content",
  "duplicated-javascript",
  "legacy-javascript",
  "viewport",
  "document-title",
  "meta-description",
  "http-status-code",
  "image-alt",
  "link-name",
  "color-contrast",
] as const;

const LIGHTHOUSE_TIMEOUT_MS = 120_000;

// ── Category Keys ──────────────────────────────────────────────────

const CATEGORY_KEYS = {
  performance: "performance",
  accessibility: "accessibility",
  bestPractices: "best-practices",
  seo: "seo",
} as const;

// ── Helpers ────────────────────────────────────────────────────────

function findLighthouseCli(): string {
  const localBin = resolve(
    import.meta.dirname ?? ".",
    "../../node_modules/.bin/lighthouse"
  );
  if (existsSync(localBin)) {
    return localBin;
  }
  throw new Error(
    "Could not find the lighthouse CLI binary. Ensure lighthouse is installed: npm install lighthouse"
  );
}

/**
 * Run the Lighthouse CLI and parse the JSON output.
 *
 * Uses the CLI approach for maximum reliability — avoids complex type
 * interactions with the programmatic API and isolates the Chrome
 * process lifecycle from the MCP server's puppeteer instance.
 */
function runLighthouseCli(
  url: string,
  chromePath?: string
): Promise<Record<string, unknown>> {
  const cliBin = findLighthouseCli();

  const args = [
    url,
    "--output=json",
    "--output-path=stdout",
    "--chrome-flags=--headless --no-sandbox --disable-gpu --disable-dev-shm-usage",
    "--quiet",
  ];

  if (chromePath) {
    args.push(`--chrome-path=${chromePath}`);
  }

  return new Promise((resolve, reject) => {
    execFile(
      "node",
      [cliBin, ...args],
      {
        timeout: LIGHTHOUSE_TIMEOUT_MS,
        maxBuffer: 50 * 1024 * 1024, // 50 MB — Lighthouse JSON can be large
        env: { ...process.env, NODE_ENV: "production" },
      },
      (error, stdout, stderr) => {
        if (error) {
          const stderrSnippet = stderr
            ? `\nStderr: ${stderr.slice(0, 500)}`
            : "";
          reject(
            new Error(
              `Lighthouse CLI failed: ${error.message}${stderrSnippet}`
            )
          );
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as Record<string, unknown>;
          resolve(parsed);
        } catch {
          reject(
            new Error(
              `Failed to parse Lighthouse JSON output (${stdout.length} bytes received)`
            )
          );
        }
      }
    );
  });
}

// ── Score Extraction ───────────────────────────────────────────────

function extractScore(
  categories: Record<string, unknown>,
  key: string
): number | null {
  const category = categories[key] as
    | { score?: number | null }
    | undefined;
  if (!category || category.score == null) return null;
  return Math.round(category.score * 100);
}

function extractScores(
  categories: Record<string, unknown>
): LighthouseScores {
  return {
    performance: extractScore(categories, CATEGORY_KEYS.performance),
    accessibility: extractScore(categories, CATEGORY_KEYS.accessibility),
    bestPractices: extractScore(categories, CATEGORY_KEYS.bestPractices),
    seo: extractScore(categories, CATEGORY_KEYS.seo),
  };
}

// ── Audit Extraction ───────────────────────────────────────────────

function extractAudit(
  raw: Record<string, unknown>
): LighthouseAudit {
  return {
    id: String(raw["id"] ?? ""),
    title: String(raw["title"] ?? ""),
    description: String(raw["description"] ?? ""),
    score: typeof raw["score"] === "number" ? raw["score"] : null,
    displayValue:
      typeof raw["displayValue"] === "string" ? raw["displayValue"] : null,
    numericValue:
      typeof raw["numericValue"] === "number" ? raw["numericValue"] : null,
    numericUnit:
      typeof raw["numericUnit"] === "string" ? raw["numericUnit"] : null,
  };
}

function extractKeyAudits(
  audits: Record<string, unknown>
): readonly LighthouseAudit[] {
  const results: LighthouseAudit[] = [];

  for (const auditId of KEY_AUDIT_IDS) {
    const raw = audits[auditId] as Record<string, unknown> | undefined;
    if (raw) {
      results.push(extractAudit(raw));
    }
  }

  return results;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Run a Lighthouse audit against the given URL.
 *
 * Spawns the Lighthouse CLI in a separate process so it manages its
 * own Chrome instance, avoiding conflicts with the puppeteer browser
 * used by other tools.
 */
export async function runLighthouse(
  url: string,
  options?: { readonly chromePath?: string }
): Promise<LighthouseResult> {
  const raw = await runLighthouseCli(url, options?.chromePath);

  const categories = (raw["categories"] ?? {}) as Record<string, unknown>;
  const audits = (raw["audits"] ?? {}) as Record<string, unknown>;
  const runWarningsRaw = raw["runWarnings"];
  const runWarnings = Array.isArray(runWarningsRaw)
    ? runWarningsRaw.map(String)
    : [];

  return {
    scores: extractScores(categories),
    audits: extractKeyAudits(audits),
    url: typeof raw["requestedUrl"] === "string" ? raw["requestedUrl"] : url,
    timestamp:
      typeof raw["fetchTime"] === "string"
        ? raw["fetchTime"]
        : new Date().toISOString(),
    lighthouseVersion:
      typeof raw["lighthouseVersion"] === "string"
        ? raw["lighthouseVersion"]
        : "unknown",
    runWarnings,
  };
}

/**
 * Run Lighthouse and return the FULL raw JSON result (LHR).
 *
 * Unlike `runLighthouse`, which extracts only key scores and audits,
 * this returns the entire Lighthouse result object for deep analysis
 * by the lighthouse-deep extraction functions.
 */
export async function runLighthouseDeep(
  url: string,
  options?: { readonly chromePath?: string }
): Promise<Record<string, unknown>> {
  return runLighthouseCli(url, options?.chromePath);
}

// ── Report Formatting ──────────────────────────────────────────────

function scoreEmoji(score: number | null): string {
  if (score === null) return "N/A";
  if (score >= 90) return `${score} (Good)`;
  if (score >= 50) return `${score} (Needs Improvement)`;
  return `${score} (Poor)`;
}

function formatAuditLine(audit: LighthouseAudit): string | null {
  // Skip audits that are not applicable or have no score
  if (audit.score === null) return null;

  const passed = audit.score >= 0.9;
  const icon = passed ? "PASS" : "FAIL";
  const display = audit.displayValue ? ` — ${audit.displayValue}` : "";
  return `| ${icon} | ${audit.title}${display} |`;
}

/**
 * Format a Lighthouse result into a human-readable Markdown report.
 */
export function formatLighthouseReport(result: LighthouseResult): string {
  const { scores, audits } = result;

  const failingAudits = audits.filter(
    (a) => a.score !== null && a.score < 0.9
  );
  const passingAudits = audits.filter(
    (a) => a.score !== null && a.score >= 0.9
  );

  const sections: string[] = [
    `## Lighthouse Audit`,
    ``,
    `**URL:** ${result.url}`,
    `**Lighthouse Version:** ${result.lighthouseVersion}`,
    `**Measured:** ${result.timestamp}`,
    ``,
    `### Scores`,
    `| Category | Score |`,
    `|----------|-------|`,
    `| Performance | ${scoreEmoji(scores.performance)} |`,
    `| Accessibility | ${scoreEmoji(scores.accessibility)} |`,
    `| Best Practices | ${scoreEmoji(scores.bestPractices)} |`,
    `| SEO | ${scoreEmoji(scores.seo)} |`,
    ``,
  ];

  if (failingAudits.length > 0) {
    sections.push(`### Key Findings (Needs Attention)`);
    sections.push(`| Status | Audit |`);
    sections.push(`|--------|-------|`);
    for (const audit of failingAudits) {
      const line = formatAuditLine(audit);
      if (line) sections.push(line);
    }
    sections.push(``);
  }

  if (passingAudits.length > 0) {
    sections.push(`### Passing Audits`);
    sections.push(`| Status | Audit |`);
    sections.push(`|--------|-------|`);
    for (const audit of passingAudits) {
      const line = formatAuditLine(audit);
      if (line) sections.push(line);
    }
    sections.push(``);
  }

  if (result.runWarnings.length > 0) {
    sections.push(`### Warnings`);
    for (const warning of result.runWarnings) {
      sections.push(`- ${warning}`);
    }
    sections.push(``);
  }

  return sections.join("\n");
}
