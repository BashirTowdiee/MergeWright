import type { CheckWriteSafetyRunResult } from "../types.js";

export function formatWriteSafetySummaryLines(outcome: CheckWriteSafetyRunResult): string[] {
  const { result } = outcome;
  const lines = [
    "Write safety summary",
    `- config path: ${outcome.configPath}`,
    `- workspace root: ${outcome.workspaceRoot}`,
    `- writeSafety.enabled: ${result.enabled}`,
    `- git work tree: ${result.isGitWorkTree}`,
    `- branch: ${result.branch || "(unknown)"}`,
    `- working tree: ${result.workingTreeState}`,
    `- changed files considered: ${result.changedFiles.length}`,
    `- blocked path matches: ${result.matchedBlockedPaths.length}`,
    `- result: ${result.ok ? "PASS" : "FAIL"}`
  ];

  if (result.warnings.length > 0) {
    lines.push("- warnings:");
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  if (result.failures.length > 0) {
    lines.push("- failures:");
    for (const failure of result.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  if (result.matchedBlockedPaths.length > 0) {
    lines.push("- blocked path matches detail:");
    for (const match of result.matchedBlockedPaths) {
      lines.push(`  - ${match}`);
    }
  }

  return lines;
}
