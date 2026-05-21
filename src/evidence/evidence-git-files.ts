import type { EvidenceManifest } from "./evidence-manifest.js";

export function mergeEvidenceGitFiles(input: {
  manifest: EvidenceManifest;
  changedFiles?: string[];
  untrackedFiles?: string[];
  unexpectedFiles?: string[];
}): EvidenceManifest {
  return {
    ...input.manifest,
    git: {
      ...input.manifest.git,
      changedFiles: dedupeSort([...input.manifest.git.changedFiles, ...(input.changedFiles ?? [])]),
      untrackedFiles: dedupeSort([...input.manifest.git.untrackedFiles, ...(input.untrackedFiles ?? [])]),
      unexpectedFiles: dedupeSort([...input.manifest.git.unexpectedFiles, ...(input.unexpectedFiles ?? [])])
    }
  };
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}
