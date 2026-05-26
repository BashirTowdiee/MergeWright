import test from "node:test";
import assert from "node:assert/strict";
import {
  canRunChecksWithPostWriteReview,
  createPostWriteReviewCompleted,
  createPostWriteReviewFailed,
  createPostWriteReviewPending,
  mergeRequiredByPhases
} from "../src/continue-run/post-write-review.js";
import type { RunMetadata } from "../src/run-metadata.js";

const notRequired: RunMetadata["postWriteReview"] = {
  required: false,
  status: "not-required",
  reason: "no write-enabled builder/fix executed",
  requiredByPhases: [],
  artefacts: []
};

test("mergeRequiredByPhases preserves canonical phase ordering and removes duplicates", () => {
  assert.deepEqual(mergeRequiredByPhases(["fixExecution"], ["builder", "fixExecution"]), ["builder", "fixExecution"]);
});

test("createPostWriteReviewPending marks review pending with required phases and status artefacts", () => {
  assert.deepEqual(createPostWriteReviewPending(notRequired, ["builder"]), {
    required: true,
    status: "pending",
    reason: "write-enabled builder/fix executed",
    requiredByPhases: ["builder"],
    artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
  });
});

test("createPostWriteReviewCompleted preserves required phases and marks review complete", () => {
  const pending = createPostWriteReviewPending(notRequired, ["fixExecution"]);

  assert.deepEqual(createPostWriteReviewCompleted(pending), {
    required: true,
    status: "completed",
    reason: "reviewer executed after write-enabled builder/fix",
    requiredByPhases: ["fixExecution"],
    artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
  });
});

test("createPostWriteReviewFailed preserves required phases and records failure reason", () => {
  const pending = createPostWriteReviewPending(notRequired, ["builder"]);

  assert.deepEqual(createPostWriteReviewFailed(pending, "reviewer execution failed"), {
    required: true,
    status: "failed",
    reason: "reviewer execution failed",
    requiredByPhases: ["builder"],
    artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
  });
});

test("canRunChecksWithPostWriteReview allows checks when no review is required or review completed", () => {
  assert.deepEqual(canRunChecksWithPostWriteReview(notRequired), { ok: true });
  assert.deepEqual(canRunChecksWithPostWriteReview(createPostWriteReviewCompleted(createPostWriteReviewPending(notRequired, ["builder"]))), {
    ok: true
  });
});

test("canRunChecksWithPostWriteReview blocks checks while review is not completed", () => {
  const pending = createPostWriteReviewPending(notRequired, ["builder"]);

  assert.deepEqual(canRunChecksWithPostWriteReview(pending), {
    ok: false,
    reason: 'Checks blocked: post-write review status is "pending". Execute reviewer first to complete post-write review.'
  });
});
