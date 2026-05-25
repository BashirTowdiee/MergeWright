import test from "node:test";
import assert from "node:assert/strict";
import type { RetryPhaseCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { RetryPhaseUseCase } from "../src/application/use-cases/retry-phase-use-case.js";

const command: RetryPhaseCommand = {
  commandId: "cmd-service-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "retry-phase",
  runId: "run-1",
  phase: "reviewer"
};

test("DefaultAppCommandService routes retry-phase through injected use case", async () => {
  const calls: RetryPhaseCommand[] = [];
  const useCase: RetryPhaseUseCase = {
    execute(retryPhaseCommand) {
      calls.push(retryPhaseCommand);
      return {
        ok: true,
        commandId: retryPhaseCommand.commandId,
        type: retryPhaseCommand.type,
        message: "Use case retried reviewer."
      };
    }
  };
  const service = new DefaultAppCommandService({
    resolveRisk: () => "none",
    retryPhaseUseCase: useCase
  });

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "retry-phase",
    message: "Use case retried reviewer."
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.runId, "run-1");
});
