import test from "node:test";
import assert from "node:assert/strict";
import type { AddTaskCommentCommand } from "../src/application/commands/app-command.js";
import { DefaultAddTaskCommentUseCase } from "../src/application/use-cases/add-task-comment-use-case.js";

const command: AddTaskCommentCommand = {
  commandId: "add-comment-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "add-task-comment",
  taskId: "task-1",
  comment: "Looks ready."
};

test("DefaultAddTaskCommentUseCase accepts a valid task comment", async () => {
  const useCase = new DefaultAddTaskCommentUseCase();

  const result = await useCase.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "add-comment-1",
    type: "add-task-comment",
    message: "Comment accepted for task task-1.",
    changedFiles: []
  });
});

test("DefaultAddTaskCommentUseCase validates missing task ids", async () => {
  const useCase = new DefaultAddTaskCommentUseCase();

  const result = await useCase.execute({ ...command, taskId: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "add-comment-1",
    type: "add-task-comment",
    code: "VALIDATION_FAILED",
    reason: "Task ID is required."
  });
});

test("DefaultAddTaskCommentUseCase validates empty comments", async () => {
  const useCase = new DefaultAddTaskCommentUseCase();

  const result = await useCase.execute({ ...command, comment: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "add-comment-1",
    type: "add-task-comment",
    code: "VALIDATION_FAILED",
    reason: "Task comment is required."
  });
});
