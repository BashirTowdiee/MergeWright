import assert from "node:assert/strict";
import test from "node:test";
import type { ChangeReport } from "../src/reporting/change-report-types.js";
import { createFocusedReviewModesResult, parseFocusedReviewModesArg } from "../src/reporting/review-modes.js";

function makeReport(overrides: Partial<ChangeReport> = {}): ChangeReport {
  const base: ChangeReport = {
    version: 1,
    runId: "run-1",
    projectName: "acme",
    stageName: "stage",
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
      results: [{ criterion: "criterion-a", status: "pass", source: "reviewer" }]
    },
    checks: { state: "passed", failedChecks: [] },
    writeSafety: { state: "passed" },
    postWriteReview: { required: false, status: "completed" },
    scopeDriftWarnings: [],
    riskSignals: [],
    manualReviewChecklist: [],
    suggestedCommitMessage: "msg"
  };
  return { ...base, ...overrides };
}

test("parseFocusedReviewModesArg returns defaults when empty", () => {
  const modes = parseFocusedReviewModesArg(undefined);
  assert.deepEqual(modes, ["architecture", "tests", "regression", "security", "docs", "maintainability"]);
});

test("parseFocusedReviewModesArg parses csv and dedupes", () => {
  const modes = parseFocusedReviewModesArg("tests,security,tests");
  assert.deepEqual(modes, ["tests", "security"]);
});

test("parseFocusedReviewModesArg rejects invalid mode", () => {
  assert.throws(() => parseFocusedReviewModesArg("tests,unknown"), /Invalid --modes value/);
});

test("createFocusedReviewModesResult returns PASS when all selected modes pass", () => {
  const result = createFocusedReviewModesResult({
    report: makeReport(),
    modes: ["tests", "docs"]
  });
  assert.equal(result.aggregateVerdict, "PASS");
  assert.equal(result.modes.length, 2);
  assert.equal(result.modes.every((mode) => mode.decision.verdict === "PASS"), true);
});

test("createFocusedReviewModesResult returns FAIL when any selected mode fails", () => {
  const result = createFocusedReviewModesResult({
    report: makeReport({
      status: "NEEDS_FIX",
      risk: "high",
      reviewer: {
        verdict: "FAIL",
        blockingIssues: [{ severity: "high", summary: "bad", files: ["src/a.ts"] }],
        nonBlockingIssues: []
      },
      checks: { state: "failed", failedChecks: ["npm test"] }
    }),
    modes: ["tests", "regression"]
  });
  assert.equal(result.aggregateVerdict, "FAIL");
  assert.equal(result.modes.some((mode) => mode.decision.verdict === "FAIL"), true);
});
