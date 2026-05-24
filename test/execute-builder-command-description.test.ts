import test from "node:test";
import assert from "node:assert/strict";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { CommandMetadata } from "../src/application/commands/command-source.js";

const metadata: CommandMetadata = {
  commandId: "cmd-execute-builder-1",
  source: "tui",
  requestedAt: "2026-05-23T00:00:00.000Z"
};

test("DefaultAppCommandService describes execute-builder safety preconditions", async () => {
  const service = new DefaultAppCommandService();

  const description = await service.describe({
    ...metadata,
    type: "execute-builder",
    runId: "run-1"
  });

  assert.equal(description.commandId, "cmd-execute-builder-1");
  assert.equal(description.type, "execute-builder");
  assert.equal(description.title, "Execute builder");
  assert.equal(description.risk, "high");
  assert.equal(description.requiresConfirmation, true);
  assert.deepEqual(description.preconditions, [
    "Run exists.",
    "Builder phase is available for the run.",
    "Write safety checks pass.",
    "Repo is clean or the command is explicitly confirmed for writes.",
    "Branch is safe for writes.",
    "No dependency-blocked or overlapping file-scope task is active."
  ]);
});
