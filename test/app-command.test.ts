import test from "node:test";
import assert from "node:assert/strict";
import { APP_COMMAND_TYPES, type AppCommand } from "../src/application/commands/app-command.js";
import type { CommandMetadata } from "../src/application/commands/command-source.js";

const metadata: CommandMetadata = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-22T12:45:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  }
};

test("application commands are serialisable product intents", () => {
  const command: AppCommand = {
    ...metadata,
    type: "select-task",
    taskId: "task-1"
  };

  assert.deepEqual(JSON.parse(JSON.stringify(command)), command);
});

test("application command type list covers the supported command union", () => {
  assert.deepEqual(APP_COMMAND_TYPES, [
    "select-task",
    "update-coordination-note",
    "mark-task-reviewed",
    "add-task-comment",
    "start-run",
    "continue-run",
    "retry-phase",
    "approve-stage",
    "reassess-stage-plan"
  ]);
});

test("application commands do not expose shell execution fields", () => {
  const commands: AppCommand[] = [
    { ...metadata, type: "select-task", taskId: "task-1" },
    { ...metadata, type: "update-coordination-note", note: "Reviewed current TUI slice." },
    { ...metadata, type: "mark-task-reviewed", taskId: "task-1", reviewedAt: metadata.requestedAt },
    { ...metadata, type: "add-task-comment", taskId: "task-1", comment: "Looks safe." },
    { ...metadata, type: "start-run", stageName: "stage-1", configPath: "configs/example.json", preset: "plan" },
    { ...metadata, type: "continue-run", runId: "run-1" },
    { ...metadata, type: "retry-phase", runId: "run-1", phase: "reviewer" },
    { ...metadata, type: "approve-stage", stageId: "stage-1", confirmationToken: "confirm-1" },
    { ...metadata, type: "reassess-stage-plan", stageId: "stage-1", reason: "Scope changed." }
  ];

  for (const command of commands) {
    const keys = Object.keys(command);
    assert.equal(keys.includes("shell"), false);
    assert.equal(keys.includes("argv"), false);
    assert.equal(keys.includes("stdout"), false);
    assert.equal(keys.includes("stderr"), false);
    assert.equal(keys.includes("command"), false);
  }
});
