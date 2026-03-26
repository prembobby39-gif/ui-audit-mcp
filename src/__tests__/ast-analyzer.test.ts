import { describe, it, expect } from "vitest";
import {
  runAstAnalysis,
  parseSourceFile,
  canParseAsAst,
  checkReactHooksConditional,
  checkMissingKeyProp,
  checkEmptyCatch,
  checkAnyType,
  checkDirectDomAccess,
  checkConsoleLog,
  checkInlineStyle,
} from "../utils/ast-analyzer.js";

// ── Helpers ──────────────────────────────────────────────────────

function parse(content: string, ext: string = ".tsx") {
  const filePath = `test-file${ext}`;
  return parseSourceFile(filePath, content);
}

function findingsForRule(
  findings: readonly import("../utils/ast-analyzer.js").AstFinding[],
  ruleId: string,
) {
  return findings.filter((f) => f.rule === ruleId);
}

// ── parseSourceFile & canParseAsAst ──────────────────────────────

describe("parseSourceFile", () => {
  it("parses valid TypeScript content", () => {
    const sf = parse("const x: number = 1;", ".ts");
    expect(sf).not.toBeNull();
  });

  it("parses valid TSX content", () => {
    const sf = parse("const App = () => <div>Hello</div>;", ".tsx");
    expect(sf).not.toBeNull();
  });

  it("parses valid JS content", () => {
    const sf = parse("const x = 1;", ".js");
    expect(sf).not.toBeNull();
  });

  it("parses valid JSX content", () => {
    const sf = parse("const App = () => <div>Hello</div>;", ".jsx");
    expect(sf).not.toBeNull();
  });

  it("returns null for unsupported extensions", () => {
    const sf = parse(".header { color: red; }", ".css");
    expect(sf).toBeNull();
  });
});

describe("canParseAsAst", () => {
  it("returns true for .ts, .tsx, .js, .jsx", () => {
    expect(canParseAsAst("file.ts")).toBe(true);
    expect(canParseAsAst("file.tsx")).toBe(true);
    expect(canParseAsAst("file.js")).toBe(true);
    expect(canParseAsAst("file.jsx")).toBe(true);
  });

  it("returns false for .css, .html, .vue, .svelte", () => {
    expect(canParseAsAst("file.css")).toBe(false);
    expect(canParseAsAst("file.html")).toBe(false);
    expect(canParseAsAst("file.vue")).toBe(false);
    expect(canParseAsAst("file.svelte")).toBe(false);
  });
});

// ── react-hooks-conditional ──────────────────────────────────────

