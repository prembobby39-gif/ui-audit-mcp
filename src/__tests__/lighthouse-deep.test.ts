import { describe, it, expect } from "vitest";
import {
  extractPwaReadiness,
  extractSecurityAudit,
  extractUnusedCode,
  extractLcpOptimization,
  extractResourceAnalysis,
  formatPwaReport,
  formatSecurityReport,
  formatUnusedCodeReport,
  formatLcpReport,
  formatResourceReport,
} from "../tools/lighthouse-deep.js";

// ── Mock LHR Factory ────────────────────────────────────────────────

function makeMockLhr(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    audits: {
      // PWA audits
      "installable-manifest": {
        id: "installable-manifest",
        title: "Web app manifest meets installability requirements",
        description: "Browsers can proactively prompt users to add your app.",
        score: 1,
      },
      "service-worker": {
        id: "service-worker",
        title: "Registers a service worker",
        description: "The service worker is the technology that enables your app to use many PWA features.",
        score: 0,
      },
      "is-on-https": {
        id: "is-on-https",
        title: "Uses HTTPS",
        description: "All sites should be protected with HTTPS.",
        score: 1,
      },
      "webapp-install-banner": {
        id: "webapp-install-banner",
        title: "User can be prompted to install the web app",
        description: "Browsers can proactively prompt users to add your app to their homescreen.",
        score: 0,
      },
      "works-offline": {
        id: "works-offline",
        title: "Current page responds with a 200 when offline",
        description: "If you are building a Progressive Web App, consider using a service worker.",
        score: 0,
      },
      "splash-screen": {
        id: "splash-screen",
        title: "Configured for a custom splash screen",
        description: "A themed splash screen ensures a high-quality experience.",
        score: 0,
      },
      "themed-omnibox": {
        id: "themed-omnibox",
        title: "Sets a theme color for the address bar",
        description: "The browser address bar can be themed to match your site.",
        score: 1,
      },
      "viewport": {
        id: "viewport",
        title: "Has a `<meta name=\"viewport\">` tag with `width` or `initial-scale`",
        description: "A `<meta name=\"viewport\">` optimizes your app for mobile screens.",
        score: 1,
      },

      // Security audits
      "redirects-http": {
        id: "redirects-http",
        title: "Redirects HTTP traffic to HTTPS",
        description: "Make sure that you redirect all HTTP traffic to HTTPS.",
        score: 1,
      },
      "no-vulnerable-libraries": {
        id: "no-vulnerable-libraries",
        title: "Includes front-end JavaScript libraries with known security vulnerabilities",
        description: "Some third-party scripts may contain known security vulnerabilities.",
        score: 0,
        displayValue: "1 vulnerability detected",
        details: {
          items: [
            {
              detectedLib: { text: "jQuery@2.1.4" },
              vulnCount: 3,
            },
          ],
        },
      },
      "csp-xss": {
        id: "csp-xss",
        title: "Ensure CSP is effective against XSS attacks",
        description: "A strong Content Security Policy (CSP) significantly reduces the risk of cross-site scripting attacks.",
        score: 0,
        displayValue: "No CSP found",
      },
      "external-anchors-use-rel-noopener": {
        id: "external-anchors-use-rel-noopener",
        title: "Links to cross-origin destinations are safe",
        description: "Add rel=\"noopener\" or rel=\"noreferrer\" to external links.",
        score: 1,
      },
      "geolocation-on-start": {
        id: "geolocation-on-start",
        title: "Avoids requesting the geolocation permission on page load",
        description: "Users are mistrustful of pages that request their location without context.",
        score: 1,
      },
      "notification-on-start": {
        id: "notification-on-start",
        title: "Avoids requesting the notification permission on page load",
        description: "Users are mistrustful of pages that request to send notifications without context.",
        score: 1,
      },

      // Unused code audits
      "unused-javascript": {
        id: "unused-javascript",
        title: "Reduce unused JavaScript",
        description: "Reduce unused JavaScript to decrease bytes consumed by network activity.",
        score: 0.4,
        displayValue: "Potential savings of 150 KiB",
        details: {
          items: [
            { url: "https://example.com/static/js/vendor.js", totalBytes: 200000, wastedBytes: 120000 },
            { url: "https://example.com/static/js/app.js", totalBytes: 80000, wastedBytes: 30000 },
          ],
        },
      },
      "unused-css-rules": {
        id: "unused-css-rules",
        title: "Reduce unused CSS",
        description: "Reduce unused CSS to decrease bytes consumed by network activity.",
        score: 0.6,
        displayValue: "Potential savings of 25 KiB",
        details: {
          items: [
            { url: "https://example.com/static/css/styles.css", totalBytes: 50000, wastedBytes: 25000 },
          ],
        },
      },

      // LCP audits
      "largest-contentful-paint": {
        id: "largest-contentful-paint",
        title: "Largest Contentful Paint",
        description: "Largest Contentful Paint marks the time at which the largest text or image is painted.",
        score: 0.3,
        numericValue: 4200,
        numericUnit: "millisecond",
        displayValue: "4.2 s",
      },
      "largest-contentful-paint-element": {
        id: "largest-contentful-paint-element",
        title: "Largest Contentful Paint element",
        description: "This is the largest contentful element painted within the viewport.",
        score: null,
        details: {
          items: [
            {
              node: {
                snippet: "<img src=\"/hero.jpg\" alt=\"Hero Image\">",
              },
            },
          ],
        },
      },
      "server-response-time": {
        id: "server-response-time",
        title: "Initial server response time was short",
        description: "Keep the server response time for the main document short.",
        score: 0.5,
        numericValue: 800,
        displayValue: "Root document took 800 ms",
      },
      "render-blocking-resources": {
        id: "render-blocking-resources",
        title: "Eliminate render-blocking resources",
        description: "Resources are blocking the first paint of your page.",
        score: 0,
        details: {
          items: [
            { url: "https://example.com/static/css/main.css", totalBytes: 45000 },
            { url: "https://example.com/static/js/critical.js", totalBytes: 30000 },
          ],
        },
      },
      "uses-optimized-images": {
        id: "uses-optimized-images",
        title: "Efficiently encode images",
        description: "Optimized images load faster and consume less cellular data.",
        score: 0.5,
      },
      "lcp-lazy-loaded": {
        id: "lcp-lazy-loaded",
        title: "Largest Contentful Paint image was not lazily loaded",
        description: "Above-the-fold images that are lazily loaded render later in the page lifecycle.",
        score: 1,
        details: {
          items: [
            { wastedMs: 500 },
          ],
        },
      },

      // Network/resource audits
      "network-requests": {
        id: "network-requests",
        title: "Network Requests",
        description: "Lists the network requests that were made during page load.",
        score: null,
        details: {
          items: [
            { url: "https://example.com/", transferSize: 15000, mimeType: "text/html" },
            { url: "https://example.com/static/js/vendor.js", transferSize: 200000, mimeType: "application/javascript" },
            { url: "https://example.com/static/js/app.js", transferSize: 80000, mimeType: "application/javascript" },
            { url: "https://example.com/static/css/main.css", transferSize: 45000, mimeType: "text/css" },
            { url: "https://example.com/hero.jpg", transferSize: 350000, mimeType: "image/jpeg" },
            { url: "https://example.com/logo.png", transferSize: 12000, mimeType: "image/png" },
            { url: "https://fonts.googleapis.com/css2?family=Inter", transferSize: 5000, mimeType: "font/woff2" },
            { url: "https://example.com/api/data.json", transferSize: 3000, mimeType: "application/json" },
          ],
        },
      },
    },
    categories: {
      performance: { score: 0.65 },
      accessibility: { score: 0.92 },
      "best-practices": { score: 0.78 },
      seo: { score: 0.85 },
    },
    requestedUrl: "https://example.com",
    fetchTime: "2026-03-26T10:00:00.000Z",
    lighthouseVersion: "13.0.0",
    runWarnings: [],
    ...overrides,
  };
}

