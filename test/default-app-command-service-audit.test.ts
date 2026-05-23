import test from "node:test";
import assert from "node:assert/strict";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { CommandAuditRecord } from "../src/application/commands/command-audit-record.js";
import type { AppendCommandAuditRecordRequest, CommandAuditStore } from "../src/application/commands/command-audit-store.js";

class InMemoryCommandAuditStore implements CommandAuditStore {
  readonly records: CommandAuditRecord[] = [];

  async append(request: AppendCommandAuditRecordRequest): Promise<void> {
    this.records.push(request.record);
  }
}

const baseCommand = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-23T00:00:00.000Z",
  actor: { id: "tester", displayName: "Tester" }
} as const;

test("DefaultAppCommandService audits successful command executions", async () => {
  const auditStore = new InMemoryCommandAuditStore();
  const service = new DefaultAppCommandService({
    auditStore,
    resolveRisk: () => "low",
    resolveAuditInputSummary: () => "Select a roadmap task.",
    auditClock: () => "2026-05-23T00:01:00.000Z"
  });

  const command: AppCommand = {
    ...baseCommand,
    type: "select-task",
    taskId: "task-1"
  };

  const result = await service.execute(command);

  assert.equal(result.ok, true);
  assert.equal(auditStore.records.length, 1);
  assert.deepEqual(auditStore.records[0], {
    id: "cmd-1:2026-05-23T00:01:00.000Z",
    commandId: "cmd-1",
    type: "select-task",
    source: "tui",
    actor: { id: "tester", displayName: "Tester" },
    risk: "low",
    requestedAt: "2026-05-23T00:00:00.000Z",
    recordedAt: "2026-05-23T00:01:00.000Z",
    inputSummary: "Select a roadmap task.",
    result,
    changedFiles: [],
    artefacts: []
  });
});

test("DefaultAppCommandService audits failed command executions", async () => {
  const auditStore = new InMemoryCommandAuditStore();
  const service = new DefaultAppCommandService({
    auditStore,
    resolveRisk: () => "low",
    resolveAuditInputSummary: () => "Add an empty task comment.",
    auditClock: () => "2026-05-23T00:02:00.000Z"
  });

  const command: AppCommand = {
    ...baseCommand,
    commandId: "cmd-2",
    type: "add-task-comment",
    taskId: "task-1",
    comment: "   "
  };

  const result = await service.execute(command);

  assert.equal(result.ok, false);
  assert.equal(auditStore.records.length, 1);
  assert.equal(auditStore.records[0].id, "cmd-2:2026-05-23T00:02:00.000Z");
  assert.equal(auditStore.records[0].commandId, "cmd-2");
  assert.equal(auditStore.records[0].type, "add-task-comment");
  assert.equal(auditStore.records[0].risk, "low");
  assert.equal(auditStore.records[0].inputSummary, "Add an empty task comment.");
  assert.equal(auditStore.records[0].result, result);
  assert.deepEqual(auditStore.records[0].changedFiles, []);
  assert.deepEqual(auditStore.records[0].artefacts, []);
});

test("DefaultAppCommandService still executes without an audit store", async () => {
  const service = new DefaultAppCommandService();
  const command: AppCommand = {
    ...baseCommand,
    type: "select-task",
    taskId: "task-1"
  };

  const result = await service.execute(command);

  assert.equal(result.ok, true);
});
