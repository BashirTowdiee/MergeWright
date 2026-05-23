import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { CommandMetadata } from "../src/application/commands/command-source.js";

const metadata: CommandMetadata = {
  commandId: "cmd-service-1",
  source: "tui",
  requestedAt: "2026-05-23T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  }
};

const command: AppCommand = {
  ...metadata,
  type: "select-task",
  taskId: "task-1"
};

test("DefaultAppCommandService describes commands from metadata", async () => {
  const service = new DefaultAppCommandService();

  const description = await service.describe(command);

  assert.equal(description.commandId, "cmd-service-1");
  assert.equal(description.type, "select-task");
  assert.equal(description.title, "Select task");
  assert.equal(description.risk, "none");
  assert.equal(description.requiresConfirmation, false);
  assert.deepEqual(description.preconditions, ["Task exists in the current read model."]);
});

test("DefaultAppCommandService can describe overridden command risk", async () => {
  const service = new DefaultAppCommandService({ resolveRisk: () => "high" });

  const description = await service.describe(command);

  assert.equal(description.risk, "high");
  assert.equal(description.requiresConfirmation, true);
  assert.equal(description.blockedReason, "select-task requires confirmation because its risk is high.");
});

test("DefaultAppCommandService executes select-task without file changes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "select-task",
    message: "Selected task task-1."
  });
});

test("DefaultAppCommandService validates missing select-task IDs", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({ ...command, taskId: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "select-task",
    code: "VALIDATION_FAILED",
    reason: "Task ID is required."
  });
});

test("DefaultAppCommandService accepts coordination notes without direct file writes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "update-coordination-note",
    note: "Record next action.",
    expectedRevision: "rev-1"
  });

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "update-coordination-note",
    message: "Coordination note accepted for service handling.",
    changedFiles: []
  });
});

test("DefaultAppCommandService validates empty coordination notes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "update-coordination-note",
    note: "  "
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "update-coordination-note",
    code: "VALIDATION_FAILED",
    reason: "Coordination note is required."
  });
});

test("DefaultAppCommandService marks tasks reviewed without direct file writes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "mark-task-reviewed",
    taskId: "task-1",
    reviewedAt: "2026-05-23T00:00:00.000Z"
  });

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "mark-task-reviewed",
    message: "Marked task task-1 reviewed.",
    changedFiles: []
  });
});

test("DefaultAppCommandService validates missing reviewed task IDs", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "mark-task-reviewed",
    taskId: "  ",
    reviewedAt: "2026-05-23T00:00:00.000Z"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "mark-task-reviewed",
    code: "VALIDATION_FAILED",
    reason: "Task ID is required."
  });
});

test("DefaultAppCommandService validates reviewed timestamps", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "mark-task-reviewed",
    taskId: "task-1",
    reviewedAt: "not-a-date"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "mark-task-reviewed",
    code: "VALIDATION_FAILED",
    reason: "Reviewed-at timestamp must be a valid date."
  });
});

test("DefaultAppCommandService accepts task comments without direct file writes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "add-task-comment",
    taskId: "task-1",
    comment: "Looks ready."
  });

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "add-task-comment",
    message: "Comment accepted for task task-1.",
    changedFiles: []
  });
});

test("DefaultAppCommandService validates missing commented task IDs", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "add-task-comment",
    taskId: "  ",
    comment: "Looks ready."
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "add-task-comment",
    code: "VALIDATION_FAILED",
    reason: "Task ID is required."
  });
});

test("DefaultAppCommandService validates empty task comments", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "add-task-comment",
    taskId: "task-1",
    comment: "  "
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "add-task-comment",
    code: "VALIDATION_FAILED",
    reason: "Task comment is required."
  });
});

test("DefaultAppCommandService rejects unwired command execution", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "continue-run",
    runId: "run-1"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "continue-run",
    code: "EXECUTION_FAILED",
    reason: "Command execution is not wired yet."
  });
});
