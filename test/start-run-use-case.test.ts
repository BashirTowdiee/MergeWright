import test from "node:test";
import assert from "node:assert/strict";
import type { StartRunCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import { DefaultStartRunUseCase } from "../src/application/use-cases/start-run-use-case.js";

const command: StartRunCommand = {
  commandId: "start-run-1",
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

test("DefaultStartRunUseCase validates missing stage names", async () => {
  const useCase = new DefaultStartRunUseCase();

  const result = await useCase.execute({ ...command, stageName: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "start-run-1",
    type: "start-run",
    code: "VALIDATION_FAILED",
    reason: "Stage name is required."
  });
});

test("DefaultStartRunUseCase validates missing config paths", async () => {
  const useCase = new DefaultStartRunUseCase();

  const result = await useCase.execute({ ...command, configPath: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "start-run-1",
    type: "start-run",
    code: "VALIDATION_FAILED",
    reason: "Config path is required."
  });
});

test("DefaultStartRunUseCase fails deterministically without a handler", async () => {
  const useCase = new DefaultStartRunUseCase();

  const result = await useCase.execute(command);

  assert.deepEqual(result, {
    ok: false,
    commandId: "start-run-1",
    type: "start-run",
    code: "EXECUTION_FAILED",
    reason: "Start-run handler is not configured."
  });
});

test("DefaultStartRunUseCase delegates valid commands to the handler", async () => {
  const calls: StartRunCommand[] = [];
  const expected: AppCommandResult = {
    ok: true,
    commandId: "start-run-1",
    type: "start-run",
    message: "Started run."
  };
  const useCase = new DefaultStartRunUseCase((startRunCommand) => {
    calls.push(startRunCommand);
    return expected;
  });

  const result = await useCase.execute(command);

  assert.deepEqual(result, expected);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.stageName, "stage-1");
});
