import test from "node:test";
import assert from "node:assert/strict";
import type { ExecuteBuilderCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import { DefaultExecuteBuilderUseCase } from "../src/application/use-cases/execute-builder-use-case.js";

const command: ExecuteBuilderCommand = {
  commandId: "execute-builder-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "execute-builder",
  runId: "run-1"
};

test("DefaultExecuteBuilderUseCase validates missing run ids", async () => {
  const useCase = new DefaultExecuteBuilderUseCase();

  const result = await useCase.execute({ ...command, runId: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "execute-builder-1",
    type: "execute-builder",
    code: "VALIDATION_FAILED",
    reason: "Run ID is required."
  });
});

test("DefaultExecuteBuilderUseCase fails deterministically without a handler", async () => {
  const useCase = new DefaultExecuteBuilderUseCase();

  const result = await useCase.execute(command);

  assert.deepEqual(result, {
    ok: false,
    commandId: "execute-builder-1",
    type: "execute-builder",
    code: "EXECUTION_FAILED",
    reason: "Execute-builder handler is not configured."
  });
});

test("DefaultExecuteBuilderUseCase delegates valid commands to the handler", async () => {
  const calls: ExecuteBuilderCommand[] = [];
  const expected: AppCommandResult = {
    ok: true,
    commandId: "execute-builder-1",
    type: "execute-builder",
    message: "Executed builder."
  };
  const useCase = new DefaultExecuteBuilderUseCase((executeBuilderCommand) => {
    calls.push(executeBuilderCommand);
    return expected;
  });

  const result = await useCase.execute(command);

  assert.deepEqual(result, expected);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.runId, "run-1");
});
