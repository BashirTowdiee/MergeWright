import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceReviewerSummary } from "../src/evidence/reviewer-summary.js";

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