function makeEmptyLhr(): Record<string, unknown> {
  return { audits: {}, categories: {} };
}

// ── extractPwaReadiness Tests ───────────────────────────────────────

describe("extractPwaReadiness", () => {
  it("extracts pass/fail for each core PWA requirement", () => {
    const result = extractPwaReadiness(makeMockLhr());

    expect(result.installable).toBe(true);
    expect(result.serviceWorker).toBe(false);
    expect(result.https).toBe(true);
    expect(result.manifest).toBe(false);
    expect(result.offlineCapable).toBe(false);
  });

  it("sets overallReady to false when any core check fails", () => {
    const result = extractPwaReadiness(makeMockLhr());
    expect(result.overallReady).toBe(false);
  });

  it("sets overallReady to true when all core checks pass", () => {
    const allPassLhr = makeMockLhr();
    const audits = allPassLhr["audits"] as Record<string, Record<string, unknown>>;
    audits["service-worker"] = { ...audits["service-worker"], score: 1 };
    audits["webapp-install-banner"] = { ...audits["webapp-install-banner"], score: 1 };
    audits["works-offline"] = { ...audits["works-offline"], score: 1 };

    const result = extractPwaReadiness(allPassLhr);
    expect(result.overallReady).toBe(true);
  });

  it("includes additional PWA checks when present", () => {
    const result = extractPwaReadiness(makeMockLhr());
    const ids = result.checks.map((c) => c.id);
    expect(ids).toContain("splash-screen");
    expect(ids).toContain("themed-omnibox");
    expect(ids).toContain("viewport");
  });

  it("handles empty LHR gracefully", () => {
    const result = extractPwaReadiness(makeEmptyLhr());
    expect(result.installable).toBe(false);
    expect(result.serviceWorker).toBe(false);
    expect(result.overallReady).toBe(false);
    expect(result.checks.length).toBeGreaterThanOrEqual(5);
  });
});

