import type { Page } from "puppeteer-core";
import { getBrowser } from "../utils/browser.js";
import type {
  NavigateResult,
  ClickResult,
  TypeResult,
  SelectResult,
  ScrollResult,
  WaitResult,
  ElementInfo,
} from "../types.js";

// ── Persistent Page Management ──────────────────────────────────

let activePage: Page | null = null;

const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_VIEWPORT_HEIGHT = 900;
const DEFAULT_DEVICE_SCALE_FACTOR = 2;
const NAVIGATION_TIMEOUT = 30_000;
const DEFAULT_WAIT_TIMEOUT = 10_000;

/**
 * Get or create a persistent page for interactions.
 * Unlike screenshot tool (which creates/destroys pages), interactions
 * reuse the same page to maintain state between calls.
 */
export async function getInteractionPage(): Promise<Page> {
  if (activePage && !activePage.isClosed()) {
    return activePage;
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setViewport({
    width: DEFAULT_VIEWPORT_WIDTH,
    height: DEFAULT_VIEWPORT_HEIGHT,
    deviceScaleFactor: DEFAULT_DEVICE_SCALE_FACTOR,
  });

  activePage = page;
  return page;
}

/**
 * Reset the active page reference (for testing).
 */
export function resetActivePage(): void {
  activePage = null;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Capture a base64 screenshot of the current page state.
 */
async function captureBase64Screenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({
    type: "png",
    fullPage: false,
    encoding: "binary",
  });
  return Buffer.from(buffer).toString("base64");
}

/**
 * Navigate the page to a URL if one is provided.
 * Returns the HTTP status code, or null if no navigation occurred.
 */
async function ensureNavigation(
  page: Page,
  url: string | undefined
): Promise<number | null> {
  if (!url) {
    return null;
  }

  const response = await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: NAVIGATION_TIMEOUT,
  });

  return response?.status() ?? null;
}

// ── Navigation ──────────────────────────────────────────────────

/**
 * Navigate to a URL, wait for network idle, return page info with screenshot.
 */
export async function navigateTo(url: string): Promise<NavigateResult> {
  const page = await getInteractionPage();
  const response = await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: NAVIGATION_TIMEOUT,
  });

  const title = await page.title();
  const screenshot = await captureBase64Screenshot(page);

  return {
    url: page.url(),
    title,
    status: response?.status() ?? null,
    screenshot,
  };
}

// ── Click ───────────────────────────────────────────────────────

export interface ClickOptions {
  readonly url?: string;
  readonly waitAfter?: number;
}

/**
 * Click an element by CSS selector. Optionally navigate first.
 * Returns a screenshot after the click so Claude can see the result.
 */
export async function clickElement(
  selector: string,
  options: ClickOptions = {}
): Promise<ClickResult> {
  const page = await getInteractionPage();
  await ensureNavigation(page, options.url);

  await page.waitForSelector(selector, {
    visible: true,
    timeout: DEFAULT_WAIT_TIMEOUT,
  });
  await page.click(selector);

  if (options.waitAfter && options.waitAfter > 0) {
    await new Promise((resolve) => setTimeout(resolve, options.waitAfter));
  }

  const screenshot = await captureBase64Screenshot(page);

  return { clicked: true, selector, screenshot };
}

// ── Type ────────────────────────────────────────────────────────

export interface TypeOptions {
  readonly url?: string;
  readonly clearFirst?: boolean;
  readonly pressEnter?: boolean;
}

/**
 * Type text into an input/textarea. Options to clear first and press Enter.
 * Returns a screenshot after typing so Claude can see the result.
 */
export async function typeIntoElement(
  selector: string,
  text: string,
  options: TypeOptions = {}
): Promise<TypeResult> {
  const page = await getInteractionPage();
  await ensureNavigation(page, options.url);

  await page.waitForSelector(selector, {
    visible: true,
    timeout: DEFAULT_WAIT_TIMEOUT,
  });

  if (options.clearFirst) {
    await page.click(selector, { count: 3 });
    await page.keyboard.press("Backspace");
  }

  await page.type(selector, text);

  if (options.pressEnter) {
    await page.keyboard.press("Enter");
  }

  const screenshot = await captureBase64Screenshot(page);

  return { typed: true, selector, text, screenshot };
}

// ── Select ──────────────────────────────────────────────────────

