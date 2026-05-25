import test from "node:test";
import assert from "node:assert/strict";
import type { ContinueRunCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { ContinueRunUseCase } from "../src/application/use-cases/continue-run-use-case.js";

const command: ContinueRunCommand = {
  commandId: "cmd-service-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "continue-run",
  runId: "run-1"
};

test("DefaultAppCommandService routes continue-run through injected use case", async () => {
  const calls: ContinueRunCommand[] = [];
  const useCase: ContinueRunUseCase = {
    execute(continueRunCommand) {
      calls.push(continueRunCommand);
      return {
        ok: true,
        commandId: continueRunCommand.commandId,
        type: continueRunCommand.type,
        message: "Use case continued run."
      };
    }
  };
  const service = new DefaultAppCommandService({
    resolveRisk: () => "none",
    continueRunUseCase: useCase
  });

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "continue-run",
    message: "Use case continued run."
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.runId, "run-1");
});
