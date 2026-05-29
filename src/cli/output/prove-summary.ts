import type { ProveResult } from "../../reporting/prove-report.js";

export function formatProveSummaryLines(result: ProveResult): string[] {
  const lines = [
    "Merge Readiness Proof",
    `- run id: ${result.runId}`,
    `- ready: ${result.ready}`,
    `- status: ${result.report.status}`,
    `- score: ${result.report.score}/100`,
    `- risk: ${result.report.risk}`,
    `- reviewer verdict: ${result.report.reviewer.verdict}`,
    `- checks: ${result.report.checks.state}`,
    `- next action: ${result.nextAction}`,
    "- blockers:"
  ];

  if (result.blockers.length === 0) {
    lines.push("  - none");
    return lines;
  }

  for (const blocker of result.blockers) {
    lines.push(`  - ${blocker}`);
  }
  return lines;
}