export interface SelectOptions {
  readonly url?: string;
}

/**
 * Select an option from a dropdown by value.
 * Returns a screenshot after selection so Claude can see the result.
 */
export async function selectOption(
  selector: string,
  value: string,
  options: SelectOptions = {}
): Promise<SelectResult> {
  const page = await getInteractionPage();
  await ensureNavigation(page, options.url);

  await page.waitForSelector(selector, { timeout: DEFAULT_WAIT_TIMEOUT });
  await page.select(selector, value);

  const screenshot = await captureBase64Screenshot(page);

  return { selected: true, value, screenshot };
}

// ── Scroll ──────────────────────────────────────────────────────

export interface ScrollOptions {
  readonly url?: string;
  readonly direction?: "up" | "down";
  readonly amount?: number;
  readonly toSelector?: string;
}

/**
 * Scroll the page by amount (pixels) or to a specific element.
 * Returns a screenshot after scrolling so Claude can see the result.
 */
export async function scrollPage(
  options: ScrollOptions = {}
): Promise<ScrollResult> {
  const page = await getInteractionPage();
  await ensureNavigation(page, options.url);

  if (options.toSelector) {
    await page.waitForSelector(options.toSelector, {
      timeout: DEFAULT_WAIT_TIMEOUT,
    });
    await page.evaluate((sel: string) => {
      const element = document.querySelector(sel);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, options.toSelector);
  } else {
    const direction = options.direction ?? "down";
    const amount = options.amount ?? 500;
    const pixels = direction === "down" ? amount : -amount;

    await page.evaluate((px: number) => {
      window.scrollBy(0, px);
    }, pixels);
  }

  // Small delay to let scroll animations complete
  await new Promise((resolve) => setTimeout(resolve, 300));

  const screenshot = await captureBase64Screenshot(page);

  return { scrolled: true, screenshot };
}

// ── Wait for Element ────────────────────────────────────────────

export interface WaitOptions {
  readonly url?: string;
  readonly timeout?: number;
  readonly visible?: boolean;
}

/**
 * Wait for an element to appear in the DOM.
 * Returns element tag name and text content when found.
 */
export async function waitForElement(
  selector: string,
  options: WaitOptions = {}
): Promise<WaitResult> {
  const page = await getInteractionPage();
  await ensureNavigation(page, options.url);

  const timeout = options.timeout ?? DEFAULT_WAIT_TIMEOUT;
  const waitOptions: { timeout: number; visible?: boolean } = { timeout };

  if (options.visible) {
    waitOptions.visible = true;
  }

  await page.waitForSelector(selector, waitOptions);

  const elementData = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) {
      return { tagName: "", textContent: "" };
    }
    return {
      tagName: el.tagName.toLowerCase(),
      textContent: (el.textContent ?? "").trim().slice(0, 500),
    };
  }, selector);

  return {
    found: true,
    selector,
    tagName: elementData.tagName,
    textContent: elementData.textContent,
  };
}

// ── Get Element Info ────────────────────────────────────────────

export interface GetElementOptions {
  readonly url?: string;
}

/**
 * Get detailed information about a DOM element:
 * tag, text, attributes, bounding box, computed styles.
 */
export async function getElementInfo(
  selector: string,
  options: GetElementOptions = {}
): Promise<ElementInfo> {
  const page = await getInteractionPage();
  await ensureNavigation(page, options.url);

  await page.waitForSelector(selector, { timeout: DEFAULT_WAIT_TIMEOUT });

  const elementData = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) {
      throw new Error(`Element not found: ${sel}`);
    }

    const htmlEl = el as HTMLElement;
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);

    const attrs: Record<string, string> = {};
    for (const attr of el.attributes) {
      attrs[attr.name] = attr.value;
    }

    return {
      tagName: el.tagName.toLowerCase(),
      textContent: (el.textContent ?? "").trim().slice(0, 500),
      attributes: attrs,
      boundingBox: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      computedStyles: {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        fontWeight: computed.fontWeight,
        display: computed.display,
        visibility: computed.visibility,
      },
      isVisible:
        htmlEl.offsetWidth > 0 &&
        htmlEl.offsetHeight > 0 &&
        computed.visibility !== "hidden" &&
        computed.display !== "none",
    };
  }, selector);

  const screenshot = await captureBase64Screenshot(page);

  return { ...elementData, screenshot };
}
