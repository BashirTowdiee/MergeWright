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
  assert.equal(description.blockedReason, "High risk command requires confirmation.");
});

test("DefaultAppCommandService rejects execution until handlers are wired", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "select-task",
    code: "EXECUTION_FAILED",
    reason: "Command execution is not wired yet."
  });
});
