import type {
  PwaReadinessResult,
  PwaCheckItem,
  SecurityAuditResult,
  SecurityFinding,
  UnusedCodeResult,
  UnusedCodeEntry,
  LcpOptimizationResult,
  ResourceAnalysisResult,
  ResourceEntry,
  ResourceBreakdown,
} from "../types.js";

// ── LHR Access Helpers ──────────────────────────────────────────────

type LhrAudit = Record<string, unknown>;
type Lhr = Record<string, unknown>;

function getAudit(lhr: Lhr, auditId: string): LhrAudit | null {
  const audits = lhr["audits"] as Record<string, LhrAudit> | undefined;
  if (!audits) return null;
  return (audits[auditId] as LhrAudit) ?? null;
}

function getAuditScore(lhr: Lhr, auditId: string): number | null {
  const audit = getAudit(lhr, auditId);
  if (!audit) return null;
  return typeof audit["score"] === "number" ? audit["score"] : null;
}

function getAuditItems(lhr: Lhr, auditId: string): readonly Record<string, unknown>[] {
  const audit = getAudit(lhr, auditId);
  if (!audit) return [];
  const details = audit["details"] as Record<string, unknown> | undefined;
  if (!details) return [];
  const items = details["items"];
  return Array.isArray(items) ? items : [];
}

function getAuditDisplayValue(lhr: Lhr, auditId: string): string | null {
  const audit = getAudit(lhr, auditId);
  if (!audit) return null;
  return typeof audit["displayValue"] === "string" ? audit["displayValue"] : null;
}

function getNumericValue(lhr: Lhr, auditId: string): number | null {
  const audit = getAudit(lhr, auditId);
  if (!audit) return null;
  return typeof audit["numericValue"] === "number" ? audit["numericValue"] : null;
}

// ── PWA Readiness ───────────────────────────────────────────────────

const PWA_AUDIT_IDS: readonly { readonly id: string; readonly field: keyof Pick<PwaReadinessResult, "installable" | "serviceWorker" | "https" | "manifest" | "offlineCapable"> }[] = [
  { id: "installable-manifest", field: "installable" },
  { id: "service-worker", field: "serviceWorker" },
  { id: "is-on-https", field: "https" },
  { id: "webapp-install-banner", field: "manifest" },
  { id: "works-offline", field: "offlineCapable" },
] as const;

function buildPwaCheck(lhr: Lhr, auditId: string): PwaCheckItem {
  const audit = getAudit(lhr, auditId);
  const score = audit ? (typeof audit["score"] === "number" ? audit["score"] : null) : null;
  return {
    id: auditId,
    title: typeof audit?.["title"] === "string" ? audit["title"] : auditId,
    passed: score !== null && score >= 0.9,
    description: typeof audit?.["description"] === "string" ? audit["description"] : "",
  };
}

export function extractPwaReadiness(lhr: Lhr): PwaReadinessResult {
  const checks: PwaCheckItem[] = PWA_AUDIT_IDS.map(({ id }) => buildPwaCheck(lhr, id));

  // Also check additional PWA-related audits if present
  const additionalIds = [
    "splash-screen",
    "themed-omnibox",
    "content-width",
    "viewport",
    "maskable-icon",
  ];
  for (const id of additionalIds) {
    if (getAudit(lhr, id)) {
      checks.push(buildPwaCheck(lhr, id));
    }
  }

  const fieldResults = Object.fromEntries(
    PWA_AUDIT_IDS.map(({ id, field }) => {
      const score = getAuditScore(lhr, id);
      return [field, score !== null && score >= 0.9];
    })
  );

  const overallReady = PWA_AUDIT_IDS.every(({ id }) => {
    const score = getAuditScore(lhr, id);
    return score !== null && score >= 0.9;
  });

  return {
    installable: fieldResults["installable"] ?? false,
    serviceWorker: fieldResults["serviceWorker"] ?? false,
    https: fieldResults["https"] ?? false,
    manifest: fieldResults["manifest"] ?? false,
    offlineCapable: fieldResults["offlineCapable"] ?? false,
    checks,
    overallReady,
  };
}

// ── Security Audit ──────────────────────────────────────────────────

