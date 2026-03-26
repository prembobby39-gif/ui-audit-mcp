import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock browser utilities ───────────────────────────────────────

const { mockPage, mockBrowser } = vi.hoisted(() => {
  const mockKeyboard = {
    press: vi.fn().mockResolvedValue(undefined),
  };

  const mockPage = {
    goto: vi.fn().mockResolvedValue({ status: () => 200 }),
    title: vi.fn().mockResolvedValue("Test Page"),
    url: vi.fn().mockReturnValue("http://localhost:3000"),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockResolvedValue(["option-value"]),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("fake-screenshot")),
    isClosed: vi.fn().mockReturnValue(false),
    setViewport: vi.fn().mockResolvedValue(undefined),
    keyboard: mockKeyboard,
  };

  const mockBrowser = {
    connected: true,
    newPage: vi.fn().mockResolvedValue(mockPage),
  };

  return { mockPage, mockBrowser, mockKeyboard };
});

vi.mock("../utils/browser.js", () => ({
  getBrowser: vi.fn().mockResolvedValue(mockBrowser),
}));

import {
  navigateTo,
  clickElement,
  typeIntoElement,
  selectOption,
  scrollPage,
  waitForElement,
  getElementInfo,
  getInteractionPage,
  resetActivePage,
} from "../tools/interact.js";

// ── Tests ────────────────────────────────────────────────────────

