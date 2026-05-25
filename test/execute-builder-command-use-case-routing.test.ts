import test from "node:test";
import assert from "node:assert/strict";
import type { ExecuteBuilderCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { ExecuteBuilderUseCase } from "../src/application/use-cases/execute-builder-use-case.js";

const command: ExecuteBuilderCommand = {
  commandId: "cmd-service-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "execute-builder",
  runId: "run-1"
};

test("DefaultAppCommandService routes execute-builder through injected use case", async () => {
  const calls: ExecuteBuilderCommand[] = [];
  const useCase: ExecuteBuilderUseCase = {
    execute(executeBuilderCommand) {
      calls.push(executeBuilderCommand);
      return {
        ok: true,
        commandId: executeBuilderCommand.commandId,
        type: executeBuilderCommand.type,
        message: "Use case executed builder."
      };
    }
  };
  const service = new DefaultAppCommandService({
    resolveRisk: () => "none",
    executeBuilderUseCase: useCase
  });

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "execute-builder",
    message: "Use case executed builder."
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.runId, "run-1");
});