const SECURITY_AUDITS: readonly { readonly id: string; readonly severity: SecurityFinding["severity"] }[] = [
  { id: "is-on-https", severity: "critical" },
  { id: "redirects-http", severity: "high" },
  { id: "no-vulnerable-libraries", severity: "critical" },
  { id: "csp-xss", severity: "high" },
  { id: "external-anchors-use-rel-noopener", severity: "medium" },
  { id: "geolocation-on-start", severity: "medium" },
  { id: "notification-on-start", severity: "medium" },
  { id: "no-document-write", severity: "medium" },
  { id: "js-libraries", severity: "low" },
] as const;

function buildSecurityFinding(lhr: Lhr, auditId: string, severity: SecurityFinding["severity"]): SecurityFinding {
  const audit = getAudit(lhr, auditId);
  const score = audit ? (typeof audit["score"] === "number" ? audit["score"] : null) : null;
  const displayValue = getAuditDisplayValue(lhr, auditId);

  return {
    id: auditId,
    title: typeof audit?.["title"] === "string" ? audit["title"] : auditId,
    passed: score !== null && score >= 0.9,
    description: typeof audit?.["description"] === "string" ? audit["description"] : "",
    severity,
    details: displayValue,
  };
}

function extractVulnerableLibraries(lhr: Lhr): readonly string[] {
  const items = getAuditItems(lhr, "no-vulnerable-libraries");
  return items.map((item) => {
    const name = typeof item["detectedLib"] === "object" && item["detectedLib"] !== null
      ? String((item["detectedLib"] as Record<string, unknown>)["text"] ?? "unknown")
      : "unknown";
    const vulnCount = typeof item["vulnCount"] === "number" ? item["vulnCount"] : 0;
    return `${name} (${vulnCount} vulnerability${vulnCount === 1 ? "" : "ies"})`;
  });
}

export function extractSecurityAudit(lhr: Lhr): SecurityAuditResult {
  const findings: SecurityFinding[] = SECURITY_AUDITS
    .filter(({ id }) => getAudit(lhr, id) !== null)
    .map(({ id, severity }) => buildSecurityFinding(lhr, id, severity));

  const httpsScore = getAuditScore(lhr, "is-on-https");

  return {
    httpsUsed: httpsScore !== null && httpsScore >= 0.9,
    findings,
    vulnerableLibraries: extractVulnerableLibraries(lhr),
    totalPassed: findings.filter((f) => f.passed).length,
    totalFailed: findings.filter((f) => !f.passed).length,
  };
}

// ── Unused Code ─────────────────────────────────────────────────────

function extractUnusedEntries(lhr: Lhr, auditId: string): readonly UnusedCodeEntry[] {
  const items = getAuditItems(lhr, auditId);
  return items.map((item) => {
    const totalBytes = typeof item["totalBytes"] === "number" ? item["totalBytes"] : 0;
    const wastedBytes = typeof item["wastedBytes"] === "number" ? item["wastedBytes"] : 0;
    return {
      url: typeof item["url"] === "string" ? item["url"] : "unknown",
      totalBytes,
      unusedBytes: wastedBytes,
      potentialSavingsBytes: wastedBytes,
    };
  });
}

export function extractUnusedCode(lhr: Lhr): UnusedCodeResult {
  const unusedJavascript = extractUnusedEntries(lhr, "unused-javascript");
  const unusedCss = extractUnusedEntries(lhr, "unused-css-rules");

  const totalSavings = [...unusedJavascript, ...unusedCss].reduce(
    (sum, entry) => sum + entry.potentialSavingsBytes,
    0
  );

  return {
    unusedJavascript,
    unusedCss,
    totalPotentialSavingsBytes: totalSavings,
    totalPotentialSavingsKb: Math.round(totalSavings / 1024),
  };
}

// ── LCP Optimization ────────────────────────────────────────────────

