import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import { showCommandPreview, createIdleCommandPreviewState } from "../src/tui/command-preview-state.js";
import { buildCommandViewDetails } from "../src/tui/command-view-details.js";
import { previewCommandIntent, type TuiCommandIntent } from "../src/tui/write-model.js";

const command: AppCommand = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-22T14:40:00.000Z",
  type: "continue-run",
  runId: "run-1"
};

const intent: TuiCommandIntent = {
  id: "intent-1",
  type: "continue-run",
  label: "Continue run",
  command
};

const description: CommandDescription = {
  commandId: "cmd-1",
  type: "continue-run",
  title: "Continue run",
  summary: "Continues an existing run through the command boundary.",
  risk: "medium",
  requiresConfirmation: true,
  preconditions: [],
  effects: []
};

test("command view details are absent when idle", () => {
  assert.equal(buildCommandViewDetails(createIdleCommandPreviewState()), undefined);
});

test("command view details summarise selected preview", () => {
  const preview = previewCommandIntent(intent, description);
  const state = showCommandPreview(intent, preview);

  assert.deepEqual(buildCommandViewDetails(state), {
    title: "Continue run (continue-run)",
    summary: "Continues an existing run through the command boundary.",
    risk: "medium",
    confirmation: "required"
  });
});
