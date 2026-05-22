import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";

const command: AppCommand = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-22T13:55:00.000Z",
  type: "approve-stage",
  stageId: "stage-1"
};

test("default app service describes commands with configured risk", async () => {
  const service = new DefaultAppCommandService({ resolveRisk: () => "high" });
  const description = await service.describe(command);

  assert.equal(description.commandId, "cmd-1");
  assert.equal(description.type, "approve-stage");
  assert.equal(description.risk, "high");
  assert.equal(description.requiresConfirmation, true);
});
