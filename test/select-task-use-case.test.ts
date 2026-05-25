import test from "node:test";
import assert from "node:assert/strict";
import type { SelectTaskCommand } from "../src/application/commands/app-command.js";
import { DefaultSelectTaskUseCase } from "../src/application/use-cases/select-task-use-case.js";

const command: SelectTaskCommand = {
  commandId: "select-task-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "select-task",
  taskId: "task-1"
};

test("DefaultSelectTaskUseCase selects a valid task", async () => {
  const useCase = new DefaultSelectTaskUseCase();

  const result = await useCase.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "select-task-1",
    type: "select-task",
    message: "Selected task task-1."
  });
});

test("DefaultSelectTaskUseCase validates missing task ids", async () => {
  const useCase = new DefaultSelectTaskUseCase();

  const result = await useCase.execute({ ...command, taskId: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "select-task-1",
    type: "select-task",
    code: "VALIDATION_FAILED",
    reason: "Task ID is required."
  });
});
