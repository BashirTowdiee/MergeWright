export interface WriteAuditGitFiles {
  changedFiles: string[];
  untrackedFiles: string[];
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

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
