import test from "node:test";
import assert from "node:assert/strict";
import { buildSelectTaskIntent } from "../src/tui/select-task-intent.js";

test("buildSelectTaskIntent maps a selected task to one AppCommand intent", () => {
  const intent = buildSelectTaskIntent({
    taskId: "task-1",
    label: "Select task 1",
    requestedAt: "2026-05-23T12:40:00.000Z",
    actor: { id: "tester", displayName: "Tester" }
  });

  assert.deepEqual(intent, {
    id: "select-task:task-1",
    type: "select-task",
    label: "Select task 1",
    command: {
      commandId: "tui-select-task-task-1",
      source: "tui",
      actor: { id: "tester", displayName: "Tester" },
      requestedAt: "2026-05-23T12:40:00.000Z",
      type: "select-task",
      taskId: "task-1"
    }
  });
});

test("buildSelectTaskIntent supports anonymous TUI task selection", () => {
  const intent = buildSelectTaskIntent({
    taskId: "task-2",
    label: "Select task 2",
    requestedAt: "2026-05-23T12:41:00.000Z"
  });

  assert.equal(intent.id, "select-task:task-2");
  assert.equal(intent.type, "select-task");
  assert.equal(intent.command.type, "select-task");
  assert.equal(intent.command.source, "tui");
  assert.equal(intent.command.taskId, "task-2");
  assert.equal(intent.command.actor, undefined);
});
