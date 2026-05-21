import type { RunMetadata } from "../run-metadata.js";

export type CommitReadinessStatus = "READY" | "NEEDS_REVIEW" | "NEEDS_FIX" | "BLOCKED";

export type ChangeRiskLevel = "low" | "medium" | "high";

export interface ChangeReportPolicy {
  riskRules: {
    highRiskPaths: string[];
    mediumRiskPaths: string[];
    lowRiskPaths: string[];
  };
  scopeDrift: {
    enabled: boolean;
    allowUnlistedTestFiles: boolean;
    allowUnlistedDocsFiles: boolean;
  };
  readiness: {
    readyMinimumScore: number;
    needsReviewMinimumScore: number;
    penalties: {
      failedRun: number;
      reviewerFail: number;
      checksFailed: number;
      checksSkippedWithSourceChanges: number;
      postWriteReviewPendingOrFailed: number;
      highRiskFiles: number;
      mediumRiskFiles: number;
      scopeDriftWarning: number;
      nonBlockingReviewerIssue: number;
    };
  };
}

export interface ChangeReportEvidenceSummary {
  available: boolean;
  status: string;
  completedAt: string | null;
}

export interface ChangeReport {
  version: 1;
  runId: string;
  projectName: string | null;
  stageName: string | null;
  status: CommitReadinessStatus;
  score: number;
  risk: ChangeRiskLevel;
  summary: string;
  phases: Record<string, string>;
  changedFiles: string[];
  untrackedFiles: string[];
  evidence?: ChangeReportEvidenceSummary;
  reviewer: {
    verdict: "PASS" | "FAIL" | "unavailable";
    blockingIssues: Array<{ severity: string; summary: string; files: string[] }>;
    nonBlockingIssues: Array<{ severity: string; summary: string; files: string[] }>;
  };
  checks: {
    state: "passed" | "failed" | "skipped" | "unknown";
    failedChecks: string[];
  };
  writeSafety: {
    state: string;
  };
  postWriteReview: {
    required: boolean;
    status: string;
  };
  autoChain?: {
    enabled: boolean;
    finalStatus?: string;
    attemptsUsed?: number;
    maxFixAttempts?: number;
  };
  scopeDriftWarnings: string[];
  riskSignals: string[];
  manualReviewChecklist: string[];
  suggestedCommitMessage: string;
}

export type RunMetadataWithAutoChain = RunMetadata & {
  autoChain?: {
    enabled?: unknown;
    finalStatus?: unknown;
    attemptsUsed?: unknown;
    maxFixAttempts?: unknown;
  };
};

export interface WriteAuditSummary {
  post?: {
    changedFiles?: unknown;
    untrackedFiles?: unknown;
  };
  changedFilesAddedByPhase?: unknown;
}

export interface ChecksStatus {
  state?: unknown;
  failedChecks?: unknown;
  failures?: unknown;
  error?: unknown;
}

export interface OptionalJsonResult<T> {
  value: T | null;
  malformed: boolean;
}
