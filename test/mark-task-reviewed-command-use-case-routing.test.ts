import test from "node:test";
import assert from "node:assert/strict";
import type { MarkTaskReviewedCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { MarkTaskReviewedUseCase } from "../src/application/use-cases/mark-task-reviewed-use-case.js";

const command: MarkTaskReviewedCommand = {
  commandId: "cmd-service-1",
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

test("DefaultAppCommandService routes mark-task-reviewed through injected use case", async () => {
  const calls: MarkTaskReviewedCommand[] = [];
  const useCase: MarkTaskReviewedUseCase = {
    execute(markTaskReviewedCommand) {
      calls.push(markTaskReviewedCommand);
      return {
        ok: true,
        commandId: markTaskReviewedCommand.commandId,
        type: markTaskReviewedCommand.type,
        message: "Use case marked task reviewed.",
        changedFiles: []
      };
    }
  };
  const service = new DefaultAppCommandService({
    resolveRisk: () => "none",
    markTaskReviewedUseCase: useCase
  });

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "mark-task-reviewed",
    message: "Use case marked task reviewed.",
    changedFiles: []
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.taskId, "task-1");
});
