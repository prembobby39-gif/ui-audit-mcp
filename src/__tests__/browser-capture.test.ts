import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConsoleEntry, NetworkEntry, PageError } from "../types.js";

// ── Mock browser utilities ───────────────────────────────────────

const { mockPage, mockGoto, mockIsClosed, mockClose, mockSetViewport } = vi.hoisted(() => {
  const mockGoto = vi.fn();
  const mockIsClosed = vi.fn().mockReturnValue(false);
  const mockClose = vi.fn();
  const mockSetViewport = vi.fn();

  const mockPage = {
    goto: mockGoto,
    isClosed: mockIsClosed,
    close: mockClose,
    setViewport: mockSetViewport,
    on: vi.fn(),
  };

  return { mockPage, mockGoto, mockIsClosed, mockClose, mockSetViewport };
});

vi.mock("../utils/browser.js", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  navigateAndWait: vi.fn().mockResolvedValue(undefined),
  closePage: vi.fn().mockResolvedValue(undefined),
}));

import {
  captureConsoleLogs,
  captureNetworkRequests,
  capturePageErrors,
  formatConsoleReport,
  formatNetworkReport,
  formatErrorReport,
} from "../tools/browser-capture.js";

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Get the callback registered for a specific event via page.on().
 */
function getEventCallback(eventName: string): ((...args: unknown[]) => void) | undefined {
  const calls = (mockPage.on as ReturnType<typeof vi.fn>).mock.calls;
  const match = calls.find((call: unknown[]) => call[0] === eventName);
  return match ? (match[1] as (...args: unknown[]) => void) : undefined;
}

/**
 * Get all callbacks registered for a specific event via page.on().
 */
function getEventCallbacks(eventName: string): Array<(...args: unknown[]) => void> {
  const calls = (mockPage.on as ReturnType<typeof vi.fn>).mock.calls;
  return calls
    .filter((call: unknown[]) => call[0] === eventName)
    .map((call: unknown[]) => call[1] as (...args: unknown[]) => void);
}

// ── Tests: captureConsoleLogs ────────────────────────────────────

describe("captureConsoleLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockPage.on as ReturnType<typeof vi.fn>).mockImplementation(() => mockPage);
  });

  it("returns a ConsoleCaptureResult with correct structure", async () => {
    const result = await captureConsoleLogs("http://localhost:3000");

    expect(result.url).toBe("http://localhost:3000");
    expect(result.timestamp).toBeDefined();
    expect(result.entries).toBeDefined();
    expect(result.uncaughtExceptions).toBeDefined();
    expect(result.totalCount).toBe(0);
    expect(result.countByLevel).toBeDefined();
  });

  it("captures console log messages at various levels", async () => {
    // Override navigateAndWait to simulate console events during navigation
    const { navigateAndWait } = await import("../utils/browser.js");
    (navigateAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      const consoleCallback = getEventCallback("console");
      if (consoleCallback) {
        consoleCallback({
          type: () => "log",
          text: () => "Hello world",
          location: () => ({ url: "http://localhost:3000/app.js" }),
        });
        consoleCallback({
          type: () => "warning",
          text: () => "Deprecation warning",
          location: () => ({ url: "" }),
        });
        consoleCallback({
          type: () => "error",
          text: () => "Something broke",
          location: () => ({ url: "http://localhost:3000/main.js" }),
        });
        consoleCallback({
          type: () => "info",
          text: () => "Info message",
          location: () => ({}),
        });
        consoleCallback({
          type: () => "debug",
          text: () => "Debug output",
          location: () => null,
        });
      }
    });

    const result = await captureConsoleLogs("http://localhost:3000");

    expect(result.totalCount).toBe(5);
    expect(result.countByLevel.log).toBe(1);
    expect(result.countByLevel.warn).toBe(1);
    expect(result.countByLevel.error).toBe(1);
    expect(result.countByLevel.info).toBe(1);
    expect(result.countByLevel.debug).toBe(1);
  });

  it("captures uncaught exceptions via pageerror", async () => {
    const { navigateAndWait } = await import("../utils/browser.js");
    (navigateAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      const pageerrorCallback = getEventCallback("pageerror");
      if (pageerrorCallback) {
        pageerrorCallback(new TypeError("cannot read property"));
      }
    });

    const result = await captureConsoleLogs("http://localhost:3000");

    expect(result.uncaughtExceptions).toHaveLength(1);
    expect(result.uncaughtExceptions[0]).toContain("cannot read property");
  });

  it("respects custom waitMs option", async () => {
    const start = Date.now();
    await captureConsoleLogs("http://localhost:3000", { waitMs: 100 });
    const elapsed = Date.now() - start;

    // Should complete relatively quickly with low waitMs (accounting for mock overhead)
    expect(elapsed).toBeLessThan(2000);
  });

  it("returns zero counts when no console messages are produced", async () => {
    const result = await captureConsoleLogs("http://localhost:3000");

    expect(result.totalCount).toBe(0);
    expect(result.entries).toHaveLength(0);
    expect(result.uncaughtExceptions).toHaveLength(0);
    expect(result.countByLevel.log).toBe(0);
    expect(result.countByLevel.warn).toBe(0);
    expect(result.countByLevel.error).toBe(0);
    expect(result.countByLevel.info).toBe(0);
    expect(result.countByLevel.debug).toBe(0);
  });

  it("maps unknown console types to log level", async () => {
    const { navigateAndWait } = await import("../utils/browser.js");
    (navigateAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      const consoleCallback = getEventCallback("console");
      if (consoleCallback) {
        consoleCallback({
          type: () => "trace",
          text: () => "Stack trace output",
          location: () => ({}),
        });
      }
    });

    const result = await captureConsoleLogs("http://localhost:3000");

    expect(result.entries[0].level).toBe("log");
  });
});

