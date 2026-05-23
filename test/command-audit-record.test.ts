import test from "node:test";
import assert from "node:assert/strict";
import { createCommandAuditRecord } from "../src/application/commands/command-audit-record.js";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";

const command: AppCommand = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-23T00:00:00.000Z",
  actor: { id: "tester", displayName: "Tester" },
  type: "add-task-comment",
  taskId: "task-1",
  comment: "Ready."
};

test("createCommandAuditRecord builds a serialisable success audit record", () => {
  const result: AppCommandResult = {
    ok: true,
    commandId: "cmd-1",
    type: "add-task-comment",
    message: "Comment accepted.",
    changedFiles: ["plans/coordination.md"],
    artefacts: ["runs/run-1/reviewer-output.md"]
  };

  const record = createCommandAuditRecord({
    command,
    risk: "low",
    inputSummary: "Add a comment to task-1.",
    result,
    recordedAt: "2026-05-23T00:01:00.000Z",
    id: "audit-1"
  });

  assert.deepEqual(record, {
    id: "audit-1",
    commandId: "cmd-1",
    type: "add-task-comment",
    source: "tui",
    actor: { id: "tester", displayName: "Tester" },
    risk: "low",
    requestedAt: "2026-05-23T00:00:00.000Z",
    recordedAt: "2026-05-23T00:01:00.000Z",
    inputSummary: "Add a comment to task-1.",
    result,
    changedFiles: ["plans/coordination.md"],
    artefacts: ["runs/run-1/reviewer-output.md"]
  });
});

test("createCommandAuditRecord derives deterministic IDs when omitted", () => {
  const result: AppCommandResult = {
    ok: true,
    commandId: "cmd-1",
    type: "add-task-comment",
    message: "Comment accepted."
  };

  const record = createCommandAuditRecord({
    command,
    risk: "none",
    inputSummary: "Add a comment.",
    result,
    recordedAt: "2026-05-23T00:01:00.000Z"
  });

  assert.equal(record.id, "cmd-1:2026-05-23T00:01:00.000Z");
  assert.deepEqual(record.changedFiles, []);
  assert.deepEqual(record.artefacts, []);
});

test("createCommandAuditRecord keeps failed command results without changed files", () => {
  const result: AppCommandResult = {
    ok: false,
    commandId: "cmd-1",
    type: "add-task-comment",
    code: "VALIDATION_FAILED",
    reason: "Task comment is required."
  };

  const record = createCommandAuditRecord({
    command,
    risk: "low",
    inputSummary: "Add an empty comment.",
    result,
    recordedAt: "2026-05-23T00:01:00.000Z"
  });

  assert.equal(record.result, result);
  assert.deepEqual(record.changedFiles, []);
  assert.deepEqual(record.artefacts, []);
});
