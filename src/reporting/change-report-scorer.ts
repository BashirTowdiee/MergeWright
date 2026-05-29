import type { ChangeReport, ChangeReportPolicy, ChangeRiskLevel, CommitReadinessStatus, RunMetadataWithAutoChain } from "./change-report-types.js";
import { isDocsOnly, isHighRiskFile } from "./scope-drift.js";

const LOGGING_PATTERNS = [/(^|\/)logger\//i, /log(ger|ging)?/i];
const DEPENDENCY_PATTERNS = [/(^|\/)(package\.json|package-lock\.json|pnpm-lock\.ya?ml|yarn\.lock|bun\.lockb)$/i];

export function classifyStatus(input: {
  runStatus: string;
  reviewerVerdict: "PASS" | "FAIL" | "unavailable";
  checksState: ChangeReport["checks"]["state"];
  postWriteReviewRequired: boolean;
  postWriteReviewStatus: string;
  autoChainFinalStatus: string;
  risk: ChangeRiskLevel;
  scopeDriftWarnings: string[];
  hasContractScopeBlockers: boolean;
  hasUnknownAcceptanceCriteria: boolean;
  hasFailedAcceptanceCriteria: boolean;
  score: number;
  policy: ChangeReportPolicy;
}): CommitReadinessStatus {
  if (input.runStatus === "failed") {
    return "BLOCKED";
  }
  if (input.hasContractScopeBlockers) {
    return "BLOCKED";
  }
  if (input.hasUnknownAcceptanceCriteria) {
    return "BLOCKED";
  }
  if (input.hasFailedAcceptanceCriteria) {
    return "NEEDS_FIX";
  }
  if (input.postWriteReviewRequired && (input.postWriteReviewStatus === "pending" || input.postWriteReviewStatus === "failed")) {
    return "BLOCKED";
  }
  if (input.reviewerVerdict === "FAIL") {
    return "NEEDS_FIX";
  }
  if (input.checksState === "failed") {
    return "NEEDS_FIX";
  }
  if (["NEEDS_FIX", "MAX_FIX_ATTEMPTS_REACHED", "CHECKS_FAILED", "FAILED"].includes(input.autoChainFinalStatus)) {
    return "NEEDS_FIX";
  }
  if (
    input.reviewerVerdict === "PASS" &&
    input.checksState === "passed" &&
    input.risk !== "high" &&
    input.scopeDriftWarnings.length === 0 &&
    input.runStatus === "success" &&
    input.score >= input.policy.readiness.readyMinimumScore
  ) {
    return "READY";
  }
  if (input.score < input.policy.readiness.needsReviewMinimumScore) {
    return "NEEDS_REVIEW";
  }
  return "NEEDS_REVIEW";
}

export function computeScore(input: {
  runStatus: string;
  reviewerVerdict: "PASS" | "FAIL" | "unavailable";
  nonBlockingIssueCount: number;
  checksState: ChangeReport["checks"]["state"];
  hasChangedFiles: boolean;
  postWriteReviewRequired: boolean;
  postWriteReviewStatus: string;
  risk: ChangeRiskLevel;
  scopeDriftWarningCount: number;
  policy: ChangeReportPolicy;
}): number {
  const penalties = input.policy.readiness.penalties;
  let score = 100;
  if (input.runStatus === "failed") score -= penalties.failedRun;
  if (input.reviewerVerdict === "FAIL") score -= penalties.reviewerFail;
  if (input.checksState === "failed") score -= penalties.checksFailed;
  if ((input.checksState === "unknown" || input.checksState === "skipped") && input.hasChangedFiles) {
    score -= penalties.checksSkippedWithSourceChanges;
  }
  if (input.postWriteReviewRequired && (input.postWriteReviewStatus === "pending" || input.postWriteReviewStatus === "failed")) {
    score -= penalties.postWriteReviewPendingOrFailed;
  }
  if (input.risk === "high") score -= penalties.highRiskFiles;
  if (input.risk === "medium") score -= penalties.mediumRiskFiles;
  score -= Math.min(30, input.scopeDriftWarningCount * penalties.scopeDriftWarning);
  score -= Math.min(20, input.nonBlockingIssueCount * penalties.nonBlockingReviewerIssue);
  return clamp(score, 0, 100);
}

export function classifyRisk(input: {
  changedFiles: string[];
  writeSafetyState: string;
  postWriteReviewStatus: string;
  policy: ChangeReportPolicy;
}): ChangeRiskLevel {
  if (input.writeSafetyState === "failed" || input.postWriteReviewStatus === "failed") {
    return "high";
  }
  const files = input.changedFiles.map(normalizePathForMatching);
  if (files.length === 0) {
    return "low";
  }
  if (files.some((file) => matchesPolicyPath(file, input.policy.riskRules.highRiskPaths))) {
    return "high";
  }
  if (files.some((file) => matchesPolicyPath(file, input.policy.riskRules.mediumRiskPaths))) {
    return "medium";
  }
  if (isDocsOnly(files) || files.some((file) => matchesPolicyPath(file, input.policy.riskRules.lowRiskPaths))) {
    return "low";
  }
  return "low";
}

export function buildRiskSignals(input: {
  reviewerVerdict: "PASS" | "FAIL" | "unavailable";
  reviewerAvailable: boolean;
  checksState: ChangeReport["checks"]["state"];
  checksMalformed: boolean;
  writeSafetyState: string;
  postWriteReviewStatus: string;
  untrackedFiles: string[];
  changedFiles: string[];
  runJsonMalformed: boolean;
  writeAuditMalformed: boolean;
  acceptanceCriteriaFailedCount: number;
  acceptanceCriteriaUnknownCount: number;
}): string[] {
  const signals: string[] = [];
  if (!input.reviewerAvailable) {
    signals.push("Reviewer output unavailable or unparsable.");
  }
  if (input.reviewerVerdict === "FAIL") {
    signals.push("Reviewer verdict is FAIL.");
  }
  if (input.checksState === "failed") {
    signals.push("One or more checks failed.");
  }
  if (input.checksState === "unknown") {
    signals.push("Checks status is unknown.");
  }
  if (input.checksMalformed) {
    signals.push("Checks status artefact is malformed.");
  }
  if (input.runJsonMalformed) {
    signals.push("run.json is malformed.");
  }
  if (input.writeAuditMalformed) {
    signals.push("Write-audit summary artefact is malformed.");
  }
  if (input.writeSafetyState === "failed") {
    signals.push("Write safety check failed.");
  }
  if (input.postWriteReviewStatus === "failed") {
    signals.push("Post-write review failed.");
  }
  if (input.untrackedFiles.length > 0) {
    signals.push("Untracked files detected.");
  }
  if (input.changedFiles.some((file) => isHighRiskFile(file))) {
    signals.push("High-risk files were changed.");
  }
  if (input.acceptanceCriteriaFailedCount > 0) {
    signals.push(`Acceptance criteria failed: ${input.acceptanceCriteriaFailedCount}.`);
  }
  if (input.acceptanceCriteriaUnknownCount > 0) {
    signals.push(`Acceptance criteria unresolved (unknown): ${input.acceptanceCriteriaUnknownCount}.`);
  }
  return dedupeSort(signals);
}

export function buildManualReviewChecklist(input: {
  reviewerAvailable: boolean;
  checksState: ChangeReport["checks"]["state"];
  risk: ChangeRiskLevel;
  changedFiles: string[];
  untrackedFiles: string[];
}): string[] {
  const checklist = ["Inspect git diff.", "Inspect changed files list."];
  if (!input.reviewerAvailable) {
    checklist.push("Inspect reviewer artefacts and verify reviewer output integrity.");
  }
  if (input.checksState !== "passed") {
    checklist.push("Run project checks locally and verify passing status.");
  }
  if (input.risk === "high") {
    checklist.push("Inspect high-risk files carefully for regressions and safety issues.");
  }
  if (input.changedFiles.some((file) => LOGGING_PATTERNS.some((pattern) => pattern.test(file)))) {
    checklist.push("Confirm sensitive values are not logged.");
  }
  if (input.changedFiles.some((file) => DEPENDENCY_PATTERNS.some((pattern) => pattern.test(file)))) {
    checklist.push("Inspect dependency and lockfile changes for unexpected updates.");
  }
  if (input.untrackedFiles.length > 0) {
    checklist.push("Inspect untracked files and decide whether they should be committed or removed.");
  }
  return dedupeSort(checklist);
}

export function suggestCommitMessage(stageName: string | null): string {
  if (!stageName) {
    return "Update staged change";
  }
  const cleaned = stageName.replace(/^stage-\d+-?/i, "").replace(/^stage-/, "");
  if (!cleaned) {
    return "Update staged change";
  }
  const text = cleaned
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .join(" ")
    .trim();
  if (!text) {
    return "Update staged change";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function flattenPhases(run: RunMetadataWithAutoChain | null): Record<string, string> {
  const phases: Record<string, string> = {};
  if (!run?.phases || typeof run.phases !== "object") {
    return phases;
  }
  for (const [name, value] of Object.entries(run.phases)) {
    phases[name] = value?.status ?? "unknown";
  }
  return phases;
}

function matchesPolicyPath(filePathRaw: string, patterns: string[]): boolean {
  const filePath = normalizePathForMatching(filePathRaw).toLowerCase();
  return patterns.some((patternRaw) => {
    const pattern = normalizePathForMatching(patternRaw).toLowerCase();
    if (!pattern) return false;
    if (pattern.endsWith("/")) {
      return filePath === pattern.slice(0, -1) || filePath.startsWith(pattern);
    }
    return filePath === pattern || filePath.startsWith(`${pattern}/`) || filePath.includes(pattern);
  });
}

function normalizePathForMatching(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
