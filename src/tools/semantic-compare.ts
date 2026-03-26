import { captureScreenshot } from "./screenshot.js";
import { computePixelDiff } from "../utils/pixel-diff.js";
import type { ScreenshotResult } from "../types.js";
import type { PixelDiffResult } from "../utils/pixel-diff.js";

// ── Types ─────────────────────────────────────────────────────────

export interface SemanticComparisonOptions {
  readonly viewport?: {
    readonly width: number;
    readonly height: number;
  };
}

export interface SemanticComparisonResult {
  readonly beforeScreenshot: ScreenshotResult;
  readonly afterScreenshot: ScreenshotResult;
  readonly diffImage: string;
  readonly differencePercent: number;
  readonly pixelsChanged: number;
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  readonly methodology: string;
  readonly changeDescription: string;
  readonly urlBefore: string;
  readonly urlAfter: string;
}

// ── Constants ─────────────────────────────────────────────────────

const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_VIEWPORT_HEIGHT = 900;
const DEFAULT_DEVICE_SCALE_FACTOR = 2;
const DEFAULT_SETTLE_DELAY = 1000;

// ── Methodology Builder ───────────────────────────────────────────

/**
 * Generate a detailed methodology prompt that tells Claude exactly
 * how to analyze before/after screenshots for semantic correctness.
 */
export function buildComparisonMethodology(
  changeDescription: string,
  diffPercent: number,
): string {
  return [
    `## Semantic Visual Comparison Methodology`,
    ``,
    `**The user requested:** ${changeDescription}`,
    `**Pixel difference:** ${diffPercent}%`,
    ``,
    `You have been given before and after screenshots, plus a pixel-level diff image. Follow these steps to evaluate whether the UI change matches the intent:`,
    ``,
    `### Step 1: Identify Visual Changes`,
    `Compare the "before" and "after" screenshots side by side. List every visible difference:`,
    `- Layout changes (position, size, spacing)`,
    `- Color or styling changes`,
    `- Content changes (text, images, icons)`,
    `- New or removed elements`,
    `- Animation or state changes`,
    ``,
    `### Step 2: Assess Intent Alignment`,
    `For each change identified, determine whether it aligns with the requested change: "${changeDescription}"`,
    `- Does the implementation match what was asked for?`,
    `- Are there changes that go beyond the request (scope creep)?`,
    `- Are there aspects of the request that were NOT implemented?`,
    ``,
    `### Step 3: Check for Visual Regressions`,
    `Examine the "after" screenshot for unintended side effects:`,
    `- Layout shifts or broken alignment`,
    `- Overlapping or clipped elements`,
    `- Missing or broken images/icons`,
    `- Color inconsistencies with the rest of the page`,
    `- Typography changes that were not requested`,
    `- Broken responsive behavior`,
    `- Missing hover/focus states visible in static capture`,
    ``,
    `### Step 4: Rate the Implementation`,
    `Provide a clear assessment:`,
    `- **Intent Match (1-5):** How well does the change match what was requested?`,
    `- **Regression Risk (1-5):** How many unintended side effects are present? (1 = many regressions, 5 = clean)`,
    `- **Overall Quality (1-5):** Combined assessment of correctness and polish`,
    ``,
    `### Step 5: Provide Specific Feedback`,
    `Organize your feedback into three categories:`,
    `- **What's correct:** Aspects that match the intent perfectly`,
    `- **What's wrong:** Changes that don't match intent or introduce regressions`,
    `- **What's missing:** Parts of the request that were not addressed`,
    ``,
    `For each issue, provide a specific, actionable fix with exact CSS values, component names, or code changes.`,
  ].join("\n");
}

// ── Screenshot Capture ────────────────────────────────────────────

/**
 * Capture a screenshot for semantic comparison with standard settings.
 */
async function captureComparisonScreenshot(
  url: string,
  width: number,
  height: number,
): Promise<ScreenshotResult> {
  return captureScreenshot({
    url,
    width,
    height,
    fullPage: true,
    delay: DEFAULT_SETTLE_DELAY,
    deviceScaleFactor: DEFAULT_DEVICE_SCALE_FACTOR,
  });
}

// ── Diff Computation ──────────────────────────────────────────────

/**
 * Compute pixel diff between two screenshots and extract result fields.
 */
function computeDiff(
  beforeBase64: string,
  afterBase64: string,
): PixelDiffResult {
  return computePixelDiff({
    base64A: beforeBase64,
    base64B: afterBase64,
  });
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Capture before/after screenshots, compute pixel diff, and generate
 * a structured methodology prompt for Claude's vision to perform
 * semantic comparison of the UI changes.
 *
 * This does NOT call an external AI API — it structures the output so
 * the calling Claude instance can do the semantic analysis using its
 * own vision capabilities.
 */
export async function captureSemanticComparison(
  urlBefore: string,
  urlAfter: string,
  changeDescription: string,
  options?: SemanticComparisonOptions,
): Promise<SemanticComparisonResult> {
  const width = options?.viewport?.width ?? DEFAULT_VIEWPORT_WIDTH;
  const height = options?.viewport?.height ?? DEFAULT_VIEWPORT_HEIGHT;

  const beforeScreenshot = await captureComparisonScreenshot(
    urlBefore,
    width,
    height,
  );

  const afterScreenshot = await captureComparisonScreenshot(
    urlAfter,
    width,
    height,
  );

  const diffResult = computeDiff(
    beforeScreenshot.base64,
    afterScreenshot.base64,
  );

  const methodology = buildComparisonMethodology(
    changeDescription,
    diffResult.differencePercent,
  );

  return {
    beforeScreenshot,
    afterScreenshot,
    diffImage: diffResult.diffImageBase64,
    differencePercent: diffResult.differencePercent,
    pixelsChanged: diffResult.pixelsChanged,
    dimensions: diffResult.dimensions,
    methodology,
    changeDescription,
    urlBefore,
    urlAfter,
  };
}
