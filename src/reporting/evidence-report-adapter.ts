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

export function readAvailableEvidenceReportReviewer(manifest: EvidenceManifest): ChangeReport["reviewer"] & { available: boolean } {
  return {
    ...readEvidenceReportReviewer(manifest),
    available: manifest.reviewer !== undefined
  };
}

export function hasEvidenceReviewer(manifest: EvidenceManifest): boolean {
  return manifest.reviewer !== undefined;
}

export function readEvidenceReportWriteSafety(manifest: EvidenceManifest): ChangeReport["writeSafety"] {
  return { state: manifest.writeSafety?.status ?? "unknown" };
}

export function readEvidenceReportPostWriteReview(manifest: EvidenceManifest): ChangeReport["postWriteReview"] {
  const status = manifest.postWriteReview?.status ?? "missing";
  return {
    required: status !== "missing",
    status
  };
}

export function readEvidenceReportRisk(manifest: EvidenceManifest): Pick<ChangeReport, "risk" | "riskSignals"> {
  const level = manifest.risk?.level;
  return {
    risk: level === "low" || level === "medium" || level === "high" ? level : "medium",
    riskSignals: dedupeSort(manifest.risk?.reasons ?? [])
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