// ── Tests: captureNetworkRequests ────────────────────────────────

describe("captureNetworkRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockPage.on as ReturnType<typeof vi.fn>).mockImplementation(() => mockPage);
  });

  it("returns a NetworkCaptureResult with correct structure", async () => {
    const result = await captureNetworkRequests("http://localhost:3000");

    expect(result.url).toBe("http://localhost:3000");
    expect(result.timestamp).toBeDefined();
    expect(result.entries).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary.totalRequests).toBe(0);
  });

  it("captures successful network requests with response data", async () => {
    const { navigateAndWait } = await import("../utils/browser.js");
    (navigateAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      const requestCallback = getEventCallback("request");
      const responseCallback = getEventCallback("response");
      if (requestCallback && responseCallback) {
        requestCallback({
          url: () => "http://localhost:3000/api/data",
          method: () => "GET",
          resourceType: () => "xhr",
        });
        responseCallback({
          url: () => "http://localhost:3000/api/data",
          status: () => 200,
          headers: () => ({ "content-length": "1024" }),
        });
      }
    });

    const result = await captureNetworkRequests("http://localhost:3000");

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].url).toBe("http://localhost:3000/api/data");
    expect(result.entries[0].method).toBe("GET");
    expect(result.entries[0].status).toBe(200);
    expect(result.entries[0].size).toBe(1024);
    expect(result.entries[0].failed).toBe(false);
  });

  it("captures failed network requests", async () => {
    const { navigateAndWait } = await import("../utils/browser.js");
    (navigateAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      const requestCallback = getEventCallback("request");
      const requestFailedCallback = getEventCallback("requestfailed");
      if (requestCallback && requestFailedCallback) {
        requestCallback({
          url: () => "http://localhost:3000/missing.js",
          method: () => "GET",
          resourceType: () => "script",
        });
        requestFailedCallback({
          url: () => "http://localhost:3000/missing.js",
          method: () => "GET",
          resourceType: () => "script",
          failure: () => ({ errorText: "net::ERR_FAILED" }),
        });
      }
    });

    const result = await captureNetworkRequests("http://localhost:3000");

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].failed).toBe(true);
    expect(result.entries[0].failureReason).toBe("net::ERR_FAILED");
    expect(result.summary.failedRequests).toBe(1);
  });

  it("provides correct network summary grouped by type", async () => {
    const { navigateAndWait } = await import("../utils/browser.js");
    (navigateAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      const requestCallback = getEventCallback("request");
      const responseCallback = getEventCallback("response");
      if (requestCallback && responseCallback) {
        // Document request
        requestCallback({
          url: () => "http://localhost:3000/",
          method: () => "GET",
          resourceType: () => "document",
        });
        responseCallback({
          url: () => "http://localhost:3000/",
          status: () => 200,
          headers: () => ({ "content-length": "5000" }),
        });

        // Script request
        requestCallback({
          url: () => "http://localhost:3000/app.js",
          method: () => "GET",
          resourceType: () => "script",
        });
        responseCallback({
          url: () => "http://localhost:3000/app.js",
          status: () => 200,
          headers: () => ({ "content-length": "20000" }),
        });

        // Another script
        requestCallback({
          url: () => "http://localhost:3000/vendor.js",
          method: () => "GET",
          resourceType: () => "script",
        });
        responseCallback({
          url: () => "http://localhost:3000/vendor.js",
          status: () => 200,
          headers: () => ({ "content-length": "50000" }),
        });
      }
    });

    const result = await captureNetworkRequests("http://localhost:3000");

    expect(result.summary.totalRequests).toBe(3);
    expect(result.summary.failedRequests).toBe(0);
    expect(result.summary.totalTransferSize).toBe(75000);

    const scriptType = result.summary.byType.find((t) => t.type === "script");
    expect(scriptType?.count).toBe(2);
    expect(scriptType?.totalSize).toBe(70000);
  });

  it("handles pages with zero network activity gracefully", async () => {
    const result = await captureNetworkRequests("http://localhost:3000");

    expect(result.entries).toHaveLength(0);
    expect(result.summary.totalRequests).toBe(0);
    expect(result.summary.failedRequests).toBe(0);
    expect(result.summary.totalTransferSize).toBe(0);
    expect(result.summary.byType).toHaveLength(0);
  });

  it("respects custom waitMs option for network capture", async () => {
    const start = Date.now();
    await captureNetworkRequests("http://localhost:3000", { waitMs: 100 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });
});

