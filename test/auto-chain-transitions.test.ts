import test from "node:test";
import assert from "node:assert/strict";
import { classifyFixRequiredWithoutAttempt, resolveUnresolvedFinalStatus, shouldRunChecksAfterInitialVerdict } from "../src/workflows/auto-chain/transitions.js";

test("shouldRunChecksAfterInitialVerdict accepts PASS reviewer", () => {
  assert.equal(shouldRunChecksAfterInitialVerdict("PASS", "FIX_REQUIRED"), true);
});

test("shouldRunChecksAfterInitialVerdict accepts PROCEED decision", () => {
  assert.equal(shouldRunChecksAfterInitialVerdict("FAIL", "PROCEED"), true);
});

test("classifyFixRequiredWithoutAttempt handles maxFixAttempts=0", () => {
  assert.equal(classifyFixRequiredWithoutAttempt({ maxFixAttempts: 0, allowWrites: true }), "MAX_FIX_ATTEMPTS_REACHED");
});

test("classifyFixRequiredWithoutAttempt handles writes disabled", () => {
  assert.equal(classifyFixRequiredWithoutAttempt({ maxFixAttempts: 2, allowWrites: false }), "NEEDS_FIX_WRITE_DISABLED");
});

test("resolveUnresolvedFinalStatus returns MAX_FIX_ATTEMPTS_REACHED at bound", () => {
  assert.equal(
    resolveUnresolvedFinalStatus({ pendingFixDecision: "FIX_REQUIRED", attemptsUsed: 2, maxFixAttempts: 2 }),
    "MAX_FIX_ATTEMPTS_REACHED"
  );
});

test("resolveUnresolvedFinalStatus returns NEEDS_FIX when decision changed", () => {
  assert.equal(resolveUnresolvedFinalStatus({ pendingFixDecision: "PROCEED", attemptsUsed: 1, maxFixAttempts: 3 }), "NEEDS_FIX");
});
