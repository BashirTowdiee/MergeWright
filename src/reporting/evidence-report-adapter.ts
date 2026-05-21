import type { EvidenceManifest } from "../evidence/evidence-manifest.js";
import type { ChangeReport } from "./change-report-types.js";

export function readEvidenceReportFiles(manifest: EvidenceManifest): Pick<ChangeReport, "changedFiles" | "untrackedFiles"> {
  return {
    changedFiles: dedupeSort(manifest.git.changedFiles),
    untrackedFiles: dedupeSort(manifest.git.untrackedFiles)
  };
}

export function readEvidenceReportSummary(manifest: EvidenceManifest): NonNullable<ChangeReport["evidence"]> {
  return {
    available: true,
    status: manifest.status,
    completedAt: manifest.completedAt ?? null
  };
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}
