import test from "node:test";
import assert from "node:assert/strict";
import type { AppEvent } from "../src/application/events/app-event.js";
import { buildProgressPaneModel, formatProgressEvent } from "../src/tui/progress-pane-model.js";

const commandStarted: AppEvent = {
  type: "command.started",
  eventId: "event-1",
  occurredAt: "2026-05-24T16:00:00.000Z",
  commandId: "cmd-1",
  commandType: "continue-run",
  runId: "run-1"
};

const commandFinished: AppEvent = {
  type: "command.finished",
  eventId: "event-2",
  occurredAt: "2026-05-24T16:00:01.000Z",
  commandId: "cmd-1",
  commandType: "continue-run",
  runId: "run-1",
  ok: true
};

const phaseStarted: AppEvent = {
  type: "phase.started",
  eventId: "event-3",
  occurredAt: "2026-05-24T16:00:02.000Z",
  runId: "run-1",
  phase: "planner"
};

const phaseFinished: AppEvent = {
  type: "phase.finished",
  eventId: "event-4",
  occurredAt: "2026-05-24T16:00:03.000Z",
  runId: "run-1",
  phase: "planner",
  ok: false
};

const phaseOutput: AppEvent = {
  type: "phase.output",
  eventId: "event-5",
  occurredAt: "2026-05-24T16:00:04.000Z",
  runId: "run-1",
  phase: "planner",
  chunk: "Planner emitted progress."
};

test("progress pane model shows an empty-state row", () => {
  assert.deepEqual(buildProgressPaneModel([]), {
    title: "Progress",
    rows: ["No progress events received."]
  });
});

test("progress pane model formats typed progress events", () => {
  assert.deepEqual(buildProgressPaneModel([commandStarted, commandFinished, phaseStarted, phaseFinished, phaseOutput]), {
    title: "Progress",
    rows: [
      "2026-05-24T16:00:00.000Z command started continue-run run=run-1",
      "2026-05-24T16:00:01.000Z command finished continue-run ok=true run=run-1",
      "2026-05-24T16:00:02.000Z phase started planner run=run-1",
      "2026-05-24T16:00:03.000Z phase finished planner ok=false run=run-1",
      "2026-05-24T16:00:04.000Z phase output planner run=run-1: Planner emitted progress."
    ]
  });
});

test("progress event formatting handles missing command type and run id", () => {
  assert.equal(
    formatProgressEvent({
      type: "command.started",
      eventId: "event-6",
      occurredAt: "2026-05-24T16:00:05.000Z",
      commandId: "cmd-2"
    }),
    "2026-05-24T16:00:05.000Z command started unknown"
  );
});
