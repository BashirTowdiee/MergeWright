import test from "node:test";
import assert from "node:assert/strict";
import type { TuiCommandIntent, TuiCommandPreview } from "../src/tui/write-model.js";
import { showCommandPreview, createIdleCommandPreviewState } from "../src/tui/command-preview-state.js";
import {
  buildCommandConfirmationState,
  createIdleCommandConfirmationState,
  formatCommandConfirmationNotice
} from "../src/tui/command-confirmation-state.js";

function makeIntent(): TuiCommandIntent {
  return {
    id: "intent-1",
    type: "select-task",
    label: "Select task",
    command: {
      commandId: "command-1",
      source: "tui",
      requestedAt: "2026-05-24T00:00:00.000Z",
      type: "select-task",
      taskId: "task-1"
    }
  };
}

function makePreview(overrides: Partial<TuiCommandPreview> = {}): TuiCommandPreview {
  return {
    intentId: "intent-1",
    description: {
      commandId: "command-1",
      type: "select-task",
      title: "Select task",
      summary: "Selects a task.",
      risk: "low",
      requiresConfirmation: false,
      preconditions: [],
      effects: []
    },
    risk: "low",
    canSubmit: true,
    requiresConfirmation: false,
    ...overrides
  };
}

test("createIdleCommandConfirmationState returns idle state", () => {
  assert.deepEqual(createIdleCommandConfirmationState(), { status: "idle" });
});

test("buildCommandConfirmationState returns idle for idle preview", () => {
  assert.deepEqual(buildCommandConfirmationState(createIdleCommandPreviewState()), { status: "idle" });
});

test("buildCommandConfirmationState returns idle when confirmation is not required", () => {
  const state = buildCommandConfirmationState(showCommandPreview(makeIntent(), makePreview()));

  assert.deepEqual(state, { status: "idle" });
});

test("buildCommandConfirmationState returns blocked state when preview has blocked reason", () => {
  const state = buildCommandConfirmationState(
    showCommandPreview(
      makeIntent(),
      makePreview({
        canSubmit: false,
        blockedReason: "Missing task id."
      })
    )
  );

  assert.deepEqual(state, {
    status: "blocked",
    intentId: "intent-1",
    commandType: "select-task",
    title: "Select task",
    reason: "Missing task id."
  });
});

test("buildCommandConfirmationState returns required state when preview requires confirmation", () => {
  const state = buildCommandConfirmationState(
    showCommandPreview(
      makeIntent(),
      makePreview({
        risk: "dangerous",
        requiresConfirmation: true,
        canSubmit: false,
        description: {
          commandId: "command-1",
          type: "select-task",
          title: "Select task",
          summary: "Selects a task.",
          risk: "dangerous",
          requiresConfirmation: true,
          preconditions: [],
          effects: []
        }
      })
    )
  );

  assert.deepEqual(state, {
    status: "required",
    intentId: "intent-1",
    commandType: "select-task",
    title: "Select task",
    risk: "dangerous",
    prompt: "Review Select task before continuing."
  });
});

test("formatCommandConfirmationNotice formats each state", () => {
  assert.equal(formatCommandConfirmationNotice({ status: "idle" }), "No command confirmation required.");
  assert.equal(
    formatCommandConfirmationNotice({
      status: "required",
      intentId: "intent-1",
      commandType: "select-task",
      title: "Select task",
      risk: "dangerous",
      prompt: "Review Select task before continuing."
    }),
    "Confirmation required: Select task (select-task) is dangerous-risk. Review Select task before continuing."
  );
  assert.equal(
    formatCommandConfirmationNotice({
      status: "blocked",
      intentId: "intent-1",
      commandType: "select-task",
      title: "Select task",
      reason: "Missing task id."
    }),
    "Command blocked: Select task (select-task). Missing task id."
  );
});
