import { readFile } from "node:fs/promises";
import path from "node:path";

export interface WriteAuditGitFiles {
  changedFiles: string[];
  untrackedFiles: string[];
}

export async function readWriteAuditGitFiles(runDir: string): Promise<WriteAuditGitFiles> {
  const [builderSummary, fixSummary] = await Promise.all([
    readOptionalJson(path.join(runDir, "write-audit", "builder", "summary.json")),
    readOptionalJson(path.join(runDir, "write-audit", "fix", "summary.json"))
  ]);
  return collectWriteAuditGitFiles(builderSummary, fixSummary);
}

export function collectWriteAuditGitFiles(...summaries: unknown[]): WriteAuditGitFiles {
  const changedFiles: string[] = [];
  const untrackedFiles: string[] = [];

  for (const summary of summaries) {
    if (!summary || typeof summary !== "object") {
      continue;
    }
    const candidate = summary as {
      post?: { changedFiles?: unknown; untrackedFiles?: unknown };
      changedFilesAddedByPhase?: unknown;
    };
    changedFiles.push(...coerceStringArray(candidate.post?.changedFiles));
    changedFiles.push(...coerceStringArray(candidate.changedFilesAddedByPhase));
    untrackedFiles.push(...coerceStringArray(candidate.post?.untrackedFiles));
  }

  return {
    changedFiles: dedupeSort(changedFiles),
    untrackedFiles: dedupeSort(untrackedFiles)
  };
}

async function readOptionalJson(filePath: string): Promise<unknown | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