function buildLcpSuggestions(lhr: Lhr, lcpTimeMs: number | null): readonly string[] {
  const suggestions: string[] = [];

  if (lcpTimeMs !== null && lcpTimeMs > 2500) {
    suggestions.push("LCP exceeds 2.5s threshold. Optimize the largest content element.");
  }

  const ttfb = getNumericValue(lhr, "server-response-time");
  if (ttfb !== null && ttfb > 600) {
    suggestions.push(`Server response time is ${Math.round(ttfb)}ms. Consider server-side caching or a CDN.`);
  }

  const renderBlocking = getAuditItems(lhr, "render-blocking-resources");
  if (renderBlocking.length > 0) {
    suggestions.push(`${renderBlocking.length} render-blocking resource(s) detected. Defer non-critical CSS/JS.`);
  }

  const lcpAudit = getAudit(lhr, "largest-contentful-paint");
  if (lcpAudit) {
    const score = typeof lcpAudit["score"] === "number" ? lcpAudit["score"] : null;
    if (score !== null && score < 0.5) {
      suggestions.push("LCP score is poor. Preload the LCP image or inline critical resources.");
    }
  }

  const usesOptimized = getAuditScore(lhr, "uses-optimized-images");
  if (usesOptimized !== null && usesOptimized < 0.9) {
    suggestions.push("Images are not optimized. Compress images and use modern formats (WebP, AVIF).");
  }

  if (suggestions.length === 0) {
    suggestions.push("LCP performance looks good. No major optimizations needed.");
  }

  return suggestions;
}

function extractLcpElement(lhr: Lhr): string | null {
  const items = getAuditItems(lhr, "largest-contentful-paint-element");
  if (items.length === 0) return null;
  const firstItem = items[0];
  if (typeof firstItem["node"] === "object" && firstItem["node"] !== null) {
    const node = firstItem["node"] as Record<string, unknown>;
    return typeof node["snippet"] === "string" ? node["snippet"] : null;
  }
  return null;
}

export function extractLcpOptimization(lhr: Lhr): LcpOptimizationResult {
  const lcpTimeMs = getNumericValue(lhr, "largest-contentful-paint");
  const ttfbMs = getNumericValue(lhr, "server-response-time");
  const lcpScore = getAuditScore(lhr, "largest-contentful-paint");

  // Lighthouse doesn't always expose resource load time and render delay
  // directly, but we can estimate from LCP breakdown if available
  const lcpBreakdown = getAuditItems(lhr, "lcp-lazy-loaded");
  const resourceLoadTimeMs = lcpBreakdown.length > 0
    ? (typeof lcpBreakdown[0]["wastedMs"] === "number" ? lcpBreakdown[0]["wastedMs"] : null)
    : null;

  const renderDelayMs = lcpTimeMs !== null && ttfbMs !== null
    ? Math.max(0, lcpTimeMs - ttfbMs - (resourceLoadTimeMs ?? 0))
    : null;

  return {
    lcpElement: extractLcpElement(lhr),
    lcpTimeMs: lcpTimeMs !== null ? Math.round(lcpTimeMs) : null,
    ttfbMs: ttfbMs !== null ? Math.round(ttfbMs) : null,
    resourceLoadTimeMs: resourceLoadTimeMs !== null ? Math.round(resourceLoadTimeMs) : null,
    renderDelayMs: renderDelayMs !== null ? Math.round(renderDelayMs) : null,
    lcpScore,
    suggestions: buildLcpSuggestions(lhr, lcpTimeMs),
  };
}

// ── Resource Analysis ───────────────────────────────────────────────

function classifyResourceType(mimeType: string, url: string): string {
  if (mimeType.includes("javascript") || url.endsWith(".js")) return "JavaScript";
  if (mimeType.includes("css") || url.endsWith(".css")) return "CSS";
  if (mimeType.includes("image")) return "Images";
  if (mimeType.includes("font") || mimeType.includes("woff")) return "Fonts";
  if (mimeType.includes("html")) return "HTML";
  if (mimeType.includes("json")) return "JSON";
  return "Other";
}