describe("interact tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetActivePage();

    // Reset default mock behaviors
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.title.mockResolvedValue("Test Page");
    mockPage.url.mockReturnValue("http://localhost:3000");
    mockPage.screenshot.mockResolvedValue(Buffer.from("fake-screenshot"));
    mockPage.isClosed.mockReturnValue(false);
    mockPage.evaluate.mockResolvedValue(undefined);
    mockPage.waitForSelector.mockResolvedValue(undefined);
  });

  // ── getInteractionPage ──────────────────────────────────────

  describe("getInteractionPage", () => {
    it("creates a new page with default viewport", async () => {
      const page = await getInteractionPage();

      expect(page).toBe(mockPage);
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1440,
        height: 900,
        deviceScaleFactor: 2,
      });
    });

    it("reuses existing page on subsequent calls", async () => {
      await getInteractionPage();
      await getInteractionPage();

      expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);
    });

    it("creates a new page if existing one is closed", async () => {
      await getInteractionPage();
      mockPage.isClosed.mockReturnValue(true);

      await getInteractionPage();

      expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
    });
  });

  // ── navigateTo ──────────────────────────────────────────────

  describe("navigateTo", () => {
    it("returns url, title, status, and screenshot", async () => {
      const result = await navigateTo("http://localhost:3000");

      expect(result.url).toBe("http://localhost:3000");
      expect(result.title).toBe("Test Page");
      expect(result.status).toBe(200);
      expect(result.screenshot).toBe(Buffer.from("fake-screenshot").toString("base64"));
    });

    it("calls page.goto with networkidle2", async () => {
      await navigateTo("http://localhost:3000/about");

      expect(mockPage.goto).toHaveBeenCalledWith("http://localhost:3000/about", {
        waitUntil: "networkidle2",
        timeout: 30_000,
      });
    });

    it("returns null status when response is null", async () => {
      mockPage.goto.mockResolvedValue(null);

      const result = await navigateTo("http://localhost:3000");

      expect(result.status).toBeNull();
    });

    it("propagates navigation errors", async () => {
      mockPage.goto.mockRejectedValue(new Error("Navigation timeout"));

      await expect(navigateTo("http://localhost:3000")).rejects.toThrow(
        "Navigation timeout"
      );
    });
  });

  // ── clickElement ────────────────────────────────────────────

  describe("clickElement", () => {
    it("clicks an element and returns screenshot", async () => {
      const result = await clickElement("button.submit");

      expect(result.clicked).toBe(true);
      expect(result.selector).toBe("button.submit");
      expect(result.screenshot).toBeDefined();
    });

    it("waits for selector to be visible before clicking", async () => {
      await clickElement("#btn");

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("#btn", {
        visible: true,
        timeout: 10_000,
      });
      expect(mockPage.click).toHaveBeenCalledWith("#btn");
    });

    it("navigates to url before clicking when url is provided", async () => {
      await clickElement("a.link", { url: "http://localhost:3000/page" });

      expect(mockPage.goto).toHaveBeenCalledWith("http://localhost:3000/page", {
        waitUntil: "networkidle2",
        timeout: 30_000,
      });
      expect(mockPage.click).toHaveBeenCalledWith("a.link");
    });

    it("does not navigate when url is not provided", async () => {
      await clickElement("button");

      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    it("waits after click when waitAfter is specified", async () => {
      const start = Date.now();
      await clickElement("button", { waitAfter: 100 });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(50);
    });

    it("throws when element not found", async () => {
      mockPage.waitForSelector.mockRejectedValue(
        new Error("Waiting for selector `#missing` failed: timeout 10000ms exceeded")
      );

      await expect(clickElement("#missing")).rejects.toThrow("timeout");
    });
  });

  // ── typeIntoElement ─────────────────────────────────────────

  describe("typeIntoElement", () => {
    it("types text into an element and returns result", async () => {
      const result = await typeIntoElement("input#email", "test@example.com");

      expect(result.typed).toBe(true);
      expect(result.selector).toBe("input#email");
      expect(result.text).toBe("test@example.com");
      expect(result.screenshot).toBeDefined();
    });

    it("waits for selector before typing", async () => {
      await typeIntoElement("#search", "hello");

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("#search", {
        visible: true,
        timeout: 10_000,
      });
      expect(mockPage.type).toHaveBeenCalledWith("#search", "hello");
    });

    it("clears field when clearFirst is true", async () => {
      await typeIntoElement("#name", "new value", { clearFirst: true });

      expect(mockPage.click).toHaveBeenCalledWith("#name", { count: 3 });
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Backspace");
      expect(mockPage.type).toHaveBeenCalledWith("#name", "new value");
    });

    it("does not clear field when clearFirst is false", async () => {
      await typeIntoElement("#name", "appended");

      expect(mockPage.click).not.toHaveBeenCalled();
      expect(mockPage.keyboard.press).not.toHaveBeenCalledWith("Backspace");
    });

    it("presses Enter when pressEnter is true", async () => {
      await typeIntoElement("#search", "query", { pressEnter: true });

      expect(mockPage.type).toHaveBeenCalledWith("#search", "query");
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter");
    });

    it("does not press Enter when pressEnter is not set", async () => {
      await typeIntoElement("#search", "query");

      expect(mockPage.keyboard.press).not.toHaveBeenCalledWith("Enter");
    });

    it("navigates when url is provided", async () => {
      await typeIntoElement("#input", "text", {
        url: "http://localhost:3000/form",
      });

      expect(mockPage.goto).toHaveBeenCalledWith(
        "http://localhost:3000/form",
        expect.any(Object)
      );
    });
  });

  // ── selectOption ────────────────────────────────────────────

  describe("selectOption", () => {
    it("selects an option and returns result", async () => {
      const result = await selectOption("#country", "us");

      expect(result.selected).toBe(true);
      expect(result.value).toBe("us");
      expect(result.screenshot).toBeDefined();
    });

    it("waits for the select element", async () => {
      await selectOption("select#size", "large");

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("select#size", {
        timeout: 10_000,
      });
      expect(mockPage.select).toHaveBeenCalledWith("select#size", "large");
    });

    it("navigates when url is provided", async () => {
      await selectOption("#dropdown", "val", {
        url: "http://localhost:3000/form",
      });

      expect(mockPage.goto).toHaveBeenCalledWith(
        "http://localhost:3000/form",
        expect.any(Object)
      );
    });
  });

  // ── scrollPage ──────────────────────────────────────────────

  describe("scrollPage", () => {
    it("scrolls down by default amount", async () => {
      const result = await scrollPage();

      expect(result.scrolled).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it("scrolls up when direction is up", async () => {
      await scrollPage({ direction: "up", amount: 300 });

      // The evaluate call should pass negative pixels for up
      const evaluateCall = mockPage.evaluate.mock.calls[0];
      expect(evaluateCall[1]).toBe(-300);
    });

    it("scrolls down with positive pixels", async () => {
      await scrollPage({ direction: "down", amount: 800 });

      const evaluateCall = mockPage.evaluate.mock.calls[0];
      expect(evaluateCall[1]).toBe(800);
    });

    it("scrolls to selector when toSelector is provided", async () => {
      await scrollPage({ toSelector: "#footer" });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("#footer", {
        timeout: 10_000,
      });
      // The evaluate call should use the selector
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        "#footer"
      );
    });

    it("navigates when url is provided", async () => {
      await scrollPage({ url: "http://localhost:3000/long-page" });

      expect(mockPage.goto).toHaveBeenCalledWith(
        "http://localhost:3000/long-page",
        expect.any(Object)
      );
    });
  });

  // ── waitForElement ──────────────────────────────────────────

  describe("waitForElement", () => {
    it("returns element info when found", async () => {
      mockPage.evaluate.mockResolvedValue({
        tagName: "div",
        textContent: "Hello World",
      });

      const result = await waitForElement(".content");

      expect(result.found).toBe(true);
      expect(result.selector).toBe(".content");
      expect(result.tagName).toBe("div");
      expect(result.textContent).toBe("Hello World");
    });

    it("uses default timeout of 10000ms", async () => {
      mockPage.evaluate.mockResolvedValue({
        tagName: "span",
        textContent: "",
      });

      await waitForElement("#loader");

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("#loader", {
        timeout: 10_000,
      });
    });

    it("uses custom timeout", async () => {
      mockPage.evaluate.mockResolvedValue({
        tagName: "div",
        textContent: "",
      });

      await waitForElement("#slow-element", { timeout: 30_000 });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("#slow-element", {
        timeout: 30_000,
      });
    });

    it("passes visible option to waitForSelector", async () => {
      mockPage.evaluate.mockResolvedValue({
        tagName: "button",
        textContent: "Submit",
      });

      await waitForElement("button", { visible: true });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith("button", {
        timeout: 10_000,
        visible: true,
      });
    });

    it("navigates when url is provided", async () => {
      mockPage.evaluate.mockResolvedValue({
        tagName: "h1",
        textContent: "Title",
      });

      await waitForElement("h1", { url: "http://localhost:3000/page" });

      expect(mockPage.goto).toHaveBeenCalledWith(
        "http://localhost:3000/page",
        expect.any(Object)
      );
    });

    it("throws when element not found within timeout", async () => {
      mockPage.waitForSelector.mockRejectedValue(
        new Error("Waiting for selector `.missing` failed: timeout 10000ms exceeded")
      );

      await expect(waitForElement(".missing")).rejects.toThrow("timeout");
    });
  });

  // ── getElementInfo ──────────────────────────────────────────

  describe("getElementInfo", () => {
    const mockElementData = {
      tagName: "button",
      textContent: "Click Me",
      attributes: { id: "submit-btn", class: "btn primary", type: "submit" },
      boundingBox: { x: 100, y: 200, width: 150, height: 40 },
      computedStyles: {
        color: "rgb(255, 255, 255)",
        backgroundColor: "rgb(0, 123, 255)",
        fontSize: "16px",
        fontFamily: "Arial, sans-serif",
        fontWeight: "600",
        display: "inline-block",
        visibility: "visible",
      },
      isVisible: true,
    };

    it("returns structured element information", async () => {
      mockPage.evaluate.mockResolvedValue(mockElementData);

      const result = await getElementInfo("#submit-btn");

      expect(result.tagName).toBe("button");
      expect(result.textContent).toBe("Click Me");
      expect(result.isVisible).toBe(true);
      expect(result.screenshot).toBeDefined();
    });

    it("returns element attributes", async () => {
      mockPage.evaluate.mockResolvedValue(mockElementData);

      const result = await getElementInfo("#submit-btn");

      expect(result.attributes).toEqual({
        id: "submit-btn",
        class: "btn primary",
        type: "submit",
      });
    });

    it("returns bounding box", async () => {
      mockPage.evaluate.mockResolvedValue(mockElementData);

      const result = await getElementInfo("#submit-btn");

      expect(result.boundingBox).toEqual({
        x: 100,
        y: 200,
        width: 150,
        height: 40,
      });
    });

    it("returns computed styles", async () => {
      mockPage.evaluate.mockResolvedValue(mockElementData);

      const result = await getElementInfo("#submit-btn");

      expect(result.computedStyles.color).toBe("rgb(255, 255, 255)");
      expect(result.computedStyles.backgroundColor).toBe("rgb(0, 123, 255)");
      expect(result.computedStyles.fontSize).toBe("16px");
      expect(result.computedStyles.fontWeight).toBe("600");
      expect(result.computedStyles.display).toBe("inline-block");
    });

    it("navigates when url is provided", async () => {
      mockPage.evaluate.mockResolvedValue(mockElementData);

      await getElementInfo(".header", {
        url: "http://localhost:3000/dashboard",
      });

      expect(mockPage.goto).toHaveBeenCalledWith(
        "http://localhost:3000/dashboard",
        expect.any(Object)
      );
    });

    it("throws when element not found", async () => {
      mockPage.waitForSelector.mockRejectedValue(
        new Error("Element not found: #nonexistent")
      );

      await expect(getElementInfo("#nonexistent")).rejects.toThrow(
        "Element not found"
      );
    });
  });

  // ── Immutability ────────────────────────────────────────────

  describe("immutability", () => {
    it("navigateTo returns a frozen-shape result", async () => {
      const result = await navigateTo("http://localhost:3000");

      // Verify it's a plain object with expected keys (not mutated)
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining(["url", "title", "status", "screenshot"])
      );
    });

    it("clickElement returns a frozen-shape result", async () => {
      const result = await clickElement("button");

      expect(Object.keys(result)).toEqual(
        expect.arrayContaining(["clicked", "selector", "screenshot"])
      );
    });
  });
});
