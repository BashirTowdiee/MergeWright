import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAllowWritesTargetsWriteEligiblePhase,
  assertContinuePhaseSelection,
  ORDERED_PHASES,
  selectedPhases,
  writeEnabledContinuationPhases
} from "../src/continue-run/phase-selection.js";

test("continue-run phases are selected in execution order", () => {
  assert.deepEqual(ORDERED_PHASES, ["builder", "reviewer", "fixPlanning", "fixExecution", "checks"]);
  assert.deepEqual(
    selectedPhases({ runChecks: true, executeFix: true, executeReviewer: true, executeBuilder: true, planFix: true }),
    ["builder", "reviewer", "fixPlanning", "fixExecution", "checks"]
  );
});

test("continue-run phase selection rejects empty continuation", () => {
  assert.throws(
    () => assertContinuePhaseSelection([]),
    /continue-run requires at least one phase flag/
  );
});

test("continue-run write-enabled phase selection tracks builder and fix only", () => {
  assert.deepEqual(writeEnabledContinuationPhases({ executeBuilder: true, executeFix: true }), ["builder", "fix"]);
  assert.deepEqual(writeEnabledContinuationPhases({ executeBuilder: false, executeFix: false }), []);
});

test("continue-run allow-writes requires a write-eligible selected phase", () => {
  assert.doesNotThrow(() => assertAllowWritesTargetsWriteEligiblePhase(false, []));
  assert.doesNotThrow(() => assertAllowWritesTargetsWriteEligiblePhase(true, ["builder"]));
  assert.throws(
    () => assertAllowWritesTargetsWriteEligiblePhase(true, []),
    /--allow-writes requires at least one write-eligible continuation phase/
  );
});
