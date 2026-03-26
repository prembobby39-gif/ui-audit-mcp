# UIMax MCP

**Turns Claude Code into a frontend expert that reviews and fixes your UI automatically.**

<p align="center">
  <img src="https://img.shields.io/npm/v/uimax-mcp" alt="npm version" />
  <img src="https://img.shields.io/npm/dm/uimax-mcp" alt="npm downloads" />
  <img src="https://img.shields.io/npm/l/uimax-mcp" alt="license" />
  <img src="https://img.shields.io/badge/tools-16-blue" alt="16 tools" />
  <img src="https://img.shields.io/badge/tests-301%20passing-brightgreen" alt="301 tests passing" />
  <img src="https://img.shields.io/badge/coverage-87%25-brightgreen" alt="87% coverage" />
  <img src="https://img.shields.io/badge/cost-free%20(Pro%20plan)-brightgreen" alt="free for Pro plan" />
</p>

One command — *"review my UI at localhost:3000"* — and it:

1. **Sees your app** — captures a real screenshot via Puppeteer
2. **Audits accessibility** — runs axe-core for WCAG 2.1 violations
3. **Runs Lighthouse** — real Google Lighthouse scores (Performance, Accessibility, Best Practices, SEO)
4. **Measures performance** — captures Core Web Vitals (FCP, LCP, CLS, TBT)
5. **Scans your code** — checks for 25+ anti-patterns across accessibility, design, and code quality
6. **Generates an expert review** — Claude acts as a senior frontend engineer with a baked-in review methodology
7. **Implements the fixes** — edits your actual code files, starting from critical issues down

**Free for all Claude Code users (Pro plan and above). No API keys. No extra costs. Just install and go.**

```bash
claude mcp add uimax -- npx -y uimax-mcp
```

---

## The Problem

You're building a frontend. You want expert-level feedback on your UI — visual design, accessibility, performance, code quality. Normally you'd need to:

1. Take screenshots manually
2. Run Lighthouse / axe separately
3. Review your own code with fresh eyes
4. Compile all findings into a coherent review
5. Then figure out the fixes

**That's 5 steps too many.**

## Quick Start

### Install as MCP Server (for Claude Code)

```bash
# Add to Claude Code — that's it, no API keys needed
claude mcp add uimax -- npx -y uimax-mcp
```

That's it. Now in any Claude Code conversation:

```
You: Review the UI at http://localhost:3000, source code is in ./src

Claude Code calls review_ui ->
  1. Captures screenshot of your running app
  2. Runs axe-core accessibility audit
  3. Runs Google Lighthouse (Performance, A11y, Best Practices, SEO)
  4. Measures Core Web Vitals
  5. Scans source code for 25+ anti-patterns
  6. Returns screenshot + all data + expert review methodology
  7. Claude Code generates expert review (using YOUR Pro plan -- $0 extra)
  8. Claude Code implements every fix automatically
```

### Install Globally

```bash
npm install -g uimax-mcp
```

---

## Tools

The MCP server exposes **16 tools** that Claude uses automatically:

### `review_ui` -- Full Automated Pipeline

This is the main tool. One call does **everything**:
1. Captures screenshot of your running app
2. Runs accessibility audit (axe-core WCAG 2.1)
3. Runs Google Lighthouse (scores + key audits)
4. Measures Core Web Vitals via Performance API
5. Scans your source code for anti-patterns
6. Returns ALL data + expert frontend review methodology to Claude Code
7. Claude Code generates the expert review and implements fixes

```
Input:  URL + code directory
Output: Screenshot + Lighthouse scores + audit data + expert methodology
        -> Claude Code generates review + implements every fix
```

> **100% free for Pro plan users.** The MCP handles data collection. Claude Code (your existing subscription) handles the expert review and implementation. No API keys. No extra charges.

### `quick_review`
Fast design-only review. Captures a screenshot and returns it with a focused design methodology. No code analysis, no performance audit. Good for rapid iteration.

### `lighthouse_audit`
Runs a full **Google Lighthouse** audit and returns real scores for:
- **Performance** (0-100)
- **Accessibility** (0-100)
- **Best Practices** (0-100)
- **SEO** (0-100)

