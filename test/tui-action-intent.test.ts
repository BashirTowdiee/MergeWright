import test from "node:test";
import assert from "node:assert/strict";
import { describeSafeActionIntent, getSafeActionCommandType } from "../src/tui/action-intent.js";

test("describeSafeActionIntent handles missing action", () => {
  assert.equal(describeSafeActionIntent(undefined), "No safe action selected.");
});

test("describeSafeActionIntent explains blocked action", () => {
  assert.equal(
    describeSafeActionIntent({
      id: "continue",
      label: "Continue run",
      enabled: false,
      blockedReason: "Fix is required first.",
      risk: "medium",
      requiresConfirmation: false
    }),
    "Blocked: Fix is required first."
  );
});

test("describeSafeActionIntent previews unmapped enabled action", () => {
  assert.equal(
    describeSafeActionIntent({
      id: "generate-report",
      label: "Generate change report",
      enabled: true,
      risk: "low",
      requiresConfirmation: false
    }),
    "Preview only: Generate change report would run later as a low-risk action."
  );
});

test("describeSafeActionIntent previews command-backed action metadata", () => {
  assert.equal(getSafeActionCommandType({ id: "continue", label: "Continue run", enabled: true, risk: "medium", requiresConfirmation: true }), "continue-run");
  assert.equal(
    describeSafeActionIntent({
      id: "continue",
      label: "Continue run",
      enabled: true,
      risk: "medium",
      requiresConfirmation: true
    }),
    "Preview only: Continue run (continue-run) would use the command boundary as a medium-risk action. Continues an existing run through the command boundary. Requires confirmation. Preconditions: Run exists. Run is resumable. Effects: Updates run artefacts and state."
  );
});

test("describeSafeActionIntent maps reviewer rerun to retry-phase metadata", () => {
  assert.equal(getSafeActionCommandType({ id: "rerun-reviewer", label: "Rerun reviewer", enabled: true, risk: "medium", requiresConfirmation: false }), "retry-phase");
  assert.equal(
    describeSafeActionIntent({
      id: "rerun-reviewer",
      label: "Rerun reviewer",
      enabled: true,
      risk: "medium",
      requiresConfirmation: false
    }),
    "Preview only: Retry phase (retry-phase) would use the command boundary as a medium-risk action. Retries a failed or selected phase through the command boundary. Preconditions: Run exists. Phase is retryable. Effects: Updates phase artefacts and state."
  );
});
