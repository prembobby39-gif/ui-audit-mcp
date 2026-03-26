import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { captureScreenshot, captureResponsiveScreenshots } from "./tools/screenshot.js";
import { runAccessibilityAudit, formatAccessibilityReport } from "./tools/accessibility.js";
import { measurePerformance, formatPerformanceReport } from "./tools/performance.js";
import { analyzeCode, formatCodeAnalysisReport } from "./tools/code-analysis.js";
import { runLighthouse, formatLighthouseReport } from "./tools/lighthouse.js";
import { runFullReview, formatFullReviewReport } from "./tools/full-review.js";
import { generateHtmlReport } from "./tools/html-report.js";
import { checkDarkMode } from "./tools/dark-mode.js";
import { compareScreenshots } from "./tools/compare.js";
import { crawlAndReview, formatCrawlReport } from "./tools/crawl.js";
import {
  saveBaseline,
  loadBaseline,
  compareToBaseline,
  formatBaselineComparison,
} from "./tools/baselines.js";
import {
  checkBudgets,
  loadBudgetsFromConfig,
  formatBudgetReport,
} from "./tools/budgets.js";
import { closeBrowser } from "./utils/browser.js";
import type { BaselineData } from "./types.js";
import {
  UI_REVIEW_PROMPT,
  RESPONSIVE_REVIEW_PROMPT,
  QUICK_DESIGN_PROMPT,
} from "./prompts/review.js";

// ── Baseline Data Collection ───────────────────────────────────────

/**
 * Run audits and extract a BaselineData snapshot for the given URL.
 * Used by save_baseline, compare_to_baseline, and check_budgets tools.
 */
async function collectBaselineData(url: string): Promise<BaselineData> {
  const [accessibility, performance, lighthouseResult] = await Promise.all([
    runAccessibilityAudit(url),
    measurePerformance(url),
    runLighthouseSafe(url),
  ]);

  return {
    url,
    timestamp: new Date().toISOString(),
    lighthouseScores: {
      performance: lighthouseResult?.scores.performance ?? null,
      accessibility: lighthouseResult?.scores.accessibility ?? null,
      bestPractices: lighthouseResult?.scores.bestPractices ?? null,
      seo: lighthouseResult?.scores.seo ?? null,
    },
    accessibilityViolationCount: accessibility.violations.length,
    performanceMetrics: {
      fcp: performance.firstContentfulPaint,
      lcp: performance.largestContentfulPaint,
      cls: performance.cumulativeLayoutShift,
      tbt: performance.totalBlockingTime,
    },
    codeIssueCount: 0,
  };
}

/**
 * Attempt to run Lighthouse, returning null on any failure.
 */
async function runLighthouseSafe(
  url: string
): Promise<Awaited<ReturnType<typeof runLighthouse>> | null> {
  try {
    return await runLighthouse(url);
  } catch {
    return null;
  }
}

// ── Server Creation ────────────────────────────────────────────────

