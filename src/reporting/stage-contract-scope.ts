import type { EvidenceStageContract } from "../evidence/evidence-manifest.js";

export interface StageContractScopeEvaluation {
  forbiddenMatches: string[];
  outOfScopeMatches: string[];
}

export function evaluateStageContractScope(input: {
  contract: EvidenceStageContract | null;
  changedFiles: string[];
  untrackedFiles: string[];
}): StageContractScopeEvaluation {
  if (!input.contract) {
    return { forbiddenMatches: [], outOfScopeMatches: [] };
  }

  const touchedFiles = dedupeSort([...input.changedFiles, ...input.untrackedFiles]);
  const forbiddenPatterns = input.contract.forbiddenPaths ?? [];
  const allowedPatterns = input.contract.allowedPaths ?? [];

  const forbiddenMatches = touchedFiles.filter((filePath) => forbiddenPatterns.some((pattern) => matchesScopePattern(filePath, pattern)));
  const outOfScopeMatches =
    allowedPatterns.length === 0
      ? []
      : touchedFiles.filter((filePath) => !allowedPatterns.some((pattern) => matchesScopePattern(filePath, pattern)));

  return {
    forbiddenMatches: dedupeSort(forbiddenMatches),
    outOfScopeMatches: dedupeSort(outOfScopeMatches)
  };
}

export function buildStageContractScopeWarning(outOfScopeMatches: string[]): string | null {
  if (outOfScopeMatches.length === 0) {
    return null;
  }
  return `Files changed outside stage contract allowedPaths: ${outOfScopeMatches.join(", ")}`;
}

export function buildStageContractScopeBlocker(forbiddenMatches: string[]): string | null {
  if (forbiddenMatches.length === 0) {
    return null;
  }
  return `Forbidden files changed by stage contract: ${forbiddenMatches.join(", ")}`;
}

function matchesScopePattern(filePath: string, pattern: string): boolean {
  const normalizedPath = normalizePath(filePath);
  const normalizedPattern = normalizePath(pattern);
  if (!normalizedPattern.includes("*")) {
    if (normalizedPath === normalizedPattern) return true;
    if (normalizedPath.startsWith(`${normalizedPattern}/`)) return true;
    return false;
  }
  const regex = globToRegex(normalizedPattern);
  return regex.test(normalizedPath);
}

function normalizePath(value: string): string {
  return value.trim().replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withDoubleStar = escaped.replaceAll("**", "__DOUBLE_STAR__");
  const withSingleStar = withDoubleStar.replaceAll("*", "[^/]*");
  const finalPattern = withSingleStar.replaceAll("__DOUBLE_STAR__", ".*");
  return new RegExp(`^${finalPattern}$`);
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}