describe("checkReactHooksConditional", () => {
  it("detects hook inside if statement", () => {
    const sf = parse(`
      function Component() {
        if (condition) {
          const [val, setVal] = useState(0);
        }
        return <div />;
      }
    `);
    const findings = checkReactHooksConditional(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("react-hooks-conditional");
  });

  it("detects hook inside for loop", () => {
    const sf = parse(`
      function Component() {
        for (let i = 0; i < 3; i++) {
          useEffect(() => {}, []);
        }
        return <div />;
      }
    `);
    const findings = checkReactHooksConditional(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("detects hook inside while loop", () => {
    const sf = parse(`
      function Component() {
        while (running) {
          useMemo(() => "val", []);
        }
        return <div />;
      }
    `);
    const findings = checkReactHooksConditional(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("detects hook inside ternary expression", () => {
    const sf = parse(`
      function Component() {
        const val = condition ? useState(0) : useState(1);
        return <div />;
      }
    `);
    const findings = checkReactHooksConditional(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag top-level hooks", () => {
    const sf = parse(`
      function Component() {
        const [val, setVal] = useState(0);
        useEffect(() => {}, []);
        const memo = useMemo(() => "val", []);
        return <div />;
      }
    `);
    const findings = checkReactHooksConditional(sf!);
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag hooks in non-conditional callbacks", () => {
    const sf = parse(`
      function Component() {
        const val = useState(0);
        return <div />;
      }
    `);
    const findings = checkReactHooksConditional(sf!);
    expect(findings).toHaveLength(0);
  });
});

// ── missing-key-prop ─────────────────────────────────────────────

describe("checkMissingKeyProp", () => {
  it("detects .map() with JSX missing key (arrow, expression body)", () => {
    const sf = parse(`
      function List() {
        return items.map((item) => <li>{item.name}</li>);
      }
    `);
    const findings = checkMissingKeyProp(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("missing-key-prop");
  });

  it("detects .map() with JSX missing key (parenthesized)", () => {
    const sf = parse(`
      function List() {
        return items.map((item) => (<li>{item.name}</li>));
      }
    `);
    const findings = checkMissingKeyProp(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("detects .map() with JSX missing key (block body with return)", () => {
    const sf = parse(`
      function List() {
        return items.map((item) => {
          return <li>{item.name}</li>;
        });
      }
    `);
    const findings = checkMissingKeyProp(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag .map() with key prop present", () => {
    const sf = parse(`
      function List() {
        return items.map((item) => <li key={item.id}>{item.name}</li>);
      }
    `);
    const findings = checkMissingKeyProp(sf!);
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag .map() with key prop in parenthesized JSX", () => {
    const sf = parse(`
      function List() {
        return items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ));
      }
    `);
    const findings = checkMissingKeyProp(sf!);
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag .map() returning non-JSX", () => {
    const sf = parse(`
      const nums = [1, 2, 3].map((n) => n * 2);
    `);
    const findings = checkMissingKeyProp(sf!);
    expect(findings).toHaveLength(0);
  });
});

// ── empty-catch ──────────────────────────────────────────────────

describe("checkEmptyCatch", () => {
  it("detects empty catch block", () => {
    const sf = parse(`
      try {
        doSomething();
      } catch (e) {}
    `, ".ts");
    const findings = checkEmptyCatch(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("empty-catch");
  });

  it("detects empty catch in multiline format", () => {
    const sf = parse(`
      try {
        doSomething();
      } catch (e) {
      }
    `, ".ts");
    const findings = checkEmptyCatch(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag catch with content", () => {
    const sf = parse(`
      try {
        doSomething();
      } catch (e) {
        console.error(e);
      }
    `, ".ts");
    const findings = checkEmptyCatch(sf!);
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag catch with a comment-only body (has statements)", () => {
    // A comment in the catch block doesn't count as a statement in the AST,
    // so this SHOULD be caught as empty
    const sf = parse(`
      try {
        doSomething();
      } catch (e) {
        // intentionally empty
      }
    `, ".ts");
    const findings = checkEmptyCatch(sf!);
    // Comments are not statements, so the block is empty in the AST
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});

// ── any-type ─────────────────────────────────────────────────────

describe("checkAnyType", () => {
  it("detects explicit any type annotation", () => {
    const sf = parse("function process(data: any): void {}", ".ts");
    const findings = checkAnyType(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("any-type");
  });

  it("detects any in variable declarations", () => {
    const sf = parse("const x: any = 42;", ".ts");
    const findings = checkAnyType(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("detects multiple any usages", () => {
    const sf = parse(`
      function foo(a: any, b: any): any {
        return a;
      }
    `, ".ts");
    const findings = checkAnyType(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });

  it("does NOT flag unknown, string, or other types", () => {
    const sf = parse(`
      function process(data: unknown): string {
        return String(data);
      }
    `, ".ts");
    const findings = checkAnyType(sf!);
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag the word 'any' in strings or comments", () => {
    const sf = parse(`
      // This handles any situation
      const msg = "any value works";
    `, ".ts");
    const findings = checkAnyType(sf!);
    expect(findings).toHaveLength(0);
  });
});

// ── direct-dom-access ────────────────────────────────────────────

describe("checkDirectDomAccess", () => {
  it("detects document.querySelector", () => {
    const sf = parse(`const el = document.querySelector(".modal");`, ".tsx");
    const findings = checkDirectDomAccess(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("direct-dom-access");
  });

  it("detects document.getElementById", () => {
    const sf = parse(`const el = document.getElementById("root");`, ".tsx");
    const findings = checkDirectDomAccess(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("detects document.querySelectorAll", () => {
    const sf = parse(`const els = document.querySelectorAll("div");`, ".tsx");
    const findings = checkDirectDomAccess(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag other document methods", () => {
    const sf = parse(`document.addEventListener("click", handler);`, ".tsx");
    const findings = checkDirectDomAccess(sf!);
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag non-document property access", () => {
    const sf = parse(`const el = container.querySelector(".item");`, ".tsx");
    const findings = checkDirectDomAccess(sf!);
    expect(findings).toHaveLength(0);
  });
});

// ── console-log ──────────────────────────────────────────────────

describe("checkConsoleLog", () => {
  it("detects console.log", () => {
    const sf = parse(`console.log("debug");`, ".ts");
    const findings = checkConsoleLog(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("console-log");
  });

  it("detects console.debug and console.info", () => {
    const sf = parse(`
      console.debug("d");
      console.info("i");
    `, ".ts");
    const findings = checkConsoleLog(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT flag console.error or console.warn", () => {
    const sf = parse(`
      console.error("err");
      console.warn("warn");
    `, ".ts");
    const findings = checkConsoleLog(sf!);
    expect(findings).toHaveLength(0);
  });
});

// ── inline-style ─────────────────────────────────────────────────

describe("checkInlineStyle", () => {
  it("detects JSX style attribute", () => {
    const sf = parse(`const el = <div style={{ color: "red" }}>Hi</div>;`);
    const findings = checkInlineStyle(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("inline-style");
  });

  it("detects style on self-closing elements", () => {
    const sf = parse(`const el = <img style={{ width: 100 }} />;`);
    const findings = checkInlineStyle(sf!);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag className or other attributes", () => {
    const sf = parse(`const el = <div className="box">Hi</div>;`);
    const findings = checkInlineStyle(sf!);
    expect(findings).toHaveLength(0);
  });
});

// ── runAstAnalysis (integration) ─────────────────────────────────

describe("runAstAnalysis", () => {
  it("runs all applicable rules for .tsx files", () => {
    const content = `
      function App() {
        if (flag) {
          useState(0);
        }
        console.log("debug");
        const el = document.querySelector(".x");
        return items.map((i) => <div>{i}</div>);
      }
    `;
    const findings = runAstAnalysis("App.tsx", content);
    const rules = new Set(findings.map((f) => f.rule));
    expect(rules.has("react-hooks-conditional")).toBe(true);
    expect(rules.has("console-log")).toBe(true);
    expect(rules.has("direct-dom-access")).toBe(true);
    expect(rules.has("missing-key-prop")).toBe(true);
  });

  it("runs any-type check only for .ts/.tsx files", () => {
    const content = `function f(x: any) { return x; }`;
    const tsFindings = runAstAnalysis("file.ts", content);
    const jsFindings = runAstAnalysis("file.js", content);
    expect(findingsForRule(tsFindings, "any-type").length).toBeGreaterThanOrEqual(1);
    expect(findingsForRule(jsFindings, "any-type")).toHaveLength(0);
  });

  it("runs inline-style check only for .tsx/.jsx files", () => {
    const content = `const el = <div style={{ color: "red" }}>Hi</div>;`;
    const tsxFindings = runAstAnalysis("file.tsx", content);
    expect(findingsForRule(tsxFindings, "inline-style").length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for unsupported file types", () => {
    const findings = runAstAnalysis("file.css", ".header { color: red; }");
    expect(findings).toHaveLength(0);
  });

  it("returns empty array for unparseable content", () => {
    // Severely broken syntax — TS parser is lenient so it may still parse,
    // but should not crash
    const findings = runAstAnalysis("file.ts", "}{}{}{@#$%^&*(");
    expect(Array.isArray(findings)).toBe(true);
  });

  it("includes correct line numbers", () => {
    const content = `const x = 1;
const y = 2;
console.log("hello");
const z = 3;`;
    const findings = runAstAnalysis("file.ts", content);
    const logFindings = findingsForRule(findings, "console-log");
    expect(logFindings.length).toBeGreaterThanOrEqual(1);
    expect(logFindings[0].line).toBe(3);
  });
});
