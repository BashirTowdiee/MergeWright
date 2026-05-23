import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import type { AppCommandService } from "../src/application/commands/app-command-service.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import { TuiCommandController } from "../src/tui/command-controller.js";
import { createIdleCommandPreviewState } from "../src/tui/command-preview-state.js";
import { buildCoordinationNoteIntent } from "../src/tui/coordination-note-intent.js";
import { previewCoordinationNoteCommand, submitCoordinationNoteCommand } from "../src/tui/coordination-note-command-flow.js";

class StubCommandService implements AppCommandService {
  readonly describedCommands: AppCommand[] = [];
  readonly executedCommands: AppCommand[] = [];

  async describe(command: AppCommand): Promise<CommandDescription> {
    this.describedCommands.push(command);
    return {
      commandId: command.commandId,
      type: command.type,
      title: "Update coordination note",
      summary: "Updates the current coordination note.",
      risk: "low",
      requiresConfirmation: false,
      preconditions: ["Planning workspace exists."],
      effects: ["Queues a coordination note update."]
    };
  }

  async execute(command: AppCommand): Promise<AppCommandResult> {
    this.executedCommands.push(command);
    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: "Coordination note accepted for service handling.",
      changedFiles: []
    };
  }
}

test("buildCoordinationNoteIntent maps note input to one AppCommand intent", () => {
  const intent = buildCoordinationNoteIntent({
    note: "Record Stage 6 progress.",
    expectedRevision: "rev-1",
    requestedAt: "2026-05-23T13:30:00.000Z",
    actor: { id: "tester", displayName: "Tester" }
  });

  assert.deepEqual(intent, {
    id: "update-coordination-note:2026-05-23T13:30:00.000Z",
    type: "update-coordination-note",
    label: "Update coordination note",
    command: {
      commandId: "tui-update-coordination-note-2026-05-23T13:30:00.000Z",
      source: "tui",
      actor: { id: "tester", displayName: "Tester" },
      requestedAt: "2026-05-23T13:30:00.000Z",
      type: "update-coordination-note",
      note: "Record Stage 6 progress.",
      expectedRevision: "rev-1"
    }
  });
});

test("previewCoordinationNoteCommand builds and previews one update-coordination-note command", async () => {
  const service = new StubCommandService();
  const controller = new TuiCommandController({ commandService: service });

  const result = await previewCoordinationNoteCommand({
    controller,
    note: "Record Stage 6 progress.",
    requestedAt: "2026-05-23T13:31:00.000Z"
  });

  assert.equal(service.describedCommands.length, 1);
  assert.equal(service.describedCommands[0]?.type, "update-coordination-note");
  assert.equal(result.previewState.status, "previewing");
  assert.equal(result.notice, "Preview: Update coordination note (update-coordination-note) is low-risk and submit-ready; no confirmation required.");
});

test("submitCoordinationNoteCommand submits the previewed command and returns result state", async () => {
  const service = new StubCommandService();
  const controller = new TuiCommandController({ commandService: service });
  const preview = await previewCoordinationNoteCommand({
    controller,
    note: "Record Stage 6 progress.",
    requestedAt: "2026-05-23T13:32:00.000Z"
  });

  const result = await submitCoordinationNoteCommand({ controller, previewState: preview.previewState });

  assert.equal(service.executedCommands.length, 1);
  assert.equal(service.executedCommands[0]?.type, "update-coordination-note");
  assert.equal(result.resultState.status, "completed");
  assert.equal(result.notice, "Command result: Coordination note accepted for service handling.");
});

test("submitCoordinationNoteCommand requires a coordination-note preview before submit", async () => {
  const controller = new TuiCommandController({ commandService: new StubCommandService() });

  await assert.rejects(() => submitCoordinationNoteCommand({ controller, previewState: createIdleCommandPreviewState() }), {
    message: "Coordination-note command preview is required before submit."
  });
});
