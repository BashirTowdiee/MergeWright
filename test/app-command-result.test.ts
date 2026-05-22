import test from "node:test";
import assert from "node:assert/strict";
import { APP_COMMAND_ERROR_CODES } from "../src/application/commands/app-command-error.js";
import {
  isAppCommandFailure,
  isAppCommandSuccess,
  type AppCommandResult
} from "../src/application/commands/app-command-result.js";

test("success command results are explicit and serialisable", () => {
  const result: AppCommandResult = {
    ok: true,
    commandId: "cmd-1",
    type: "select-task",
    message: "Selected task task-1.",
    runId: "run-1",
    stageId: "stage-1",
    changedFiles: [],
    artefacts: [],
    warnings: []
  };

  assert.equal(isAppCommandSuccess(result), true);
  assert.equal(isAppCommandFailure(result), false);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test("failure command results are explicit and serialisable", () => {
  const result: AppCommandResult = {
    ok: false,
    commandId: "cmd-1",
    type: "approve-stage",
    code: "CONFIRMATION_REQUIRED",
    reason: "Approving a stage requires confirmation.",
    details: { stageId: "stage-1" }
  };

  assert.equal(isAppCommandSuccess(result), false);
  assert.equal(isAppCommandFailure(result), true);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test("command result error codes cover the initial failure set", () => {
  assert.deepEqual(APP_COMMAND_ERROR_CODES, [
    "VALIDATION_FAILED",
    "CONFIRMATION_REQUIRED",
    "WRITE_SAFETY_FAILED",
    "NOT_FOUND",
    "CONFLICT",
    "EXECUTION_FAILED"
  ]);
});

test("command results do not require stdout or stderr parsing", () => {
  const results: AppCommandResult[] = [
    {
      ok: true,
      commandId: "cmd-1",
      type: "start-run",
      message: "Started run.",
      runId: "run-1"
    },
    {
      ok: false,
      commandId: "cmd-2",
      type: "retry-phase",
      code: "EXECUTION_FAILED",
      reason: "The retry failed."
    }
  ];

  for (const result of results) {
    const keys = Object.keys(result);
    assert.equal(keys.includes("stdout"), false);
    assert.equal(keys.includes("stderr"), false);
    assert.equal(keys.includes("output"), false);
  }
});
