import type { ChangeReport } from "./change-report-types.js";

export interface ProveResult {
  version: 1;
  runId: string;
  ready: boolean;
  exitCode: 0 | 1;
  nextAction: string;
  blockers: string[];
  report: ChangeReport;
}

export function createProveResult(report: ChangeReport): ProveResult {
  const ready = report.status === "READY";
  return {
    version: 1,
    runId: report.runId,
    ready,
    exitCode: ready ? 0 : 1,
    nextAction: determineNextAction(report),
    blockers: collectBlockers(report),
    report
  };
}

function determineNextAction(report: ChangeReport): string {
  if (report.status === "READY") {
    return "Ready to merge after human approval.";
  }
  if (report.status === "BLOCKED") {
    return "Resolve blocking preconditions, then rerun prove.";
  }
  if (report.status === "NEEDS_FIX") {
    if (report.reviewer.blockingIssues.length > 0 || report.reviewer.verdict === "FAIL") {
      return "Address reviewer blocking issues, then rerun reviewer/checks and prove.";
    }
    if (report.checks.state === "failed") {
      return "Fix failed checks, rerun checks, then rerun prove.";
    }
    return "Apply required fixes, then rerun reviewer/checks and prove.";
  }
  return "Review risks and missing evidence, then rerun prove.";
}

function collectBlockers(report: ChangeReport): string[] {
  const reviewerBlockers = report.reviewer.blockingIssues
    .map((issue) => `[${issue.severity}] ${issue.summary}`)
    .sort((a, b) => a.localeCompare(b));

  const failedChecks = report.checks.failedChecks
    .filter((check) => check.trim().length > 0)
    .map((check) => `check failed: ${check.trim()}`)
    .sort((a, b) => a.localeCompare(b));

  const highSignalRisk = report.riskSignals
    .filter((signal) => HIGH_SIGNAL_PATTERN.test(signal))
    .map((signal) => `risk signal: ${signal}`)
    .sort((a, b) => a.localeCompare(b));

  const acceptanceBlockers = report.acceptanceCriteria.results
    .filter((item) => item.status === "fail" || item.status === "unknown")
    .map((item) => `acceptance criterion ${item.status}: ${item.criterion}`)
    .sort((a, b) => a.localeCompare(b));

  return dedupeSort([...reviewerBlockers, ...failedChecks, ...acceptanceBlockers, ...highSignalRisk]);
}

const HIGH_SIGNAL_PATTERN = /(fail|blocked|unknown|unavailable|malformed|high-risk|scope drift|untracked)/i;

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}
