import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import type { AppCommandResult } from "../src/application/commands/app-command-result.js";
import type { AppCommandService } from "../src/application/commands/app-command-service.js";
import { EventedAppCommandService } from "../src/application/commands/evented-app-command-service.js";
import type { CommandDescription } from "../src/application/commands/command-description.js";
import type { AppEvent } from "../src/application/events/app-event.js";
import { InMemoryAppEventBus } from "../src/application/events/app-event-bus.js";

const command: AppCommand = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-24T15:30:00.000Z",
  type: "continue-run",
  runId: "run-1"
};

const successResult: AppCommandResult = {
  ok: true,
  commandId: "cmd-1",
  type: "continue-run",
  message: "Continued run.",
  runId: "run-1",
  artefacts: ["runs/run-1/output.md"]
};

const errorResult: AppCommandResult = {
  ok: false,
  commandId: "cmd-1",
  type: "continue-run",
  code: "EXECUTION_FAILED",
  reason: "Continue failed."
};

class StubCommandService implements AppCommandService {
  readonly executeCalls: AppCommand[] = [];

  constructor(private readonly result: AppCommandResult) {}

  async describe(command: AppCommand): Promise<CommandDescription> {
    return {
      commandId: command.commandId,
      type: command.type,
      title: "Stub command",
      summary: "Stub command description.",
      risk: "none",
      requiresConfirmation: false,
      preconditions: [],
      effects: []
    };
  }

  async execute(commandToExecute: AppCommand): Promise<AppCommandResult> {
    this.executeCalls.push(commandToExecute);
    return this.result;
  }
}

test("EventedAppCommandService emits command started and finished events around execution", async () => {
  const inner = new StubCommandService(successResult);
  const eventBus = new InMemoryAppEventBus();
  const events: AppEvent[] = [];
  eventBus.subscribe((event) => {
    events.push(event);
  });
  const service = new EventedAppCommandService({
    inner,
    eventBus,
    clock: () => "2026-05-24T15:30:00.000Z",
    createEventId: (_command, type) => `event-${type}`
  });

  const result = await service.execute(command);

  assert.equal(result, successResult);
  assert.deepEqual(inner.executeCalls, [command]);
  assert.deepEqual(events, [
    {
      type: "command.started",
      eventId: "event-command.started",
      occurredAt: "2026-05-24T15:30:00.000Z",
      commandId: "cmd-1",
      commandType: "continue-run",
      runId: "run-1"
    },
    {
      type: "command.finished",
      eventId: "event-command.finished",
      occurredAt: "2026-05-24T15:30:00.000Z",
      commandId: "cmd-1",
      commandType: "continue-run",
      runId: "run-1",
      ok: true
    }
  ]);
});

test("EventedAppCommandService emits finished events when execution is not ok", async () => {
  const inner = new StubCommandService(errorResult);
  const eventBus = new InMemoryAppEventBus();
  const events: AppEvent[] = [];
  eventBus.subscribe((event) => {
    events.push(event);
  });
  const service = new EventedAppCommandService({
    inner,
    eventBus,
    clock: () => "2026-05-24T15:31:00.000Z"
  });

  const result = await service.execute(command);

  assert.equal(result, errorResult);
  assert.deepEqual(events, [
    {
      type: "command.started",
      eventId: "cmd-1:command.started",
      occurredAt: "2026-05-24T15:31:00.000Z",
      commandId: "cmd-1",
      commandType: "continue-run",
      runId: "run-1"
    },
    {
      type: "command.finished",
      eventId: "cmd-1:command.finished",
      occurredAt: "2026-05-24T15:31:00.000Z",
      commandId: "cmd-1",
      commandType: "continue-run",
      runId: "run-1",
      ok: false
    }
  ]);
});

test("EventedAppCommandService delegates describe without publishing events", async () => {
  const inner = new StubCommandService(successResult);
  const eventBus = new InMemoryAppEventBus();
  const events: AppEvent[] = [];
  eventBus.subscribe((event) => {
    events.push(event);
  });
  const service = new EventedAppCommandService({ inner, eventBus });

  const description = await service.describe(command);

  assert.equal(description.commandId, "cmd-1");
  assert.equal(description.type, "continue-run");
  assert.deepEqual(events, []);
});
