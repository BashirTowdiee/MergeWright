import type { generateChangeReport } from "../../change-report.js";

export function formatReportSummaryLines(
  report: Awaited<ReturnType<typeof generateChangeReport>>,
  runId: string,
  markdownPath: string,
  jsonPath: string,
  prSummaryPath: string | null
): string[] {
  const lines = [
    "AI Change Report",
    `- run id: ${runId}`,
    `- status: ${report.status}`,
    `- score: ${report.score}/100`,
    `- risk: ${report.risk}`,
    `- changed files: ${report.changedFiles.length}`,
    `- untracked files: ${report.untrackedFiles.length}`,
    `- scope drift warnings: ${report.scopeDriftWarnings.length}`,
    `- report markdown: ${markdownPath}`,
    `- report json: ${jsonPath}`
  ];
  if (prSummaryPath) {
    lines.push(`- PR summary markdown: ${prSummaryPath}`);
  }
  return lines;
}

export function formatGeneratedReportSummaryLines(report: Awaited<ReturnType<typeof generateChangeReport>>, markdownPath: string, jsonPath: string): string[] {
  return [
    "AI Change Report",
    `- status: ${report.status}`,
    `- score: ${report.score}/100`,
    `- risk: ${report.risk}`,
    `- changed files: ${report.changedFiles.length}`,
    `- untracked files: ${report.untrackedFiles.length}`,
    `- scope drift warnings: ${report.scopeDriftWarnings.length}`,
    `- report markdown: ${markdownPath}`,
    `- report json: ${jsonPath}`
  ];
}
