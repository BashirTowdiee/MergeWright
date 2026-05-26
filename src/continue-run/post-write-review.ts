import type { RunMetadata } from "../run-metadata.js";

export type PostWriteReviewRequiredPhase = "builder" | "fixExecution";
export type PostWriteReviewState = RunMetadata["postWriteReview"];

export const POST_WRITE_REVIEW_ARTEFACTS = ["post-write-review-required.json", "post-write-review-status.json"] as const;

export function mergeRequiredByPhases(
  existing: readonly PostWriteReviewRequiredPhase[],
  incoming: readonly PostWriteReviewRequiredPhase[]
): PostWriteReviewRequiredPhase[] {
  const union = new Set<PostWriteReviewRequiredPhase>([...existing, ...incoming]);
  return (["builder", "fixExecution"] as const).filter((phase): phase is PostWriteReviewRequiredPhase => union.has(phase));
}

export function createPostWriteReviewPending(
  existing: Pick<PostWriteReviewState, "requiredByPhases">,
  phases: readonly PostWriteReviewRequiredPhase[]
): PostWriteReviewState {
  return {
    required: true,
    status: "pending",
    reason: "write-enabled builder/fix executed",
    requiredByPhases: mergeRequiredByPhases(existing.requiredByPhases ?? [], phases),
    artefacts: [...POST_WRITE_REVIEW_ARTEFACTS]
  };
}

export function createPostWriteReviewCompleted(existing: PostWriteReviewState): PostWriteReviewState {
  return {
    ...existing,
    required: true,
    status: "completed",
    reason: "reviewer executed after write-enabled builder/fix",
    artefacts: [...POST_WRITE_REVIEW_ARTEFACTS]
  };
}

export function createPostWriteReviewFailed(existing: PostWriteReviewState, reason: string): PostWriteReviewState {
  return {
    ...existing,
    required: true,
    status: "failed",
    reason,
    artefacts: [...POST_WRITE_REVIEW_ARTEFACTS]
  };
}

export function canRunChecksWithPostWriteReview(postWriteReview: PostWriteReviewState): { ok: boolean; reason?: string } {
  if (!postWriteReview.required) {
    return { ok: true };
  }
  if (postWriteReview.status === "completed") {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `Checks blocked: post-write review status is "${postWriteReview.status}". Execute reviewer first to complete post-write review.`
  };
}
