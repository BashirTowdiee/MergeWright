import test from "node:test";
import assert from "node:assert/strict";
import type { MarkTaskReviewedCommand } from "../src/application/commands/app-command.js";
import { DefaultMarkTaskReviewedUseCase } from "../src/application/use-cases/mark-task-reviewed-use-case.js";

const command: MarkTaskReviewedCommand = {
  commandId: "mark-reviewed-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "mark-task-reviewed",
  taskId: "task-1",
  reviewedAt: "2026-05-25T00:00:00.000Z"
};

test("DefaultMarkTaskReviewedUseCase marks a valid task as reviewed", async () => {
  const useCase = new DefaultMarkTaskReviewedUseCase();

  const result = await useCase.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "mark-reviewed-1",
    type: "mark-task-reviewed",
    message: "Marked task task-1 reviewed.",
    changedFiles: []
  });
});

test("DefaultMarkTaskReviewedUseCase validates missing task ids", async () => {
  const useCase = new DefaultMarkTaskReviewedUseCase();

  const result = await useCase.execute({ ...command, taskId: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "mark-reviewed-1",
    type: "mark-task-reviewed",
    code: "VALIDATION_FAILED",
    reason: "Task ID is required."
  });
});

test("DefaultMarkTaskReviewedUseCase validates reviewed timestamps", async () => {
  const useCase = new DefaultMarkTaskReviewedUseCase();

  const result = await useCase.execute({ ...command, reviewedAt: "not-a-date" });

  assert.deepEqual(result, {
    ok: false,
    commandId: "mark-reviewed-1",
    type: "mark-task-reviewed",
    code: "VALIDATION_FAILED",
    reason: "Reviewed-at timestamp must be a valid date."
  });
});
