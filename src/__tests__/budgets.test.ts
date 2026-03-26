import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkBudgets,
  loadBudgetsFromConfig,
  formatBudgetReport,
} from "../tools/budgets.js";
import type { BaselineData, PerformanceBudgets, BudgetCheckResult } from "../types.js";

// ── Test Fixtures ──────────────────────────────────────────────────

function makeBaselineData(overrides: Partial<BaselineData> = {}): BaselineData {
  return {
    url: "http://localhost:3000",
    timestamp: "2026-03-26T10:00:00.000Z",
    lighthouseScores: {
      performance: 85,
      accessibility: 90,
      bestPractices: 95,
      seo: 80,
    },
    accessibilityViolationCount: 3,
    performanceMetrics: {
      fcp: 1200,
      lcp: 2500,
      cls: 0.05,
      tbt: 200,
    },
    codeIssueCount: 5,
    ...overrides,
  };
}

// ── Temp Directory Management ──────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(tmpdir(), `uimax-test-budgets-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ── checkBudgets Tests ─────────────────────────────────────────────

describe("checkBudgets", () => {
  it("passes when all lighthouse thresholds are met", () => {
    const data = makeBaselineData({
      lighthouseScores: { performance: 95, accessibility: 98, bestPractices: 100, seo: 92 },
    });
    const budgets: PerformanceBudgets = {
      lighthouse: { performance: 90, accessibility: 95, bestPractices: 95, seo: 90 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("fails when lighthouse performance is below threshold", () => {
    const data = makeBaselineData({
      lighthouseScores: { performance: 70, accessibility: 90, bestPractices: 95, seo: 80 },
    });
    const budgets: PerformanceBudgets = {
      lighthouse: { performance: 90 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].metric).toBe("Lighthouse Performance");
    expect(result.failures[0].threshold).toBe(90);
    expect(result.failures[0].actual).toBe(70);
  });

  it("fails when lighthouse accessibility is below threshold", () => {
    const data = makeBaselineData({
      lighthouseScores: { performance: 95, accessibility: 60, bestPractices: 95, seo: 80 },
    });
    const budgets: PerformanceBudgets = {
      lighthouse: { accessibility: 90 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(false);
    expect(result.failures[0].metric).toBe("Lighthouse Accessibility");
  });

  it("fails when web vitals exceed threshold (FCP)", () => {
    const data = makeBaselineData({
      performanceMetrics: { fcp: 3000, lcp: 2500, cls: 0.05, tbt: 200 },
    });
    const budgets: PerformanceBudgets = {
      webVitals: { fcp: 1800 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].metric).toBe("FCP");
    expect(result.failures[0].threshold).toBe(1800);
    expect(result.failures[0].actual).toBe(3000);
  });

  it("fails when web vitals exceed threshold (LCP)", () => {
    const data = makeBaselineData({
      performanceMetrics: { fcp: 1200, lcp: 5000, cls: 0.05, tbt: 200 },
    });
    const budgets: PerformanceBudgets = {
      webVitals: { lcp: 2500 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(false);
    expect(result.failures[0].metric).toBe("LCP");
  });

  it("fails when CLS exceeds threshold", () => {
    const data = makeBaselineData({
      performanceMetrics: { fcp: 1200, lcp: 2500, cls: 0.3, tbt: 200 },
    });
    const budgets: PerformanceBudgets = {
      webVitals: { cls: 0.1 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(false);
    expect(result.failures[0].metric).toBe("CLS");
  });

  it("fails when TBT exceeds threshold", () => {
    const data = makeBaselineData({
      performanceMetrics: { fcp: 1200, lcp: 2500, cls: 0.05, tbt: 600 },
    });
    const budgets: PerformanceBudgets = {
      webVitals: { tbt: 300 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(false);
    expect(result.failures[0].metric).toBe("TBT");
  });

  it("fails when accessibility violations exceed max", () => {
    const data = makeBaselineData({ accessibilityViolationCount: 5 });
    const budgets: PerformanceBudgets = {
      maxAccessibilityViolations: 0,
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(false);
    expect(result.failures[0].metric).toBe("Accessibility Violations");
    expect(result.failures[0].actual).toBe(5);
  });

  it("fails when code issues exceed max", () => {
    const data = makeBaselineData({ codeIssueCount: 20 });
    const budgets: PerformanceBudgets = {
      maxCodeIssues: 10,
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(false);
    expect(result.failures[0].metric).toBe("Code Issues");
    expect(result.failures[0].actual).toBe(20);
  });

  it("handles missing budget keys gracefully (empty budgets)", () => {
    const data = makeBaselineData();
    const budgets: PerformanceBudgets = {};

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("handles null lighthouse scores when budget is set", () => {
    const data = makeBaselineData({
      lighthouseScores: { performance: null, accessibility: null, bestPractices: null, seo: null },
    });
    const budgets: PerformanceBudgets = {
      lighthouse: { performance: 90 },
    };

    const result = checkBudgets(data, budgets);

    // Null scores should not produce failures (data unavailable)
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("handles null web vitals when budget is set", () => {
    const data = makeBaselineData({
      performanceMetrics: { fcp: null, lcp: null, cls: null, tbt: null },
    });
    const budgets: PerformanceBudgets = {
      webVitals: { fcp: 1800, lcp: 2500 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("reports multiple failures across categories", () => {
    const data = makeBaselineData({
      lighthouseScores: { performance: 50, accessibility: 60, bestPractices: 95, seo: 80 },
      performanceMetrics: { fcp: 5000, lcp: 8000, cls: 0.5, tbt: 1000 },
      accessibilityViolationCount: 10,
    });
    const budgets: PerformanceBudgets = {
      lighthouse: { performance: 90, accessibility: 90 },
      webVitals: { fcp: 1800, lcp: 2500, cls: 0.1, tbt: 300 },
      maxAccessibilityViolations: 0,
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(false);
    expect(result.failures.length).toBe(7);
  });

  it("passes when values exactly equal thresholds (lighthouse)", () => {
    const data = makeBaselineData({
      lighthouseScores: { performance: 90, accessibility: 90, bestPractices: 90, seo: 90 },
    });
    const budgets: PerformanceBudgets = {
      lighthouse: { performance: 90 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(true);
  });

  it("passes when values exactly equal thresholds (web vitals)", () => {
    const data = makeBaselineData({
      performanceMetrics: { fcp: 1800, lcp: 2500, cls: 0.1, tbt: 300 },
    });
    const budgets: PerformanceBudgets = {
      webVitals: { fcp: 1800, lcp: 2500, cls: 0.1, tbt: 300 },
    };

    const result = checkBudgets(data, budgets);

    expect(result.passed).toBe(true);
  });
});

// ── loadBudgetsFromConfig Tests ────────────────────────────────────

describe("loadBudgetsFromConfig", () => {
  it("returns null when no config file exists", async () => {
    const result = await loadBudgetsFromConfig(tempDir);
    expect(result).toBeNull();
  });

  it("returns null when config has no budgets key", async () => {
    await writeFile(
      join(tempDir, ".uimaxrc.json"),
      JSON.stringify({ rules: {} }),
      "utf-8"
    );

    const result = await loadBudgetsFromConfig(tempDir);
    expect(result).toBeNull();
  });

  it("loads budgets from config file", async () => {
    const config = {
      budgets: {
        lighthouse: { performance: 90 },
        webVitals: { lcp: 2500 },
        maxAccessibilityViolations: 0,
      },
    };
    await writeFile(
      join(tempDir, ".uimaxrc.json"),
      JSON.stringify(config),
      "utf-8"
    );

    const result = await loadBudgetsFromConfig(tempDir);

    expect(result).not.toBeNull();
    expect(result!.lighthouse?.performance).toBe(90);
    expect(result!.webVitals?.lcp).toBe(2500);
    expect(result!.maxAccessibilityViolations).toBe(0);
  });
});

// ── formatBudgetReport Tests ───────────────────────────────────────

describe("formatBudgetReport", () => {
  it("formats a passing result", () => {
    const result: BudgetCheckResult = {
      passed: true,
      failures: [],
    };

    const output = formatBudgetReport(result);

    expect(output).toContain("PASSED");
    expect(output).toContain("All budgets met.");
    expect(output).toContain("No budget violations found.");
  });

  it("formats a failing result with failure details", () => {
    const result: BudgetCheckResult = {
      passed: false,
      failures: [
        {
          metric: "Lighthouse Performance",
          threshold: 90,
          actual: 70,
          message: "Lighthouse Performance score 70 is below budget of 90",
        },
      ],
    };

    const output = formatBudgetReport(result);

    expect(output).toContain("FAILED");
    expect(output).toContain("Some budgets exceeded.");
    expect(output).toContain("### Failures");
    expect(output).toContain("FAIL");
    expect(output).toContain("Lighthouse Performance");
    expect(output).toContain("90");
    expect(output).toContain("70");
  });

  it("formats multiple failures as a table", () => {
    const result: BudgetCheckResult = {
      passed: false,
      failures: [
        {
          metric: "Lighthouse Performance",
          threshold: 90,
          actual: 70,
          message: "Lighthouse Performance score 70 is below budget of 90",
        },
        {
          metric: "FCP",
          threshold: 1800,
          actual: 3000,
          message: "FCP of 3000 exceeds budget of 1800",
        },
      ],
    };

    const output = formatBudgetReport(result);

    expect(output).toContain("Lighthouse Performance");
    expect(output).toContain("FCP");
    expect(output).toContain("| Status | Metric | Threshold | Actual |");
  });
});
