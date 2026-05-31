export type ReviewStatus = "pending" | "ready" | "approved" | "changes_requested";
export type ReviewDecision = "approved" | "changes_requested";

export interface ReviewCommentView {
  readonly id: string;
  readonly author: string;
  readonly message: string;
  readonly createdAt: string;
}

export interface ReviewDecisionView {
  readonly decision: ReviewDecision;
  readonly author: string;
  readonly note?: string;
  readonly decidedAt: string;
}

export interface ReviewItemView {
  readonly id: string;
  readonly runId: string;
  readonly title: string;
  readonly status: ReviewStatus;
  readonly readinessStatus: "READY" | "NEEDS_REVIEW" | "NEEDS_FIX" | "BLOCKED" | "unknown";
  readonly reviewerVerdict: "PASS" | "FAIL" | "unavailable" | "UNKNOWN";
  readonly checksState: "passed" | "failed" | "skipped" | "unknown";
  readonly blockerCount: number;
  readonly blockers: readonly string[];
  readonly commentCount: number;
  readonly updatedAt: string;
  readonly comments: readonly ReviewCommentView[];
  readonly decision?: ReviewDecisionView;
}