function buildBreakdown(resources: readonly ResourceEntry[]): readonly ResourceBreakdown[] {
  const groups = new Map<string, { count: number; totalBytes: number }>();

  for (const resource of resources) {
    const existing = groups.get(resource.resourceType);
    if (existing) {
      groups.set(resource.resourceType, {
        count: existing.count + 1,
        totalBytes: existing.totalBytes + resource.transferSizeBytes,
      });
    } else {
      groups.set(resource.resourceType, {
        count: 1,
        totalBytes: resource.transferSizeBytes,
      });
    }
  }

  return [...groups.entries()]
    .map(([type, data]) => ({
      type,
      count: data.count,
      totalBytes: data.totalBytes,
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);
}

function extractResourceEntries(lhr: Lhr): readonly ResourceEntry[] {
  const items = getAuditItems(lhr, "network-requests");
  return items.map((item) => {
    const url = typeof item["url"] === "string" ? item["url"] : "unknown";
    const transferSize = typeof item["transferSize"] === "number" ? item["transferSize"] : 0;
    const mimeType = typeof item["mimeType"] === "string" ? item["mimeType"] : "";
    return {
      url,
      transferSizeBytes: transferSize,
      resourceType: classifyResourceType(mimeType, url),
    };
  });
}

function extractRenderBlockingEntries(lhr: Lhr): readonly ResourceEntry[] {
  const items = getAuditItems(lhr, "render-blocking-resources");
  return items.map((item) => ({
    url: typeof item["url"] === "string" ? item["url"] : "unknown",
    transferSizeBytes: typeof item["totalBytes"] === "number" ? item["totalBytes"] : 0,
    resourceType: typeof item["url"] === "string"
      ? classifyResourceType("", item["url"])
      : "Other",
  }));
}

export function extractResourceAnalysis(lhr: Lhr): ResourceAnalysisResult {
  const resources = extractResourceEntries(lhr);
  const renderBlockingResources = extractRenderBlockingEntries(lhr);

  const totalTransferSizeBytes = resources.reduce(
    (sum, r) => sum + r.transferSizeBytes,
    0
  );

  const sortedBySize = [...resources].sort(
    (a, b) => b.transferSizeBytes - a.transferSizeBytes
  );

  return {
    totalTransferSizeBytes,
    totalTransferSizeKb: Math.round(totalTransferSizeBytes / 1024),
    totalRequests: resources.length,
    breakdown: buildBreakdown(resources),
    largestResources: sortedBySize.slice(0, 10),
    renderBlockingResources,
  };
}

// ── Format Functions ────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatPwaReport(result: PwaReadinessResult): string {
  const sections: string[] = [
    `## PWA Readiness Audit`,
    ``,
    `**Overall PWA Ready:** ${result.overallReady ? "Yes" : "No"}`,
    ``,
    `| Check | Status |`,
    `|-------|--------|`,
  ];

  for (const check of result.checks) {
    const status = check.passed ? "PASS" : "FAIL";
    sections.push(`| ${check.title} | ${status} |`);
  }

  sections.push(``);

  const failed = result.checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    sections.push(`### Missing PWA Requirements`);
    for (const check of failed) {
      sections.push(`- **${check.title}:** ${check.description}`);
    }
    sections.push(``);
  }

  return sections.join("\n");
}

export function formatSecurityReport(result: SecurityAuditResult): string {
  const sections: string[] = [
    `## Security Audit`,
    ``,
    `**HTTPS:** ${result.httpsUsed ? "Yes" : "No"}`,
    `**Passed:** ${result.totalPassed} | **Failed:** ${result.totalFailed}`,
    ``,
    `| Finding | Severity | Status |`,
    `|---------|----------|--------|`,
  ];

  for (const finding of result.findings) {
    const status = finding.passed ? "PASS" : "FAIL";
    sections.push(`| ${finding.title} | ${finding.severity.toUpperCase()} | ${status} |`);
  }

  sections.push(``);

  if (result.vulnerableLibraries.length > 0) {
    sections.push(`### Vulnerable Libraries`);
    for (const lib of result.vulnerableLibraries) {
      sections.push(`- ${lib}`);
    }
    sections.push(``);
  }

  return sections.join("\n");
}

