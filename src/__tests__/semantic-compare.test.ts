import { describe, it, expect, vi, beforeEach } from "vitest";
import { PNG } from "pngjs";

// ── Mock browser utilities ───────────────────────────────────────

const { mockScreenshot, mockPage } = vi.hoisted(() => {
  const mockScreenshot = vi.fn();
  const mockClose = vi.fn();
  const mockIsClosed = vi.fn().mockReturnValue(false);

  const mockPage = {
    screenshot: mockScreenshot,
    isClosed: mockIsClosed,
    close: mockClose,
  };

  return { mockScreenshot, mockPage };
});

vi.mock("../utils/browser.js", () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  navigateAndWait: vi.fn().mockResolvedValue(undefined),
  closePage: vi.fn().mockResolvedValue(undefined),
}));

import {
  captureSemanticComparison,
  buildComparisonMethodology,
} from "../tools/semantic-compare.js";

// ── Test Helpers ──────────────────────────────────────────────────

function createSolidPngBuffer(
  width: number,
  height: number,
  color: { r: number; g: number; b: number; a: number },
): Buffer {
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
      png.data[idx + 3] = color.a;
    }
  }

  return PNG.sync.write(png);
}

const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLUE = { r: 0, g: 0, b: 255, a: 255 };
const GREEN = { r: 0, g: 255, b: 0, a: 255 };

// ── buildComparisonMethodology ───────────────────────────────────

describe("buildComparisonMethodology", () => {
  it("includes the change description in the methodology", () => {
    const methodology = buildComparisonMethodology(
      "Changed header background to blue",
      5.25,
    );

    expect(methodology).toContain("Changed header background to blue");
  });

  it("includes the diff percentage in the methodology", () => {
    const methodology = buildComparisonMethodology(
      "Updated button styles",
      12.5,
    );

    expect(methodology).toContain("12.5%");
  });

  it("includes all five analysis steps", () => {
    const methodology = buildComparisonMethodology("Any change", 0);

    expect(methodology).toContain("Step 1: Identify Visual Changes");
    expect(methodology).toContain("Step 2: Assess Intent Alignment");
    expect(methodology).toContain("Step 3: Check for Visual Regressions");
    expect(methodology).toContain("Step 4: Rate the Implementation");
    expect(methodology).toContain("Step 5: Provide Specific Feedback");
  });

  it("includes rating criteria in Step 4", () => {
    const methodology = buildComparisonMethodology("Any change", 0);

    expect(methodology).toContain("Intent Match");
    expect(methodology).toContain("Regression Risk");
    expect(methodology).toContain("Overall Quality");
  });

  it("includes feedback categories in Step 5", () => {
    const methodology = buildComparisonMethodology("Any change", 0);

    expect(methodology).toContain("What's correct");
    expect(methodology).toContain("What's wrong");
    expect(methodology).toContain("What's missing");
  });

  it("returns a new string each time (immutable)", () => {
    const first = buildComparisonMethodology("Change A", 10);
    const second = buildComparisonMethodology("Change B", 20);

    expect(first).toContain("Change A");
    expect(first).toContain("10%");
    expect(second).toContain("Change B");
    expect(second).toContain("20%");
    expect(first).not.toBe(second);
  });
});

// ── captureSemanticComparison ────────────────────────────────────

describe("captureSemanticComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures both before and after screenshots", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:3001",
      "Updated heading color",
    );

    expect(result.beforeScreenshot).toBeDefined();
    expect(result.beforeScreenshot.base64).toBeTruthy();
    expect(result.beforeScreenshot.mimeType).toBe("image/png");
    expect(result.afterScreenshot).toBeDefined();
    expect(result.afterScreenshot.base64).toBeTruthy();
    expect(result.afterScreenshot.mimeType).toBe("image/png");
  });

  it("includes the diff image as base64", async () => {
    const redPng = createSolidPngBuffer(10, 10, RED);
    const bluePng = createSolidPngBuffer(10, 10, BLUE);
    mockScreenshot
      .mockResolvedValueOnce(redPng)
      .mockResolvedValueOnce(bluePng);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:3001",
      "Changed colors",
    );

    expect(result.diffImage).toBeTruthy();
    // Verify the diff image is a decodable PNG
    const diffBuffer = Buffer.from(result.diffImage, "base64");
    const diffPng = PNG.sync.read(diffBuffer);
    expect(diffPng.width).toBe(10);
    expect(diffPng.height).toBe(10);
  });

  it("returns correct difference percentage for different images", async () => {
    const redPng = createSolidPngBuffer(10, 10, RED);
    const bluePng = createSolidPngBuffer(10, 10, BLUE);
    mockScreenshot
      .mockResolvedValueOnce(redPng)
      .mockResolvedValueOnce(bluePng);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:3001",
      "Changed all colors",
    );

    expect(result.differencePercent).toBe(100);
    expect(result.pixelsChanged).toBe(100);
  });

  it("returns 0% difference for identical images", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, GREEN);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:3001",
      "No actual change",
    );

    expect(result.differencePercent).toBe(0);
    expect(result.pixelsChanged).toBe(0);
  });

  it("defaults viewport to 1440x900 when no options provided", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:3001",
      "Some change",
    );

    expect(result.beforeScreenshot.width).toBe(1440);
    expect(result.beforeScreenshot.height).toBe(900);
    expect(result.afterScreenshot.width).toBe(1440);
    expect(result.afterScreenshot.height).toBe(900);
  });

  it("uses provided viewport dimensions", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:3001",
      "Responsive change",
      { viewport: { width: 375, height: 812 } },
    );

    expect(result.beforeScreenshot.width).toBe(375);
    expect(result.beforeScreenshot.height).toBe(812);
    expect(result.afterScreenshot.width).toBe(375);
    expect(result.afterScreenshot.height).toBe(812);
  });

  it("includes the methodology in the result", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:3001",
      "Added dark mode toggle",
    );

    expect(result.methodology).toContain("Added dark mode toggle");
    expect(result.methodology).toContain("Step 1");
    expect(result.methodology).toContain("Step 5");
  });

  it("preserves the change description in the result", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:3001",
      "Increased font size to 18px",
    );

    expect(result.changeDescription).toBe("Increased font size to 18px");
  });

  it("preserves both URLs in the result", async () => {
    const pngBuffer = createSolidPngBuffer(10, 10, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:4000",
      "URL change test",
    );

    expect(result.urlBefore).toBe("http://localhost:3000");
    expect(result.urlAfter).toBe("http://localhost:4000");
  });

  it("propagates browser errors", async () => {
    mockScreenshot.mockRejectedValueOnce(new Error("Browser crashed"));

    await expect(
      captureSemanticComparison(
        "http://localhost:3000",
        "http://localhost:3001",
        "Some change",
      ),
    ).rejects.toThrow("Browser crashed");
  });

  it("returns correct dimensions from diff computation", async () => {
    const pngBuffer = createSolidPngBuffer(20, 15, RED);
    mockScreenshot
      .mockResolvedValueOnce(pngBuffer)
      .mockResolvedValueOnce(pngBuffer);

    const result = await captureSemanticComparison(
      "http://localhost:3000",
      "http://localhost:3001",
      "Dimension check",
    );

    expect(result.dimensions.width).toBe(20);
    expect(result.dimensions.height).toBe(15);
  });
});
