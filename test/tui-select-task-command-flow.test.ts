import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import type { AppCommandService } from "../src/application/commands/app-command-service.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import { TuiCommandController } from "../src/tui/command-controller.js";
import { createIdleCommandPreviewState } from "../src/tui/command-preview-state.js";
import { previewSelectTaskCommand, submitSelectTaskCommand } from "../src/tui/select-task-command-flow.js";

class StubCommandService implements AppCommandService {
  readonly describedCommands: AppCommand[] = [];
  readonly executedCommands: AppCommand[] = [];

  async describe(command: AppCommand): Promise<CommandDescription> {
    this.describedCommands.push(command);
    return {
      commandId: command.commandId,
      type: command.type,
      title: "Select task",
      summary: "Selects the active roadmap task.",
      risk: "none",
      requiresConfirmation: false,
      preconditions: ["Task exists."],
      effects: ["Updates the active task selection."]
    };
  }

  async execute(command: AppCommand): Promise<AppCommandResult> {
    this.executedCommands.push(command);
    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: `Selected task ${command.type === "select-task" ? command.taskId : "unknown"}.`
    };
  }
}

test("previewSelectTaskCommand builds and previews one select-task command", async () => {
  const service = new StubCommandService();
  const controller = new TuiCommandController({ commandService: service });

  const result = await previewSelectTaskCommand({
    controller,
    taskId: "task-1",
    label: "Select task 1",
    requestedAt: "2026-05-23T12:50:00.000Z",
    actor: { id: "tester" }
  });

  assert.equal(service.describedCommands.length, 1);
  assert.deepEqual(service.describedCommands[0], {
    commandId: "tui-select-task-task-1",
    source: "tui",
    actor: { id: "tester" },
    requestedAt: "2026-05-23T12:50:00.000Z",
    type: "select-task",
    taskId: "task-1"
  });
  assert.equal(result.previewState.status, "previewing");
  assert.equal(result.previewState.status === "previewing" ? result.previewState.intent.id : undefined, "select-task:task-1");
  assert.equal(result.notice, "Preview: Select task (select-task) is none-risk and submit-ready; no confirmation required.");
});

test("submitSelectTaskCommand submits the previewed command and returns result state", async () => {
  const service = new StubCommandService();
  const controller = new TuiCommandController({ commandService: service });
  const preview = await previewSelectTaskCommand({
    controller,
    taskId: "task-2",
    label: "Select task 2",
    requestedAt: "2026-05-23T12:51:00.000Z"
  });

  const result = await submitSelectTaskCommand({ controller, previewState: preview.previewState });

  assert.equal(service.executedCommands.length, 1);
  assert.equal(service.executedCommands[0]?.type, "select-task");
  assert.equal(result.resultState.status, "completed");
  assert.equal(result.resultState.status === "completed" ? result.resultState.intentId : undefined, "select-task:task-2");
  assert.equal(result.notice, "Command result: Selected task task-2.");
});

test("submitSelectTaskCommand requires a preview before submit", async () => {
  const controller = new TuiCommandController({ commandService: new StubCommandService() });

  await assert.rejects(() => submitSelectTaskCommand({ controller, previewState: createIdleCommandPreviewState() }), {
    message: "Select-task command preview is required before submit."
  });
});
