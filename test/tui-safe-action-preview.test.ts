import test from "node:test";
import assert from "node:assert/strict";
import { buildSafeActionPreview } from "../src/tui/safe-action-preview.js";

test("safe action preview ignores unmapped actions", () => {
  const state = buildSafeActionPreview({
    action: {
      id: "generate-report",
      label: "Generate change report",
      enabled: true,
      risk: "low",
      requiresConfirmation: false
    },
    runId: "run-1",
    selectedPhaseId: "reviewer",
    requestedAt: "2026-05-22T14:20:00.000Z"
  });

  assert.equal(state, undefined);
});

test("safe action preview builds continue command preview", () => {
  const state = buildSafeActionPreview({
    action: {
      id: "continue",
      label: "Continue run",
      enabled: true,
      risk: "medium",
      requiresConfirmation: true
    },
    runId: "run-1",
    selectedPhaseId: "reviewer",
    requestedAt: "2026-05-22T14:20:00.000Z"
  });

  assert.equal(state?.status, "previewing");
  assert.equal(state?.status === "previewing" ? state.intent.type : undefined, "continue-run");
  assert.equal(state?.status === "previewing" ? state.preview.description.title : undefined, "Continue run");
  assert.equal(state?.status === "previewing" ? state.preview.requiresConfirmation : undefined, true);
});

test("safe action preview builds reviewer retry preview", () => {
  const state = buildSafeActionPreview({
    action: {
      id: "rerun-reviewer",
      label: "Rerun reviewer",
      enabled: true,
      risk: "medium",
      requiresConfirmation: false
    },
    runId: "run-1",
    selectedPhaseId: "reviewer",
    requestedAt: "2026-05-22T14:20:00.000Z"
  });

  assert.equal(state?.status, "previewing");
  assert.equal(state?.status === "previewing" ? state.intent.type : undefined, "retry-phase");
  assert.equal(state?.status === "previewing" ? state.preview.description.title : undefined, "Retry phase");
  assert.equal(state?.status === "previewing" ? state.preview.risk : undefined, "medium");
});
