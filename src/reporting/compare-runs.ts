import type { ChangeReport } from "./change-report-types.js";

export interface CompareRunsReport {
  version: 1;
  runA: ComparedRunSummary;
  runB: ComparedRunSummary;
  deltas: {
    score: number;
    risk: "higher" | "lower" | "same";
    readinessChanged: boolean;
    checksChanged: boolean;
    reviewerChanged: boolean;
    changedFileCount: number;
  };
  changedFiles: {
    onlyInA: string[];
    onlyInB: string[];
    inBothCount: number;
  };
  checks: {
    failedOnlyInA: string[];
    failedOnlyInB: string[];
  };
  acceptance: {
    regressions: string[];
    improvements: string[];
  };
}

export interface ComparedRunSummary {
  runId: string;
  status: ChangeReport["status"];
  score: number;
  risk: ChangeReport["risk"];
  reviewerVerdict: ChangeReport["reviewer"]["verdict"];
  checksState: ChangeReport["checks"]["state"];
  changedFileCount: number;
  acceptanceCriteria: {
    expected: number;
    passed: number;
    failed: number;
    unknown: number;
  };
  missingEvidenceWarnings: string[];
}

const MISSING_EVIDENCE_PATTERN = /(missing|unavailable|malformed|unknown|unparsable|inconclusive|not found|not observed)/i;
const RISK_RANK: Record<ChangeReport["risk"], number> = { low: 1, medium: 2, high: 3 };
const ACCEPTANCE_RANK: Record<"pass" | "unknown" | "fail", number> = { pass: 2, unknown: 1, fail: 0 };

export function createCompareRunsReport(runA: ChangeReport, runB: ChangeReport): CompareRunsReport {
  const changedFilesA = dedupeSort(runA.changedFiles);
  const changedFilesB = dedupeSort(runB.changedFiles);
  const failedChecksA = dedupeSort(runA.checks.failedChecks);
  const failedChecksB = dedupeSort(runB.checks.failedChecks);

  const onlyInA = changedFilesA.filter((file) => !changedFilesB.includes(file));
  const onlyInB = changedFilesB.filter((file) => !changedFilesA.includes(file));
  const inBothCount = changedFilesA.filter((file) => changedFilesB.includes(file)).length;

  const [acceptanceRegressions, acceptanceImprovements] = compareAcceptanceCriteria(runA, runB);

  return {
    version: 1,
    runA: summarizeComparedRun(runA),
    runB: summarizeComparedRun(runB),
    deltas: {
      score: runB.score - runA.score,
      risk: compareRisk(runA.risk, runB.risk),
      readinessChanged: runA.status !== runB.status,
      checksChanged: runA.checks.state !== runB.checks.state,
      reviewerChanged: runA.reviewer.verdict !== runB.reviewer.verdict,
      changedFileCount: runB.changedFiles.length - runA.changedFiles.length
    },
    changedFiles: {
      onlyInA,
      onlyInB,
      inBothCount
    },
    checks: {
      failedOnlyInA: failedChecksA.filter((check) => !failedChecksB.includes(check)),
      failedOnlyInB: failedChecksB.filter((check) => !failedChecksA.includes(check))
    },
    acceptance: {
      regressions: acceptanceRegressions,
      improvements: acceptanceImprovements
    }
  };
}

function summarizeComparedRun(report: ChangeReport): ComparedRunSummary {
  return {
    runId: report.runId,
    status: report.status,
    score: report.score,
    risk: report.risk,
    reviewerVerdict: report.reviewer.verdict,
    checksState: report.checks.state,
    changedFileCount: report.changedFiles.length,
    acceptanceCriteria: {
      expected: report.acceptanceCriteria.expected,
      passed: report.acceptanceCriteria.passed,
      failed: report.acceptanceCriteria.failed,
      unknown: report.acceptanceCriteria.unknown
    },
    missingEvidenceWarnings: collectMissingEvidenceWarnings(report)
  };
}

function collectMissingEvidenceWarnings(report: ChangeReport): string[] {
  const warnings: string[] = [];
  if (report.evidence && report.evidence.available === false) {
    warnings.push(`Evidence manifest unavailable (status: ${report.evidence.status}).`);
  }
  for (const signal of report.riskSignals) {
    if (MISSING_EVIDENCE_PATTERN.test(signal)) {
      warnings.push(signal);
    }
  }
  return dedupeSort(warnings);
}

function compareRisk(riskA: ChangeReport["risk"], riskB: ChangeReport["risk"]): "higher" | "lower" | "same" {
  const delta = RISK_RANK[riskB] - RISK_RANK[riskA];
  if (delta > 0) return "higher";
  if (delta < 0) return "lower";
  return "same";
}

function compareAcceptanceCriteria(runA: ChangeReport, runB: ChangeReport): [string[], string[]] {
  const aMap = toAcceptanceMap(runA);
  const bMap = toAcceptanceMap(runB);
  const criteria = dedupeSort([...Object.keys(aMap), ...Object.keys(bMap)]);

  const regressions: string[] = [];
  const improvements: string[] = [];

  for (const criterion of criteria) {
    const aStatus = aMap[criterion] ?? "unknown";
    const bStatus = bMap[criterion] ?? "unknown";
    const delta = ACCEPTANCE_RANK[bStatus] - ACCEPTANCE_RANK[aStatus];
    if (delta < 0) {
      regressions.push(`${criterion}: ${aStatus} -> ${bStatus}`);
    } else if (delta > 0) {
      improvements.push(`${criterion}: ${aStatus} -> ${bStatus}`);
    }
  }

  return [dedupeSort(regressions), dedupeSort(improvements)];
}

function toAcceptanceMap(report: ChangeReport): Record<string, "pass" | "fail" | "unknown"> {
  const result: Record<string, "pass" | "fail" | "unknown"> = {};
  for (const item of report.acceptanceCriteria.results) {
    if (!item.criterion) {
      continue;
    }
    result[item.criterion] = item.status;
  }
  return result;
}

function dedupeSort(values: string[]): string[] {
  const deduped = Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
  deduped.sort((a, b) => a.localeCompare(b));
  return deduped;
}
