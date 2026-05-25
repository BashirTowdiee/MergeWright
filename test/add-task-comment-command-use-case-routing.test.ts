import test from "node:test";
import assert from "node:assert/strict";
import type { AddTaskCommentCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { AddTaskCommentUseCase } from "../src/application/use-cases/add-task-comment-use-case.js";

const command: AddTaskCommentCommand = {
  commandId: "cmd-service-1",
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

test("DefaultAppCommandService routes add-task-comment through injected use case", async () => {
  const calls: AddTaskCommentCommand[] = [];
  const useCase: AddTaskCommentUseCase = {
    execute(addTaskCommentCommand) {
      calls.push(addTaskCommentCommand);
      return {
        ok: true,
        commandId: addTaskCommentCommand.commandId,
        type: addTaskCommentCommand.type,
        message: "Use case accepted task comment.",
        changedFiles: []
      };
    }
  };
  const service = new DefaultAppCommandService({
    resolveRisk: () => "none",
    addTaskCommentUseCase: useCase
  });

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "add-task-comment",
    message: "Use case accepted task comment.",
    changedFiles: []
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.comment, "Looks ready.");
});
