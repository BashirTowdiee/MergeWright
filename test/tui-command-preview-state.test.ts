import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import { clearCommandPreview, createIdleCommandPreviewState, formatCommandPreviewNotice, showCommandPreview } from "../src/tui/command-preview-state.js";
import { previewCommandIntent, type TuiCommandIntent } from "../src/tui/write-model.js";

const command: AppCommand = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-22T14:05:00.000Z",
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
  effects: ["Updates run artefacts and state."],
  blockedReason: "continue-run requires confirmation because its risk is medium."
};

test("command preview state starts idle and can be cleared", () => {
  assert.deepEqual(createIdleCommandPreviewState(), { status: "idle" });
  assert.deepEqual(clearCommandPreview(), { status: "idle" });
  assert.equal(formatCommandPreviewNotice(createIdleCommandPreviewState()), "No command preview selected.");
});

test("command preview state formats selected preview", () => {
  const preview = previewCommandIntent(intent, description);
  const state = showCommandPreview(intent, preview);

  assert.equal(state.status, "previewing");
  assert.equal(formatCommandPreviewNotice(state), "Preview: Continue run (continue-run) is medium-risk and blocked; confirmation required. Blocked: continue-run requires confirmation because its risk is medium.");
});

test("command preview state formats submit-ready preview", () => {
  const readyDescription: CommandDescription = {
    ...description,
    risk: "low",
    requiresConfirmation: false,
    blockedReason: undefined
  };
  const preview = previewCommandIntent(intent, readyDescription);
  const state = showCommandPreview(intent, preview);

  assert.equal(formatCommandPreviewNotice(state), "Preview: Continue run (continue-run) is low-risk and submit-ready; no confirmation required.");
});