export function formatUnusedCodeReport(result: UnusedCodeResult): string {
  const sections: string[] = [
    `## Unused Code Analysis`,
    ``,
    `**Total Potential Savings:** ${formatBytes(result.totalPotentialSavingsBytes)} (${result.totalPotentialSavingsKb} KB)`,
    ``,
  ];

  if (result.unusedJavascript.length > 0) {
    sections.push(`### Unused JavaScript (${result.unusedJavascript.length} files)`);
    sections.push(`| Resource | Total Size | Unused | Savings |`);
    sections.push(`|----------|-----------|--------|---------|`);
    for (const entry of result.unusedJavascript) {
      const short = shortenUrl(entry.url);
      sections.push(`| ${short} | ${formatBytes(entry.totalBytes)} | ${formatBytes(entry.unusedBytes)} | ${formatBytes(entry.potentialSavingsBytes)} |`);
    }
    sections.push(``);
  }

  if (result.unusedCss.length > 0) {
    sections.push(`### Unused CSS (${result.unusedCss.length} files)`);
    sections.push(`| Resource | Total Size | Unused | Savings |`);
    sections.push(`|----------|-----------|--------|---------|`);
    for (const entry of result.unusedCss) {
      const short = shortenUrl(entry.url);
      sections.push(`| ${short} | ${formatBytes(entry.totalBytes)} | ${formatBytes(entry.unusedBytes)} | ${formatBytes(entry.potentialSavingsBytes)} |`);
    }
    sections.push(``);
  }

  if (result.unusedJavascript.length === 0 && result.unusedCss.length === 0) {
    sections.push(`No unused code detected.`);
    sections.push(``);
  }

  return sections.join("\n");
}

export function formatLcpReport(result: LcpOptimizationResult): string {
  const sections: string[] = [
    `## LCP Optimization Analysis`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| LCP Time | ${result.lcpTimeMs !== null ? `${result.lcpTimeMs}ms` : "N/A"} |`,
    `| LCP Score | ${result.lcpScore !== null ? `${Math.round(result.lcpScore * 100)}/100` : "N/A"} |`,
    `| TTFB | ${result.ttfbMs !== null ? `${result.ttfbMs}ms` : "N/A"} |`,
    `| Resource Load Time | ${result.resourceLoadTimeMs !== null ? `${result.resourceLoadTimeMs}ms` : "N/A"} |`,
    `| Render Delay | ${result.renderDelayMs !== null ? `${result.renderDelayMs}ms` : "N/A"} |`,
    ``,
  ];

  if (result.lcpElement) {
    sections.push(`**LCP Element:** \`${result.lcpElement}\``);
    sections.push(``);
  }

  if (result.suggestions.length > 0) {
    sections.push(`### Optimization Suggestions`);
    for (const suggestion of result.suggestions) {
      sections.push(`- ${suggestion}`);
    }
    sections.push(``);
  }

  return sections.join("\n");
}

export function formatResourceReport(result: ResourceAnalysisResult): string {
  const sections: string[] = [
    `## Resource Analysis`,
    ``,
    `**Total Transfer Size:** ${formatBytes(result.totalTransferSizeBytes)} (${result.totalTransferSizeKb} KB)`,
    `**Total Requests:** ${result.totalRequests}`,
    ``,
    `### Breakdown by Type`,
    `| Type | Count | Size |`,
    `|------|-------|------|`,
  ];

  for (const group of result.breakdown) {
    sections.push(`| ${group.type} | ${group.count} | ${formatBytes(group.totalBytes)} |`);
  }

  sections.push(``);

  if (result.largestResources.length > 0) {
    sections.push(`### Largest Resources (Top ${result.largestResources.length})`);
    sections.push(`| Resource | Type | Size |`);
    sections.push(`|----------|------|------|`);
    for (const resource of result.largestResources) {
      const short = shortenUrl(resource.url);
      sections.push(`| ${short} | ${resource.resourceType} | ${formatBytes(resource.transferSizeBytes)} |`);
    }
    sections.push(``);
  }

  if (result.renderBlockingResources.length > 0) {
    sections.push(`### Render-Blocking Resources (${result.renderBlockingResources.length})`);
    sections.push(`| Resource | Type | Size |`);
    sections.push(`|----------|------|------|`);
    for (const resource of result.renderBlockingResources) {
      const short = shortenUrl(resource.url);
      sections.push(`| ${short} | ${resource.resourceType} | ${formatBytes(resource.transferSizeBytes)} |`);
    }
    sections.push(``);
  }

  return sections.join("\n");
}

// ── Utility ─────────────────────────────────────────────────────────

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.length > 60) {
      return `...${path.slice(-57)}`;
    }
    return path || url;
  } catch {
    return url.length > 60 ? `...${url.slice(-57)}` : url;
  }
}
