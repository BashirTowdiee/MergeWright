import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import { showCommandPreview } from "../src/tui/command-preview-state.js";
import { isSelectTaskPreviewForTask } from "../src/tui/select-task-preview-match.js";
import { previewCommandIntent, type TuiCommandIntent } from "../src/tui/write-model.js";

const command: AppCommand = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-23T13:10:00.000Z",
  type: "select-task",
  taskId: "task-1"
};

const intent: TuiCommandIntent = {
  id: "select-task:task-1",
  type: "select-task",
  label: "Select task 1",
  command
};

const description: CommandDescription = {
  commandId: "cmd-1",
  type: "select-task",
  title: "Select task",
  summary: "Selects the active roadmap task.",
  risk: "none",
  requiresConfirmation: false,
  preconditions: [],
  effects: []
};

test("isSelectTaskPreviewForTask matches a previewed select-task command by task ID", () => {
  const state = showCommandPreview(intent, previewCommandIntent(intent, description));

  assert.equal(isSelectTaskPreviewForTask(state, "task-1"), true);
  assert.equal(isSelectTaskPreviewForTask(state, "task-2"), false);
});

test("isSelectTaskPreviewForTask ignores non-previewing states and non-select-task intents", () => {
  assert.equal(isSelectTaskPreviewForTask({ status: "idle" }, "task-1"), false);

  const nonSelectCommand: AppCommand = {
    commandId: "cmd-2",
    source: "tui",
    requestedAt: "2026-05-23T13:11:00.000Z",
    type: "continue-run",
    runId: "run-1"
  };
  const nonSelectIntent: TuiCommandIntent = {
    id: "continue:run-1",
    type: "continue-run",
    label: "Continue run",
    command: nonSelectCommand
  };
  const nonSelectDescription: CommandDescription = {
    ...description,
    commandId: "cmd-2",
    type: "continue-run",
    title: "Continue run"
  };

  const state = showCommandPreview(nonSelectIntent, previewCommandIntent(nonSelectIntent, nonSelectDescription));

  assert.equal(isSelectTaskPreviewForTask(state, "task-1"), false);
});
