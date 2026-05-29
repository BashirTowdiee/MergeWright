import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceAcceptanceSummary, createEvidenceReviewerSummary } from "../src/evidence/reviewer-summary.js";

function reviewerMarkdown(json: object): string {
  return ["Review result", "```json reviewer-verdict", JSON.stringify(json), "```"].join("\n");
}

test("createEvidenceReviewerSummary converts reviewer verdict into evidence summary", () => {
  const summary = createEvidenceReviewerSummary({
    artefactPath: "reviewer-output-last-message.md",
    markdown: reviewerMarkdown({
      verdict: "PASS",
      blockingIssues: [],
      nonBlockingIssues: [{ severity: "low", summary: "Naming could improve", files: ["src/a.ts"] }]
    })
  });

  assert.deepEqual(summary, {
    verdict: "PASS",
    artefactPath: "reviewer-output-last-message.md",
    blockingIssues: [],
    nonBlockingIssues: [{ severity: "low", summary: "Naming could improve", files: ["src/a.ts"] }]
  });
});

test("createEvidenceReviewerSummary returns UNKNOWN for missing verdict", () => {
  assert.deepEqual(createEvidenceReviewerSummary({ markdown: "No verdict" }), {
    verdict: "UNKNOWN",
    artefactPath: undefined,
    blockingIssues: [],
    nonBlockingIssues: []
  });
});

test("createEvidenceAcceptanceSummary maps reviewer acceptance criteria", () => {
  const summary = createEvidenceAcceptanceSummary({
    markdown: reviewerMarkdown({
      verdict: "FAIL",
      blockingIssues: [{ severity: "high", summary: "blocking", files: ["src/a.ts"] }],
      nonBlockingIssues: [],
      acceptanceCriteria: [
        { criterion: "criterion-a", status: "pass", evidence: "ok" },
        { criterion: "criterion-b", status: "unknown" }
      ]
    })
  });

  assert.deepEqual(summary, {
    status: "unknown",
    criteria: [
      { criterion: "criterion-a", status: "pass", evidence: "ok" },
      { criterion: "criterion-b", status: "unknown" }
    ]
  });
});

test("createEvidenceReviewerSummary preserves reviewer verdict v2 fields", () => {
  const summary = createEvidenceReviewerSummary({
    artefactPath: "reviewer-output-last-message.md",
    markdown: reviewerMarkdown({
      verdict: "FAIL",
      blockingIssues: [{ severity: "high", summary: "blocking", files: ["src/a.ts"] }],
      nonBlockingIssues: [],
      evidenceChecked: [{ artefact: "run.json", status: "verified", note: "present" }],
      testsObserved: [{ test: "npm test", outcome: "fail", evidence: "failing suite" }],
      riskLevel: "high",
      recommendedFixPrompt: "Fix tests and rerun checks."
    })
  });

  assert.deepEqual(summary.evidenceChecked, [{ artefact: "run.json", status: "verified", note: "present" }]);
  assert.deepEqual(summary.testsObserved, [{ test: "npm test", outcome: "fail", evidence: "failing suite" }]);
  assert.equal(summary.riskLevel, "high");
  assert.equal(summary.recommendedFixPrompt, "Fix tests and rerun checks.");
});
