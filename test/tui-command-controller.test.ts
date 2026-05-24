import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import type { AppCommandService } from "../src/application/commands/app-command-service.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import { TuiCommandController } from "../src/tui/command-controller.js";
import type { TuiCommandIntent } from "../src/tui/write-model.js";

const command: AppCommand = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-23T12:10:00.000Z",
  actor: { id: "tester" },
  type: "select-task",
  taskId: "task-1"
};

const intent: TuiCommandIntent = {
  id: "intent-1",
  type: "select-task",
  label: "Select task",
  command
};

const description: CommandDescription = {
  commandId: "cmd-1",
  type: "select-task",
  title: "Select task",
  summary: "Selects the active roadmap task.",
  risk: "low",
  requiresConfirmation: false,
  preconditions: ["Task exists."],
  effects: ["Updates the active task selection."]
};

const successResult: AppCommandResult = {
  ok: true,
  commandId: "cmd-1",
  type: "select-task",
  message: "Selected task task-1."
};

class StubCommandService implements AppCommandService {
  readonly describedCommands: AppCommand[] = [];
  readonly executedCommands: AppCommand[] = [];
  description: CommandDescription = description;

  async describe(commandToDescribe: AppCommand): Promise<CommandDescription> {
    this.describedCommands.push(commandToDescribe);
    return this.description;
  }

  async execute(commandToExecute: AppCommand): Promise<AppCommandResult> {
    this.executedCommands.push(commandToExecute);
    return successResult;
  }
}

test("TuiCommandController previews intents through AppCommandService", async () => {
  const service = new StubCommandService();
  const controller = new TuiCommandController({ commandService: service });

  const preview = await controller.preview(intent);

  assert.deepEqual(service.describedCommands, [command]);
  assert.equal(preview.intentId, "intent-1");
  assert.equal(preview.description, description);
  assert.equal(preview.risk, "low");
  assert.equal(preview.canSubmit, true);
  assert.equal(preview.requiresConfirmation, false);
});

test("TuiCommandController submits commands through AppCommandService", async () => {
  const service = new StubCommandService();
  const controller = new TuiCommandController({ commandService: service });

  const outcome = await controller.submit({ intentId: intent.id, command });

  assert.deepEqual(service.describedCommands, [command]);
  assert.deepEqual(service.executedCommands, [command]);
  assert.deepEqual(outcome, {
    intentId: "intent-1",
    result: successResult
  });
});

test("TuiCommandController blocks submission when preconditions fail", async () => {
  const service = new StubCommandService();
  service.description = {
    ...description,
    blockedReason: "Task is locked."
  };
  const controller = new TuiCommandController({ commandService: service });

  const outcome = await controller.submit({ intentId: intent.id, command });

  assert.deepEqual(service.executedCommands, []);
  assert.deepEqual(outcome, {
    intentId: "intent-1",
    result: {
      ok: false,
      commandId: "cmd-1",
      type: "select-task",
      code: "VALIDATION_FAILED",
      reason: "Task is locked."
    }
  });
});

test("TuiCommandController blocks confirmation-required submission without token", async () => {
  const service = new StubCommandService();
  service.description = {
    ...description,
    risk: "high",
    requiresConfirmation: true
  };
  const controller = new TuiCommandController({ commandService: service });

  const outcome = await controller.submit({ intentId: intent.id, command });

  assert.deepEqual(service.executedCommands, []);
  assert.deepEqual(outcome, {
    intentId: "intent-1",
    result: {
      ok: false,
      commandId: "cmd-1",
      type: "select-task",
      code: "CONFIRMATION_REQUIRED",
      reason: "Confirmation token required: select-task:intent-1:confirm"
    }
  });
});

test("TuiCommandController submits confirmation-required command with matching token", async () => {
  const service = new StubCommandService();
  service.description = {
    ...description,
    risk: "high",
    requiresConfirmation: true
  };
  const controller = new TuiCommandController({ commandService: service });

  const outcome = await controller.submit({
    intentId: intent.id,
    command,
    confirmationToken: "select-task:intent-1:confirm"
  });

  assert.deepEqual(service.executedCommands, [command]);
  assert.deepEqual(outcome, {
    intentId: "intent-1",
    result: successResult
  });
});
