import assert from "node:assert/strict";
import test from "node:test";
import { summarizeReviewerAcceptanceCriteria } from "../src/reporting/reviewer-acceptance.js";

test("summarizeReviewerAcceptanceCriteria returns empty summary when no expected criteria", () => {
  const summary = summarizeReviewerAcceptanceCriteria({
    stageContract: null,
    reviewerAcceptanceCriteria: [{ criterion: "x", status: "pass" }]
  });

  assert.deepEqual(summary, {
    expected: 0,
    passed: 0,
    failed: 0,
    unknown: 0,
    results: []
  });
});

test("summarizeReviewerAcceptanceCriteria maps expected criteria and marks missing as unknown", () => {
  const summary = summarizeReviewerAcceptanceCriteria({
    stageContract: {
      acceptanceCriteria: ["criterion-a", "criterion-b"],
      objective: "obj",
      allowedPaths: [],
      forbiddenPaths: [],
      requiredCommands: [],
      requiredEvidence: [],
      reviewChecklist: []
    },
    reviewerAcceptanceCriteria: [{ criterion: "criterion-a", status: "pass", evidence: "checked in tests" }]
  });

  assert.deepEqual(summary, {
    expected: 2,
    passed: 1,
    failed: 0,
    unknown: 1,
    results: [
      { criterion: "criterion-a", status: "pass", source: "reviewer", evidence: "checked in tests" },
      { criterion: "criterion-b", status: "unknown", source: "missing" }
    ]
  });
});
