import test from "node:test";
import assert from "node:assert/strict";
import { describeSafeActionIntent } from "../src/tui/action-intent.js";

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

test("describeSafeActionIntent previews enabled action", () => {
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

test("describeSafeActionIntent mentions confirmation when required", () => {
  assert.equal(
    describeSafeActionIntent({
      id: "request-fix",
      label: "Request fix",
      enabled: true,
      risk: "medium",
      requiresConfirmation: true
    }),
    "Preview only: Request fix would run later as a medium-risk action. Requires confirmation."
  );
});
