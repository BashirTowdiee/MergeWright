import path from "node:path";
import { collectReportInputs } from "./change-report-collector.js";
import { DEFAULT_CHANGE_REPORT_POLICY } from "./change-report-policy.js";
import {
  buildManualReviewChecklist,
  buildRiskSignals,
  classifyRisk,
  classifyStatus,
  computeScore,
  flattenPhases,
  suggestCommitMessage
} from "./change-report-scorer.js";
import type { ChangeReport, ChangeReportPolicy } from "./change-report-types.js";
import { buildScopeDriftWarnings } from "./scope-drift.js";

export async function generateChangeReport(input: { runDir: string; policy?: ChangeReportPolicy }): Promise<ChangeReport> {
  const runDir = path.resolve(input.runDir);
  const policy = input.policy ?? DEFAULT_CHANGE_REPORT_POLICY;

  const collected = await collectReportInputs(runDir);
  const run = collected.run;

  const writeSafetyState = collected.writeSafety?.state ?? run?.writeSafety?.state ?? "unknown";
  const postWriteReviewRequired = collected.postWriteReview?.required ?? run?.postWriteReview?.required ?? false;
  const postWriteReviewStatus = collected.postWriteReview?.status ?? run?.postWriteReview?.status ?? "unknown";

  const scopeDriftWarnings = buildScopeDriftWarnings({
    stageText: collected.stageText,
    changedFiles: collected.changedFiles,
    untrackedFiles: collected.untrackedFiles,
    policy
  });
  const riskSignals = buildRiskSignals({
    reviewerVerdict: collected.reviewer.verdict,
    reviewerAvailable: collected.reviewer.available,
    checksState: collected.checks.state,
    checksMalformed: collected.checksMalformed,
    writeSafetyState,
    postWriteReviewStatus,
    untrackedFiles: collected.untrackedFiles,
    changedFiles: collected.changedFiles,
    runJsonMalformed: collected.runJsonMalformed,
    writeAuditMalformed: collected.writeAuditMalformed
  });

  const risk = classifyRisk({ changedFiles: collected.changedFiles, writeSafetyState, postWriteReviewStatus, policy });
  const score = computeScore({
    runStatus: run?.status ?? "unknown",
    reviewerVerdict: collected.reviewer.verdict,
    nonBlockingIssueCount: collected.reviewer.nonBlockingIssues.length,
    checksState: collected.checks.state,
    hasChangedFiles: collected.changedFiles.length > 0,
    postWriteReviewRequired,
    postWriteReviewStatus,
    risk,
    scopeDriftWarningCount: scopeDriftWarnings.length,
    policy
  });
  const finalStatus = classifyStatus({
    runStatus: run?.status ?? "unknown",
    reviewerVerdict: collected.reviewer.verdict,
    checksState: collected.checks.state,
    postWriteReviewRequired,
    postWriteReviewStatus,
    autoChainFinalStatus: typeof run?.autoChain?.finalStatus === "string" ? run.autoChain.finalStatus : "",
    risk,
    scopeDriftWarnings,
    score,
    policy
  });

  const manualReviewChecklist = buildManualReviewChecklist({
    reviewerAvailable: collected.reviewer.available,
    checksState: collected.checks.state,
    risk,
    changedFiles: collected.changedFiles,
    untrackedFiles: collected.untrackedFiles
  });
  const suggestedCommitMessage = suggestCommitMessage(run?.stageName ?? null);
  const phases = flattenPhases(run);

  const report: ChangeReport = {
    version: 1,
    runId: run?.runId ?? path.basename(runDir),
    projectName: run?.projectName ?? null,
    stageName: run?.stageName ?? null,
    status: finalStatus,
    score,
    risk,
    summary: `${finalStatus} (${score}/100) - ${risk} risk`,
    phases,
    changedFiles: collected.changedFiles,
    untrackedFiles: collected.untrackedFiles,
    evidence: collected.evidence,
    reviewer: {
      verdict: collected.reviewer.verdict,
      blockingIssues: collected.reviewer.blockingIssues,
      nonBlockingIssues: collected.reviewer.nonBlockingIssues
    },
    checks: collected.checks as ChangeReport["checks"],
    writeSafety: { state: writeSafetyState },
    postWriteReview: {
      required: postWriteReviewRequired,
      status: postWriteReviewStatus
    },
    ...(run?.autoChain
      ? {
          autoChain: {
            enabled: Boolean(run.autoChain.enabled),
            finalStatus: readOptionalString(run.autoChain.finalStatus),
            attemptsUsed: readOptionalNumber(run.autoChain.attemptsUsed),
            maxFixAttempts: readOptionalNumber(run.autoChain.maxFixAttempts)
          }
        }
      : {}),
    scopeDriftWarnings,
    riskSignals,
    manualReviewChecklist,
    suggestedCommitMessage
  };

  return report;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
