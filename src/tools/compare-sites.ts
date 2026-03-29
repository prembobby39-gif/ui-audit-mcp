// ── Compare Sites Tool ──────────────────────────────────────────────
//
// Competitive benchmarking: audits two URLs side-by-side and produces
// a comparison Report Card table with grades for both sites across
// all dimensions. Great for benchmarking against competitors.

import { captureScreenshot } from "./screenshot.js";
import { runAccessibilityAudit } from "./accessibility.js";
import { measurePerformance } from "./performance.js";
import { runSeoAudit } from "./seo.js";
import type {
  AccessibilityResult,
  PerformanceMetrics,
  ScreenshotResult,
} from "../types.js";
import type { SeoAuditResult } from "./seo.js";
import {
  computeAccessibilityGrade,
  computePerformanceGrade,
  scoreToGrade,
  formatGradeCompact,
  type GradeResult,
} from "../utils/grading.js";

// ── Types ────────────────────────────────────────────────────────────

export interface SiteAuditSnapshot {
  readonly url: string;
  readonly timestamp: string;
  readonly screenshot: ScreenshotResult;
  readonly accessibility: AccessibilityResult;
  readonly performance: PerformanceMetrics;
  readonly seo: SeoAuditResult | null;
  readonly grades: SiteGrades;
}

export interface SiteGrades {
  readonly accessibility: GradeResult;
  readonly performance: GradeResult;
  readonly seo: GradeResult;
  readonly overall: GradeResult;
}

export interface SiteComparisonResult {
  readonly timestamp: string;
  readonly siteA: SiteAuditSnapshot;
  readonly siteB: SiteAuditSnapshot;
  readonly comparison: readonly CategoryComparison[];
  readonly winner: "siteA" | "siteB" | "tie";
  readonly summary: string;
}

export interface CategoryComparison {
  readonly category: string;
  readonly siteAGrade: GradeResult;
  readonly siteBGrade: GradeResult;
  readonly winner: "siteA" | "siteB" | "tie";
  readonly delta: number;
}

// ── Main Function ────────────────────────────────────────────────────

/**
 * Audit two URLs side-by-side and produce a comparative analysis.
 * Runs accessibility, performance, and SEO audits on both sites concurrently.
 */
export async function compareSites(
  urlA: string,
  urlB: string
): Promise<SiteComparisonResult> {
  // Run all audits for both sites concurrently
  const [siteA, siteB] = await Promise.all([
    auditSite(urlA),
    auditSite(urlB),
  ]);

  // Build category comparisons
  const comparison = buildComparison(siteA.grades, siteB.grades);

  // Determine overall winner
  const winner = determineWinner(comparison);

  // Build summary
  const summary = buildSummary(urlA, urlB, comparison, winner);

  return {
    timestamp: new Date().toISOString(),
    siteA,
    siteB,
    comparison,
    winner,
    summary,
  };
}

// ── Site Audit ───────────────────────────────────────────────────────

async function auditSite(url: string): Promise<SiteAuditSnapshot> {
  const [screenshot, accessibility, performance, seo] = await Promise.all([
    captureScreenshot({
      url,
      width: 1440,
      height: 900,
      fullPage: true,
      delay: 1500,
      deviceScaleFactor: 2,
    }),
    runAccessibilityAudit(url),
    measurePerformance(url),
    runSeoSafe(url),
  ]);

  const grades = computeSiteGrades(accessibility, performance, seo);

  return {
    url,
    timestamp: new Date().toISOString(),
    screenshot,
    accessibility,
    performance,
    seo,
    grades,
  };
}

async function runSeoSafe(url: string): Promise<SeoAuditResult | null> {
  try {
    return await runSeoAudit(url);
  } catch {
    return null;
  }
}

// ── Grading ──────────────────────────────────────────────────────────

function computeSiteGrades(
  accessibility: AccessibilityResult,
  performance: PerformanceMetrics,
  seo: SeoAuditResult | null
): SiteGrades {
  const a11yGrade = computeAccessibilityGrade({
    lighthouseScore: null,
    violationCount: accessibility.violations.length,
    passCount: accessibility.passes,
  });

  const perfGrade = computePerformanceGrade({
    lighthouseScore: null,
    fcp: performance.firstContentfulPaint,
    lcp: performance.largestContentfulPaint,
    cls: performance.cumulativeLayoutShift,
    tbt: performance.totalBlockingTime,
  });

  const seoGrade = seo
    ? scoreToGrade(seo.score)
    : scoreToGrade(50);

  // Overall = weighted average: perf 35%, a11y 35%, seo 30%
  const overallScore = Math.round(
    a11yGrade.score * 0.35 +
    perfGrade.score * 0.35 +
    seoGrade.score * 0.30
  );
  const overall = scoreToGrade(overallScore);

  return {
    accessibility: a11yGrade,
    performance: perfGrade,
    seo: seoGrade,
    overall,
  };
}

// ── Comparison Logic ─────────────────────────────────────────────────

function buildComparison(
  gradesA: SiteGrades,
  gradesB: SiteGrades
): readonly CategoryComparison[] {
  const categories: readonly { key: keyof SiteGrades; label: string }[] = [
    { key: "accessibility", label: "Accessibility" },
    { key: "performance", label: "Performance" },
    { key: "seo", label: "SEO" },
    { key: "overall", label: "Overall" },
  ];

  return categories.map(({ key, label }) => {
    const a = gradesA[key];
    const b = gradesB[key];
    const delta = a.score - b.score;

    return {
      category: label,
      siteAGrade: a,
      siteBGrade: b,
      winner:
        delta > 0 ? "siteA" as const :
        delta < 0 ? "siteB" as const :
        "tie" as const,
      delta,
    };
  });
}

