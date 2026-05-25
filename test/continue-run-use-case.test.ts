import test from "node:test";
import assert from "node:assert/strict";
import type { ContinueRunCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import { DefaultContinueRunUseCase } from "../src/application/use-cases/continue-run-use-case.js";

const command: ContinueRunCommand = {
  commandId: "continue-run-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "continue-run",
  runId: "run-1"
};

test("DefaultContinueRunUseCase validates missing run ids", async () => {
  const useCase = new DefaultContinueRunUseCase();

  const result = await useCase.execute({ ...command, runId: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "continue-run-1",
    type: "continue-run",
    code: "VALIDATION_FAILED",
    reason: "Run ID is required."
  });
});

test("DefaultContinueRunUseCase fails deterministically without a handler", async () => {
  const useCase = new DefaultContinueRunUseCase();

  const result = await useCase.execute(command);

  assert.deepEqual(result, {
    ok: false,
    commandId: "continue-run-1",
    type: "continue-run",
    code: "EXECUTION_FAILED",
    reason: "Continue-run handler is not configured."
  });
});

test("DefaultContinueRunUseCase delegates valid commands to the handler", async () => {
  const calls: ContinueRunCommand[] = [];
  const expected: AppCommandResult = {
    ok: true,
    commandId: "continue-run-1",
    type: "continue-run",
    message: "Continued run."
  };
  const useCase = new DefaultContinueRunUseCase((continueRunCommand) => {
    calls.push(continueRunCommand);
    return expected;
  });

  const result = await useCase.execute(command);

  assert.deepEqual(result, expected);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.runId, "run-1");
});
