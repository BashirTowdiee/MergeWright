import { access } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorConfig } from "./config.js";
import { createGitInspectionClient, type GitInspectionClient } from "./git-inspection.js";

export interface WriteSafetyInput {
  workspaceRoot: string;
  config: OrchestratorConfig;
  git?: GitInspectionClient;
}

export interface WriteSafetyResult {
  ok: boolean;
  summary: string;
  failures: string[];
  warnings: string[];
  enabled: boolean;
  branch: string;
  isGitWorkTree: boolean;
  isCleanWorkingTree: boolean;
  workingTreeState: "clean" | "dirty" | "unknown";
  changedFiles: string[];
  matchedBlockedPaths: string[];
}

export async function checkWriteSafety(input: WriteSafetyInput): Promise<WriteSafetyResult> {
  const { workspaceRoot, config } = input;
  const git = input.git ?? createGitInspectionClient();

  const failures: string[] = [];
  const warnings: string[] = [];
  const changedFiles: string[] = [];
  const matchedBlockedPaths = new Set<string>();

  try {
    await access(workspaceRoot);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    failures.push(`workspaceRoot does not exist or is not accessible: ${workspaceRoot}. ${msg}`);
    return {
      ok: false,
      summary: "Write safety check failed.",
      failures,
      warnings,
      enabled: config.writeSafety.enabled,
      branch: "",
      isGitWorkTree: false,
      isCleanWorkingTree: false,
      workingTreeState: "unknown",
      changedFiles,
      matchedBlockedPaths: []
    };
  }

  const inside = await git.isInsideWorkTree(workspaceRoot);
  const isGitWorkTree = inside.success && inside.stdout.trim() === "true";
  if (!isGitWorkTree) {
    failures.push("workspaceRoot is not inside a git work tree");
  }

  const branchResult = isGitWorkTree ? await git.currentBranch(workspaceRoot) : null;
  const branch = branchResult?.stdout.trim() ?? "";
  if (isGitWorkTree && !branchResult?.success) {
    failures.push("failed to inspect current git branch");
  }

  const statusResult = isGitWorkTree ? await git.statusPorcelain(workspaceRoot) : null;
  if (isGitWorkTree && !statusResult?.success) {
    failures.push("failed to inspect git working tree status");
  }

  const diffNamesResult = isGitWorkTree ? await git.diffNameOnly(workspaceRoot) : null;
  if (isGitWorkTree && !diffNamesResult?.success) {
    failures.push("failed to inspect changed file paths");
  }

  const changedFileSet = new Set<string>();
  if (diffNamesResult?.success) {
    for (const line of diffNamesResult.stdout.split(/\r?\n/)) {
      const file = line.trim();
      if (file) {
        changedFileSet.add(file);
      }
    }
  }
  if (statusResult?.success) {
    for (const file of parseStatusPorcelainPaths(statusResult.stdout)) {
      changedFileSet.add(file);
    }
  }
  changedFiles.push(...changedFileSet);

  const workingTreeState: "clean" | "dirty" | "unknown" = !isGitWorkTree || !statusResult?.success
    ? "unknown"
    : changedFileSet.size === 0
      ? "clean"
      : "dirty";
  const isCleanWorkingTree = workingTreeState === "clean";
  if (config.writeSafety.requireCleanWorkingTree && isGitWorkTree && workingTreeState !== "clean") {
    failures.push("working tree is dirty and writeSafety.requireCleanWorkingTree is true");
  }

  if (isGitWorkTree && config.writeSafety.allowedBranches.length > 0) {
    if (!branch.trim()) {
      failures.push("Current branch is unknown, but allowedBranches is configured.");
    } else {
      const allowed = config.writeSafety.allowedBranches.some((pattern) => matchesSimplePattern(branch, pattern));
      if (!allowed) {
        failures.push(`current branch \"${branch}\" does not match writeSafety.allowedBranches`);
      }
    }
  }

  for (const file of changedFiles) {
    for (const blockedPattern of config.writeSafety.blockedPaths) {
      if (matchesBlockedPath(file, blockedPattern)) {
        matchedBlockedPaths.add(`${file} -> ${blockedPattern}`);
      }
    }
  }

  if (matchedBlockedPaths.size > 0) {
    failures.push("changed files include writeSafety.blockedPaths matches");
  }

  if (!config.writeSafety.enabled) {
    failures.push("writeSafety.enabled is false");
    warnings.push("write mode is currently disabled; this check is inspection-only");
  }

  if (config.writeSafety.autoCommit) {
    failures.push("writeSafety.autoCommit must be false");
  }

  if (config.writeSafety.autoPush) {
    failures.push("writeSafety.autoPush must be false");
  }

  const ok = failures.length === 0;
  return {
    ok,
    summary: ok ? "Write safety check passed." : "Write safety check failed.",
    failures,
    warnings,
    enabled: config.writeSafety.enabled,
    branch,
    isGitWorkTree,
    isCleanWorkingTree,
    workingTreeState,
    changedFiles,
    matchedBlockedPaths: Array.from(matchedBlockedPaths)
  };
}

export function parseStatusPorcelainPaths(status: string): string[] {
  const paths: string[] = [];
  for (const rawLine of status.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) {
      continue;
    }

    const payload = line.length >= 3 ? line.slice(3).trim() : "";
    if (!payload) {
      continue;
    }

    const renameSplit = payload.split(" -> ");
    if (renameSplit.length === 2) {
      const oldPath = renameSplit[0].trim();
      const newPath = renameSplit[1].trim();
      if (oldPath) {
        paths.push(oldPath);
      }
      if (newPath) {
        paths.push(newPath);
      }
      continue;
    }

    paths.push(payload);
  }
  return paths;
}

export function matchesSimplePattern(value: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }

  if (!pattern.includes("*")) {
    return value === pattern;
  }

  const escaped = escapeRegex(pattern).replace(/\\\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(value);
}

export function matchesBlockedPath(filePath: string, blockedPattern: string): boolean {
  const normalizedFile = normalizePosixPath(filePath);
  const normalizedPattern = normalizePosixPath(blockedPattern);

  if (normalizedPattern.endsWith("/")) {
    return normalizedFile.startsWith(normalizedPattern);
  }

  if (normalizedPattern.includes("*")) {
    return matchesSimplePattern(normalizedFile, normalizedPattern);
  }

  return normalizedFile === normalizedPattern;
}

function normalizePosixPath(input: string): string {
  return input.split(path.win32.sep).join("/");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