function determineWinner(
  comparison: readonly CategoryComparison[]
): "siteA" | "siteB" | "tie" {
  const overallEntry = comparison.find((c) => c.category === "Overall");
  if (overallEntry) return overallEntry.winner;

  let aWins = 0;
  let bWins = 0;
  for (const c of comparison) {
    if (c.winner === "siteA") aWins++;
    else if (c.winner === "siteB") bWins++;
  }

  if (aWins > bWins) return "siteA";
  if (bWins > aWins) return "siteB";
  return "tie";
}

function buildSummary(
  urlA: string,
  urlB: string,
  comparison: readonly CategoryComparison[],
  winner: "siteA" | "siteB" | "tie"
): string {
  const aWins = comparison.filter((c) => c.winner === "siteA" && c.category !== "Overall").length;
  const bWins = comparison.filter((c) => c.winner === "siteB" && c.category !== "Overall").length;

  if (winner === "tie") {
    return `${urlA} and ${urlB} are evenly matched across all categories.`;
  }

  const winnerUrl = winner === "siteA" ? urlA : urlB;
  const winCount = winner === "siteA" ? aWins : bWins;

  return `${winnerUrl} leads in ${winCount} of 3 categories.`;
}

// ── Formatting ───────────────────────────────────────────────────────

/**
 * Format the site comparison as a readable markdown report.
 */
export function formatSiteComparisonReport(result: SiteComparisonResult): string {
  const urlA = result.siteA.url;
  const urlB = result.siteB.url;

  // Shorten URLs for table headers
  const labelA = shortenUrl(urlA);
  const labelB = shortenUrl(urlB);

  const sections: string[] = [
    `## Competitive Benchmark`,
    ``,
    `**Compared:** ${result.timestamp}`,
    ``,
    `### Report Card`,
    ``,
    `| Category | ${labelA} | ${labelB} | Winner |`,
    `|----------|${"-".repeat(Math.max(labelA.length, 6))}|${"-".repeat(Math.max(labelB.length, 6))}|--------|`,
  ];

  for (const c of result.comparison) {
    const winIndicator =
      c.winner === "siteA" ? `✅ ${labelA}` :
      c.winner === "siteB" ? `✅ ${labelB}` :
      "🤝 Tie";

    const bold = c.category === "Overall" ? "**" : "";
    sections.push(
      `| ${bold}${c.category}${bold} | ${bold}${c.siteAGrade.grade}${bold} (${c.siteAGrade.score}) | ${bold}${c.siteBGrade.grade}${bold} (${c.siteBGrade.score}) | ${winIndicator} |`,
    );
  }

  sections.push(``);

  // Performance details
  sections.push(
    `### Performance Details`,
    ``,
    `| Metric | ${labelA} | ${labelB} |`,
    `|--------|${"-".repeat(Math.max(labelA.length, 6))}|${"-".repeat(Math.max(labelB.length, 6))}|`,
    `| Load Time | ${result.siteA.performance.loadTime.toFixed(0)}ms | ${result.siteB.performance.loadTime.toFixed(0)}ms |`,
    `| FCP | ${formatMs(result.siteA.performance.firstContentfulPaint)} | ${formatMs(result.siteB.performance.firstContentfulPaint)} |`,
    `| LCP | ${formatMs(result.siteA.performance.largestContentfulPaint)} | ${formatMs(result.siteB.performance.largestContentfulPaint)} |`,
    `| CLS | ${formatCls(result.siteA.performance.cumulativeLayoutShift)} | ${formatCls(result.siteB.performance.cumulativeLayoutShift)} |`,
    `| TBT | ${formatMs(result.siteA.performance.totalBlockingTime)} | ${formatMs(result.siteB.performance.totalBlockingTime)} |`,
    `| DOM Nodes | ${result.siteA.performance.domNodes} | ${result.siteB.performance.domNodes} |`,
    ``,
  );

  // Accessibility details
  sections.push(
    `### Accessibility Details`,
    ``,
    `| Metric | ${labelA} | ${labelB} |`,
    `|--------|${"-".repeat(Math.max(labelA.length, 6))}|${"-".repeat(Math.max(labelB.length, 6))}|`,
    `| Violations | ${result.siteA.accessibility.violations.length} | ${result.siteB.accessibility.violations.length} |`,
    `| Passes | ${result.siteA.accessibility.passes} | ${result.siteB.accessibility.passes} |`,
    ``,
  );

  // SEO details
  if (result.siteA.seo && result.siteB.seo) {
    sections.push(
      `### SEO Details`,
      ``,
      `| Metric | ${labelA} | ${labelB} |`,
      `|--------|${"-".repeat(Math.max(labelA.length, 6))}|${"-".repeat(Math.max(labelB.length, 6))}|`,
      `| SEO Score | ${result.siteA.seo.score}/100 | ${result.siteB.seo.score}/100 |`,
      `| Checks Passed | ${result.siteA.seo.passed}/${result.siteA.seo.passed + result.siteA.seo.failed} | ${result.siteB.seo.passed}/${result.siteB.seo.passed + result.siteB.seo.failed} |`,
      ``,
    );
  }

  // Summary
  sections.push(
    `### Summary`,
    ``,
    result.summary,
    ``,
  );

  return sections.join("\n");
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    // Include path if it's not just "/" to differentiate same-domain URLs
    const path = parsed.pathname;
    if (path && path !== "/") {
      return host + path.replace(/\/$/, "");
    }
    return host;
  } catch {
    return url.slice(0, 30);
  }
}

function formatMs(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(0)}ms`;
}

function formatCls(value: number | null): string {
  if (value === null) return "N/A";
  return value.toFixed(3);
}