export function createServer(): McpServer {
  const server = new McpServer({
    name: "uimax",
    version: "0.5.0",
    // 0.2.0: Dark mode detection, 25+ code rules, framework detection fix
  });

  // ── Primary Tools (automated pipeline) ────────────────────────

  server.tool(
    "review_ui",
    `THE PRIMARY TOOL — Fully automated UI review pipeline. Captures a screenshot, runs accessibility/performance/code audits, then returns ALL data along with an expert frontend review methodology so you can generate a comprehensive review and implement fixes.

Use this when the user asks to "review my UI", "audit my frontend", or "find UI issues". After receiving the results, you MUST:
1. Study the screenshot carefully for visual/UX issues
2. Analyze the audit data following the expert methodology provided
3. Generate a comprehensive review with SPECIFIC fixes (exact CSS values, code changes)
4. Implement the fixes directly in the codebase

This tool is FREE — it runs entirely within Claude Code using the user's existing plan. No API keys needed.`,
    {
      url: z.string().url().describe("URL of the running application (e.g., http://localhost:3000)"),
      codeDirectory: z.string().describe("Absolute path to the frontend source directory (e.g., /Users/me/project/src)"),
      width: z.number().optional().default(1440).describe("Viewport width in pixels"),
      height: z.number().optional().default(900).describe("Viewport height in pixels"),
    },
    async ({ url, codeDirectory, width, height }) => {
      try {
        // Collect all audit data
        const auditData = await runFullReview(url, codeDirectory, {
          width: width ?? 1440,
          height: height ?? 900,
        });

        const auditReport = formatFullReviewReport(auditData);

        // Return screenshot + data + expert prompt to Claude Code
        // Claude Code (on the user's Pro plan) generates the expert review itself
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `# UIMax Data Collection Complete`,
                ``,
                `**URL:** ${url}`,
                `**Code Directory:** ${codeDirectory}`,
                `**Timestamp:** ${auditData.timestamp}`,
                `**Accessibility violations:** ${auditData.accessibility.violations.length}`,
                `**Accessibility passes:** ${auditData.accessibility.passes}`,
                `**Load time:** ${auditData.performance.loadTime.toFixed(0)}ms`,
                `**DOM nodes:** ${auditData.performance.domNodes}`,
                `**Code files analyzed:** ${auditData.codeAnalysis.totalFiles}`,
                `**Code findings:** ${auditData.codeAnalysis.findings.length}`,
                `**Framework detected:** ${auditData.codeAnalysis.framework}`,
                ...(auditData.lighthouse
                  ? [
                      `**Lighthouse Performance:** ${auditData.lighthouse.scores.performance ?? "N/A"}`,
                      `**Lighthouse Accessibility:** ${auditData.lighthouse.scores.accessibility ?? "N/A"}`,
                      `**Lighthouse Best Practices:** ${auditData.lighthouse.scores.bestPractices ?? "N/A"}`,
                      `**Lighthouse SEO:** ${auditData.lighthouse.scores.seo ?? "N/A"}`,
                    ]
                  : [`**Lighthouse:** skipped (timed out or unavailable)`]),
                ``,
                `---`,
                ``,
                `## Screenshot of the live UI — study this carefully:`,
              ].join("\n"),
            },
            {
              type: "image" as const,
              data: auditData.screenshot.base64,
              mimeType: auditData.screenshot.mimeType,
            },
            {
              type: "text" as const,
              text: [
                ``,
                `---`,
                ``,
                auditReport,
                ``,
                `---`,
                ``,
                `# Expert Review Instructions`,
                ``,
                `You now have everything you need. Follow the methodology below to generate a comprehensive expert UI review, then implement every fix.`,
                ``,
                UI_REVIEW_PROMPT,
                ``,
                `---`,
                ``,
                `# Implementation Instructions`,
                ``,
                `After generating your review, IMMEDIATELY implement the fixes:`,
                `1. Start with CRITICAL severity findings`,
                `2. Then HIGH, MEDIUM, LOW in order`,
                `3. For each finding, locate the exact file and apply the specific code change`,
                `4. After implementing all fixes, provide a summary of what was changed`,
                ``,
                `DO NOT just list the findings — actually edit the code files and fix them.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `UI review failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "export_report",
    `Generate a standalone HTML report file with all audit findings embedded. Runs the full review pipeline (screenshot, accessibility, performance, code analysis) and outputs a beautiful, shareable HTML file with zero external dependencies.

Use this when the user wants a downloadable/shareable report of their UI review.

This tool is FREE — runs entirely within Claude Code.`,
    {
      url: z.string().url().describe("URL of the running application (e.g., http://localhost:3000)"),
      codeDirectory: z.string().describe("Absolute path to the frontend source directory (e.g., /Users/me/project/src)"),
      outputPath: z.string().optional().describe("Output file path for the HTML report (defaults to ./uimax-report.html)"),
    },
    async ({ url, codeDirectory, outputPath }) => {
      try {
        const resolvedPath = resolve(outputPath ?? "./uimax-report.html");

        // Run the full audit pipeline
        const reviewData = await runFullReview(url, codeDirectory);

        // Generate the self-contained HTML report
        const html = generateHtmlReport(reviewData);

        // Write to disk
        await writeFile(resolvedPath, html, "utf-8");

        const violationCount = reviewData.accessibility.violations.length;
        const findingCount = reviewData.codeAnalysis.findings.length;
        const totalIssues = violationCount + findingCount;

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `# UIMax Report Exported`,
                ``,
                `**File:** ${resolvedPath}`,
                `**URL:** ${url}`,
                `**Timestamp:** ${reviewData.timestamp}`,
                ``,
                `## Summary`,
                `- Accessibility violations: ${violationCount}`,
                `- Code findings: ${findingCount}`,
                `- Total issues: ${totalIssues}`,
                `- Load time: ${reviewData.performance.loadTime.toFixed(0)}ms`,
                `- Files analyzed: ${reviewData.codeAnalysis.totalFiles}`,
                ``,
                `The HTML report is self-contained with all CSS inline and the screenshot embedded as base64. Open it in any browser to view or share.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Report export failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "quick_review",
    `Quick design-only review. Captures a screenshot and returns it with a focused design review methodology. No code analysis, no performance audit — just visual/UX feedback. Great for rapid design iteration.

After receiving the screenshot, analyze it as a senior UI designer and provide 5-10 high-impact observations with specific fixes.

This tool is FREE — runs entirely within Claude Code.`,
    {
      url: z.string().url().describe("URL of the page to review"),
    },
    async ({ url }) => {
      try {
        const screenshot = await captureScreenshot({
          url,
          width: 1440,
          height: 900,
          fullPage: true,
          delay: 1000,
          deviceScaleFactor: 2,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `# Quick Design Review\n\n**URL:** ${url}\n**Captured:** ${screenshot.timestamp}\n\nScreenshot:`,
            },
            {
              type: "image" as const,
              data: screenshot.base64,
              mimeType: screenshot.mimeType,
            },
            {
              type: "text" as const,
              text: [
                ``,
                `---`,
                ``,
                `# Review Methodology`,
                ``,
                QUICK_DESIGN_PROMPT,
                ``,
                `---`,
                ``,
                `After generating your design review, implement the fixes directly in the code.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Quick review failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Individual Data Collection Tools ──────────────────────────

  server.tool(
    "screenshot",
    "Capture a screenshot of a webpage. Returns a PNG image that you can visually analyze for design issues, layout problems, and UI quality.",
    {
      url: z.string().url().describe("URL of the page to screenshot (e.g., http://localhost:3000)"),
      width: z.number().optional().default(1440).describe("Viewport width in pixels"),
      height: z.number().optional().default(900).describe("Viewport height in pixels"),
      fullPage: z.boolean().optional().default(true).describe("Capture the full scrollable page"),
      delay: z.number().optional().default(1000).describe("Wait time in ms after page load before capturing"),
    },
    async ({ url, width, height, fullPage, delay }) => {
      try {
        const result = await captureScreenshot({
          url,
          width: width ?? 1440,
          height: height ?? 900,
          fullPage: fullPage ?? true,
          delay: delay ?? 1000,
          deviceScaleFactor: 2,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Screenshot captured: ${result.url} (${result.width}x${result.height}) at ${result.timestamp}`,
            },
            {
              type: "image" as const,
              data: result.base64,
              mimeType: result.mimeType,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Screenshot failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "responsive_screenshots",
    "Capture screenshots at mobile (375px), tablet (768px), and desktop (1440px) viewports. Perfect for reviewing responsive design.",
    {
      url: z.string().url().describe("URL of the page to capture"),
    },
    async ({ url }) => {
      try {
        const results = await captureResponsiveScreenshots(url);
        const labels = ["Mobile (375px)", "Tablet (768px)", "Desktop (1440px)"];

        const content = results.flatMap((result, i) => [
          {
            type: "text" as const,
            text: `### ${labels[i]}`,
          },
          {
            type: "image" as const,
            data: result.base64,
            mimeType: result.mimeType,
          },
        ]);

        content.push({
          type: "text" as const,
          text: [
            ``,
            `---`,
            ``,
            `# Responsive Review Methodology`,
            ``,
            RESPONSIVE_REVIEW_PROMPT,
          ].join("\n"),
        });

        return { content };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Responsive screenshots failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "check_dark_mode",
    "Detect whether a webpage supports dark mode. Captures two screenshots — one in light mode and one with prefers-color-scheme: dark emulated — then compares them. Returns both screenshots and a difference percentage. Great for checking if dark mode is properly implemented.",
    {
      url: z.string().url().describe("URL of the page to check"),
    },
    async ({ url }) => {
      try {
        const result = await checkDarkMode(url);

        const status = result.hasDarkMode
          ? `Dark mode DETECTED (${result.differencePercent}% difference between light and dark)`
          : "No dark mode detected — the page looks identical in light and dark mode";

        return {
          content: [
            {
              type: "text" as const,
              text: `# Dark Mode Check\n\n**URL:** ${url}\n**Result:** ${status}\n\n## Light Mode:`,
            },
            {
              type: "image" as const,
              data: result.lightScreenshot.base64,
              mimeType: result.lightScreenshot.mimeType,
            },
            {
              type: "text" as const,
              text: `\n## Dark Mode (emulated):`,
            },
            {
              type: "image" as const,
              data: result.darkScreenshot.base64,
              mimeType: result.darkScreenshot.mimeType,
            },
            {
              type: "text" as const,
              text: result.hasDarkMode
                ? `\n\nDark mode is implemented. Review both screenshots for contrast issues, missing dark variants, or elements that don't adapt properly.`
                : `\n\nNo dark mode support detected. Consider adding \`prefers-color-scheme: dark\` media queries or CSS custom properties for theming. This is increasingly expected by users — ~80% of mobile users prefer dark mode.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Dark mode check failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "compare_screenshots",
    "Before/after visual comparison with pixel-level diffing. Captures screenshots of two URLs at the same viewport size, computes an accurate pixel-level difference using pixelmatch, and returns BOTH images plus a red-highlighted diff image showing exactly which pixels changed. Use this to verify UI changes, compare staging vs production, or check before/after states of a redesign.",
    {
      urlA: z.string().url().describe("First URL — the 'before' state (e.g., http://localhost:3000)"),
      urlB: z.string().url().describe("Second URL — the 'after' state (e.g., http://localhost:3001)"),
      width: z.number().optional().default(1440).describe("Viewport width in pixels"),
      height: z.number().optional().default(900).describe("Viewport height in pixels"),
    },
    async ({ urlA, urlB, width, height }) => {
      try {
        const result = await compareScreenshots(urlA, urlB, {
          width: width ?? 1440,
          height: height ?? 900,
        });

        const diffSummary = result.differencePercent === 0
          ? "The two pages are visually IDENTICAL (0% pixel difference)"
          : `Visual difference detected: ${result.differencePercent}% of pixels differ (${result.pixelsChanged.toLocaleString()} pixels changed)`;

        const headerContent = [
          `# Screenshot Comparison (Pixel-Level Diff)`,
          ``,
          `**URL A (before):** ${result.urlA}`,
          `**URL B (after):** ${result.urlB}`,
          `**Viewport:** ${result.screenshotA.width}x${result.screenshotA.height}`,
          `**Diff dimensions:** ${result.dimensions.width}x${result.dimensions.height}`,
          `**Pixel difference:** ${result.differencePercent}%`,
          `**Pixels changed:** ${result.pixelsChanged.toLocaleString()} / ${(result.dimensions.width * result.dimensions.height).toLocaleString()}`,
          `**Result:** ${diffSummary}`,
          ``,
          `## Screenshot A (before):`,
        ].join("\n");

        const analysisContent = result.differencePercent > 0
          ? [
              ``,
              `---`,
              ``,
              `## Comparison Analysis`,
              ``,
              `The two pages differ by **${result.differencePercent}%** (${result.pixelsChanged.toLocaleString()} pixels). The diff image above highlights changed pixels in red. Compare all three images:`,
              `- Look for layout shifts, spacing changes, or element repositioning`,
              `- Check for color or typography differences`,
              `- Identify any missing or newly added elements`,
              `- Note any responsive or alignment regressions`,
              ``,
              `**Timestamps:**`,
              `- A captured: ${result.screenshotA.timestamp}`,
              `- B captured: ${result.screenshotB.timestamp}`,
            ].join("\n")
          : [
              ``,
              `---`,
              ``,
              `## Comparison Analysis`,
              ``,
              `The two pages are **pixel-perfect identical**. No differences detected between the before and after states.`,
              ``,
              `**Timestamps:**`,
              `- A captured: ${result.screenshotA.timestamp}`,
              `- B captured: ${result.screenshotB.timestamp}`,
            ].join("\n");

        const content: Array<
          | { type: "text"; text: string }
          | { type: "image"; data: string; mimeType: "image/png" }
        > = [
          { type: "text" as const, text: headerContent },
          {
            type: "image" as const,
            data: result.screenshotA.base64,
            mimeType: result.screenshotA.mimeType,
          },
          { type: "text" as const, text: `\n## Screenshot B (after):` },
          {
            type: "image" as const,
            data: result.screenshotB.base64,
            mimeType: result.screenshotB.mimeType,
          },
        ];

        // Only include the diff image when there are actual differences
        if (result.differencePercent > 0) {
          content.push(
            { type: "text" as const, text: `\n## Diff Image (changed pixels in red):` },
            {
              type: "image" as const,
              data: result.diffImage,
              mimeType: "image/png" as const,
            },
          );
        }

        content.push({ type: "text" as const, text: analysisContent });

        return { content };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Screenshot comparison failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "accessibility_audit",
    "Run an automated accessibility audit using axe-core. Checks for WCAG 2.1 Level A and AA violations, reporting issues by severity with specific fix instructions.",
    {
      url: z.string().url().describe("URL of the page to audit"),
    },
    async ({ url }) => {
      try {
        const result = await runAccessibilityAudit(url);
        const report = formatAccessibilityReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Accessibility audit failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "performance_audit",
    "Measure Core Web Vitals and performance metrics: FCP, LCP, CLS, TBT, load time, resource count, DOM size, and JS heap usage.",
    {
      url: z.string().url().describe("URL of the page to measure"),
    },
    async ({ url }) => {
      try {
        const result = await measurePerformance(url);
        const report = formatPerformanceReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Performance audit failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "lighthouse_audit",
    "Run a full Lighthouse audit against a URL. Returns scores for Performance, Accessibility, Best Practices, and SEO (0-100), plus detailed audit findings for render-blocking resources, image optimization, unused code, and more. Heavier than performance_audit but provides industry-standard Lighthouse scores.",
    {
      url: z.string().url().describe("URL of the page to audit (e.g., http://localhost:3000)"),
    },
    async ({ url }) => {
      try {
        const result = await runLighthouse(url);
        const report = formatLighthouseReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Lighthouse audit failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "analyze_code",
    "Analyze frontend source code for quality issues: accessibility anti-patterns, CSS problems, component complexity, design inconsistencies, and performance concerns.",
    {
      directory: z.string().describe("Absolute path to the frontend source directory (e.g., /Users/me/project/src)"),
    },
    async ({ directory }) => {
      try {
        const result = await analyzeCode(directory);
        const report = formatCodeAnalysisReport(result);

        return {
          content: [
            { type: "text" as const, text: report },
            {
              type: "text" as const,
              text: `\n\n<raw_data>\n${JSON.stringify(result, null, 2)}\n</raw_data>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Code analysis failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "crawl_and_review",
    `Crawl multiple pages from a starting URL and run accessibility + performance audits on each. Discovers internal links from the start page, deduplicates them, and visits up to maxPages (default 5, max 10). Each page gets a screenshot, axe-core accessibility audit, and Performance API metrics. Does NOT run Lighthouse (too slow for multi-page). Use this to audit an entire site section quickly.

This tool is FREE — runs entirely within Claude Code.`,
    {
      url: z.string().url().describe("Starting URL to crawl from (e.g., http://localhost:3000)"),
      maxPages: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum number of pages to audit (1-10, default 5)"),
      codeDir: z
        .string()
        .optional()
        .describe("Optional code directory path (reserved for future use)"),
    },
    async ({ url, maxPages }) => {
      try {
        const result = await crawlAndReview(url, maxPages);
        const report = formatCrawlReport(result);

        // Build content: text report + screenshots for each page
        const content: Array<
          | { type: "text"; text: string }
          | { type: "image"; data: string; mimeType: "image/png" }
        > = [
          {
            type: "text" as const,
            text: report,
          },
        ];

        // Append screenshots for each successfully audited page
        for (const page of result.pages) {
          if (page.screenshot) {
            content.push({
              type: "text" as const,
              text: `\n### Screenshot: ${page.url}`,
            });
            content.push({
              type: "image" as const,
              data: page.screenshot.base64,
              mimeType: page.screenshot.mimeType,
            });
          }
        }

        return { content };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Crawl and review failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Baseline & Budget Tools ──────────────────────────────────

  server.tool(
    "save_baseline",
    `Save the current audit state for a URL as a baseline snapshot. Runs screenshot, accessibility, performance, and Lighthouse audits, then saves the results to .uimax-history.json in the project directory. Use this to establish a baseline before making changes, so you can compare later.

This tool is FREE — runs entirely within Claude Code.`,
    {
      url: z.string().url().describe("URL of the running application (e.g., http://localhost:3000)"),
      codeDir: z.string().optional().describe("Project directory for saving .uimax-history.json (defaults to cwd)"),
    },
    async ({ url, codeDir }) => {
      try {
        const auditResults = await collectBaselineData(url);
        const entry = await saveBaseline(url, auditResults, codeDir);

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `# Baseline Saved`,
                ``,
                `**URL:** ${url}`,
                `**Timestamp:** ${entry.timestamp}`,
                `**Lighthouse Performance:** ${auditResults.lighthouseScores.performance ?? "N/A"}`,
                `**Lighthouse Accessibility:** ${auditResults.lighthouseScores.accessibility ?? "N/A"}`,
                `**Accessibility Violations:** ${auditResults.accessibilityViolationCount}`,
                `**FCP:** ${auditResults.performanceMetrics.fcp ?? "N/A"}ms`,
                `**LCP:** ${auditResults.performanceMetrics.lcp ?? "N/A"}ms`,
                `**CLS:** ${auditResults.performanceMetrics.cls ?? "N/A"}`,
                `**TBT:** ${auditResults.performanceMetrics.tbt ?? "N/A"}ms`,
                ``,
                `Baseline saved to .uimax-history.json. Use \`compare_to_baseline\` after making changes to see what improved or regressed.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Save baseline failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "compare_to_baseline",
    `Compare the current audit state of a URL against its most recent saved baseline. Runs fresh audits, loads the previous baseline from .uimax-history.json, and shows what improved and what regressed. Use this after making changes to verify you improved the metrics you intended.

This tool is FREE — runs entirely within Claude Code.`,
    {
      url: z.string().url().describe("URL of the running application (e.g., http://localhost:3000)"),
      codeDir: z.string().optional().describe("Project directory containing .uimax-history.json (defaults to cwd)"),
    },
    async ({ url, codeDir }) => {
      try {
        const previousEntry = await loadBaseline(url, codeDir);
        if (!previousEntry) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No baseline found for ${url}. Run \`save_baseline\` first to establish a baseline.`,
              },
            ],
          };
        }

        const currentData = await collectBaselineData(url);
        const comparison = compareToBaseline(currentData, previousEntry.data);
        const report = formatBaselineComparison(comparison);

        // Also save the new baseline
        await saveBaseline(url, currentData, codeDir);

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `# Baseline Comparison Results`,
                ``,
                report,
                ``,
                `---`,
                ``,
                `The current results have been saved as the new baseline.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Baseline comparison failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "check_budgets",
    `Check if the current site meets performance budgets defined in .uimaxrc.json. Runs fresh audits and compares results against budget thresholds for Lighthouse scores, Web Vitals, accessibility violations, and code issues. Returns pass/fail with details of any exceeded budgets.

Configure budgets in .uimaxrc.json under the "budgets" key:
{
  "budgets": {
    "lighthouse": { "performance": 90, "accessibility": 95 },
    "webVitals": { "lcp": 2500, "cls": 0.1 },
    "maxAccessibilityViolations": 0
  }
}

This tool is FREE — runs entirely within Claude Code.`,
    {
      url: z.string().url().describe("URL of the running application (e.g., http://localhost:3000)"),
      codeDir: z.string().optional().describe("Project directory containing .uimaxrc.json with budget config (defaults to cwd)"),
    },
    async ({ url, codeDir }) => {
      try {
        const budgets = await loadBudgetsFromConfig(codeDir);
        if (!budgets) {
          return {
            content: [
              {
                type: "text" as const,
                text: [
                  `# No Performance Budgets Configured`,
                  ``,
                  `No \`budgets\` key found in .uimaxrc.json. Add budgets to your config:`,
                  ``,
                  '```json',
                  `{`,
                  `  "budgets": {`,
                  `    "lighthouse": { "performance": 90, "accessibility": 95 },`,
                  `    "webVitals": { "lcp": 2500, "cls": 0.1, "fcp": 1800, "tbt": 300 },`,
                  `    "maxAccessibilityViolations": 0,`,
                  `    "maxCodeIssues": 10`,
                  `  }`,
                  `}`,
                  '```',
                ].join("\n"),
              },
            ],
          };
        }

        const currentData = await collectBaselineData(url);
        const result = checkBudgets(currentData, budgets);
        const report = formatBudgetReport(result);

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `# Budget Check Results`,
                ``,
                `**URL:** ${url}`,
                `**Timestamp:** ${currentData.timestamp}`,
                ``,
                report,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Budget check failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Prompts ────────────────────────────────────────────────────

  server.prompt(
    "ui-review",
    "Comprehensive UI review methodology. Use this prompt after running the review_ui tool to get expert-level analysis of the collected data.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: UI_REVIEW_PROMPT,
          },
        },
      ],
    })
  );

  server.prompt(
    "responsive-review",
    "Responsive design review methodology. Use after capturing responsive_screenshots to analyze layout across mobile, tablet, and desktop.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: RESPONSIVE_REVIEW_PROMPT,
          },
        },
      ],
    })
  );

  server.prompt(
    "quick-design-review",
    "Quick design-only review. Use after taking a screenshot when you just want visual/UX feedback without code analysis.",
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: QUICK_DESIGN_PROMPT,
          },
        },
      ],
    })
  );

  // ── Cleanup ────────────────────────────────────────────────────

  process.on("SIGINT", async () => {
    await closeBrowser();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await closeBrowser();
    process.exit(0);
  });

  return server;
}
