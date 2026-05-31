import type { ReviewFinding, RunReadinessSnapshot, SafeActionId } from "./run-read-model.js";

export interface RunReadinessView {
  runId: string;
  ready: boolean;
  status: RunReadinessSnapshot["status"];
  score?: number;
  risk?: RunReadinessSnapshot["risk"];
  checksState?: RunReadinessSnapshot["checksState"];
  reviewerVerdict?: RunReadinessSnapshot["reviewerVerdict"];
  missingEvidenceWarnings: string[];
  blockedReason?: string;
  nextAction: SafeActionId | "ready-to-merge" | "inspect-blockers";
}

export interface RunReviewView {
  runId: string;
  verdict: "PASS" | "FAIL" | "UNKNOWN";
  blockingFindings: ReviewFinding[];
  nonBlockingFindings: ReviewFinding[];
  recommendedFixPrompt?: string;
  testsObservedCount?: number;
  acceptanceCriteriaCount?: number;
}

export type RunEvidenceItemStatus = "pass" | "fail" | "missing" | "unknown";

export interface RunEvidenceItem {
  id: string;
  label: string;
  status: RunEvidenceItemStatus;
  blocking: boolean;
  note?: string;
  sourcePath?: string;
}

export interface RunEvidenceView {
  runId: string;
  available: boolean;
  status: string;
  blockerCount: number;
  warningCount: number;
  items: RunEvidenceItem[];
}
