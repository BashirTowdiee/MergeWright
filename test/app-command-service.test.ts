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
