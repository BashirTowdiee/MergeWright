import type { CompareRunsReport } from "../../reporting/compare-runs.js";

export function formatCompareRunsSummaryLines(report: CompareRunsReport): string[] {
  const lines = [
    "Run Comparison",
    `- run A: ${report.runA.runId}`,
    `- run B: ${report.runB.runId}`,
    `- readiness: ${report.runA.status} -> ${report.runB.status}`,
    `- score: ${report.runA.score} -> ${report.runB.score} (delta ${formatSigned(report.deltas.score)})`,
    `- risk: ${report.runA.risk} -> ${report.runB.risk} (${report.deltas.risk})`,
    `- reviewer verdict: ${report.runA.reviewerVerdict} -> ${report.runB.reviewerVerdict}`,
    `- checks state: ${report.runA.checksState} -> ${report.runB.checksState}`,
    `- changed files: ${report.runA.changedFileCount} -> ${report.runB.changedFileCount} (delta ${formatSigned(report.deltas.changedFileCount)})`,
    `- changed files only in A: ${report.changedFiles.onlyInA.length}`,
    `- changed files only in B: ${report.changedFiles.onlyInB.length}`,
    `- changed files in both: ${report.changedFiles.inBothCount}`,
    `- checks failed only in A: ${report.checks.failedOnlyInA.length}`,
    `- checks failed only in B: ${report.checks.failedOnlyInB.length}`,
    `- acceptance regressions: ${report.acceptance.regressions.length}`,
    `- acceptance improvements: ${report.acceptance.improvements.length}`,
    `- missing evidence warnings (A): ${report.runA.missingEvidenceWarnings.length}`,
    `- missing evidence warnings (B): ${report.runB.missingEvidenceWarnings.length}`
  ];

  if (report.runA.missingEvidenceWarnings.length > 0) {
    lines.push("- run A missing evidence details:");
    for (const warning of report.runA.missingEvidenceWarnings) {
      lines.push(`  - ${warning}`);
    }
  }
  if (report.runB.missingEvidenceWarnings.length > 0) {
    lines.push("- run B missing evidence details:");
    for (const warning of report.runB.missingEvidenceWarnings) {
      lines.push(`  - ${warning}`);
    }
  }

  return lines;
}

function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}
