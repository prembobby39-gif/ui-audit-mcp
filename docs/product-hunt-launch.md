# UIMax MCP -- Product Hunt Launch Prep

> **Status:** Draft -- do NOT post yet. This is launch content only.
> **Product:** [UIMax MCP](https://github.com/prembobby39-gif/uimax-mcp)
> **Version at launch:** 0.4.0
> **Category:** Developer Tools / Open Source
> **Pricing:** Free (MIT license)

---

## 1. Tagline (60 chars max)

**Primary (recommended):**

> Turn Claude Code into a frontend expert -- free

(49 chars)

**Alternatives:**

- `One command to audit, review, and fix your UI` (48 chars)
- `Free frontend expert for Claude Code` (37 chars)
- `Screenshot, audit, review, fix -- one MCP command` (51 chars)

---

## 2. First Paragraph (the hook)

> Every frontend dev knows the loop: take a screenshot, open Lighthouse, run an accessibility checker, review your own code, compile findings, then figure out fixes. UIMax MCP collapses that entire cycle into a single command. Say "review my UI at localhost:3000" in Claude Code and it captures a real screenshot, runs Google Lighthouse, audits accessibility with axe-core, measures Core Web Vitals, scans your code for 25+ anti-patterns, and then Claude acts as a senior frontend engineer who reviews everything and implements the fixes in your actual codebase. It's completely free -- MIT-licensed, no API keys, no extra costs. If you have a Claude Code subscription, you already have everything you need.

---

## 3. Full Description

### The Problem

Building frontend is fast. Getting expert feedback on it is slow.

You finish a feature, and now you need to check: Does it look right? Is it accessible? How does Lighthouse score it? Are there code smells? You end up juggling 4-5 different tools, copying results into a doc, and then translating findings into code changes. Most of the time, you skip half of it because the feedback loop is too painful.

AI coding assistants can help write code, but they can't *see* your running app. They don't know your Lighthouse scores. They can't detect WCAG violations in the rendered DOM. They review code in a vacuum.

### The Solution

UIMax MCP bridges that gap. It's an MCP server that gives Claude Code eyes and ears for your frontend.

One command -- `"review my UI at localhost:3000"` -- triggers a full pipeline:

1. **Screenshot capture** via Puppeteer (Claude can see your actual rendered UI)
2. **Accessibility audit** via axe-core (real WCAG 2.1 Level A & AA violations)
3. **Lighthouse audit** (real Google Lighthouse -- Performance, Accessibility, Best Practices, SEO scores)
4. **Core Web Vitals** via Performance API (FCP, LCP, CLS, TBT)
5. **Code analysis** scanning 25+ anti-pattern rules across accessibility, design, performance, and code quality
6. **Expert review methodology** baked into the prompt so Claude acts as a senior frontend engineer
7. **Automatic implementation** -- Claude edits your actual code files, starting from critical issues

All the data collection happens in the MCP server. The expert review and code fixes happen through Claude Code using your existing subscription. Zero extra cost.

### 13 Tools Included

| Tool | What it does |
|------|-------------|
| `review_ui` | Full pipeline -- screenshot + Lighthouse + axe + perf + code scan + expert review |
| `quick_review` | Fast design-only review from a screenshot |
| `lighthouse_audit` | Real Google Lighthouse scores and failing audit details |
| `compare_screenshots` | Pixel-level before/after diff using pixelmatch |
| `export_report` | Standalone HTML report (dark themed, zero dependencies) |
| `screenshot` | High-res PNG capture of any URL |
| `responsive_screenshots` | Mobile (375px), tablet (768px), desktop (1440px) captures |
| `check_dark_mode` | Detects dark mode support, compares light vs dark screenshots |
| `accessibility_audit` | axe-core WCAG 2.1 audit with violations grouped by severity |
| `performance_audit` | Core Web Vitals + DOM stats + JS heap size |
| `crawl_and_review` | Multi-page audit -- crawls internal links, audits up to 10 pages |
| `analyze_code` | 25+ rule code scanner with configurable severity |
| *3 expert prompts* | `ui-review`, `responsive-review`, `quick-design-review` |

### Key Differentiators

- **Free and open source** (MIT). No API keys, no SaaS, no usage limits.
- **Real Lighthouse** -- not a simulation, not a proxy. Actual Google Lighthouse running in your browser.
- **Pixel-level visual diff** -- pixelmatch-powered before/after comparison with red-highlighted diff images.
- **Multi-page crawl** -- give it one URL and it discovers internal links, auditing up to 10 pages automatically.
- **Expert methodology, not just data** -- the review prompt makes Claude act as a senior frontend engineer with a structured review framework (visual design, UX, accessibility, performance, code quality, creative patterns).
- **Fixes your code** -- doesn't just report problems. Claude implements every fix in your actual codebase.
- **Framework-aware** -- auto-detects React, Next.js, Vue, Nuxt, Svelte, SvelteKit, Angular, or plain HTML.
- **Configurable** -- `.uimaxrc.json` lets you toggle rules, override severity, and ignore patterns.

### Tech Stack

- **Puppeteer** (puppeteer-core) -- screenshot capture, browser automation
- **axe-core** -- WCAG 2.1 accessibility engine
- **Google Lighthouse** -- performance, accessibility, best practices, SEO scoring
- **pixelmatch + pngjs** -- pixel-level image diffing
- **Zod** -- input validation
- **TypeScript** -- full type safety
- **Vitest** -- 214 tests passing, 87% coverage

### Installation

```bash
claude mcp add uimax -- npx -y uimax-mcp
```

One command. No configuration. No API keys. Works immediately.

---

## 4. Screenshots Needed

Prepare 4-5 high-quality screenshots (1270x760px recommended for Product Hunt gallery). Use a clean terminal theme and a real project for authenticity.

### Screenshot 1: The Review Command in Action

**What to capture:** Claude Code terminal showing the full `review_ui` pipeline executing. The user's prompt should be visible ("Review my UI at localhost:3000") and Claude's response should show it calling the tool, with the step-by-step output (capturing screenshot, running Lighthouse, running axe-core, etc.).

**Why it matters:** This is the hero image. It shows the "one command" value prop immediately. People need to see how simple the workflow is.

**Tips:** Use a real project (not a blank page). Make sure the terminal font is readable at the PH gallery size.

### Screenshot 2: Audit Results -- Lighthouse Scores + Accessibility Violations

**What to capture:** Claude Code displaying the audit results: Lighthouse scores (e.g., Performance: 92, Accessibility: 78, Best Practices: 100, SEO: 90), followed by axe-core violations with severity levels and fix instructions. Show Claude's expert analysis interpreting the data.

**Why it matters:** This proves it's not a toy -- real Lighthouse, real axe-core, real scores. Developers immediately understand the value.

**Tips:** Ideally show a project with a mix of good and bad scores so the audit feels authentic, not staged.

### Screenshot 3: Before/After Pixel Diff

**What to capture:** The `compare_screenshots` output showing two screenshots side by side (or sequentially) with the red-highlighted diff image and the pixel difference percentage. Best if the "after" shows fixes applied by Claude.

**Why it matters:** Visual regression is a pain point every frontend dev recognizes. The pixel diff is a "wow" feature that's immediately understandable.

**Tips:** Use a real before/after where Claude fixed accessibility issues (e.g., contrast improvements). The red diff overlay is visually striking.

### Screenshot 4: Exported HTML Report

**What to capture:** The standalone HTML report opened in a browser. Show the dark-themed report with embedded screenshot, Lighthouse scores, accessibility violations, and code findings. The browser URL bar should show a local file path to emphasize it's a standalone file.

**Why it matters:** This shows the "share with your team" use case. Developers can attach this to PRs or send to clients.

**Tips:** Take a browser screenshot, not a terminal screenshot. The dark theme looks great in a gallery.

### Screenshot 5: Multi-Page Crawl Results

**What to capture:** The `crawl_and_review` output showing results for multiple pages (e.g., homepage, about, pricing, docs) with per-page accessibility counts and performance metrics. Show the summary section.

**Why it matters:** Most audit tools are single-page. Crawling an entire site from one command is a clear differentiator.

**Tips:** Use a site with 4-5 discoverable pages. The tabular output with per-page stats is visually compelling.

### Bonus: Architecture Diagram

**Optional:** A clean diagram showing the data flow: User prompt -> Claude Code -> UIMax MCP (Puppeteer + axe-core + Lighthouse + code scanner) -> data back to Claude -> expert review + auto-fix. The README already has an ASCII version; a polished visual version would work well in the gallery.

---

## 5. Launch Strategy

### Timing

- **Best day:** Tuesday, Wednesday, or Thursday for maximum traffic. However, **Saturday or Sunday** can work well for developer tools because the developer share of PH traffic is higher on weekends and competition is lower.
- **Recommended:** Launch on a **Tuesday or Wednesday** for the best balance of traffic and competition.
- **Time:** Product Hunt launches go live at **12:01 AM Pacific Time**. Be ready at that exact moment.

### Pre-Launch (1-2 weeks before)

- [ ] Set up the Product Hunt product page (ship page) and collect followers
- [ ] Engage with the PH community: upvote and leave thoughtful comments on other developer tools
- [ ] Prepare all 5 screenshots at 1270x760px
- [ ] Write and polish the maker comment (see Section 6)
- [ ] Draft social media posts (see Section 7)
- [ ] Build a list of communities to notify: Claude Code Discord/community, MCP-related Discord servers, relevant subreddits (r/webdev, r/frontend, r/ClaudeAI, r/programming), Hacker News, Indie Hackers, Dev.to
- [ ] Reach out to 5-10 developers who use Claude Code and ask if they'd be willing to try UIMax and leave honest feedback on launch day
- [ ] Ensure GitHub README is polished, badges are accurate, and the repo looks professional
- [ ] Confirm npm package `uimax-mcp` installs cleanly with `npx -y uimax-mcp`

### Launch Day -- First 4 Hours (Critical Window)

Product Hunt hides upvote counts during the first 4 hours and sorts the homepage loosely. This window determines your positioning for the rest of the day.

**At 12:01 AM PT:**
- [ ] Verify the launch page is live
- [ ] Post the maker comment immediately (already drafted, just paste it)
- [ ] Post on Twitter/X with the PH link
- [ ] Send announcement to email list / Discord / Slack communities
- [ ] Post on relevant subreddits (follow each sub's self-promotion rules)
- [ ] DM the 5-10 developers you reached out to pre-launch

**First 4 hours (12:01 AM - 4:00 AM PT):**
- [ ] Respond to every comment within 15 minutes
- [ ] Be genuine and helpful -- answer technical questions in detail
- [ ] Thank people who share it
- [ ] Post 2-3 social media updates with different angles (accessibility, Lighthouse, pixel diff)

**Rest of the day:**
- [ ] Continue responding to all comments
- [ ] Share milestone updates on social ("We hit top 5!")
- [ ] Cross-post to Hacker News (Show HN) if not already done
- [ ] Post on Dev.to with a "how I built this" article

### Post-Launch (next 48 hours)

- [ ] Thank everyone who supported the launch
- [ ] Follow up with people who commented or signed up
- [ ] Write a "lessons learned" post for Indie Hackers or Dev.to
- [ ] Update the README with a "Featured on Product Hunt" badge
- [ ] Collect feedback and create GitHub issues for requested features

---

## 6. Maker Comment

Post this immediately when the launch goes live. It should be pinned to the top of the discussion.

---

Hey everyone -- I'm Prem, the solo dev behind UIMax MCP.

**Why I built this:**

I was using Claude Code for frontend work and kept hitting the same wall. Claude is great at writing code, but it can't *see* the running app. It doesn't know your Lighthouse score is 42. It can't tell that your button fails WCAG contrast requirements. It reviews code without any context about what the rendered output actually looks like.

So I built UIMax MCP to close that gap. It gives Claude Code real eyes: actual screenshots via Puppeteer, real Lighthouse scores (not simulated), axe-core accessibility audits on the live DOM, Core Web Vitals from the Performance API, and a code scanner for 25+ common anti-patterns.

The key insight: the MCP server handles all the data collection (screenshots, audits, metrics), and then Claude Code -- using your existing Pro subscription -- acts as the expert reviewer and implements fixes. That's why it's completely free. No API keys. No SaaS. No usage limits.

**What you get today (v0.4.0):**

- 13 tools: full review pipeline, Lighthouse, axe-core, pixel-level visual diff, multi-page crawl, responsive screenshots, dark mode detection, HTML report export, and more
- One-command install: `claude mcp add uimax -- npx -y uimax-mcp`
- 214 tests passing, 87% coverage
- Works with React, Next.js, Vue, Nuxt, Svelte, Angular, or plain HTML
- Configurable rules via `.uimaxrc.json`

**What's next:**

- CSS specificity analyzer
- Design token extraction
- Framework-specific checks (Vue composition API, Svelte stores)
- Performance budgets (fail if bundle > X KB)
- Custom rule plugins
- Figma design comparison (screenshot vs Figma mock)

I'd love to hear what you think. If you try it and something breaks, open an issue -- I respond to everything.

GitHub: https://github.com/prembobby39-gif/uimax-mcp

---

## 7. Social Copy

### Twitter/X -- Main Launch Post

```
UIMax MCP is live on Product Hunt.

One command turns Claude Code into a frontend expert:
- Real Lighthouse scores
- axe-core accessibility audit
- Pixel-level visual diff
- 25+ code anti-pattern checks
- Auto-implements every fix

Free. Open source. No API keys.

[PH link]
```

### Twitter/X -- Technical Thread (post as a thread)

**Tweet 1:**
```
I just launched UIMax MCP on Product Hunt.

It's an MCP server that gives Claude Code real eyes for your frontend.

One command: "review my UI at localhost:3000"

Here's what happens behind the scenes:
```

**Tweet 2:**
```
1. Puppeteer captures a real screenshot of your running app
2. axe-core runs a WCAG 2.1 audit on the live DOM
3. Google Lighthouse scores Performance, A11y, Best Practices, SEO
4. Performance API measures FCP, LCP, CLS, TBT
5. Code scanner checks 25+ anti-patterns
```

**Tweet 3:**
```
All that data goes back to Claude Code with an expert review methodology baked in.

Claude acts as a senior frontend engineer, generates a structured review, and then implements every fix in your actual codebase.

The MCP collects data. Your Claude subscription does the thinking. $0 extra.
```

**Tweet 4:**
```
Other things it can do:

- Pixel-level before/after diff (pixelmatch)
- Multi-page crawl (audits up to 10 pages from one URL)
- Responsive screenshots (mobile, tablet, desktop)
- Dark mode detection
- Standalone HTML report export

All 13 tools, one install command.
```

**Tweet 5:**
```
Install:
claude mcp add uimax -- npx -y uimax-mcp

That's it. No API keys. No config.

MIT licensed. 214 tests. 87% coverage.

Would love your feedback:
[PH link]
[GitHub link]
```

### LinkedIn Post

```
I just launched UIMax MCP on Product Hunt.

It's an open-source MCP server that turns Claude Code into a frontend expert.

The problem: AI coding assistants write code, but they can't see the running app. They don't know your Lighthouse score. They can't detect accessibility violations in the rendered DOM.

UIMax MCP fixes that. One command and it:

- Captures a real screenshot via Puppeteer
- Runs Google Lighthouse (real scores, not simulated)
- Audits accessibility with axe-core (WCAG 2.1)
- Measures Core Web Vitals
- Scans code for 25+ anti-patterns
- Then Claude reviews everything as a senior frontend engineer and implements fixes

Free. MIT licensed. No API keys. One-command install.

Built this as a solo dev because I kept wishing Claude could just *see* what my frontend looked like.

Check it out on Product Hunt: [link]
GitHub: https://github.com/prembobby39-gif/uimax-mcp
```

### Reddit (r/webdev or r/ClaudeAI)

```
Title: I built an MCP server that turns Claude Code into a frontend expert (free, open source)

I got tired of the manual frontend review loop -- screenshot, Lighthouse, axe, code review, compile findings, figure out fixes.

So I built UIMax MCP. It's an MCP server that does all the data collection (Puppeteer screenshots, real Lighthouse, axe-core a11y audit, Core Web Vitals, 25+ code pattern checks) and then Claude Code acts as a senior frontend engineer using your existing subscription.

One command: "review my UI at localhost:3000"

It captures the screenshot, runs all audits, generates an expert review, and implements every fix. Zero extra cost.

13 tools total including pixel-level visual diff, multi-page crawl, responsive screenshots, dark mode detection, and HTML report export.

Install: claude mcp add uimax -- npx -y uimax-mcp

MIT licensed. 214 tests. 87% coverage.

Just launched on Product Hunt today: [link]
GitHub: https://github.com/prembobby39-gif/uimax-mcp

Happy to answer any questions about how it works under the hood.
```

### Hacker News (Show HN)

```
Title: Show HN: UIMax MCP -- Turn Claude Code into a frontend expert (free, open source)

URL: https://github.com/prembobby39-gif/uimax-mcp

Text: UIMax MCP is an MCP server that gives Claude Code real eyes for your frontend. One command triggers: Puppeteer screenshot capture, Google Lighthouse audit, axe-core WCAG 2.1 scan, Core Web Vitals measurement, and 25+ code anti-pattern checks. Claude then acts as a senior frontend engineer and implements fixes.

Tech: Puppeteer-core, axe-core, Lighthouse, pixelmatch, Zod, TypeScript. 214 tests, 87% coverage.

It's free because the MCP handles data collection, and your existing Claude subscription handles the expert review. No API keys, no SaaS.

Install: claude mcp add uimax -- npx -y uimax-mcp

13 tools including pixel-level visual diff, multi-page crawl, responsive screenshots, dark mode detection, and standalone HTML report export.
```

---

## 8. Launch Day Checklist (Quick Reference)

```
PRE-LAUNCH
[ ] Product Hunt page set up with all screenshots
[ ] Maker comment drafted and ready to paste
[ ] Social posts drafted (Twitter, LinkedIn, Reddit, HN)
[ ] 5-10 supporters notified and ready
[ ] npm package tested: npx -y uimax-mcp works cleanly
[ ] GitHub repo polished

LAUNCH (12:01 AM PT)
[ ] Verify PH page is live
[ ] Post maker comment
[ ] Tweet main launch post
[ ] Post LinkedIn
[ ] DM supporters
[ ] Notify Discord/Slack communities

FIRST 4 HOURS
[ ] Respond to every PH comment within 15 min
[ ] Post Twitter thread
[ ] Post to r/webdev and r/ClaudeAI
[ ] Submit Show HN

REST OF DAY
[ ] Keep responding to comments
[ ] Share milestone updates
[ ] Post to Dev.to / Indie Hackers

POST-LAUNCH (48 hours)
[ ] Thank supporters
[ ] Collect feedback -> GitHub issues
[ ] Add PH badge to README
[ ] Write launch retrospective
```

---

## Research Sources

- [Product Hunt Launch Playbook (30x #1 Winner)](https://dev.to/iris1031/product-hunt-launch-playbook-the-definitive-guide-30x-1-winner-48g5)
- [How to launch a developer tool on Product Hunt in 2026](https://hackmamba.io/developer-marketing/how-to-launch-on-product-hunt/)
- [The best day to launch on Product Hunt](https://fmerian.medium.com/the-best-day-to-launch-on-product-hunt-eefe090fcc4a)
- [awesome-product-hunt launch guide](https://github.com/fmerian/awesome-product-hunt/blob/main/product-hunt-launch-guide.md)
- [Product Hunt Launch Checklist (Whale)](https://usewhale.io/blog/product-hunt-launch-checklist/)
- [How to successfully launch on Product Hunt in 2025](https://www.marketingideas.com/p/how-to-successfully-launch-on-product)
- [Product Hunt Launch Guide 2026 for Indie Hackers](https://calmops.com/indie-hackers/product-hunt-launch-guide/)
