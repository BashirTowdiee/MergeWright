import type { ChangeReport } from "./change-report-types.js";

export function formatChangeReportMarkdown(report: ChangeReport): string {
  const lines: string[] = [
    "# AI Change Report",
    "",
    "## Commit Readiness",
    `- Status: ${report.status}`,
    `- Score: ${report.score}/100`,
    `- Risk: ${report.risk}`,
    "",
    "## Summary",
    report.summary.trim() || "None",
    "",
    "## Run",
    `- Run ID: ${report.runId}`,
    `- Project: ${report.projectName ?? "None"}`,
    `- Stage: ${report.stageName ?? "None"}`,
    "",
    "## Evidence",
    `- Available: ${report.evidence?.available ?? false}`,
    `- Status: ${report.evidence?.status ?? "missing"}`,
    `- Completed at: ${report.evidence?.completedAt ?? "None"}`,
    "",
    "## Phase Summary",
    `- Planner: ${readPhaseStatus(report, "planner")}`,
    `- Builder: ${readPhaseStatus(report, "builder")}`,
    `- Reviewer: ${readPhaseStatus(report, "reviewer")}`,
    `- Fix planning: ${readPhaseStatus(report, "fixPlanning")}`,
    `- Fix execution: ${readPhaseStatus(report, "fixExecution")}`,
    `- Checks: ${readPhaseStatus(report, "checks")}`,
    "",
    "## Reviewer",
    `- Verdict: ${report.reviewer.verdict}`,
    "- Blocking issues:"
  ];

  lines.push(...renderIssueLines(report.reviewer.blockingIssues));
  lines.push("- Non-blocking issues:");
  lines.push(...renderIssueLines(report.reviewer.nonBlockingIssues));

  lines.push("", "## Checks", `- State: ${report.checks.state}`, "- Failed checks:");
  lines.push(...renderListLines(report.checks.failedChecks));

  lines.push("", "## Changed Files");
  lines.push(...renderListLines(report.changedFiles));
  lines.push("", "## Untracked Files");
  lines.push(...renderListLines(report.untrackedFiles));
  lines.push("", "## Scope Drift");
  lines.push(...renderListLines(report.scopeDriftWarnings));
  lines.push("", "## Risk Signals");
  lines.push(...renderListLines(report.riskSignals));

  lines.push("", "## Auto-chain");
  lines.push(...renderAutoChainLines(report.autoChain));

  lines.push("", "## Manual Review Checklist");
  lines.push(...renderListLines(report.manualReviewChecklist));

  lines.push("", "## Suggested Commit Message", report.suggestedCommitMessage || "None", "");
  return lines.join("\n");
}

export function formatChangeReportJson(report: ChangeReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderListLines(items: string[]): string[] {
  const sorted = dedupeSort(items);
  return sorted.length > 0 ? sorted.map((item) => `- ${item}`) : ["- None"];
}

export function renderIssueLines(issues: Array<{ severity: string; summary: string; files: string[] }>): string[] {
  if (issues.length === 0) {
    return ["- None"];
  }
  const sorted = [...issues].sort((a, b) => {
    const aKey = `${a.severity}\u0000${a.summary}\u0000${dedupeSort(a.files).join(",")}`;
    const bKey = `${b.severity}\u0000${b.summary}\u0000${dedupeSort(b.files).join(",")}`;
    return aKey.localeCompare(bKey);
  });
  return sorted.map((issue) => {
    const files = dedupeSort(issue.files);
    const suffix = files.length > 0 ? ` (files: ${files.join(", ")})` : "";
    return `- [${issue.severity}] ${issue.summary}${suffix}`;
  });
}

function renderAutoChainLines(autoChain: ChangeReport["autoChain"]): string[] {
  if (!autoChain) {
    return ["- None"];
  }
  return [
    `- Enabled: ${autoChain.enabled}`,
    `- Final status: ${autoChain.finalStatus ?? "None"}`,
    `- Attempts used: ${autoChain.attemptsUsed ?? "None"}`,
    `- Max fix attempts: ${autoChain.maxFixAttempts ?? "None"}`
  ];
}

function readPhaseStatus(report: ChangeReport, phaseName: string): string {
  return report.phases[phaseName] ?? "unknown";
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
