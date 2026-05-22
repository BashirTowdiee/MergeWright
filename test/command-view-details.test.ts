import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import { showCommandPreview, createIdleCommandPreviewState } from "../src/tui/command-preview-state.js";
import { buildCommandViewDetails, buildCommandViewRows, COMMAND_VIEW_LIST_SEPARATOR, COMMAND_VIEW_ROW_LABELS } from "../src/tui/command-view-details.js";
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

test("command view row labels are stable", () => {
  assert.deepEqual(COMMAND_VIEW_ROW_LABELS, {
    title: "Command",
    summary: "Summary",
    risk: "Risk",
    confirmation: "Confirmation",
    state: "State",
    preconditions: "Preconditions",
    effects: "Effects",
    reason: "Reason"
  });
});

test("command view list separator is stable", () => {
  assert.equal(COMMAND_VIEW_LIST_SEPARATOR, " | ");
});

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
    confirmation: "required",
    state: "blocked",
    preconditions: ["Run exists."],
    effects: ["Updates run state."],
    reason: "continue-run requires confirmation because its risk is medium."
  });
});

test("command view details mark ready preview", () => {
  const readyPreview = previewCommandIntent(intent, {
    ...description,
    risk: "low",
    requiresConfirmation: false,
    blockedReason: undefined
  });

  assert.equal(buildCommandViewDetails(showCommandPreview(intent, readyPreview))?.state, "ready");
  assert.equal(buildCommandViewDetails(showCommandPreview(intent, readyPreview))?.reason, undefined);
});

test("command view rows format optional details", () => {
  const preview = previewCommandIntent(intent, description);
  const state = showCommandPreview(intent, preview);
  const details = buildCommandViewDetails(state);

  assert.ok(details);
  assert.deepEqual(buildCommandViewRows(details), [
    "Command: Continue run (continue-run)",
    "Summary: Continues an existing run through the command boundary.",
    "Risk: medium",
    "Confirmation: required",
    "State: blocked",
    "Preconditions: Run exists.",
    "Effects: Updates run state.",
    "Reason: continue-run requires confirmation because its risk is medium."
  ]);
});

test("command view rows format ready details", () => {
  const preview = previewCommandIntent(intent, {
    ...description,
    risk: "low",
    requiresConfirmation: false,
    preconditions: [],
    effects: [],
    blockedReason: undefined
  });
  const details = buildCommandViewDetails(showCommandPreview(intent, preview));

  assert.ok(details);
  assert.deepEqual(buildCommandViewRows(details), [
    "Command: Continue run (continue-run)",
    "Summary: Continues an existing run through the command boundary.",
    "Risk: low",
    "Confirmation: not required",
    "State: ready"
  ]);
});

test("command view rows omit optional detail rows when empty", () => {
  assert.deepEqual(
    buildCommandViewRows({
      title: "Continue run (continue-run)",
      summary: "Continues an existing run through the command boundary.",
      risk: "low",
      confirmation: "not required",
      state: "ready",
      preconditions: [],
      effects: []
    }),
    [
      "Command: Continue run (continue-run)",
      "Summary: Continues an existing run through the command boundary.",
      "Risk: low",
      "Confirmation: not required",
      "State: ready"
    ]
  );
});

test("command view rows keep detail order", () => {
  const rows = buildCommandViewRows({
    title: "A",
    summary: "B",
    risk: "low",
    confirmation: "not required",
    state: "ready",
    preconditions: ["C"],
    effects: ["D"],
    reason: "E"
  });

  assert.deepEqual(rows.slice(5), ["Preconditions: C", "Effects: D", "Reason: E"]);
});

test("command view rows join multiple list values", () => {
  const rows = buildCommandViewRows({
    title: "A",
    summary: "B",
    risk: "low",
    confirmation: "not required",
    state: "ready",
    preconditions: ["C", "D"],
    effects: ["E", "F"]
  });

  assert.equal(rows[5], "Preconditions: C | D");
  assert.equal(rows[6], "Effects: E | F");
});
