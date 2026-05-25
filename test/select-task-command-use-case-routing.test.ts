import test from "node:test";
import assert from "node:assert/strict";
import type { SelectTaskCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { SelectTaskUseCase } from "../src/application/use-cases/select-task-use-case.js";

const command: SelectTaskCommand = {
  commandId: "cmd-service-1",
  source: "web",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "select-task",
  taskId: "task-1"
};

test("DefaultAppCommandService routes select-task through injected use case", async () => {
  const calls: SelectTaskCommand[] = [];
  const useCase: SelectTaskUseCase = {
    execute(selectTaskCommand) {
      calls.push(selectTaskCommand);
      return {
        ok: true,
        commandId: selectTaskCommand.commandId,
        type: selectTaskCommand.type,
        message: `Use case selected ${selectTaskCommand.taskId}.`
      };
    }
  };
  const service = new DefaultAppCommandService({
    resolveRisk: () => "none",
    selectTaskUseCase: useCase
  });

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "select-task",
    message: "Use case selected task-1."
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.taskId, "task-1");
});