Plus detailed findings for failing audits with fix instructions. This is the real Lighthouse — the same tool Chrome DevTools uses.

### `compare_screenshots`
**Before/after visual comparison with pixel-level diffing.** Give it two URLs — captures both, runs `pixelmatch` to compute exact pixel differences, and generates a red-highlighted diff image showing what changed. Perfect for:
- Verifying UI fixes actually changed what you expected
- Comparing staging vs production
- Visual regression checking

```
Input:  URL A ("before") + URL B ("after")
Output: Both screenshots + diff image + pixel difference % + pixels changed + dimensions
```

### `export_report`
Generates a **standalone HTML report** with everything embedded — screenshot, accessibility violations, Lighthouse scores, performance metrics, code findings. Dark themed, zero external dependencies. Share it with your team, attach it to a PR, or email it to a client.

```
Input:  URL + code directory + output path (optional)
Output: Self-contained HTML file at the specified path
```

### `screenshot`
Captures a high-resolution PNG screenshot of any URL. Claude can see the image directly and analyze visual design, layout, spacing, typography, and color usage.

### `responsive_screenshots`
Captures screenshots at **mobile (375px)**, **tablet (768px)**, and **desktop (1440px)** viewports. Perfect for reviewing responsive design.

### `check_dark_mode`
Detects whether your app supports dark mode. Captures two screenshots — light mode and dark mode (emulated via `prefers-color-scheme: dark`) — and compares them. Returns both screenshots + a difference percentage.

