import { renderIssueLines, renderListLines } from "./change-report-formatters.js";
import type { ChangeReport } from "./change-report-types.js";

export function formatPrSummaryMarkdown(report: ChangeReport): string {
  const prTitle = report.suggestedCommitMessage.trim() || "Update staged change";
  const summaryText = report.summary.trim();

  const lines: string[] = [`# ${prTitle}`, "", "## Summary", summaryText || "None", "", "## Changes"];

  if (report.changedFiles.length === 0) {
    lines.push("- None");
  } else {
    lines.push(`- Changed files (${dedupeSort(report.changedFiles).length}):`);
    for (const filePath of dedupeSort(report.changedFiles)) {
      lines.push(`- ${filePath}`);
    }
  }

  lines.push("", "## Testing");
  lines.push(`- Checks state: ${report.checks.state}`);
  if (report.checks.state === "failed") {
    lines.push("- Failed checks:");
    lines.push(...renderListLines(report.checks.failedChecks));
  } else if (report.checks.state === "skipped") {
    lines.push("- Failed checks: None (checks skipped)");
  } else if (report.checks.state === "unknown") {
    lines.push("- Failed checks: None (checks status unknown)");
  } else {
    lines.push("- Failed checks: None");
  }
  if (report.status !== "READY") {
    lines.push(`- Commit readiness: ${report.status} (not ready for direct merge)`);
  }

  lines.push("", "## Risk");
  lines.push(`- Risk level: ${report.risk}`);
  lines.push("- Risk signals:");
  lines.push(...renderListLines(report.riskSignals));
  lines.push("- Scope drift warnings:");
  lines.push(...renderListLines(report.scopeDriftWarnings));

  lines.push("", "## Review Notes");
  const blockingIssues = renderIssueLines(report.reviewer.blockingIssues);
  const nonBlockingIssues = renderIssueLines(report.reviewer.nonBlockingIssues);
  lines.push(`- Reviewer verdict: ${report.reviewer.verdict}`);
  lines.push("- Blocking issues:");
  lines.push(...blockingIssues);
  lines.push("- Non-blocking issues:");
  lines.push(...nonBlockingIssues);

  lines.push("", "## Manual Checklist");
  if (report.manualReviewChecklist.length === 0) {
    lines.push("- [ ] None");
  } else {
    for (const item of dedupeSort(report.manualReviewChecklist)) {
      lines.push(`- [ ] ${item}`);
    }
  }

  lines.push("", "## Rollback");
  lines.push("Revert this PR commit set and restore the previous known-good state.");
  lines.push(`Current report status: ${report.status}.`);
  lines.push("");

  return lines.join("\n");
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
