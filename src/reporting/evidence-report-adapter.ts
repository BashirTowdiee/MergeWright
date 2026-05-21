import type { EvidenceIssueSummary, EvidenceManifest } from "../evidence/evidence-manifest.js";
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

export function readEvidenceReportReviewer(manifest: EvidenceManifest): ChangeReport["reviewer"] {
  const verdict = manifest.reviewer?.verdict;
  return {
    verdict: verdict === "PASS" || verdict === "FAIL" ? verdict : "unavailable",
    blockingIssues: mapIssues(manifest.reviewer?.blockingIssues),
    nonBlockingIssues: mapIssues(manifest.reviewer?.nonBlockingIssues)
  };
}

function mapIssues(issues: EvidenceIssueSummary[] | undefined): Array<{ severity: string; summary: string; files: string[] }> {
  return (issues ?? [])
    .map((issue) => ({
      severity: issue.severity ?? "medium",
      summary: issue.summary,
      files: dedupeSort(issue.files ?? [])
    }))
    .sort((a, b) => `${a.severity}\u0000${a.summary}`.localeCompare(`${b.severity}\u0000${b.summary}`));
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}
