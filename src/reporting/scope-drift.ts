import type { ChangeReportPolicy } from "./change-report-types.js";

const HIGH_RISK_PATTERNS = [
  /(^|\/)auth(\/|$)/i,
  /(^|\/)security(\/|$)/i,
  /(^|\/)payment(s)?(\/|$)/i,
  /(^|\/)billing(\/|$)/i,
  /(^|\/)database(\/|$)/i,
  /(^|\/)migration(s)?(\/|$)/i,
  /(^|\/)terraform(\/|$)/i,
  /(^|\/)\.github\/workflows\//i,
  /(^|\/)(package-lock\.json|pnpm-lock\.ya?ml|yarn\.lock|bun\.lockb|go\.sum|cargo\.lock)$/i,
  /(^|\/)(package\.json|pyproject\.toml|requirements(\.txt)?|poetry\.lock|Pipfile(\.lock)?|Gemfile(\.lock)?|pom\.xml|build\.gradle(\.kts)?|gradle\.properties)$/i,
  /(^|\/)(\.env|\.env\.[^/]+)$/i,
  /(^|\/).*config\.[^/]+$/i
];

const DEPENDENCY_PATTERNS = [/(^|\/)(package\.json|package-lock\.json|pnpm-lock\.ya?ml|yarn\.lock|bun\.lockb)$/i];
const DOCS_ONLY_PATTERNS = [/\.md$/i, /(^|\/)docs\//i, /(^|\/)README(\.[^/]+)?$/i, /(^|\/)CHANGELOG(\.[^/]+)?$/i];
const HIGH_RISK_DOMAIN_HINTS = ["auth", "security", "payment", "billing", "database", "migration", "terraform", "workflow"];

export function buildScopeDriftWarnings(input: {
  stageText: string;
  changedFiles: string[];
  untrackedFiles: string[];
  policy: ChangeReportPolicy;
}): string[] {
  if (!input.policy.scopeDrift.enabled) {
    return [];
  }
  const warnings: string[] = [];
  const stageLower = input.stageText.toLowerCase();

  if (
    mentionsNoDependencies(input.stageText) &&
    input.changedFiles.some((file) => DEPENDENCY_PATTERNS.some((pattern) => pattern.test(file)))
  ) {
    warnings.push("Dependency files changed even though stage text indicates no dependency changes.");
  }

  const scopedFiles = extractScopeFileList(input.stageText);
  if (scopedFiles.length > 0) {
    const outside = input.changedFiles.filter((changed) => {
      const normalizedChanged = normalizePathForMatching(changed);
      const inScope = scopedFiles.some((scoped) => {
        const normalizedScoped = normalizePathForMatching(scoped);
        return normalizedChanged === normalizedScoped || normalizedChanged.startsWith(`${normalizedScoped}/`);
      });
      if (inScope) return false;
      if (input.policy.scopeDrift.allowUnlistedTestFiles && isTestLikePath(normalizedChanged)) return false;
      if (input.policy.scopeDrift.allowUnlistedDocsFiles && isDocsLikePath(normalizedChanged)) return false;
      return true;
    });
    if (outside.length > 0) {
      warnings.push("Files changed outside explicit Scope file list in stage text.");
    }
  }

  const touchedHighRisk = input.changedFiles.some((file) => matchesAny(file, HIGH_RISK_PATTERNS));
  const mentionsHighRiskDomain = HIGH_RISK_DOMAIN_HINTS.some((hint) => stageLower.includes(hint));
  if (touchedHighRisk && !mentionsHighRiskDomain) {
    warnings.push("High-risk files changed but stage text does not mention the related domain.");
  }

  if (input.untrackedFiles.length > 0) {
    warnings.push("Untracked files remain after write audit.");
  }

  return dedupeSort(warnings);
}

export function isHighRiskFile(file: string): boolean {
  return matchesAny(file, HIGH_RISK_PATTERNS);
}

export function isDocsOnly(files: string[]): boolean {
  return files.length > 0 && files.every((file) => matchesAny(file, DOCS_ONLY_PATTERNS));
}

function isTestLikePath(filePath: string): boolean {
  return /(^|\/)(test|tests|__tests__)(\/|$)/i.test(filePath) || /\.(test|spec)\.[^/]+$/i.test(filePath);
}

function isDocsLikePath(filePath: string): boolean {
  return isDocsOnly([filePath]);
}

function mentionsNoDependencies(text: string): boolean {
  const lowered = text.toLowerCase();
  return lowered.includes("no dependencies") || lowered.includes("no dependency") || lowered.includes("without dependencies");
}

function extractScopeFileList(stageText: string): string[] {
  const lines = stageText.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{1,6}\s*scope\b/i.test(line.trim()));
  if (start === -1) return [];

  const files: string[] = [];
  let inFence = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line.trim())) break;
    if (isFenceStartOrEnd(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$/);
    if (!bullet) continue;
    const candidate = bullet[1].replace(/^`|`$/g, "").trim();
    if (candidate && candidate.includes("/")) {
      files.push(candidate);
    } else if (candidate && /\.[a-z0-9]+$/i.test(candidate)) {
      files.push(candidate);
    }
  }
  return dedupeSort(files);
}

function normalizePathForMatching(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function matchesAny(file: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(file));
}

function isFenceStartOrEnd(line: string): boolean {
  return /^\s*```/.test(line);
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