// ── Tests: capturePageErrors ─────────────────────────────────────

describe("capturePageErrors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockPage.on as ReturnType<typeof vi.fn>).mockImplementation(() => mockPage);
  });

  it("returns an ErrorCaptureResult with correct structure", async () => {
    const result = await capturePageErrors("http://localhost:3000");

    expect(result.url).toBe("http://localhost:3000");
    expect(result.timestamp).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(result.totalCount).toBe(0);
    expect(result.countByKind).toBeDefined();
  });

  it("captures JavaScript exceptions via pageerror", async () => {
    const { navigateAndWait } = await import("../utils/browser.js");
    (navigateAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      const pageerrorCallbacks = getEventCallbacks("pageerror");
      const err = new ReferenceError("foo is not defined");
      err.stack = "ReferenceError: foo is not defined\n    at http://localhost:3000/app.js:10:5";
      for (const cb of pageerrorCallbacks) {
        cb(err);
      }
    });

    const result = await capturePageErrors("http://localhost:3000");

    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    const exceptions = result.errors.filter((e) => e.kind === "exception");
    expect(exceptions.length).toBeGreaterThanOrEqual(1);
    expect(exceptions[0].message).toContain("foo is not defined");
  });

  it("captures failed resource loads for critical resource types", async () => {
    const { navigateAndWait } = await import("../utils/browser.js");
    (navigateAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      const requestFailedCallbacks = getEventCallbacks("requestfailed");
      for (const cb of requestFailedCallbacks) {
        cb({
          url: () => "http://localhost:3000/styles.css",
          resourceType: () => "stylesheet",
          failure: () => ({ errorText: "net::ERR_FILE_NOT_FOUND" }),
        });
      }
    });

    const result = await capturePageErrors("http://localhost:3000");

    const resourceErrors = result.errors.filter((e) => e.kind === "resource-load-failure");
    expect(resourceErrors.length).toBeGreaterThanOrEqual(1);
    expect(resourceErrors[0].message).toContain("stylesheet");
    expect(resourceErrors[0].message).toContain("styles.css");
  });

  it("does not capture non-critical resource failures (e.g. xhr)", async () => {
    const { navigateAndWait } = await import("../utils/browser.js");
    (navigateAndWait as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      const requestFailedCallbacks = getEventCallbacks("requestfailed");
      for (const cb of requestFailedCallbacks) {
        cb({
          url: () => "http://localhost:3000/api/data",
          resourceType: () => "xhr",
          failure: () => ({ errorText: "net::ERR_FAILED" }),
        });
      }
    });

    const result = await capturePageErrors("http://localhost:3000");

    const resourceErrors = result.errors.filter((e) => e.kind === "resource-load-failure");
    expect(resourceErrors).toHaveLength(0);
  });

  it("handles clean pages with no errors", async () => {
    const result = await capturePageErrors("http://localhost:3000");

    expect(result.totalCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.countByKind.exception).toBe(0);
    expect(result.countByKind["unhandled-rejection"]).toBe(0);
    expect(result.countByKind["resource-load-failure"]).toBe(0);
  });
});

// ── Tests: formatConsoleReport ───────────────────────────────────

