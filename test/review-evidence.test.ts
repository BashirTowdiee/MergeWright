import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { readEvidenceManifest, writeEvidenceManifest } from "../src/evidence/evidence-store.js";
import { updateEvidenceReviewSummary } from "../src/evidence/review-evidence.js";

function reviewerMarkdown(json: object): string {
  return ["Review result", "```json reviewer-verdict", JSON.stringify(json), "```"].join("\n");
}

test("updateEvidenceReviewSummary persists reviewer summary from reviewer output", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "review-evidence-"));
  await writeEvidenceManifest(runDir, createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" }));
  await writeFile(
    path.join(runDir, "reviewer-output-last-message.md"),
    reviewerMarkdown({
      verdict: "PASS",
      blockingIssues: [],
      nonBlockingIssues: [],
      acceptanceCriteria: [{ criterion: "criterion-a", status: "pass", evidence: "test output" }],
      evidenceChecked: [{ artefact: "checks-status.json", status: "verified" }],
      testsObserved: [{ test: "npm test", outcome: "pass" }],
      riskLevel: "low"
    }),
    "utf8"
  );

  const updated = await updateEvidenceReviewSummary(runDir);
  const persisted = await readEvidenceManifest(runDir);

  assert.equal(updated.reviewer?.verdict, "PASS");
  assert.equal(updated.reviewer?.artefactPath, "reviewer-output-last-message.md");
  assert.deepEqual(updated.reviewer?.evidenceChecked, [{ artefact: "checks-status.json", status: "verified" }]);
  assert.deepEqual(updated.reviewer?.testsObserved, [{ test: "npm test", outcome: "pass" }]);
  assert.equal(updated.reviewer?.riskLevel, "low");
  assert.deepEqual(updated.acceptance, {
    status: "pass",
    criteria: [{ criterion: "criterion-a", status: "pass", evidence: "test output" }]
  });
  assert.deepEqual(persisted.reviewer, updated.reviewer);
  assert.deepEqual(persisted.acceptance, updated.acceptance);
});

test("updateEvidenceReviewSummary records UNKNOWN when reviewer output is missing", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "review-evidence-missing-"));
  await writeEvidenceManifest(runDir, createEvidenceManifest({ runId: "run-456", workspace: "/tmp/workspace" }));

  const updated = await updateEvidenceReviewSummary(runDir);

  assert.equal(updated.reviewer?.verdict, "UNKNOWN");
  assert.equal(updated.reviewer?.artefactPath, "reviewer-output-last-message.md");
});
