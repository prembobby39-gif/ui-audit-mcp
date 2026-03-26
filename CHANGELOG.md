# Changelog

All notable changes to UIMax MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-03-26

### Added
- **AST-based code analysis** — 7 rules now use TypeScript's compiler API instead of regex for zero false positives (`react-hooks-conditional`, `missing-key-prop`, `empty-catch`, `any-type`, `direct-dom-access`, `console-log`, `inline-style`)
- `save_baseline` tool — save current audit state to `.uimax-history.json` for tracking over time
- `compare_to_baseline` tool — compare current audit results against previous baseline, shows improvements and regressions
- `check_budgets` tool — enforce performance budgets from `.uimaxrc.json` (Lighthouse scores, Web Vitals, violation counts)
- Performance budgets configuration in `.uimaxrc.json` under `"budgets"` key
- CHANGELOG.md with full release history
- Product Hunt launch prep document
- CI auto-publish: `NPM_TOKEN` secret configured for automatic npm releases on git tags
- 87 new tests (AST analyzer, baselines, budgets)

### Changed
- Code analysis findings now tagged with `analysisMethod: "ast"` or `"regex"`
- Tool count: 13 → 16
- Test count: 214 → 301

## [0.4.0] - 2026-03-26

### Added
- Pixel-level visual diffing in `compare_screenshots` using pixelmatch — generates red-highlighted diff images showing exactly what changed
- `crawl_and_review` tool — discovers internal links from a URL and audits up to 10 pages with screenshots, axe-core, and performance metrics
- `.uimaxrc.example.json` with all 25+ rules documented
- 14 GitHub repository topics for discoverability
- 47 new tests (pixel-diff, compare, crawl)

### Changed
- npm keywords expanded from 14 to 20
- Added homepage, bugs, repository fields to package.json
- Tightened .npmignore for leaner published package
- Tool count: 12 → 13

## [0.3.1] - 2026-03-26

### Fixed
- Added `mcpName` field for official MCP registry compatibility
- Updated server.json version to match package version
- Excluded test files from npm package (107 → 63 files)

## [0.3.0] - 2026-03-26

### Added
- Google Lighthouse integration — real Performance, Accessibility, Best Practices, SEO scores
- `compare_screenshots` tool for before/after visual comparison
- `export_report` tool for standalone HTML reports (dark themed, zero dependencies)
- `lighthouse_audit` tool for standalone Lighthouse audits
- Custom rule configuration via `.uimaxrc.json` (toggle rules, override severity, ignore patterns)
- 167 tests with 87% coverage
- GitHub Actions CI/CD (Node 18/20/22 matrix, npm release on tag)
- 3 MCP prompts: ui-review, responsive-review, quick-design-review
- glama.json and server.json for MCP directory listings

### Changed
- Tool count: 9 → 12
- Updated README for v0.3.0 with 12 tools, config, Lighthouse, and examples
- Skip tests on Node 18 (vitest v4 requires Node 20+)

## [0.2.0] - 2026-03-26

### Added
- Dark mode detection
- 25+ code analysis rules
- Responsive screenshots (mobile/tablet/desktop)
- Core Web Vitals measurement
- Full automated review pipeline
- Quick review mode

### Changed
- Renamed project from ui-audit-mcp to UIMax MCP

### Fixed
- Framework detection fix

## [0.1.0] - 2026-03-25

### Added
- Initial release of ui-audit-mcp
- Screenshot capture via Puppeteer
- axe-core accessibility auditing (WCAG 2.1)
- Claude API integration for automated expert report generation

### Fixed
- Removed Anthropic API dependency — now 100% free for Pro users
