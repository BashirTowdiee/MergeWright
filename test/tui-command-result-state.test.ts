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

const orchestrationSuccessResult: AppCommandResult = {
  ok: true,
  commandId: "cmd-3",
  type: "start-run",
  message: "Started planner run.",
  runId: "run-1",
  artefacts: ["runs/run-1/planner-output.md"]
};

const changedFilesSuccessResult: AppCommandResult = {
  ok: true,
  commandId: "cmd-4",
  type: "update-coordination-note",
  message: "Coordination note accepted.",
  changedFiles: ["plans/coordination.md"]
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

test("command result state formats orchestration result metadata", () => {
  const state = showCommandResult("intent-3", orchestrationSuccessResult);

  assert.deepEqual(state, {
    status: "completed",
    intentId: "intent-3",
    result: orchestrationSuccessResult
  });
  assert.equal(formatCommandResultNotice(state), "Command result: Started planner run. Run: run-1. Artefacts: runs/run-1/planner-output.md.");
});

test("command result state formats changed file metadata", () => {
  const state = showCommandResult("intent-4", changedFilesSuccessResult);

  assert.deepEqual(state, {
    status: "completed",
    intentId: "intent-4",
    result: changedFilesSuccessResult
  });
  assert.equal(formatCommandResultNotice(state), "Command result: Coordination note accepted. Changed files: plans/coordination.md.");
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
