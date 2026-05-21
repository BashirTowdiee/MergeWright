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

export function readEvidenceReportChecks(manifest: EvidenceManifest): ChangeReport["checks"] {
  if (manifest.checks?.status === "passed") {
    return { state: "passed", failedChecks: [] };
  }
  if (manifest.checks?.status === "failed") {
    return { state: "failed", failedChecks: dedupeSort(manifest.checks.failed) };
  }
  if (manifest.checks?.status === "skipped") {
    return { state: "skipped", failedChecks: [] };
  }
  return { state: "unknown", failedChecks: [] };
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}