// ── extractSecurityAudit Tests ──────────────────────────────────────

describe("extractSecurityAudit", () => {
  it("detects HTTPS usage", () => {
    const result = extractSecurityAudit(makeMockLhr());
    expect(result.httpsUsed).toBe(true);
  });

  it("counts passed and failed findings", () => {
    const result = extractSecurityAudit(makeMockLhr());
    expect(result.totalPassed).toBeGreaterThan(0);
    expect(result.totalFailed).toBeGreaterThan(0);
    expect(result.totalPassed + result.totalFailed).toBe(result.findings.length);
  });

  it("extracts vulnerable libraries", () => {
    const result = extractSecurityAudit(makeMockLhr());
    expect(result.vulnerableLibraries.length).toBe(1);
    expect(result.vulnerableLibraries[0]).toContain("jQuery@2.1.4");
  });

  it("assigns correct severity to findings", () => {
    const result = extractSecurityAudit(makeMockLhr());
    const httpsFinding = result.findings.find((f) => f.id === "is-on-https");
    expect(httpsFinding?.severity).toBe("critical");

    const cspFinding = result.findings.find((f) => f.id === "csp-xss");
    expect(cspFinding?.severity).toBe("high");
  });

  it("handles empty LHR gracefully", () => {
    const result = extractSecurityAudit(makeEmptyLhr());
    expect(result.httpsUsed).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.vulnerableLibraries).toEqual([]);
  });
});

// ── extractUnusedCode Tests ─────────────────────────────────────────

