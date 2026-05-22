import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import { createIdleCommandPreviewState, showCommandPreview } from "../src/tui/command-preview-state.js";
import { buildCommandPreviewPaneModel } from "../src/tui/panes/CommandPreviewPane.js";
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
  preconditions: ["Run exists."],
  effects: ["Updates run state."],
  blockedReason: "continue-run requires confirmation because its risk is medium."
};

test("command preview pane model is absent while idle", () => {
  assert.equal(buildCommandPreviewPaneModel(createIdleCommandPreviewState()), undefined);
});

test("command preview pane model contains title and rows for preview", () => {
  const preview = previewCommandIntent(intent, description);
  const state = showCommandPreview(intent, preview);

  assert.deepEqual(buildCommandPreviewPaneModel(state), {
    title: "Command",
    rows: [
      "Command: Continue run (continue-run)",
      "Summary: Continues an existing run through the command boundary.",
      "Risk: medium",
      "Confirmation: required",
      "State: blocked",
      "Preconditions: Run exists.",
      "Effects: Updates run state.",
      "Reason: continue-run requires confirmation because its risk is medium."
    ]
  });
});