describe("formatConsoleReport", () => {
  it("produces readable markdown output for console logs", () => {
    const result = {
      url: "http://localhost:3000",
      timestamp: "2025-01-01T00:00:00.000Z",
      entries: [
        { level: "error" as const, text: "Failed to fetch", timestamp: "t", location: "app.js" },
        { level: "warn" as const, text: "Deprecated API", timestamp: "t" },
      ],
      uncaughtExceptions: ["TypeError: null is not an object"],
      totalCount: 2,
      countByLevel: { log: 0, warn: 1, error: 1, info: 0, debug: 0 },
    };

    const report = formatConsoleReport(result);

    expect(report).toContain("Console Log Report");
    expect(report).toContain("**Total messages:** 2");
    expect(report).toContain("[ERROR]");
    expect(report).toContain("Failed to fetch");
    expect(report).toContain("[WARN]");
    expect(report).toContain("Deprecated API");
    expect(report).toContain("Uncaught Exceptions");
    expect(report).toContain("TypeError");
  });

  it("shows 'no console messages' when entries are empty", () => {
    const result = {
      url: "http://localhost:3000",
      timestamp: "2025-01-01T00:00:00.000Z",
      entries: [] as readonly ConsoleEntry[],
      uncaughtExceptions: [] as readonly string[],
      totalCount: 0,
      countByLevel: { log: 0, warn: 0, error: 0, info: 0, debug: 0 },
    };

    const report = formatConsoleReport(result);

    expect(report).toContain("No console messages captured");
  });
});

// ── Tests: formatNetworkReport ───────────────────────────────────

describe("formatNetworkReport", () => {
  it("produces readable markdown output for network requests", () => {
    const result = {
      url: "http://localhost:3000",
      timestamp: "2025-01-01T00:00:00.000Z",
      entries: [
        {
          url: "http://localhost:3000/app.js",
          method: "GET",
          resourceType: "script",
          status: 200,
          size: 10240,
          duration: 50,
          failed: false,
        },
        {
          url: "http://localhost:3000/missing.css",
          method: "GET",
          resourceType: "stylesheet",
          status: 0,
          size: 0,
          duration: 10,
          failed: true,
          failureReason: "net::ERR_FILE_NOT_FOUND",
        },
      ] as readonly NetworkEntry[],
      summary: {
        totalRequests: 2,
        failedRequests: 1,
        totalTransferSize: 10240,
        byType: [
          { type: "script", count: 1, totalSize: 10240 },
          { type: "stylesheet", count: 1, totalSize: 0 },
        ],
      },
    };

    const report = formatNetworkReport(result);

    expect(report).toContain("Network Request Report");
    expect(report).toContain("**Total requests:** 2");
    expect(report).toContain("**Failed requests:** 1");
    expect(report).toContain("script");
    expect(report).toContain("Failed Requests");
    expect(report).toContain("net::ERR_FILE_NOT_FOUND");
  });

  it("shows 'no network requests' when entries are empty", () => {
    const result = {
      url: "http://localhost:3000",
      timestamp: "2025-01-01T00:00:00.000Z",
      entries: [] as readonly NetworkEntry[],
      summary: {
        totalRequests: 0,
        failedRequests: 0,
        totalTransferSize: 0,
        byType: [],
      },
    };

    const report = formatNetworkReport(result);

    expect(report).toContain("No network requests captured");
  });
});

// ── Tests: formatErrorReport ─────────────────────────────────────

describe("formatErrorReport", () => {
  it("produces readable markdown output for page errors", () => {
    const result = {
      url: "http://localhost:3000",
      timestamp: "2025-01-01T00:00:00.000Z",
      errors: [
        {
          kind: "exception" as const,
          message: "TypeError: Cannot read properties of null",
          timestamp: "t",
          source: "at http://localhost:3000/app.js:10:5",
        },
        {
          kind: "resource-load-failure" as const,
          message: "Failed to load image: http://localhost:3000/logo.png",
          timestamp: "t",
          source: "http://localhost:3000/logo.png",
        },
      ] as readonly PageError[],
      totalCount: 2,
      countByKind: { exception: 1, "unhandled-rejection": 0, "resource-load-failure": 1 },
    };

    const report = formatErrorReport(result);

    expect(report).toContain("Page Error Report");
    expect(report).toContain("**Total errors:** 2");
    expect(report).toContain("[exception]");
    expect(report).toContain("TypeError");
    expect(report).toContain("[resource-load-failure]");
    expect(report).toContain("logo.png");
  });

  it("shows 'no errors' when error list is empty", () => {
    const result = {
      url: "http://localhost:3000",
      timestamp: "2025-01-01T00:00:00.000Z",
      errors: [] as readonly PageError[],
      totalCount: 0,
      countByKind: { exception: 0, "unhandled-rejection": 0, "resource-load-failure": 0 },
    };

    const report = formatErrorReport(result);

    expect(report).toContain("No errors captured");
  });
});
