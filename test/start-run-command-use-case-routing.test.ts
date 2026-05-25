import test from "node:test";
import assert from "node:assert/strict";
import type { StartRunCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { StartRunUseCase } from "../src/application/use-cases/start-run-use-case.js";

const command: StartRunCommand = {
  commandId: "cmd-service-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "start-run",
  stageName: "stage-1",
  configPath: "configs/demo.json"
};

test("DefaultAppCommandService routes start-run through injected use case", async () => {
  const calls: StartRunCommand[] = [];
  const useCase: StartRunUseCase = {
    execute(startRunCommand) {
      calls.push(startRunCommand);
      return {
        ok: true,
        commandId: startRunCommand.commandId,
        type: startRunCommand.type,
        message: "Use case started run."
      };
    }
  };
  const service = new DefaultAppCommandService({
    resolveRisk: () => "none",
    startRunUseCase: useCase
  });

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "start-run",
    message: "Use case started run."
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.configPath, "configs/demo.json");
});
