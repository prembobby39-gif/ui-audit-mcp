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

// ── Browser Capture ───────────────────────────────────────────────

export type ConsoleLevel = "log" | "warn" | "error" | "info" | "debug";

export interface ConsoleEntry {
  readonly level: ConsoleLevel;
  readonly text: string;
  readonly timestamp: string;
  readonly location?: string;
}

export interface ConsoleCaptureResult {
  readonly url: string;
  readonly timestamp: string;
  readonly entries: readonly ConsoleEntry[];
  readonly uncaughtExceptions: readonly string[];
  readonly totalCount: number;
  readonly countByLevel: Readonly<Record<ConsoleLevel, number>>;
}

export interface NetworkEntry {
  readonly url: string;
  readonly method: string;
  readonly resourceType: string;
  readonly status: number;
  readonly size: number;
  readonly duration: number;
  readonly failed: boolean;
  readonly failureReason?: string;
}

export interface NetworkTypeSummary {
  readonly type: string;
  readonly count: number;
  readonly totalSize: number;
}

export interface NetworkSummary {
  readonly totalRequests: number;
  readonly failedRequests: number;
  readonly totalTransferSize: number;
  readonly byType: readonly NetworkTypeSummary[];
}

export interface NetworkCaptureResult {
  readonly url: string;
  readonly timestamp: string;
  readonly entries: readonly NetworkEntry[];
  readonly summary: NetworkSummary;
}

export type PageErrorKind = "exception" | "unhandled-rejection" | "resource-load-failure";

export interface PageError {
  readonly kind: PageErrorKind;
  readonly message: string;
  readonly timestamp: string;
  readonly source?: string;
}

export interface ErrorCaptureResult {
  readonly url: string;
  readonly timestamp: string;
  readonly errors: readonly PageError[];
  readonly totalCount: number;
  readonly countByKind: Readonly<Record<PageErrorKind, number>>;
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

// ── Lighthouse Deep Analysis ──────────────────────────────────────

export interface PwaCheckItem {
  readonly id: string;
  readonly title: string;
  readonly passed: boolean;
  readonly description: string;
}

export interface PwaReadinessResult {
  readonly installable: boolean;
  readonly serviceWorker: boolean;
  readonly https: boolean;
  readonly manifest: boolean;
  readonly offlineCapable: boolean;
  readonly checks: readonly PwaCheckItem[];
  readonly overallReady: boolean;
}

export interface SecurityFinding {
  readonly id: string;
  readonly title: string;
  readonly passed: boolean;
  readonly description: string;
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly details: string | null;
}

export interface SecurityAuditResult {
  readonly httpsUsed: boolean;
  readonly findings: readonly SecurityFinding[];
  readonly vulnerableLibraries: readonly string[];
  readonly totalPassed: number;
  readonly totalFailed: number;
}

export interface UnusedCodeEntry {
  readonly url: string;
  readonly totalBytes: number;
  readonly unusedBytes: number;
  readonly potentialSavingsBytes: number;
}

export interface UnusedCodeResult {
  readonly unusedJavascript: readonly UnusedCodeEntry[];
  readonly unusedCss: readonly UnusedCodeEntry[];
  readonly totalPotentialSavingsBytes: number;
  readonly totalPotentialSavingsKb: number;
}

export interface LcpOptimizationResult {
  readonly lcpElement: string | null;
  readonly lcpTimeMs: number | null;
  readonly ttfbMs: number | null;
  readonly resourceLoadTimeMs: number | null;
  readonly renderDelayMs: number | null;
  readonly lcpScore: number | null;
  readonly suggestions: readonly string[];
}

export interface ResourceEntry {
  readonly url: string;
  readonly transferSizeBytes: number;
  readonly resourceType: string;
}

export interface ResourceBreakdown {
  readonly type: string;
  readonly count: number;
  readonly totalBytes: number;
}

export interface ResourceAnalysisResult {
  readonly totalTransferSizeBytes: number;
  readonly totalTransferSizeKb: number;
  readonly totalRequests: number;
  readonly breakdown: readonly ResourceBreakdown[];
  readonly largestResources: readonly ResourceEntry[];
  readonly renderBlockingResources: readonly ResourceEntry[];
}

// ── Browser Interaction ──────────────────────────────────────────

export interface NavigateResult {
  readonly url: string;
  readonly title: string;
  readonly status: number | null;
  readonly screenshot: string;
}

export interface ClickResult {
  readonly clicked: boolean;
  readonly selector: string;
  readonly screenshot: string;
}

export interface TypeResult {
  readonly typed: boolean;
  readonly selector: string;
  readonly text: string;
  readonly screenshot: string;
}

export interface SelectResult {
  readonly selected: boolean;
  readonly value: string;
  readonly screenshot: string;
}

export interface ScrollResult {
  readonly scrolled: boolean;
  readonly screenshot: string;
}

export interface WaitResult {
  readonly found: boolean;
  readonly selector: string;
  readonly tagName: string;
  readonly textContent: string;
}

export interface ElementInfo {
  readonly tagName: string;
  readonly textContent: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly boundingBox: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null;
  readonly computedStyles: {
    readonly color: string;
    readonly backgroundColor: string;
    readonly fontSize: string;
    readonly fontFamily: string;
    readonly fontWeight: string;
    readonly display: string;
    readonly visibility: string;
  };
  readonly isVisible: boolean;
  readonly screenshot: string;
}
