import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { InMemoryRunReadRepository } from "../src/application/queries/in-memory-run-read-repository.js";
import { DefaultReviewQueryService } from "../src/application/queries/review-query-service.js";
import { DefaultRunQueryService } from "../src/application/queries/run-query-service.js";
import type { RunDetail, RunSummary } from "../src/application/read-models/run-read-model.js";

const runSummaries: RunSummary[] = [
  {
    id: "run-1",
    title: "Run one",
    status: "failed",
    subtitle: "needs fix",
    mode: "read-only",
    warnings: []
  },
  {
    id: "run-2",
    title: "Run two",
    status: "passed",
    subtitle: "ready",
    mode: "read-only",
    warnings: []
  }
];

const runDetailsById: Record<string, RunDetail> = {
  "run-1": {
    id: "run-1",
    title: "Run one",
    status: "failed",
    runDir: "/tmp/run-1",
    mode: "read-only",
    phases: [],
    artefacts: [],
    safeActions: [],
    blockedReason: "Missing acceptance evidence",
    reviewerFindings: [{ severity: "high", message: "Missing acceptance evidence" }],
    readiness: {
      source: "report",
      status: "NEEDS_FIX",
      score: 64,
      risk: "high",
      checksState: "failed",
      reviewerVerdict: "FAIL",
      missingEvidenceWarnings: []
    },
    warnings: []
  },
  "run-2": {
    id: "run-2",
    title: "Run two",
    status: "passed",
    runDir: "/tmp/run-2",
    mode: "read-only",
    phases: [],
    artefacts: [],
    safeActions: [],
    reviewerFindings: [],
    readiness: {
      source: "report",
      status: "READY",
      score: 90,
      risk: "low",
      checksState: "passed",
      reviewerVerdict: "PASS",
      missingEvidenceWarnings: []
    },
    warnings: []
  }
};

async function createService() {
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), "mw-reviews-"));
  const repository = new InMemoryRunReadRepository({ runs: runSummaries, runDetailsById });
  const runQueryService = new DefaultRunQueryService(repository);
  const reviewQueryService = new DefaultReviewQueryService({ runQueryService, runsRoot });
  return { runsRoot, reviewQueryService };
}

test("DefaultReviewQueryService lists pending reviews from run readiness", async () => {
  const { reviewQueryService } = await createService();

  const reviews = await reviewQueryService.listReviews();

  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]?.runId, "run-1");
  assert.equal(reviews[0]?.status, "pending");
  assert.equal(reviews[0]?.blockerCount, 1);
});

test("DefaultReviewQueryService addComment persists comments and surfaces ready reviews", async () => {
  const { runsRoot, reviewQueryService } = await createService();

  const updated = await reviewQueryService.addComment("run-2", { author: "operator", message: "Looks merge-ready." });
  assert.ok(updated);
  assert.equal(updated?.commentCount, 1);
  assert.equal(updated?.status, "ready");

  const reloaded = new DefaultReviewQueryService({
    runQueryService: new DefaultRunQueryService(new InMemoryRunReadRepository({ runs: runSummaries, runDetailsById })),
    runsRoot
  });
  const reviews = await reloaded.listReviews();
  const run2 = reviews.find((review) => review.runId === "run-2");
  assert.equal(run2?.commentCount, 1);
});

test("DefaultReviewQueryService decideReview persists approval decisions", async () => {
  const { runsRoot, reviewQueryService } = await createService();

  const updated = await reviewQueryService.decideReview("run-1", {
    decision: "approved",
    author: "lead",
    note: "Approved after evidence update."
  });
  assert.ok(updated);
  assert.equal(updated?.status, "approved");
  assert.equal(updated?.decision?.decision, "approved");

  const reloaded = new DefaultReviewQueryService({
    runQueryService: new DefaultRunQueryService(new InMemoryRunReadRepository({ runs: runSummaries, runDetailsById })),
    runsRoot
  });
  const reviews = await reloaded.listReviews();
  const run1 = reviews.find((review) => review.runId === "run-1");
  assert.equal(run1?.decision?.decision, "approved");
});