### `accessibility_audit`
Injects [axe-core](https://github.com/dequelabs/axe-core) into the page and runs a WCAG 2.1 Level A & AA audit. Returns violations grouped by severity with fix instructions.

### `performance_audit`
Measures Core Web Vitals using the browser's Performance API:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Total Blocking Time (TBT)
- DOM node count, resource count, JS heap size

### `crawl_and_review`
**Multi-page audit from a single URL.** Give it one URL and it discovers all internal links, then audits up to 10 pages — each getting a screenshot, axe-core accessibility audit, and Core Web Vitals measurement. Perfect for reviewing an entire site without running page-by-page.

```
Input:  Starting URL + maxPages (optional, default 5) + code directory (optional)
Output: Per-page screenshots + accessibility issues + performance metrics + overall summary
```

### `save_baseline`
Save the current audit state for a URL as a baseline snapshot. Runs accessibility, performance, and Lighthouse audits, then appends the results to `.uimax-history.json` in your project directory. Use this before making changes so you can compare later.

```
Input:  URL + optional code directory
Output: Baseline entry saved to .uimax-history.json
```

### `compare_to_baseline`
Compare the current audit state of a URL against its most recent saved baseline. Runs fresh audits, loads the previous baseline, and shows what improved and what regressed. Automatically saves the new results as the latest baseline.

```
Input:  URL + optional code directory
Output: Improvements, regressions, and unchanged metrics
```

### `check_budgets`
Check if the current site meets performance budgets defined in `.uimaxrc.json`. Runs fresh audits and compares against budget thresholds for Lighthouse scores, Web Vitals, accessibility violations, and code issues. Returns pass/fail with details of any exceeded budgets.

```
Input:  URL + optional code directory (for .uimaxrc.json)
Output: Pass/fail status + details of any budget violations
```

### `analyze_code`
Scans frontend source files for **25+ categories** of issues. Uses **AST-based analysis** (TypeScript compiler API) for `.ts/.tsx/.js/.jsx` files — catches bugs that regex misses, with zero false positives on string literals. Falls back to regex for other file types and rules without AST implementations. Supports custom configuration via `.uimaxrc.json` (see [Configuration](#configuration)).

**AST-powered rules** (zero false positives):
| Rule | What AST catches that regex misses |
|------|-----------------------------------|
| `react-hooks-conditional` | Hooks inside nested if/for/while/ternary — proper scope traversal |
| `missing-key-prop` | `.map()` callbacks returning JSX without `key` — handles arrow/block bodies |
| `empty-catch` | Empty catch blocks — not fooled by comments |
| `any-type` | `any` in type positions only — ignores "any" in strings/comments |
| `direct-dom-access` | `document.querySelector` etc. — proper call expression matching |
| `console-log` | `console.log/warn/error` — not fooled by variable names containing "console" |
| `inline-style` | JSX `style={}` attributes — proper attribute detection |

---

## Configuration

Create a `.uimaxrc.json` in your project root to customize code analysis:

```json
{
  "rules": {
    "console-log": "off",
    "magic-number": "off",
    "hardcoded-color": "warn",
    "inline-style": "error"
  },
  "severity": {
    "todo-fixme": "high"
  },
  "ignore": [
    "node_modules",
    "dist",
    "*.test.*",
    "*.spec.*"
  ]
}
```

- **`rules`** — Set any rule to `"off"`, `"warn"`, or `"error"`
- **`severity`** — Override severity: `"low"`, `"medium"`, `"high"`, `"critical"`
- **`ignore`** — Additional glob patterns to exclude from analysis
- **`budgets`** — Performance budgets for the `check_budgets` tool (see below)

### Performance Budgets

Add a `budgets` key to `.uimaxrc.json` to define thresholds:

```json
{
  "budgets": {
    "lighthouse": {
      "performance": 90,
      "accessibility": 95,
      "bestPractices": 90,
      "seo": 90
    },
    "webVitals": {
      "fcp": 1800,
      "lcp": 2500,
      "cls": 0.1,
      "tbt": 300
    },
    "maxAccessibilityViolations": 0,
    "maxCodeIssues": 10
  }
}
```

Run `check_budgets` to verify your site meets these thresholds.

UIMax searches for `.uimaxrc.json` in the target directory and up to 3 parent directories, so it works in monorepos.

---

## Prompts

Expert review prompts that guide Claude's analysis:

| Prompt | Use Case |
|--------|----------|
| `ui-review` | Comprehensive review (design + UX + a11y + perf + code) |
| `responsive-review` | Responsive design review across viewports |
| `quick-design-review` | Fast visual/UX feedback from a screenshot only |

---

## Example Workflows

### Full Review (the main workflow)
```
You: Review the UI at http://localhost:3000
     Source code is in /Users/me/project/src

Claude: [Calls review_ui]
        [Captures screenshot, runs Lighthouse + axe + perf + code scan]
        [Generates 20+ findings with specific fixes]
        [Implements every fix automatically]
```

### Before/After Comparison
```
You: Compare localhost:3000 with localhost:3001

Claude: [Calls compare_screenshots]
        [Shows both screenshots side by side]
        [Reports 23% visual difference]
        [Identifies what changed]
```

### Generate Shareable Report
```
You: Export a full report of localhost:3000 to ./report.html

Claude: [Calls export_report]
        [Runs all audits, generates standalone HTML]
        [Saves to ./report.html — open in any browser]
```

### Lighthouse Scores
```
You: Run Lighthouse on http://localhost:3000

Claude: [Calls lighthouse_audit]
        [Returns Performance: 92, Accessibility: 87, Best Practices: 100, SEO: 90]
        [Lists failing audits with fix instructions]
```

### Responsive Check
```
You: Check if my site is responsive - http://localhost:3000

Claude: [Calls responsive_screenshots]
        [Shows mobile, tablet, desktop views]
        [Identifies layout issues at each breakpoint]
```

### Quick Design Feedback
```
You: Take a screenshot of localhost:3000 and tell me
     what a senior designer would change

Claude: [Calls quick_review]
        [Provides focused design feedback + implements fixes]
```

### Accessibility Only
```
You: Run an accessibility audit on http://localhost:3000

Claude: [Calls accessibility_audit]
        [Reports WCAG violations with fix instructions]
```

---

## What Claude Reviews

When using the full `review_ui` pipeline, Claude evaluates:

| Category | What's Checked |
|----------|----------------|
| **Visual Design** | Layout, typography, color contrast, whitespace, shadows, icon consistency |
| **User Experience** | Navigation, interaction states, loading/error/empty states, edge cases |
| **Accessibility** | WCAG 2.1 AA, keyboard nav, screen reader compat, focus management |
| **Performance** | Lighthouse scores, Core Web Vitals, render-blocking resources, bundle size |
| **Code Quality** | Component architecture, CSS organization, error boundaries, TypeScript safety |
| **Creative** | Modern UI patterns (Linear, Vercel, Raycast), micro-interactions, animations |

---

## Code Analysis Rules

The `analyze_code` tool checks for **25+ rules** across categories:

| Rule | Severity | Category |
|------|----------|----------|
| `img-no-alt` | High | Accessibility |
| `click-no-keyboard` | High | Accessibility |
| `no-form-label` | High | Accessibility |
| `missing-viewport-meta` | High | Accessibility |
| `no-lang-attr` | Medium | Accessibility |
| `no-focus-visible` | Medium | Accessibility |
| `empty-catch` | High | Code Quality |
| `react-hooks-conditional` | High | Code Quality |
| `missing-key-prop` | High | Bug |
| `console-log` | Low | Code Quality |
| `todo-fixme` | Low | Code Quality |
| `inline-style` | Medium | Code Quality |
| `any-type` | Medium | Code Quality |
| `magic-number` | Low | Code Quality |
| `direct-dom-access` | Medium | Code Quality |
| `event-handler-inline` | Low | Code Quality |
| `important-css` | Medium | Design |
| `hardcoded-color` | Low | Design |
| `z-index-high` | Medium | Design |
| `font-too-small` | Medium | Design |
| `no-lazy-image` | Medium | Performance |
| `large-bundle-import` | Medium | Performance |
| `no-error-boundary` | Medium | UX |
| `missing-meta-description` | Medium | UX |
| `large-file` | Medium/High | Code Quality |
| `deep-nesting` | Medium/High | Code Quality |

All rules can be toggled via [`.uimaxrc.json`](#configuration).

---

## Supported Frameworks

Auto-detected from `package.json`:
- React / Next.js
- Vue / Nuxt
- Svelte / SvelteKit
- Angular
- Plain HTML/CSS/JS

---

## Requirements

- **Node.js** >= 18.0.0
- **Chrome/Chromium** (uses your system Chrome — no extra download)
- **Claude Code** (for MCP integration)
- **No API keys needed** — runs entirely within Claude Code using your existing Pro plan

---

## How It Works

```
+------------------------------------------------------------------+
|                  Claude Code (your Pro plan)                       |
|                                                                   |
|  User: "Review my UI at localhost:3000 and fix everything"        |
|           |                                                       |
|           v                                                       |
|  +------------------------------------------------------------+  |
|  |              UIMax MCP (data collection)                    |  |
|  |                                                             |  |
|  |  Screenshot -----> Puppeteer -------> PNG Image             |  |
|  |  Accessibility --> axe-core --------> WCAG Violations       |  |
|  |  Lighthouse -----> Google LH -------> Scores + Audits      |  |
|  |  Performance ----> Perf API --------> Web Vitals            |  |
|  |  Code Scan ------> File Analysis ---> Anti-patterns         |  |
|  |  Expert Prompt --> Baked-in methodology                     |  |
|  +-------------------------+----------------------------------+   |
|                            |                                      |
|                            v                                      |
|  Claude Code receives: screenshot + data + expert methodology     |
|                            |                                      |
|                            v                                      |
|  Claude acts as world-class frontend expert (FREE -- Pro plan)    |
|     Generates comprehensive review with exact fixes               |
|                            |                                      |
|                            v                                      |
|  Claude implements every fix in the codebase automatically        |
|                                                                   |
+------------------------------------------------------------------+
```

---

## Development

```bash
# Clone
git clone https://github.com/prembobby39-gif/uimax-mcp.git
cd uimax-mcp

# Install
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Test locally with Claude Code
claude mcp add uimax-dev -- node /path/to/uimax-mcp/dist/index.js
```

---

## Contributing

Contributions welcome! Some ideas:

- [ ] CSS specificity analyzer
- [ ] Design token extraction
- [ ] Framework-specific checks (Vue composition API, Svelte stores)
- [x] Visual regression with pixel-level diffing
- [x] Performance budgets (fail if scores drop below thresholds)
- [ ] Custom rule plugins (user-defined regex rules)
- [ ] Figma design comparison (screenshot vs Figma mock)

---

## License

MIT
