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
import {
  buildStageContractScopeBlocker,
  buildStageContractScopeWarning,
  evaluateStageContractScope
} from "./stage-contract-scope.js";
import { summarizeReviewerAcceptanceCriteria } from "./reviewer-acceptance.js";

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
  const contractScope = evaluateStageContractScope({
    contract: collected.stageContract,
    changedFiles: collected.changedFiles,
    untrackedFiles: collected.untrackedFiles
  });
  const contractScopeWarning = buildStageContractScopeWarning(contractScope.outOfScopeMatches);
  const contractScopeBlocker = buildStageContractScopeBlocker(contractScope.forbiddenMatches);
  const acceptanceCriteria = summarizeReviewerAcceptanceCriteria({
    stageContract: collected.stageContract,
    reviewerAcceptanceCriteria: collected.reviewer.acceptanceCriteria
  });
  const combinedScopeDriftWarnings = dedupeSort([
    ...scopeDriftWarnings,
    ...(contractScopeWarning ? [contractScopeWarning] : [])
  ]);
  const computedRiskSignals = buildRiskSignals({
    reviewerVerdict: collected.reviewer.verdict,
    reviewerAvailable: collected.reviewer.available,
    checksState: collected.checks.state,
    checksMalformed: collected.checksMalformed,
    writeSafetyState,
    postWriteReviewStatus,
    untrackedFiles: collected.untrackedFiles,
    changedFiles: collected.changedFiles,
    runJsonMalformed: collected.runJsonMalformed,
    writeAuditMalformed: collected.writeAuditMalformed,
    acceptanceCriteriaFailedCount: acceptanceCriteria.failed,
    acceptanceCriteriaUnknownCount: acceptanceCriteria.unknown
  });

  const computedRisk = classifyRisk({ changedFiles: collected.changedFiles, writeSafetyState, postWriteReviewStatus, policy });
  const risk = collected.evidenceRisk?.risk ?? computedRisk;
  const score = computeScore({
    runStatus: run?.status ?? "unknown",
    reviewerVerdict: collected.reviewer.verdict,
    nonBlockingIssueCount: collected.reviewer.nonBlockingIssues.length,
    checksState: collected.checks.state,
    hasChangedFiles: collected.changedFiles.length > 0,
    postWriteReviewRequired,
    postWriteReviewStatus,
    risk,
    scopeDriftWarningCount: combinedScopeDriftWarnings.length,
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
    scopeDriftWarnings: combinedScopeDriftWarnings,
    hasContractScopeBlockers: contractScope.forbiddenMatches.length > 0,
    hasUnknownAcceptanceCriteria: acceptanceCriteria.unknown > 0,
    hasFailedAcceptanceCriteria: acceptanceCriteria.failed > 0,
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
  const riskSignals = dedupeSort([
    ...(collected.evidenceRisk?.riskSignals ?? []),
    ...computedRiskSignals,
    ...(contractScopeBlocker ? [contractScopeBlocker] : [])
  ]);

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
      nonBlockingIssues: collected.reviewer.nonBlockingIssues,
      ...(collected.reviewer.evidenceChecked?.length
        ? {
            evidenceChecked: collected.reviewer.evidenceChecked
          }
        : {}),
      ...(collected.reviewer.acceptanceCriteria?.length
        ? {
            acceptanceCriteria: collected.reviewer.acceptanceCriteria
          }
        : {}),
      ...(collected.reviewer.testsObserved?.length
        ? {
            testsObserved: collected.reviewer.testsObserved
          }
        : {}),
      ...(collected.reviewer.riskLevel
        ? {
            riskLevel: collected.reviewer.riskLevel
          }
        : {}),
      ...(collected.reviewer.recommendedFixPrompt
        ? {
            recommendedFixPrompt: collected.reviewer.recommendedFixPrompt
          }
        : {})
    },
    acceptanceCriteria,
    checks: collected.checks,
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
    scopeDriftWarnings: combinedScopeDriftWarnings,
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

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}
