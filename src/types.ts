// ── Severity & Category ────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low";
export type FindingCategory = "bug" | "accessibility" | "performance" | "design" | "code-quality" | "ux";

// ── Screenshot ─────────────────────────────────────────────────────

export interface ScreenshotOptions {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly fullPage: boolean;
  readonly delay: number;
  readonly deviceScaleFactor: number;
}

export interface ScreenshotResult {
  readonly base64: string;
  readonly mimeType: "image/png";
  readonly width: number;
  readonly height: number;
  readonly url: string;
  readonly timestamp: string;
}

// ── Accessibility ──────────────────────────────────────────────────

export interface AccessibilityViolation {
  readonly id: string;
  readonly impact: "critical" | "serious" | "moderate" | "minor";
  readonly description: string;
  readonly help: string;
  readonly helpUrl: string;
  readonly nodes: readonly AccessibilityNode[];
}

export interface AccessibilityNode {
  readonly target: readonly string[];
  readonly html: string;
  readonly failureSummary: string;
}

export interface AccessibilityResult {
  readonly url: string;
  readonly timestamp: string;
  readonly violations: readonly AccessibilityViolation[];
  readonly passes: number;
  readonly incomplete: number;
  readonly inapplicable: number;
}

// ── Performance ────────────────────────────────────────────────────

export interface PerformanceMetrics {
  readonly url: string;
  readonly timestamp: string;
  readonly loadTime: number;
  readonly domContentLoaded: number;
  readonly firstPaint: number | null;
  readonly firstContentfulPaint: number | null;
  readonly largestContentfulPaint: number | null;
  readonly cumulativeLayoutShift: number | null;
  readonly totalBlockingTime: number | null;
  readonly domNodes: number;
  readonly resourceCount: number;
  readonly totalResourceSize: number;
  readonly jsHeapSize: number | null;
}

// ── Code Analysis ──────────────────────────────────────────────────

export interface CodeFinding {
  readonly file: string;
  readonly line: number | null;
  readonly severity: Severity;
  readonly category: FindingCategory;
  readonly rule: string;
  readonly message: string;
  readonly suggestion: string;
  readonly analysisMethod?: "ast" | "regex";
}

export interface CodeAnalysisResult {
  readonly directory: string;
  readonly timestamp: string;
  readonly framework: string;
  readonly totalFiles: number;
  readonly totalLines: number;
  readonly findings: readonly CodeFinding[];
  readonly summary: {
    readonly components: number;
    readonly stylesheets: number;
    readonly avgFileSize: number;
    readonly largestFiles: readonly { file: string; lines: number }[];
  };
  readonly configStatus: {
    readonly loaded: boolean;
    readonly path: string | null;
    readonly rulesDisabled: readonly string[];
    readonly severityOverrides: readonly string[];
  };
}

// ── Lighthouse ────────────────────────────────────────────────────

/**
 * Re-exported from tools/lighthouse.ts for type compatibility.
 * The canonical types live in lighthouse.ts; this alias allows
 * FullReviewResult to reference them without a circular import.
 */
export interface LighthouseScores {
  readonly performance: number | null;
  readonly accessibility: number | null;
  readonly bestPractices: number | null;
  readonly seo: number | null;
}

export interface LighthouseAuditEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly score: number | null;
  readonly displayValue: string | null;
  readonly numericValue: number | null;
  readonly numericUnit: string | null;
}

export interface LighthouseResultSummary {
  readonly scores: LighthouseScores;
  readonly audits: readonly LighthouseAuditEntry[];
  readonly url: string;
  readonly timestamp: string;
  readonly lighthouseVersion: string;
  readonly runWarnings: readonly string[];
}

// ── Crawl ─────────────────────────────────────────────────────────

export interface CrawlPageResult {
  readonly url: string;
  readonly screenshot: ScreenshotResult | null;
  readonly accessibilityIssues: readonly AccessibilityViolation[];
  readonly accessibilityPasses: number;
  readonly performanceMetrics: PerformanceMetrics | null;
  readonly error: string | null;
}

export interface CrawlResult {
  readonly startUrl: string;
  readonly timestamp: string;
  readonly pagesAudited: number;
  readonly pagesRequested: number;
  readonly pages: readonly CrawlPageResult[];
}

// ── Full Review ────────────────────────────────────────────────────

export interface FullReviewResult {
  readonly url: string;
  readonly codeDirectory: string;
  readonly timestamp: string;
  readonly screenshot: ScreenshotResult;
  readonly accessibility: AccessibilityResult;
  readonly performance: PerformanceMetrics;
  readonly codeAnalysis: CodeAnalysisResult;
  readonly lighthouse?: LighthouseResultSummary;
}

// ── Baselines ─────────────────────────────────────────────────────

export interface BaselineData {
  readonly url: string;
  readonly timestamp: string;
  readonly lighthouseScores: {
    readonly performance: number | null;
    readonly accessibility: number | null;
    readonly bestPractices: number | null;
    readonly seo: number | null;
  };
  readonly accessibilityViolationCount: number;
  readonly performanceMetrics: {
    readonly fcp: number | null;
    readonly lcp: number | null;
    readonly cls: number | null;
    readonly tbt: number | null;
  };
  readonly codeIssueCount: number;
}

export interface BaselineEntry {
  readonly url: string;
  readonly timestamp: string;
  readonly data: BaselineData;
}

export interface BaselineMetricChange {
  readonly metric: string;
  readonly previous: number | null;
  readonly current: number | null;
  readonly delta: number | null;
  readonly direction: "improved" | "regressed" | "unchanged" | "unknown";
}

export interface BaselineComparison {
  readonly url: string;
  readonly previousTimestamp: string;
  readonly currentTimestamp: string;
  readonly improvements: readonly BaselineMetricChange[];
  readonly regressions: readonly BaselineMetricChange[];
  readonly unchanged: readonly BaselineMetricChange[];
}

// ── Performance Budgets ───────────────────────────────────────────

export interface PerformanceBudgets {
  readonly lighthouse?: {
    readonly performance?: number;
    readonly accessibility?: number;
    readonly bestPractices?: number;
    readonly seo?: number;
  };
  readonly webVitals?: {
    readonly fcp?: number;
    readonly lcp?: number;
    readonly cls?: number;
    readonly tbt?: number;
  };
  readonly maxAccessibilityViolations?: number;
  readonly maxCodeIssues?: number;
}

export interface BudgetFailure {
  readonly metric: string;
  readonly threshold: number;
  readonly actual: number;
  readonly message: string;
}

export interface BudgetCheckResult {
  readonly passed: boolean;
  readonly failures: readonly BudgetFailure[];
}
