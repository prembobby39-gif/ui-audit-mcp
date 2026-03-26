import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { CodeFinding, CodeAnalysisResult, Severity, FindingCategory } from "../types.js";
import {
  collectFrontendFiles,
  detectFramework,
  type FileInfo,
} from "../utils/file-utils.js";
import {
  runAstAnalysis,
  canParseAsAst,
  AST_RULE_IDS,
  type AstFinding,
} from "../utils/ast-analyzer.js";

// ── Analysis Rules ─────────────────────────────────────────────────

interface Rule {
  readonly id: string;
  readonly severity: Severity;
  readonly category: FindingCategory;
  readonly message: string;
  readonly suggestion: string;
  readonly pattern: RegExp;
  readonly fileTypes: readonly string[];
}

const RULES: readonly Rule[] = [
  // ── Accessibility Rules ──
  {
    id: "img-no-alt",
    severity: "high",
    category: "accessibility",
    message: "Image element missing alt attribute",
    suggestion: "Add an alt attribute describing the image content, or alt=\"\" for decorative images",
    pattern: /<img(?![^>]*\balt\b)[^>]*>/gi,
    fileTypes: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
  },
  {
    id: "click-no-keyboard",
    severity: "high",
    category: "accessibility",
    message: "onClick handler without keyboard event handler (onKeyDown/onKeyUp)",
    suggestion: "Add onKeyDown or onKeyUp handler alongside onClick, or use a <button> element instead",
    pattern: /onClick\s*=\s*\{[^}]*\}(?![^<]*(?:onKeyDown|onKeyUp|onKeyPress))/gi,
    fileTypes: [".tsx", ".jsx"],
  },
  {
    id: "no-form-label",
    severity: "high",
    category: "accessibility",
    message: "Input element may be missing an associated label",
    suggestion: "Wrap input in a <label>, use htmlFor/for attribute, or add aria-label/aria-labelledby",
    pattern: /<input(?![^>]*(?:aria-label|aria-labelledby|id\s*=))[^>]*>/gi,
    fileTypes: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
  },
  {
    id: "no-lang-attr",
    severity: "medium",
    category: "accessibility",
    message: "HTML element missing lang attribute",
    suggestion: "Add lang attribute to <html> element (e.g., <html lang=\"en\">)",
    pattern: /<html(?![^>]*\blang\b)[^>]*>/gi,
    fileTypes: [".html"],
  },

  // ── Code Quality Rules ──
  {
    id: "console-log",
    severity: "low",
    category: "code-quality",
    message: "console.log statement found (likely debug code)",
    suggestion: "Remove console.log or replace with a proper logging utility",
    pattern: /console\.(log|debug|info)\s*\(/g,
    fileTypes: [".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte"],
  },
  {
    id: "todo-fixme",
    severity: "low",
    category: "code-quality",
    message: "TODO/FIXME comment found",
    suggestion: "Address the TODO/FIXME or create a tracking issue",
    pattern: /(?:\/\/|\/\*|<!--)\s*(?:TODO|FIXME|HACK|XXX)\b/gi,
    fileTypes: [".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte", ".css", ".html"],
  },
  {
    id: "inline-style",
    severity: "medium",
    category: "code-quality",
    message: "Inline style attribute found",
    suggestion: "Move styles to a CSS file, CSS module, or styled component for better maintainability",
    pattern: /style\s*=\s*\{\s*\{/g,
    fileTypes: [".tsx", ".jsx"],
  },
  {
    id: "any-type",
    severity: "medium",
    category: "code-quality",
    message: "TypeScript 'any' type usage found",
    suggestion: "Replace 'any' with a specific type or 'unknown' for type safety",
    pattern: /:\s*any\b/g,
    fileTypes: [".tsx", ".ts"],
  },
  {
    id: "magic-number",
    severity: "low",
    category: "code-quality",
    message: "Magic number in JSX/style (not 0 or 1)",
    suggestion: "Extract magic numbers into named constants or design tokens",
    pattern: /(?:width|height|margin|padding|top|left|right|bottom|gap|fontSize|size)\s*[:=]\s*['"]?\d{2,}/g,
    fileTypes: [".tsx", ".jsx", ".css", ".scss"],
  },

  // ── Design Rules ──
  {
    id: "important-css",
    severity: "medium",
    category: "design",
    message: "!important flag in CSS (specificity issue)",
    suggestion: "Refactor CSS specificity instead of using !important",
    pattern: /!important/g,
    fileTypes: [".css", ".scss", ".sass", ".less"],
  },
  {
    id: "hardcoded-color",
    severity: "low",
    category: "design",
    message: "Hardcoded hex color (not using design token/variable)",
    suggestion: "Use CSS custom properties or design tokens for consistent theming",
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    fileTypes: [".tsx", ".jsx", ".css", ".scss"],
  },
  {
    id: "z-index-high",
    severity: "medium",
    category: "design",
    message: "High z-index value (potential stacking context issue)",
    suggestion: "Use a z-index scale system with named layers instead of arbitrary values",
    pattern: /z-index\s*:\s*(?:[5-9]\d{2,}|\d{4,})/g,
    fileTypes: [".css", ".scss", ".tsx", ".jsx"],
  },

  // ── Performance Rules ──
  {
    id: "no-lazy-image",
    severity: "medium",
    category: "performance",
    message: "Image without loading=\"lazy\" (may impact initial load)",
    suggestion: "Add loading=\"lazy\" for below-the-fold images",
    pattern: /<img(?![^>]*loading\s*=)[^>]*src\s*=/gi,
    fileTypes: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
  },
  {
    id: "large-bundle-import",
    severity: "medium",
    category: "performance",
    message: "Full library import detected (could increase bundle size)",
    suggestion: "Use named/tree-shakeable imports (e.g., import { specific } from 'lib')",
    pattern: /import\s+\w+\s+from\s+['"](?:lodash|moment|date-fns|rxjs)['"](?!\s*\/)/g,
    fileTypes: [".tsx", ".jsx", ".ts", ".js"],
  },

  // ── UX Rules ──
  {
    id: "missing-error-boundary",
    severity: "medium",
    category: "ux",
    message: "React component without error boundary in ancestry",
    suggestion: "Wrap major UI sections with an ErrorBoundary component",
    pattern: /(?:export\s+(?:default\s+)?function|const\s+\w+\s*=\s*(?:\(\)|React\.memo|forwardRef))\s*(?:\w+)?\s*\(/g,
    fileTypes: [".tsx", ".jsx"],
  },
  {
    id: "no-loading-state",
    severity: "medium",
    category: "ux",
    message: "Async operation without visible loading state",
    suggestion: "Add loading indicators for async operations (spinner, skeleton, or progress bar)",
    pattern: /(?:await\s+fetch|useQuery|useSWR|axios\.)(?![^]*(?:loading|isLoading|pending|skeleton|spinner))/g,
    fileTypes: [".tsx", ".jsx"],
  },

  // ── React Hooks & Patterns ──
  {
    id: "react-hooks-conditional",
    severity: "high",
    category: "code-quality",
    message: "React hook called inside a conditional block",
    suggestion: "Move hooks to the top level of the component — hooks must be called in the same order every render",
    pattern: /if\s*\(.*use[A-Z]/g,
    fileTypes: [".tsx", ".jsx"],
  },
  {
    id: "missing-key-prop",
    severity: "high",
    category: "bug",
    message: "Array .map() rendering JSX without a key prop",
    suggestion: "Add a unique key prop to the root element returned from .map() (e.g., key={item.id})",
    pattern: /\.map\s*\([^)]*\)\s*(?:=>|{)\s*(?:\(?\s*<)(?![^>]*\bkey\s*=)/g,
    fileTypes: [".tsx", ".jsx"],
  },
  {
    id: "direct-dom-access",
    severity: "medium",
    category: "code-quality",
    message: "Direct DOM access detected in a component file",
    suggestion: "Use refs (useRef/ref) instead of document.querySelector/getElementById in React/Vue components",
    pattern: /document\.(?:querySelector|getElementById)\s*\(/g,
    fileTypes: [".tsx", ".jsx", ".vue"],
  },
  {
    id: "empty-catch",
    severity: "high",
    category: "code-quality",
    message: "Empty catch block swallows errors silently",
    suggestion: "Handle or log the error inside the catch block — silent failures make debugging extremely difficult",
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    fileTypes: [".ts", ".tsx", ".js", ".jsx"],
  },
  {
    id: "event-handler-inline",
    severity: "low",
    category: "code-quality",
    message: "Inline arrow function in event handler causes unnecessary re-renders",
    suggestion: "Extract the handler into a useCallback hook or a named function defined outside JSX",
    pattern: /onClick\s*=\s*\{\s*\(\)\s*=>/g,
    fileTypes: [".tsx", ".jsx"],
  },

  // ── Design Rules (additional) ──
  {
    id: "font-too-small",
    severity: "medium",
    category: "design",
    message: "Font size below 12px may be unreadable for many users",
    suggestion: "Use a minimum font size of 12px (or 0.75rem) for body text to ensure readability",
    pattern: /font-size:\s*(?:[0-9]|1[01])px/g,
    fileTypes: [".css", ".scss"],
  },

  // ── UX Rules (additional) ──
  {
    id: "missing-meta-description",
    severity: "medium",
    category: "ux",
    message: "HTML file missing <meta name=\"description\"> tag",
    suggestion: "Add a <meta name=\"description\" content=\"...\"> for better SEO and link previews",
    pattern: /(?=[\s\S]*<head)(?![\s\S]*<meta\s+name\s*=\s*["']description["'])/g,
    fileTypes: [".html"],
  },

  // ── Accessibility Rules (additional) ──
  {
    id: "missing-viewport-meta",
    severity: "high",
    category: "accessibility",
    message: "HTML file missing <meta name=\"viewport\"> tag",
    suggestion: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> for responsive design",
    pattern: /(?=[\s\S]*<head)(?![\s\S]*<meta\s+name\s*=\s*["']viewport["'])/g,
    fileTypes: [".html"],
  },
  {
    id: "no-focus-visible",
    severity: "medium",
    category: "accessibility",
    message: "CSS uses :focus without :focus-visible — keyboard-only focus styling missing",
    suggestion: "Replace or supplement :focus with :focus-visible to avoid showing focus rings on mouse clicks",
    pattern: /:focus\b(?!-visible)/g,
    fileTypes: [".css", ".scss"],
  },
];

// ── Config Loading ────────────────────────────────────────────────

type RuleStatus = "off" | "warn" | "error";

export interface UimaxConfig {
  readonly rules: Record<string, RuleStatus>;
  readonly severity: Record<string, Severity>;
  readonly ignore: readonly string[];
}

const DEFAULT_CONFIG: UimaxConfig = {
  rules: {},
  severity: {},
  ignore: [],
};

interface ConfigLoadResult {
  readonly config: UimaxConfig;
  readonly loaded: boolean;
  readonly path: string | null;
}

function isValidRuleStatus(value: unknown): value is RuleStatus {
  return value === "off" || value === "warn" || value === "error";
}

function isValidSeverity(value: unknown): value is Severity {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function parseConfig(raw: unknown): UimaxConfig {
  if (typeof raw !== "object" || raw === null) {
    return DEFAULT_CONFIG;
  }

  const obj = raw as Record<string, unknown>;

  const rules: Record<string, RuleStatus> = {};
  if (typeof obj.rules === "object" && obj.rules !== null) {
    for (const [key, value] of Object.entries(obj.rules as Record<string, unknown>)) {
      if (isValidRuleStatus(value)) {
        rules[key] = value;
      }
    }
  }

  const severity: Record<string, Severity> = {};
  if (typeof obj.severity === "object" && obj.severity !== null) {
    for (const [key, value] of Object.entries(obj.severity as Record<string, unknown>)) {
      if (isValidSeverity(value)) {
        severity[key] = value;
      }
    }
  }

  const ignore: string[] = [];
  if (Array.isArray(obj.ignore)) {
    for (const item of obj.ignore) {
      if (typeof item === "string") {
        ignore.push(item);
      }
    }
  }

  return { rules, severity, ignore };
}

/**
 * Load `.uimaxrc.json` config from the given directory or up to 3 parent directories.
 * Returns the parsed config and load status. Falls back to defaults on error.
 */
export async function loadConfig(directory: string): Promise<ConfigLoadResult> {
  const searchDirs = [
    directory,
    resolve(directory, ".."),
    resolve(directory, "..", ".."),
    resolve(directory, "..", "..", ".."),
  ];

  for (const dir of searchDirs) {
    const configPath = join(dir, ".uimaxrc.json");
    try {
      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);
      return {
        config: parseConfig(parsed),
        loaded: true,
        path: configPath,
      };
    } catch {
      // Config not found or unreadable in this directory, continue searching
    }
  }

  return { config: DEFAULT_CONFIG, loaded: false, path: null };
}

// ── File-Level Checks ──────────────────────────────────────────────

function checkFileSize(file: FileInfo): CodeFinding | null {
  if (file.lineCount > 500) {
    return {
      file: file.relativePath,
      line: null,
      severity: file.lineCount > 800 ? "high" : "medium",
      category: "code-quality",
      rule: "large-file",
      message: `File has ${file.lineCount} lines (recommended max: 400)`,
      suggestion:
        "Split into smaller, focused modules with single responsibilities",
    };
  }
  return null;
}

function checkDeepNesting(file: FileInfo): CodeFinding | null {
  const lines = file.content.split("\n");
  let maxIndent = 0;
  let maxLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;

    const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    const indent = leadingSpaces / 2; // Assuming 2-space indent

    if (indent > maxIndent) {
      maxIndent = indent;
      maxLine = i + 1;
    }
  }

  if (maxIndent > 6) {
    return {
      file: file.relativePath,
      line: maxLine,
      severity: maxIndent > 8 ? "high" : "medium",
      category: "code-quality",
      rule: "deep-nesting",
      message: `Deep nesting detected (${maxIndent} levels)`,
      suggestion:
        "Extract nested logic into helper functions or use early returns",
    };
  }
  return null;
}

function checkMissingErrorBoundary(files: readonly FileInfo[]): CodeFinding | null {
  const hasErrorBoundary = files.some((file) => {
    const name = file.relativePath.toLowerCase();
    return name.includes("errorboundary") || name.includes("error-boundary");
  });

  const hasComponents = files.some((file) =>
    [".tsx", ".jsx"].includes(file.extension)
  );

  if (hasComponents && !hasErrorBoundary) {
    return {
      file: "(project-level)",
      line: null,
      severity: "medium",
      category: "ux",
      rule: "no-error-boundary",
      message: "No ErrorBoundary component found in the project",
      suggestion:
        "Create an ErrorBoundary component to gracefully catch and display runtime errors instead of crashing the UI",
    };
  }
  return null;
}

// ── AST / Regex Routing ────────────────────────────────────────────

interface AstCoverageResult {
  readonly findings: readonly AstFinding[];
  readonly coveredRuleIds: ReadonlySet<string>;
}

/**
 * Attempt AST analysis for the file. Returns AST findings and the set of
 * rule IDs that were covered by the AST engine. If AST parsing fails,
 * returns empty results so the caller falls back to regex for all rules.
 */
function getAstCoveredRules(
  file: FileInfo,
  activeRules: readonly Rule[],
): AstCoverageResult {
  if (!canParseAsAst(file.path)) {
    return { findings: [], coveredRuleIds: new Set() };
  }

  const activeAstRuleIds = new Set(
    activeRules
      .filter((r) => AST_RULE_IDS.has(r.id) && r.fileTypes.includes(file.extension))
      .map((r) => r.id),
  );

  if (activeAstRuleIds.size === 0) {
    return { findings: [], coveredRuleIds: new Set() };
  }

  const astFindings = runAstAnalysis(file.path, file.content);

  // If AST returned nothing (could be parse failure), still mark rules as covered
  // so we don't double-report. The AST analyzer returns [] on parse failure too,
  // but that's acceptable — regex would also likely give poor results on broken syntax.
  const relevantFindings = astFindings.filter((f) => activeAstRuleIds.has(f.rule));

  return {
    findings: limitFindingsPerRule(relevantFindings, 5),
    coveredRuleIds: activeAstRuleIds,
  };
}

/**
 * Return the subset of active rules that should run via regex —
 * i.e., rules not covered by the AST engine for this file.
 */
function getRegexOnlyRules(
  file: FileInfo,
  activeRules: readonly Rule[],
  astResult: AstCoverageResult,
): readonly Rule[] {
  return activeRules.filter(
    (r) => !astResult.coveredRuleIds.has(r.id),
  );
}

/**
 * Limit findings to at most `max` per unique rule ID (immutable).
 */
function limitFindingsPerRule(
  findings: readonly AstFinding[],
  max: number,
): readonly AstFinding[] {
  const counts = new Map<string, number>();
  return findings.filter((f) => {
    const current = counts.get(f.rule) ?? 0;
    if (current >= max) return false;
    counts.set(f.rule, current + 1);
    return true;
  });
}

// ── Main Analysis ──────────────────────────────────────────────────

/**
 * Analyze frontend code for common issues, anti-patterns, and improvements.
 *
 * Scans TypeScript/JavaScript, CSS, and HTML files for accessibility issues,
 * code quality problems, design inconsistencies, and performance concerns.
 */
export async function analyzeCode(
  directory: string
): Promise<CodeAnalysisResult> {
  const { config, loaded, path: configPath } = await loadConfig(directory);

  const framework = await detectFramework(directory);

  // Convert config ignore patterns to glob-compatible patterns
  const configIgnoreGlobs = config.ignore.map((pattern) => {
    // If pattern has no glob chars and no extension, treat as a directory
    if (!pattern.includes("*") && !pattern.includes(".")) {
      return `${pattern}/**`;
    }
    // If it's a glob pattern like "*.test.*", ensure it matches in all directories
    if (pattern.startsWith("*.")) {
      return `**/${pattern}`;
    }
    return pattern;
  });

  const files = await collectFrontendFiles(directory, 200, configIgnoreGlobs);

  // Filter RULES based on config (immutable — create a new filtered array)
  const activeRules = RULES.filter((rule) => config.rules[rule.id] !== "off");

  // Build a list of disabled rule IDs for reporting
  const rulesDisabled = Object.entries(config.rules)
    .filter(([, status]) => status === "off")
    .map(([id]) => id);

  // Build a list of severity-overridden rule IDs for reporting
  const severityOverrides = Object.keys(config.severity);

  const findings: CodeFinding[] = [];
  let totalLines = 0;
  let componentCount = 0;
  let stylesheetCount = 0;

  for (const file of files) {
    totalLines += file.lineCount;

    // Count components and stylesheets
    if ([".tsx", ".jsx", ".vue", ".svelte"].includes(file.extension)) {
      componentCount++;
    }
    if ([".css", ".scss", ".sass", ".less"].includes(file.extension)) {
      stylesheetCount++;
    }

    // Run AST-based analysis for supported file types, then regex for the rest
    const astCoveredRules = getAstCoveredRules(file, activeRules);
    const regexOnlyRules = getRegexOnlyRules(file, activeRules, astCoveredRules);

    // Run AST analysis and convert findings
    for (const astFinding of astCoveredRules.findings) {
      const effectiveSeverity = config.severity[astFinding.rule] ?? astFinding.severity;
      findings.push({
        file: file.relativePath,
        line: astFinding.line,
        severity: effectiveSeverity,
        category: astFinding.category,
        rule: astFinding.rule,
        message: astFinding.message,
        suggestion: astFinding.suggestion,
        analysisMethod: "ast",
      });
    }

    // Run regex-based rules for rules without AST coverage
    for (const rule of regexOnlyRules) {
      if (!rule.fileTypes.includes(file.extension)) continue;

      const matches = file.content.matchAll(rule.pattern);
      let matchCount = 0;

      // Determine the effective severity: config override takes precedence
      const effectiveSeverity = config.severity[rule.id] ?? rule.severity;

      for (const match of matches) {
        matchCount++;
        if (matchCount > 5) break; // Limit findings per rule per file

        // Find line number
        const beforeMatch = file.content.slice(0, match.index);
        const lineNumber = beforeMatch.split("\n").length;

        findings.push({
          file: file.relativePath,
          line: lineNumber,
          severity: effectiveSeverity,
          category: rule.category,
          rule: rule.id,
          message: rule.message,
          suggestion: rule.suggestion,
          analysisMethod: "regex",
        });
      }
    }

    // Run file-level checks
    const sizeCheck = checkFileSize(file);
    if (sizeCheck) findings.push(sizeCheck);

    const nestingCheck = checkDeepNesting(file);
    if (nestingCheck) findings.push(nestingCheck);
  }

  // Run project-level checks
  const errorBoundaryCheck = checkMissingErrorBoundary(files);
  if (errorBoundaryCheck) findings.push(errorBoundaryCheck);

  // Sort findings by severity
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sortedFindings = [...findings].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  // Find largest files
  const sortedFiles = [...files].sort((a, b) => b.lineCount - a.lineCount);
  const largestFiles = sortedFiles.slice(0, 5).map((f) => ({
    file: f.relativePath,
    lines: f.lineCount,
  }));

  const avgFileSize =
    files.length > 0
      ? Math.round(totalLines / files.length)
      : 0;

  return {
    directory,
    timestamp: new Date().toISOString(),
    framework,
    totalFiles: files.length,
    totalLines,
    findings: sortedFindings,
    summary: {
      components: componentCount,
      stylesheets: stylesheetCount,
      avgFileSize,
      largestFiles,
    },
    configStatus: {
      loaded,
      path: configPath,
      rulesDisabled,
      severityOverrides,
    },
  };
}

/**
 * Format code analysis results into a readable summary.
 */
export function formatCodeAnalysisReport(result: CodeAnalysisResult): string {
  const lines: string[] = [
    `## Code Analysis Results`,
    ``,
    `**Directory:** ${result.directory}`,
    `**Framework:** ${result.framework}`,
    `**Files Analyzed:** ${result.totalFiles}`,
    `**Total Lines:** ${result.totalLines.toLocaleString()}`,
    `**Avg File Size:** ${result.summary.avgFileSize} lines`,
    `**Components:** ${result.summary.components}`,
    `**Stylesheets:** ${result.summary.stylesheets}`,
  ];

  if (result.configStatus.loaded) {
    lines.push(`**Config:** Loaded from \`${result.configStatus.path}\``);
    if (result.configStatus.rulesDisabled.length > 0) {
      lines.push(`**Rules Disabled:** ${result.configStatus.rulesDisabled.join(", ")}`);
    }
    if (result.configStatus.severityOverrides.length > 0) {
      lines.push(`**Severity Overrides:** ${result.configStatus.severityOverrides.join(", ")}`);
    }
  }

  lines.push(``);

  if (result.summary.largestFiles.length > 0) {
    lines.push(`### Largest Files`);
    for (const f of result.summary.largestFiles) {
      lines.push(`- ${f.file} (${f.lines} lines)`);
    }
    lines.push(``);
  }

  // Group findings by category
  const byCategory = new Map<string, CodeFinding[]>();
  for (const finding of result.findings) {
    const existing = byCategory.get(finding.category) ?? [];
    byCategory.set(finding.category, [...existing, finding]);
  }

  const categoryLabels: Record<string, string> = {
    accessibility: "Accessibility",
    "code-quality": "Code Quality",
    design: "Design Consistency",
    performance: "Performance",
    ux: "User Experience",
    bug: "Bugs",
  };

  lines.push(`### Findings (${result.findings.length} total)`);
  lines.push(``);

  for (const [category, categoryFindings] of byCategory) {
    const label = categoryLabels[category] ?? category;
    lines.push(`#### ${label} (${categoryFindings.length})`);
    lines.push(``);

    for (const f of categoryFindings.slice(0, 20)) {
      const loc = f.line ? `:${f.line}` : "";
      lines.push(`- **[${f.severity.toUpperCase()}]** ${f.file}${loc}`);
      lines.push(`  ${f.message}`);
      lines.push(`  → ${f.suggestion}`);
      lines.push(``);
    }
  }

  return lines.join("\n");
}
