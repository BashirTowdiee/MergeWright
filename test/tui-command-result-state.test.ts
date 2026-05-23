import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import { clearCommandResult, createIdleCommandResultState, formatCommandResultNotice, showCommandResult } from "../src/tui/command-result-state.js";

const successResult: AppCommandResult = {
  ok: true,
  commandId: "cmd-1",
  type: "select-task",
  message: "Selected task task-1.",
  changedFiles: [],
  artefacts: []
};

const failureResult: AppCommandResult = {
  ok: false,
  commandId: "cmd-2",
  type: "select-task",
  code: "VALIDATION_FAILED",
  reason: "Task ID is required."
};

test("command result state starts idle and can be cleared", () => {
  assert.deepEqual(createIdleCommandResultState(), { status: "idle" });
  assert.deepEqual(clearCommandResult(), { status: "idle" });
  assert.equal(formatCommandResultNotice(createIdleCommandResultState()), "No command result selected.");
});

test("command result state formats successful command results", () => {
  const state = showCommandResult("intent-1", successResult);

  assert.deepEqual(state, {
    status: "completed",
    intentId: "intent-1",
    result: successResult
  });
  assert.equal(formatCommandResultNotice(state), "Command result: Selected task task-1.");
});

test("command result state formats failed command results", () => {
  const state = showCommandResult("intent-2", failureResult);

  assert.deepEqual(state, {
    status: "completed",
    intentId: "intent-2",
    result: failureResult
  });
  assert.equal(formatCommandResultNotice(state), "Command failed: VALIDATION_FAILED Task ID is required.");
});
