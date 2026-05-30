import assert from "node:assert/strict";
import test from "node:test";
import type { ChangeReport } from "../src/reporting/change-report-types.js";
import { createCompareRunsReport } from "../src/reporting/compare-runs.js";

function makeReport(overrides: Partial<ChangeReport> = {}): ChangeReport {
  const base: ChangeReport = {
    version: 1,
    runId: "run-a",
    projectName: "acme",
    stageName: "stage-01",
    status: "READY",
    score: 95,
    risk: "low",
    summary: "ready",
    phases: {},
    changedFiles: ["src/a.ts"],
    untrackedFiles: [],
    evidence: { available: true, status: "pass", completedAt: "2026-05-30T00:00:00.000Z" },
    reviewer: { verdict: "PASS", blockingIssues: [], nonBlockingIssues: [] },
    acceptanceCriteria: {
      expected: 1,
      passed: 1,
      failed: 0,
      unknown: 0,
      results: [{ criterion: "API returns 200", status: "pass", source: "reviewer" }]
    },
    checks: { state: "passed", failedChecks: [] },
    writeSafety: { state: "passed" },
    postWriteReview: { required: false, status: "completed" },
    scopeDriftWarnings: [],
    riskSignals: [],
    manualReviewChecklist: [],
    suggestedCommitMessage: "Update"
  };
  return { ...base, ...overrides };
}

test("createCompareRunsReport compares readiness/checks/reviewer/changed files", () => {
  const runA = makeReport();
  const runB = makeReport({
    runId: "run-b",
    status: "NEEDS_FIX",
    score: 70,
    risk: "high",
    changedFiles: ["src/a.ts", "src/b.ts"],
    reviewer: { verdict: "FAIL", blockingIssues: [], nonBlockingIssues: [] },
    checks: { state: "failed", failedChecks: ["npm test"] },
    acceptanceCriteria: {
      expected: 1,
      passed: 0,
      failed: 1,
      unknown: 0,
      results: [{ criterion: "API returns 200", status: "fail", source: "reviewer" }]
    }
  });

  const comparison = createCompareRunsReport(runA, runB);
  assert.equal(comparison.runA.runId, "run-a");
  assert.equal(comparison.runB.runId, "run-b");
  assert.equal(comparison.deltas.score, -25);
  assert.equal(comparison.deltas.risk, "higher");
  assert.equal(comparison.deltas.readinessChanged, true);
  assert.equal(comparison.deltas.checksChanged, true);
  assert.equal(comparison.deltas.reviewerChanged, true);
  assert.deepEqual(comparison.changedFiles.onlyInA, []);
  assert.deepEqual(comparison.changedFiles.onlyInB, ["src/b.ts"]);
  assert.deepEqual(comparison.checks.failedOnlyInB, ["npm test"]);
  assert.equal(comparison.acceptance.regressions.includes("API returns 200: pass -> fail"), true);
});

test("createCompareRunsReport keeps missing evidence warnings explicit", () => {
  const runA = makeReport({
    runId: "run-a",
    evidence: { available: false, status: "unknown", completedAt: null },
    riskSignals: ["Reviewer output unavailable or unparsable."]
  });
  const runB = makeReport({ runId: "run-b" });

  const comparison = createCompareRunsReport(runA, runB);
  assert.equal(comparison.runA.missingEvidenceWarnings.length >= 1, true);
  assert.equal(comparison.runA.missingEvidenceWarnings.some((warning) => warning.includes("unavailable")), true);
  assert.deepEqual(comparison.runB.missingEvidenceWarnings, []);
});
