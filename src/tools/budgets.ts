import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  BaselineData,
  PerformanceBudgets,
  BudgetCheckResult,
  BudgetFailure,
} from "../types.js";

// ── Constants ──────────────────────────────────────────────────────

const CONFIG_FILENAME = ".uimaxrc.json";

// ── Config Loading ─────────────────────────────────────────────────

/**
 * Load performance budgets from .uimaxrc.json in the given directory.
 * Returns null if no budgets are configured or the file doesn't exist.
 */
export async function loadBudgetsFromConfig(
  codeDir?: string
): Promise<PerformanceBudgets | null> {
  try {
    const configPath = resolve(codeDir ?? process.cwd(), CONFIG_FILENAME);
    const raw = await readFile(configPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) return null;

    const config = parsed as Record<string, unknown>;
    if (!config["budgets"] || typeof config["budgets"] !== "object") {
      return null;
    }

    return config["budgets"] as PerformanceBudgets;
  } catch {
    return null;
  }
}

// ── Budget Checking ────────────────────────────────────────────────

/**
 * Check if current results meet all budget thresholds.
 * Returns a result with pass/fail status and details of any failures.
 */
export function checkBudgets(
  results: BaselineData,
  budgets: PerformanceBudgets
): BudgetCheckResult {
  const failures: BudgetFailure[] = [
    ...checkLighthouseBudgets(results, budgets),
    ...checkWebVitalsBudgets(results, budgets),
    ...checkCountBudgets(results, budgets),
  ];

  return {
    passed: failures.length === 0,
    failures,
  };
}

// ── Lighthouse Score Checks ────────────────────────────────────────

function checkLighthouseBudgets(
  results: BaselineData,
  budgets: PerformanceBudgets
): readonly BudgetFailure[] {
  if (!budgets.lighthouse) return [];

  const failures: BudgetFailure[] = [];
  const scores = results.lighthouseScores;
  const thresholds = budgets.lighthouse;

  const scoreChecks: ReadonlyArray<{
    key: keyof typeof thresholds;
    label: string;
    actual: number | null;
  }> = [
    { key: "performance", label: "Lighthouse Performance", actual: scores.performance },
    { key: "accessibility", label: "Lighthouse Accessibility", actual: scores.accessibility },
    { key: "bestPractices", label: "Lighthouse Best Practices", actual: scores.bestPractices },
    { key: "seo", label: "Lighthouse SEO", actual: scores.seo },
  ];

  for (const check of scoreChecks) {
    const threshold = thresholds[check.key];
    if (threshold === undefined) continue;
    if (check.actual === null) continue;

    if (check.actual < threshold) {
      failures.push({
        metric: check.label,
        threshold,
        actual: check.actual,
        message: `${check.label} score ${check.actual} is below budget of ${threshold}`,
      });
    }
  }

  return failures;
}

// ── Web Vitals Checks ──────────────────────────────────────────────

function checkWebVitalsBudgets(
  results: BaselineData,
  budgets: PerformanceBudgets
): readonly BudgetFailure[] {
  if (!budgets.webVitals) return [];

  const failures: BudgetFailure[] = [];
  const metrics = results.performanceMetrics;
  const thresholds = budgets.webVitals;

  const vitalChecks: ReadonlyArray<{
    key: keyof typeof thresholds;
    label: string;
    actual: number | null;
  }> = [
    { key: "fcp", label: "FCP", actual: metrics.fcp },
    { key: "lcp", label: "LCP", actual: metrics.lcp },
    { key: "cls", label: "CLS", actual: metrics.cls },
    { key: "tbt", label: "TBT", actual: metrics.tbt },
  ];

  for (const check of vitalChecks) {
    const threshold = thresholds[check.key];
    if (threshold === undefined) continue;
    if (check.actual === null) continue;

    if (check.actual > threshold) {
      failures.push({
        metric: check.label,
        threshold,
        actual: check.actual,
        message: `${check.label} of ${check.actual} exceeds budget of ${threshold}`,
      });
    }
  }

  return failures;
}

// ── Count Checks ───────────────────────────────────────────────────

function checkCountBudgets(
  results: BaselineData,
  budgets: PerformanceBudgets
): readonly BudgetFailure[] {
  const failures: BudgetFailure[] = [];

  if (
    budgets.maxAccessibilityViolations !== undefined &&
    results.accessibilityViolationCount > budgets.maxAccessibilityViolations
  ) {
    failures.push({
      metric: "Accessibility Violations",
      threshold: budgets.maxAccessibilityViolations,
      actual: results.accessibilityViolationCount,
      message: `${results.accessibilityViolationCount} accessibility violations exceed budget of ${budgets.maxAccessibilityViolations}`,
    });
  }

  if (
    budgets.maxCodeIssues !== undefined &&
    results.codeIssueCount > budgets.maxCodeIssues
  ) {
    failures.push({
      metric: "Code Issues",
      threshold: budgets.maxCodeIssues,
      actual: results.codeIssueCount,
      message: `${results.codeIssueCount} code issues exceed budget of ${budgets.maxCodeIssues}`,
    });
  }

  return failures;
}

// ── Report Formatting ──────────────────────────────────────────────

/**
 * Format a budget check result as markdown with pass/fail indicators.
 */
export function formatBudgetReport(result: BudgetCheckResult): string {
  const status = result.passed ? "PASSED" : "FAILED";
  const icon = result.passed ? "All budgets met." : "Some budgets exceeded.";

  const sections: string[] = [
    `## Performance Budget Check: ${status}`,
    ``,
    icon,
    ``,
  ];

  if (result.failures.length > 0) {
    sections.push(`### Failures`);
    sections.push(`| Status | Metric | Threshold | Actual |`);
    sections.push(`|--------|--------|-----------|--------|`);

    for (const failure of result.failures) {
      sections.push(
        `| FAIL | ${failure.metric} | ${failure.threshold} | ${failure.actual} |`
      );
    }

    sections.push(``);
  }

  if (result.passed) {
    sections.push(`No budget violations found.`);
    sections.push(``);
  }

  return sections.join("\n");
}