describe("extractUnusedCode", () => {
  it("extracts unused JavaScript entries", () => {
    const result = extractUnusedCode(makeMockLhr());
    expect(result.unusedJavascript.length).toBe(2);
    expect(result.unusedJavascript[0].url).toContain("vendor.js");
    expect(result.unusedJavascript[0].totalBytes).toBe(200000);
    expect(result.unusedJavascript[0].unusedBytes).toBe(120000);
  });

  it("extracts unused CSS entries", () => {
    const result = extractUnusedCode(makeMockLhr());
    expect(result.unusedCss.length).toBe(1);
    expect(result.unusedCss[0].url).toContain("styles.css");
  });

  it("computes total potential savings", () => {
    const result = extractUnusedCode(makeMockLhr());
    const expectedTotal = 120000 + 30000 + 25000;
    expect(result.totalPotentialSavingsBytes).toBe(expectedTotal);
    expect(result.totalPotentialSavingsKb).toBe(Math.round(expectedTotal / 1024));
  });

  it("handles empty LHR gracefully", () => {
    const result = extractUnusedCode(makeEmptyLhr());
    expect(result.unusedJavascript).toEqual([]);
    expect(result.unusedCss).toEqual([]);
    expect(result.totalPotentialSavingsBytes).toBe(0);
  });
});

// ── extractLcpOptimization Tests ────────────────────────────────────

