import assert from "node:assert/strict";
import test from "node:test";
import type { ChangeReport } from "../src/reporting/change-report-types.js";
import { createProveResult } from "../src/reporting/prove-report.js";

function makeReport(overrides: Partial<ChangeReport> = {}): ChangeReport {
  const base: ChangeReport = {
    version: 1,
    runId: "run-123",
    projectName: "acme",
    stageName: "stage-01",
    status: "READY",
    score: 92,
    risk: "low",
    summary: "ready",
    phases: {},
    changedFiles: [],
    untrackedFiles: [],
    evidence: { available: true, status: "pass", completedAt: "2026-05-29T00:00:00.000Z" },
    reviewer: { verdict: "PASS", blockingIssues: [], nonBlockingIssues: [] },
    acceptanceCriteria: { expected: 0, passed: 0, failed: 0, unknown: 0, results: [] },
    checks: { state: "passed", failedChecks: [] },
    writeSafety: { state: "passed" },
    postWriteReview: { required: false, status: "completed" },
    scopeDriftWarnings: [],
    riskSignals: [],
    manualReviewChecklist: [],
    suggestedCommitMessage: "Update stage"
  };
  return { ...base, ...overrides };
}

test("createProveResult marks READY report as ready with no blockers", () => {
  const result = createProveResult(makeReport());
  assert.equal(result.ready, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.nextAction, "Ready to merge after human approval.");
  assert.deepEqual(result.blockers, []);
});

test("createProveResult aggregates deterministic blockers for non-ready report", () => {
  const result = createProveResult(
    makeReport({
      status: "NEEDS_FIX",
      reviewer: {
        verdict: "FAIL",
        blockingIssues: [{ severity: "high", summary: "missing safety guard", files: ["src/guard.ts"] }],
        nonBlockingIssues: []
      },
      checks: { state: "failed", failedChecks: ["npm test"] },
      riskSignals: ["Checks status artefact is malformed.", "Reviewer verdict is FAIL.", "Low-priority note."]
    })
  );

  assert.equal(result.ready, false);
  assert.equal(result.exitCode, 1);
  assert.equal(result.nextAction, "Address reviewer blocking issues, then rerun reviewer/checks and prove.");
  assert.deepEqual(result.blockers, [
    "[high] missing safety guard",
    "check failed: npm test",
    "risk signal: Checks status artefact is malformed.",
    "risk signal: Reviewer verdict is FAIL."
  ]);
});
