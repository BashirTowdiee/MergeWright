import test from "node:test";
import assert from "node:assert/strict";
import type { TuiCommandIntent, TuiCommandPreview } from "../src/tui/write-model.js";
import { createIdleCommandPreviewState, showCommandPreview } from "../src/tui/command-preview-state.js";
import {
  buildCommandConfirmationState,
  createCommandConfirmationToken,
  createIdleCommandConfirmationState,
  formatCommandConfirmationNotice,
  isCommandConfirmationSatisfied
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

test("createCommandConfirmationToken builds deterministic token", () => {
  assert.equal(createCommandConfirmationToken({ intentId: "intent-1", commandType: "select-task" }), "select-task:intent-1:confirm");
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
        risk: "high",
        requiresConfirmation: true,
        canSubmit: false,
        description: {
          commandId: "command-1",
          type: "select-task",
          title: "Select task",
          summary: "Selects a task.",
          risk: "high",
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
    risk: "high",
    token: "select-task:intent-1:confirm",
    prompt: "Review Select task before continuing with select-task:intent-1:confirm."
  });
});

test("isCommandConfirmationSatisfied matches intent and token", () => {
  const state = buildCommandConfirmationState(showCommandPreview(makeIntent(), makePreview({ risk: "high", requiresConfirmation: true, canSubmit: false })));

  assert.equal(isCommandConfirmationSatisfied({ state, intentId: "intent-1", confirmationToken: "select-task:intent-1:confirm" }), true);
  assert.equal(isCommandConfirmationSatisfied({ state, intentId: "intent-1", confirmationToken: "wrong" }), false);
});

test("formatCommandConfirmationNotice formats each state", () => {
  assert.equal(formatCommandConfirmationNotice({ status: "idle" }), "No command confirmation required.");
  assert.equal(
    formatCommandConfirmationNotice({
      status: "required",
      intentId: "intent-1",
      commandType: "select-task",
      title: "Select task",
      risk: "high",
      token: "select-task:intent-1:confirm",
      prompt: "Review Select task before continuing with select-task:intent-1:confirm."
    }),
    "Confirmation required: Select task (select-task) is high-risk. Review Select task before continuing with select-task:intent-1:confirm."
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
