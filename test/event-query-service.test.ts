import test from "node:test";
import assert from "node:assert/strict";
import type { AppEvent } from "../src/application/events/app-event.js";
import { DefaultEventQueryService } from "../src/application/queries/event-query-service.js";
import { InMemoryEventReadRepository } from "../src/application/queries/in-memory-event-read-repository.js";

const events: AppEvent[] = [
  {
    eventId: "event-1",
    occurredAt: "2026-05-20T00:00:00.000Z",
    runId: "run-1",
    commandId: "command-1",
    commandType: "start-run",
    type: "command.started"
  },
  {
    eventId: "event-2",
    occurredAt: "2026-05-20T00:00:01.000Z",
    runId: "run-1",
    type: "phase.started",
    phase: "planner"
  },
  {
    eventId: "event-3",
    occurredAt: "2026-05-20T00:00:02.000Z",
    runId: "run-2",
    type: "phase.output",
    phase: "builder",
    chunk: "builder output"
  },
  {
    eventId: "event-4",
    occurredAt: "2026-05-20T00:00:03.000Z",
    runId: "run-1",
    commandId: "command-1",
    commandType: "start-run",
    type: "command.finished",
    ok: true
  }
];

function createService(): DefaultEventQueryService {
  return new DefaultEventQueryService(new InMemoryEventReadRepository({ events }));
}

test("DefaultEventQueryService lists events in repository order", async () => {
  const service = createService();

  const result = await service.listEvents();

  assert.deepEqual(result.map((event) => event.eventId), ["event-1", "event-2", "event-3", "event-4"]);
});

test("DefaultEventQueryService filters events by run id", async () => {
  const service = createService();

  const result = await service.listEvents({ runId: "run-1" });

  assert.deepEqual(result.map((event) => event.eventId), ["event-1", "event-2", "event-4"]);
});

test("DefaultEventQueryService filters events by type", async () => {
  const service = createService();

  const result = await service.listEvents({ type: "phase.output" });

  assert.deepEqual(result.map((event) => event.eventId), ["event-3"]);
});

test("DefaultEventQueryService supports cursor and limit", async () => {
  const service = createService();

  const result = await service.listEvents({ afterEventId: "event-1", limit: 2 });

  assert.deepEqual(result.map((event) => event.eventId), ["event-2", "event-3"]);
});

test("DefaultEventQueryService treats negative limits as empty", async () => {
  const service = createService();

  const result = await service.listEvents({ limit: -1 });

  assert.deepEqual(result, []);
});
