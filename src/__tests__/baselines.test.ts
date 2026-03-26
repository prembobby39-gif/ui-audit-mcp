import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  saveBaseline,
  loadBaseline,
  loadAllBaselines,
  compareToBaseline,
  formatBaselineComparison,
} from "../tools/baselines.js";
import type { BaselineData, BaselineComparison } from "../types.js";

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
  tempDir = join(tmpdir(), `uimax-test-baselines-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ── saveBaseline Tests ─────────────────────────────────────────────

describe("saveBaseline", () => {
  it("creates a new history file when none exists", async () => {
    const data = makeBaselineData();
    await saveBaseline("http://localhost:3000", data, tempDir);

    const raw = await readFile(join(tempDir, ".uimax-history.json"), "utf-8");
    const entries = JSON.parse(raw);

    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe("http://localhost:3000");
    expect(entries[0].data).toEqual(data);
  });

  it("appends to an existing history file", async () => {
    const data1 = makeBaselineData({ timestamp: "2026-03-26T10:00:00.000Z" });
    const data2 = makeBaselineData({ timestamp: "2026-03-26T11:00:00.000Z" });

    await saveBaseline("http://localhost:3000", data1, tempDir);
    await saveBaseline("http://localhost:3000", data2, tempDir);

    const raw = await readFile(join(tempDir, ".uimax-history.json"), "utf-8");
    const entries = JSON.parse(raw);

    expect(entries).toHaveLength(2);
    expect(entries[0].timestamp).toBe("2026-03-26T10:00:00.000Z");
    expect(entries[1].timestamp).toBe("2026-03-26T11:00:00.000Z");
  });

  it("returns the saved entry", async () => {
    const data = makeBaselineData();
    const entry = await saveBaseline("http://localhost:3000", data, tempDir);

    expect(entry.url).toBe("http://localhost:3000");
    expect(entry.data).toEqual(data);
    expect(entry.timestamp).toBe(data.timestamp);
  });

  it("supports multiple URLs in the same history file", async () => {
    const data1 = makeBaselineData({ url: "http://localhost:3000" });
    const data2 = makeBaselineData({ url: "http://localhost:4000" });

    await saveBaseline("http://localhost:3000", data1, tempDir);
    await saveBaseline("http://localhost:4000", data2, tempDir);

    const raw = await readFile(join(tempDir, ".uimax-history.json"), "utf-8");
    const entries = JSON.parse(raw);

    expect(entries).toHaveLength(2);
    expect(entries[0].url).toBe("http://localhost:3000");
    expect(entries[1].url).toBe("http://localhost:4000");
  });
});

// ── loadBaseline Tests ─────────────────────────────────────────────

describe("loadBaseline", () => {
  it("returns null when no history file exists", async () => {
    const result = await loadBaseline("http://localhost:3000", tempDir);
    expect(result).toBeNull();
  });

  it("returns null when URL has no entries", async () => {
    const data = makeBaselineData({ url: "http://localhost:4000" });
    await saveBaseline("http://localhost:4000", data, tempDir);

    const result = await loadBaseline("http://localhost:3000", tempDir);
    expect(result).toBeNull();
  });

  it("returns the most recent entry for a URL", async () => {
    const data1 = makeBaselineData({ timestamp: "2026-03-26T10:00:00.000Z" });
    const data2 = makeBaselineData({ timestamp: "2026-03-26T11:00:00.000Z" });

    await saveBaseline("http://localhost:3000", data1, tempDir);
    await saveBaseline("http://localhost:3000", data2, tempDir);

    const result = await loadBaseline("http://localhost:3000", tempDir);

    expect(result).not.toBeNull();
    expect(result!.timestamp).toBe("2026-03-26T11:00:00.000Z");
  });

  it("returns correct URL when multiple URLs exist", async () => {
    const dataA = makeBaselineData({ url: "http://localhost:3000" });
    const dataB = makeBaselineData({ url: "http://localhost:4000" });

    await saveBaseline("http://localhost:3000", dataA, tempDir);
    await saveBaseline("http://localhost:4000", dataB, tempDir);

    const result = await loadBaseline("http://localhost:4000", tempDir);

    expect(result).not.toBeNull();
    expect(result!.url).toBe("http://localhost:4000");
  });
});

// ── loadAllBaselines Tests ─────────────────────────────────────────

describe("loadAllBaselines", () => {
  it("returns empty array when no history file exists", async () => {
    const result = await loadAllBaselines(tempDir);
    expect(result).toEqual([]);
  });

  it("returns all entries from the history file", async () => {
    const data1 = makeBaselineData({ timestamp: "2026-03-26T10:00:00.000Z" });
    const data2 = makeBaselineData({ timestamp: "2026-03-26T11:00:00.000Z" });

    await saveBaseline("http://localhost:3000", data1, tempDir);
    await saveBaseline("http://localhost:3000", data2, tempDir);

    const result = await loadAllBaselines(tempDir);
    expect(result).toHaveLength(2);
  });
});

// ── compareToBaseline Tests ────────────────────────────────────────

describe("compareToBaseline", () => {
  it("detects improvements in lighthouse scores", () => {
    const previous = makeBaselineData({
      lighthouseScores: { performance: 70, accessibility: 80, bestPractices: 85, seo: 75 },
    });
    const current = makeBaselineData({
      lighthouseScores: { performance: 90, accessibility: 95, bestPractices: 95, seo: 85 },
    });

    const comparison = compareToBaseline(current, previous);

    expect(comparison.improvements.length).toBeGreaterThan(0);
    const perfImprovement = comparison.improvements.find(
      (c) => c.metric === "Lighthouse Performance"
    );
    expect(perfImprovement).toBeDefined();
    expect(perfImprovement!.delta).toBe(20);
    expect(perfImprovement!.direction).toBe("improved");
  });

  it("detects regressions in lighthouse scores", () => {
    const previous = makeBaselineData({
      lighthouseScores: { performance: 90, accessibility: 95, bestPractices: 95, seo: 85 },
    });
    const current = makeBaselineData({
      lighthouseScores: { performance: 70, accessibility: 80, bestPractices: 85, seo: 75 },
    });

    const comparison = compareToBaseline(current, previous);

    expect(comparison.regressions.length).toBeGreaterThan(0);
    const perfRegression = comparison.regressions.find(
      (c) => c.metric === "Lighthouse Performance"
    );
    expect(perfRegression).toBeDefined();
    expect(perfRegression!.delta).toBe(-20);
    expect(perfRegression!.direction).toBe("regressed");
  });

  it("detects improvements in web vitals (lower is better)", () => {
    const previous = makeBaselineData({
      performanceMetrics: { fcp: 2000, lcp: 4000, cls: 0.2, tbt: 500 },
    });
    const current = makeBaselineData({
      performanceMetrics: { fcp: 1000, lcp: 2000, cls: 0.05, tbt: 100 },
    });

    const comparison = compareToBaseline(current, previous);

    const fcpChange = comparison.improvements.find((c) => c.metric === "FCP");
    expect(fcpChange).toBeDefined();
    expect(fcpChange!.direction).toBe("improved");
  });

  it("detects regressions in web vitals (higher is worse)", () => {
    const previous = makeBaselineData({
      performanceMetrics: { fcp: 1000, lcp: 2000, cls: 0.05, tbt: 100 },
    });
    const current = makeBaselineData({
      performanceMetrics: { fcp: 2000, lcp: 4000, cls: 0.2, tbt: 500 },
    });

    const comparison = compareToBaseline(current, previous);

    const lcpChange = comparison.regressions.find((c) => c.metric === "LCP");
    expect(lcpChange).toBeDefined();
    expect(lcpChange!.direction).toBe("regressed");
  });

  it("marks metrics as unchanged when values are equal", () => {
    const data = makeBaselineData();
    const comparison = compareToBaseline(data, data);

    expect(comparison.regressions).toHaveLength(0);
    expect(comparison.improvements).toHaveLength(0);
    expect(comparison.unchanged.length).toBeGreaterThan(0);
  });

  it("handles null metric values gracefully", () => {
    const previous = makeBaselineData({
      performanceMetrics: { fcp: null, lcp: null, cls: null, tbt: null },
      lighthouseScores: { performance: null, accessibility: null, bestPractices: null, seo: null },
    });
    const current = makeBaselineData({
      performanceMetrics: { fcp: 1000, lcp: 2000, cls: 0.05, tbt: 100 },
    });

    const comparison = compareToBaseline(current, previous);

    const unknownChanges = [...comparison.unchanged].filter(
      (c) => c.direction === "unknown"
    );
    expect(unknownChanges.length).toBeGreaterThan(0);
  });

  it("includes correct timestamps in comparison", () => {
    const previous = makeBaselineData({ timestamp: "2026-03-26T10:00:00.000Z" });
    const current = makeBaselineData({ timestamp: "2026-03-26T12:00:00.000Z" });

    const comparison = compareToBaseline(current, previous);

    expect(comparison.previousTimestamp).toBe("2026-03-26T10:00:00.000Z");
    expect(comparison.currentTimestamp).toBe("2026-03-26T12:00:00.000Z");
  });
});

// ── formatBaselineComparison Tests ─────────────────────────────────

describe("formatBaselineComparison", () => {
  it("produces markdown with improvements section", () => {
    const comparison: BaselineComparison = {
      url: "http://localhost:3000",
      previousTimestamp: "2026-03-26T10:00:00.000Z",
      currentTimestamp: "2026-03-26T12:00:00.000Z",
      improvements: [
        { metric: "Lighthouse Performance", previous: 70, current: 90, delta: 20, direction: "improved" },
      ],
      regressions: [],
      unchanged: [],
    };

    const output = formatBaselineComparison(comparison);

    expect(output).toContain("## Baseline Comparison");
    expect(output).toContain("### Improvements");
    expect(output).toContain("Lighthouse Performance");
    expect(output).toContain("+20");
  });

  it("produces markdown with regressions section", () => {
    const comparison: BaselineComparison = {
      url: "http://localhost:3000",
      previousTimestamp: "2026-03-26T10:00:00.000Z",
      currentTimestamp: "2026-03-26T12:00:00.000Z",
      improvements: [],
      regressions: [
        { metric: "FCP", previous: 1000, current: 2000, delta: 1000, direction: "regressed" },
      ],
      unchanged: [],
    };

    const output = formatBaselineComparison(comparison);

    expect(output).toContain("### Regressions");
    expect(output).toContain("FCP");
    expect(output).toContain("+1000");
  });

  it("includes URL and timestamps in the output", () => {
    const comparison: BaselineComparison = {
      url: "http://localhost:3000",
      previousTimestamp: "2026-03-26T10:00:00.000Z",
      currentTimestamp: "2026-03-26T12:00:00.000Z",
      improvements: [],
      regressions: [],
      unchanged: [],
    };

    const output = formatBaselineComparison(comparison);

    expect(output).toContain("http://localhost:3000");
    expect(output).toContain("2026-03-26T10:00:00.000Z");
    expect(output).toContain("2026-03-26T12:00:00.000Z");
  });

  it("formats negative deltas without a plus sign", () => {
    const comparison: BaselineComparison = {
      url: "http://localhost:3000",
      previousTimestamp: "2026-03-26T10:00:00.000Z",
      currentTimestamp: "2026-03-26T12:00:00.000Z",
      improvements: [
        { metric: "FCP", previous: 2000, current: 1000, delta: -1000, direction: "improved" },
      ],
      regressions: [],
      unchanged: [],
    };

    const output = formatBaselineComparison(comparison);

    expect(output).toContain("-1000");
    expect(output).not.toContain("+-1000");
  });
});
