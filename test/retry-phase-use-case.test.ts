import test from "node:test";
import assert from "node:assert/strict";
import type { RetryPhaseCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import { DefaultRetryPhaseUseCase } from "../src/application/use-cases/retry-phase-use-case.js";

const command: RetryPhaseCommand = {
  commandId: "retry-phase-1",
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

test("DefaultRetryPhaseUseCase validates missing run ids", async () => {
  const useCase = new DefaultRetryPhaseUseCase();

  const result = await useCase.execute({ ...command, runId: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "retry-phase-1",
    type: "retry-phase",
    code: "VALIDATION_FAILED",
    reason: "Run ID is required."
  });
});

test("DefaultRetryPhaseUseCase validates unsupported phases", async () => {
  const useCase = new DefaultRetryPhaseUseCase();

  const result = await useCase.execute({ ...command, phase: "builder" });

  assert.deepEqual(result, {
    ok: false,
    commandId: "retry-phase-1",
    type: "retry-phase",
    code: "VALIDATION_FAILED",
    reason: "Only reviewer retry-phase commands are currently supported."
  });
});

test("DefaultRetryPhaseUseCase fails deterministically without a handler", async () => {
  const useCase = new DefaultRetryPhaseUseCase();

  const result = await useCase.execute(command);

  assert.deepEqual(result, {
    ok: false,
    commandId: "retry-phase-1",
    type: "retry-phase",
    code: "EXECUTION_FAILED",
    reason: "Retry-phase handler is not configured."
  });
});

test("DefaultRetryPhaseUseCase delegates valid commands to the handler", async () => {
  const calls: RetryPhaseCommand[] = [];
  const expected: AppCommandResult = {
    ok: true,
    commandId: "retry-phase-1",
    type: "retry-phase",
    message: "Retried reviewer."
  };
  const useCase = new DefaultRetryPhaseUseCase((retryPhaseCommand) => {
    calls.push(retryPhaseCommand);
    return expected;
  });

  const result = await useCase.execute(command);

  assert.deepEqual(result, expected);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.phase, "reviewer");
});
