import ts from "typescript";
import type { Severity, FindingCategory } from "../types.js";

// ── Types ────────────────────────────────────────────────────────

export interface AstFinding {
  readonly rule: string;
  readonly severity: Severity;
  readonly category: FindingCategory;
  readonly message: string;
  readonly suggestion: string;
  readonly line: number;
}

// ── Helpers ──────────────────────────────────────────────────────

function getLineNumber(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

function isHookCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  const expr = node.expression;
  if (ts.isIdentifier(expr)) {
    return /^use[A-Z]/.test(expr.text);
  }
  return false;
}

// ── Rule: react-hooks-conditional ────────────────────────────────

function findHooksInBlock(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  findings: AstFinding[],
): void {
  ts.forEachChild(node, (child) => {
    if (isHookCall(child)) {
      findings.push({
        rule: "react-hooks-conditional",
        severity: "high",
        category: "code-quality",
        message: "React hook called inside a conditional block",
        suggestion:
          "Move hooks to the top level of the component — hooks must be called in the same order every render",
        line: getLineNumber(sourceFile, child.getStart(sourceFile)),
      });
    }
    findHooksInBlock(child, sourceFile, findings);
  });
}

function isConditionalBlock(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isConditionalExpression(node)
  );
}

export function checkReactHooksConditional(
  sourceFile: ts.SourceFile,
): readonly AstFinding[] {
  const findings: AstFinding[] = [];

  function visit(node: ts.Node): void {
    if (isConditionalBlock(node)) {
      findHooksInBlock(node, sourceFile, findings);
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

// ── Rule: missing-key-prop ───────────────────────────────────────

function jsxElementHasKeyProp(node: ts.Node): boolean {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    return node.attributes.properties.some(
      (attr) => ts.isJsxAttribute(attr) && attr.name.getText() === "key",
    );
  }
  return false;
}

function findRootJsxInExpression(node: ts.Node): ts.Node | null {
  if (ts.isJsxElement(node)) return node.openingElement;
  if (ts.isJsxSelfClosingElement(node)) return node;
  if (ts.isParenthesizedExpression(node)) {
    return findRootJsxInExpression(node.expression);
  }
  return null;
}

export function checkMissingKeyProp(
  sourceFile: ts.SourceFile,
): readonly AstFinding[] {
  const findings: AstFinding[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === "map") {
        const callback = node.arguments[0];
        if (callback) {
          const body = getCallbackBody(callback);
          if (body) {
            const rootJsx = findRootJsxInExpression(body);
            if (rootJsx && !jsxElementHasKeyProp(rootJsx)) {
              findings.push({
                rule: "missing-key-prop",
                severity: "high",
                category: "bug",
                message: "Array .map() rendering JSX without a key prop",
                suggestion:
                  "Add a unique key prop to the root element returned from .map() (e.g., key={item.id})",
                line: getLineNumber(sourceFile, node.getStart(sourceFile)),
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function getCallbackBody(node: ts.Node): ts.Node | null {
  if (ts.isArrowFunction(node)) {
    if (ts.isBlock(node.body)) {
      return findReturnExpression(node.body);
    }
    return node.body;
  }
  if (ts.isFunctionExpression(node)) {
    return findReturnExpression(node.body);
  }
  return null;
}

function findReturnExpression(block: ts.Block): ts.Node | null {
  for (const stmt of block.statements) {
    if (ts.isReturnStatement(stmt) && stmt.expression) {
      return stmt.expression;
    }
  }
  return null;
}

// ── Rule: empty-catch ────────────────────────────────────────────

export function checkEmptyCatch(
  sourceFile: ts.SourceFile,
): readonly AstFinding[] {
  const findings: AstFinding[] = [];

  function visit(node: ts.Node): void {
    if (ts.isTryStatement(node) && node.catchClause) {
      const catchBlock = node.catchClause.block;
      if (catchBlock.statements.length === 0) {
        findings.push({
          rule: "empty-catch",
          severity: "high",
          category: "code-quality",
          message: "Empty catch block swallows errors silently",
          suggestion:
            "Handle or log the error inside the catch block — silent failures make debugging extremely difficult",
          line: getLineNumber(
            sourceFile,
            node.catchClause.getStart(sourceFile),
          ),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

// ── Rule: any-type ───────────────────────────────────────────────

export function checkAnyType(
  sourceFile: ts.SourceFile,
): readonly AstFinding[] {
  const findings: AstFinding[] = [];

  function visit(node: ts.Node): void {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      findings.push({
        rule: "any-type",
        severity: "medium",
        category: "code-quality",
        message: "TypeScript 'any' type usage found",
        suggestion:
          "Replace 'any' with a specific type or 'unknown' for type safety",
        line: getLineNumber(sourceFile, node.getStart(sourceFile)),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

// ── Rule: direct-dom-access ──────────────────────────────────────

const DOM_ACCESS_METHODS = new Set([
  "querySelector",
  "querySelectorAll",
  "getElementById",
  "getElementsByClassName",
  "getElementsByTagName",
]);

export function checkDirectDomAccess(
  sourceFile: ts.SourceFile,
): readonly AstFinding[] {
  const findings: AstFinding[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const propAccess = node.expression;
      if (
        ts.isIdentifier(propAccess.expression) &&
        propAccess.expression.text === "document" &&
        DOM_ACCESS_METHODS.has(propAccess.name.text)
      ) {
        findings.push({
          rule: "direct-dom-access",
          severity: "medium",
          category: "code-quality",
          message: "Direct DOM access detected in a component file",
          suggestion:
            "Use refs (useRef/ref) instead of document.querySelector/getElementById in React/Vue components",
          line: getLineNumber(sourceFile, node.getStart(sourceFile)),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

// ── Rule: console-log ────────────────────────────────────────────

const CONSOLE_LOG_METHODS = new Set(["log", "debug", "info"]);

export function checkConsoleLog(
  sourceFile: ts.SourceFile,
): readonly AstFinding[] {
  const findings: AstFinding[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const propAccess = node.expression;
      if (
        ts.isIdentifier(propAccess.expression) &&
        propAccess.expression.text === "console" &&
        CONSOLE_LOG_METHODS.has(propAccess.name.text)
      ) {
        findings.push({
          rule: "console-log",
          severity: "low",
          category: "code-quality",
          message: "console.log statement found (likely debug code)",
          suggestion:
            "Remove console.log or replace with a proper logging utility",
          line: getLineNumber(sourceFile, node.getStart(sourceFile)),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

// ── Rule: inline-style ───────────────────────────────────────────

export function checkInlineStyle(
  sourceFile: ts.SourceFile,
): readonly AstFinding[] {
  const findings: AstFinding[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && node.name.getText() === "style") {
      findings.push({
        rule: "inline-style",
        severity: "medium",
        category: "code-quality",
        message: "Inline style attribute found",
        suggestion:
          "Move styles to a CSS file, CSS module, or styled component for better maintainability",
        line: getLineNumber(sourceFile, node.getStart(sourceFile)),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

// ── Script language detection ────────────────────────────────────

function getScriptKind(filePath: string): ts.ScriptKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (lower.endsWith(".ts")) return ts.ScriptKind.TS;
  if (lower.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (lower.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.Unknown;
}

const AST_PARSEABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

export function canParseAsAst(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return Array.from(AST_PARSEABLE_EXTENSIONS).some((ext) =>
    lower.endsWith(ext),
  );
}

// ── Rule IDs that have AST implementations ───────────────────────

export const AST_RULE_IDS = new Set([
  "react-hooks-conditional",
  "missing-key-prop",
  "empty-catch",
  "any-type",
  "direct-dom-access",
  "console-log",
  "inline-style",
]);

// ── Main entry point ─────────────────────────────────────────────

export function parseSourceFile(
  filePath: string,
  content: string,
): ts.SourceFile | null {
  const scriptKind = getScriptKind(filePath);
  if (scriptKind === ts.ScriptKind.Unknown) return null;

  try {
    return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);
  } catch {
    return null;
  }
}

export function runAstAnalysis(
  filePath: string,
  content: string,
): readonly AstFinding[] {
  const sourceFile = parseSourceFile(filePath, content);
  if (!sourceFile) return [];

  const isJsx =
    filePath.endsWith(".tsx") || filePath.endsWith(".jsx");
  const isTs =
    filePath.endsWith(".ts") || filePath.endsWith(".tsx");

  const allFindings: AstFinding[] = [
    ...checkEmptyCatch(sourceFile),
    ...checkConsoleLog(sourceFile),
    ...checkDirectDomAccess(sourceFile),
  ];

  if (isTs) {
    allFindings.push(...checkAnyType(sourceFile));
  }

  if (isJsx) {
    allFindings.push(...checkReactHooksConditional(sourceFile));
    allFindings.push(...checkMissingKeyProp(sourceFile));
    allFindings.push(...checkInlineStyle(sourceFile));
  }

  return allFindings;
}
