import type { Stage, StagePlan } from "../../stage-plan.js";
import path from "node:path";

export function buildDefaultCommitMessage(plan: StagePlan, stage: Stage): string {
  const subject = `stage(${stage.id}): ${stage.title}`;
  const checks = stage.checks.length === 0 ? "(none)" : stage.checks.join(", ");
  const body = [
    `Stage Plan: ${plan.title}`,
    `Stage ID: ${stage.id}`,
    `Stage Title: ${stage.title}`,
    `Revision: ${stage.revision}`,
    "Stage status before commit: accepted",
    `Stage artefact path: ${path.join("stages", stage.id)}`,
    `Checks: ${checks}`
  ];
  return `${subject}\n\n${body.join("\n")}`;
}

export function assertFilesWithinStageScope(changedFiles: string[], stage: Stage): void {
  const includes = stage.scope.include ?? [];
  const excludes = stage.scope.exclude ?? [];

  if (includes.length > 0) {
    const outside = changedFiles.filter((file) => !includes.some((pattern) => matchesScopePattern(file, pattern)));
    if (outside.length > 0) {
      throw new Error(
        `accept-stage --auto-commit refused: changed files are outside stage scope.include for "${stage.id}": ${outside.join(", ")}`
      );
    }
  }

  if (excludes.length > 0) {
    const blocked = changedFiles.filter((file) => excludes.some((pattern) => matchesScopePattern(file, pattern)));
    if (blocked.length > 0) {
      throw new Error(
        `accept-stage --auto-commit refused: changed files match stage scope.exclude for "${stage.id}": ${blocked.join(", ")}`
      );
    }
  }
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
