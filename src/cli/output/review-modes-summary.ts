import type { FocusedReviewModesResult } from "../../reporting/review-modes.js";

export function formatReviewModesSummaryLines(result: FocusedReviewModesResult): string[] {
  const lines = [
    "Focused Review Modes",
    `- run id: ${result.runId}`,
    `- aggregate verdict: ${result.aggregateVerdict}`,
    `- mode count: ${result.modes.length}`
  ];

  for (const modeResult of result.modes) {
    lines.push(`- mode ${modeResult.mode}: ${modeResult.decision.verdict}`);
    lines.push(`  - blocking issues: ${modeResult.decision.blockingIssues.length}`);
    lines.push(`  - non-blocking issues: ${modeResult.decision.nonBlockingIssues.length}`);
    lines.push(`  - risk level: ${modeResult.decision.riskLevel ?? "unknown"}`);
    lines.push(`  - checklist: ${modeResult.checklist.filter((item) => item.status === "pass").length} pass, ${modeResult.checklist.filter((item) => item.status === "fail").length} fail, ${modeResult.checklist.filter((item) => item.status === "unknown").length} unknown`);
  }

  return lines;
}