describe("extractLcpOptimization", () => {
  it("extracts LCP time and score", () => {
    const result = extractLcpOptimization(makeMockLhr());
    expect(result.lcpTimeMs).toBe(4200);
    expect(result.lcpScore).toBe(0.3);
  });

  it("extracts LCP element snippet", () => {
    const result = extractLcpOptimization(makeMockLhr());
    expect(result.lcpElement).toContain("hero.jpg");
  });

  it("extracts TTFB", () => {
    const result = extractLcpOptimization(makeMockLhr());
    expect(result.ttfbMs).toBe(800);
  });

  it("provides optimization suggestions for slow LCP", () => {
    const result = extractLcpOptimization(makeMockLhr());
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.some((s) => s.includes("2.5s"))).toBe(true);
  });

  it("handles empty LHR gracefully", () => {
    const result = extractLcpOptimization(makeEmptyLhr());
    expect(result.lcpTimeMs).toBeNull();
    expect(result.lcpElement).toBeNull();
    expect(result.ttfbMs).toBeNull();
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("calculates render delay", () => {
    const result = extractLcpOptimization(makeMockLhr());
    // renderDelay = lcpTime - ttfb - resourceLoadTime = 4200 - 800 - 500 = 2900
    expect(result.renderDelayMs).toBe(2900);
  });
});

// ── extractResourceAnalysis Tests ───────────────────────────────────

describe("extractResourceAnalysis", () => {
  it("computes total transfer size and request count", () => {
    const result = extractResourceAnalysis(makeMockLhr());
    expect(result.totalRequests).toBe(8);
    expect(result.totalTransferSizeBytes).toBe(
      15000 + 200000 + 80000 + 45000 + 350000 + 12000 + 5000 + 3000
    );
  });

  it("breaks down resources by type", () => {
    const result = extractResourceAnalysis(makeMockLhr());
    const jsBreakdown = result.breakdown.find((b) => b.type === "JavaScript");
    expect(jsBreakdown).toBeDefined();
    expect(jsBreakdown!.count).toBe(2);
    expect(jsBreakdown!.totalBytes).toBe(280000);
  });

  it("sorts largest resources by size descending", () => {
    const result = extractResourceAnalysis(makeMockLhr());
    expect(result.largestResources.length).toBeGreaterThan(0);
    expect(result.largestResources[0].url).toContain("hero.jpg");
  });

  it("extracts render-blocking resources", () => {
    const result = extractResourceAnalysis(makeMockLhr());
    expect(result.renderBlockingResources.length).toBe(2);
    expect(result.renderBlockingResources[0].url).toContain("main.css");
  });

  it("handles empty LHR gracefully", () => {
    const result = extractResourceAnalysis(makeEmptyLhr());
    expect(result.totalRequests).toBe(0);
    expect(result.totalTransferSizeBytes).toBe(0);
    expect(result.breakdown).toEqual([]);
    expect(result.largestResources).toEqual([]);
  });

  it("converts total size to KB", () => {
    const result = extractResourceAnalysis(makeMockLhr());
    expect(result.totalTransferSizeKb).toBe(
      Math.round(result.totalTransferSizeBytes / 1024)
    );
  });
});

// ── Format Function Tests ───────────────────────────────────────────

describe("formatPwaReport", () => {
  it("produces markdown with PWA heading", () => {
    const result = extractPwaReadiness(makeMockLhr());
    const report = formatPwaReport(result);
    expect(report).toContain("## PWA Readiness Audit");
    expect(report).toContain("Overall PWA Ready");
  });

  it("includes PASS and FAIL statuses", () => {
    const result = extractPwaReadiness(makeMockLhr());
    const report = formatPwaReport(result);
    expect(report).toContain("PASS");
    expect(report).toContain("FAIL");
  });

  it("lists missing requirements", () => {
    const result = extractPwaReadiness(makeMockLhr());
    const report = formatPwaReport(result);
    expect(report).toContain("Missing PWA Requirements");
  });
});

describe("formatSecurityReport", () => {
  it("produces markdown with security heading", () => {
    const result = extractSecurityAudit(makeMockLhr());
    const report = formatSecurityReport(result);
    expect(report).toContain("## Security Audit");
    expect(report).toContain("HTTPS");
  });

  it("lists vulnerable libraries section", () => {
    const result = extractSecurityAudit(makeMockLhr());
    const report = formatSecurityReport(result);
    expect(report).toContain("Vulnerable Libraries");
    expect(report).toContain("jQuery");
  });
});

describe("formatUnusedCodeReport", () => {
  it("produces markdown with unused code heading", () => {
    const result = extractUnusedCode(makeMockLhr());
    const report = formatUnusedCodeReport(result);
    expect(report).toContain("## Unused Code Analysis");
    expect(report).toContain("Total Potential Savings");
  });

  it("shows unused JS and CSS sections", () => {
    const result = extractUnusedCode(makeMockLhr());
    const report = formatUnusedCodeReport(result);
    expect(report).toContain("Unused JavaScript");
    expect(report).toContain("Unused CSS");
  });

  it("shows 'no unused code' message for empty results", () => {
    const result = extractUnusedCode(makeEmptyLhr());
    const report = formatUnusedCodeReport(result);
    expect(report).toContain("No unused code detected");
  });
});

describe("formatLcpReport", () => {
  it("produces markdown with LCP heading", () => {
    const result = extractLcpOptimization(makeMockLhr());
    const report = formatLcpReport(result);
    expect(report).toContain("## LCP Optimization Analysis");
    expect(report).toContain("LCP Time");
  });

  it("shows LCP element when available", () => {
    const result = extractLcpOptimization(makeMockLhr());
    const report = formatLcpReport(result);
    expect(report).toContain("LCP Element");
    expect(report).toContain("hero.jpg");
  });

  it("shows N/A for missing metrics", () => {
    const result = extractLcpOptimization(makeEmptyLhr());
    const report = formatLcpReport(result);
    expect(report).toContain("N/A");
  });
});

describe("formatResourceReport", () => {
  it("produces markdown with resource heading", () => {
    const result = extractResourceAnalysis(makeMockLhr());
    const report = formatResourceReport(result);
    expect(report).toContain("## Resource Analysis");
    expect(report).toContain("Total Transfer Size");
    expect(report).toContain("Total Requests");
  });

  it("shows breakdown by type", () => {
    const result = extractResourceAnalysis(makeMockLhr());
    const report = formatResourceReport(result);
    expect(report).toContain("Breakdown by Type");
    expect(report).toContain("JavaScript");
    expect(report).toContain("CSS");
    expect(report).toContain("Images");
  });

  it("shows render-blocking resources", () => {
    const result = extractResourceAnalysis(makeMockLhr());
    const report = formatResourceReport(result);
    expect(report).toContain("Render-Blocking Resources");
  });
});
