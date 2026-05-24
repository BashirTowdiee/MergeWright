import test from "node:test";
import assert from "node:assert/strict";
import type { AppEvent } from "../src/application/events/app-event.js";
import { InMemoryAppEventBus } from "../src/application/events/app-event-bus.js";

const commandStartedEvent: AppEvent = {
  type: "command.started",
  eventId: "event-1",
  occurredAt: "2026-05-24T14:45:00.000Z",
  commandId: "cmd-1",
  commandType: "start-run",
  runId: "run-1"
};

const phaseOutputEvent: AppEvent = {
  type: "phase.output",
  eventId: "event-2",
  occurredAt: "2026-05-24T14:45:01.000Z",
  commandId: "cmd-1",
  commandType: "start-run",
  runId: "run-1",
  phase: "planner",
  chunk: "Planner produced task list."
};

test("InMemoryAppEventBus publishes typed events to all subscribers", async () => {
  const bus = new InMemoryAppEventBus();
  const firstSubscriberEvents: AppEvent[] = [];
  const secondSubscriberEvents: AppEvent[] = [];

  bus.subscribe((event) => {
    firstSubscriberEvents.push(event);
  });
  bus.subscribe(async (event) => {
    secondSubscriberEvents.push(event);
  });

  await bus.publish(commandStartedEvent);
  await bus.publish(phaseOutputEvent);

  assert.deepEqual(firstSubscriberEvents, [commandStartedEvent, phaseOutputEvent]);
  assert.deepEqual(secondSubscriberEvents, [commandStartedEvent, phaseOutputEvent]);
});

test("InMemoryAppEventBus stops publishing to unsubscribed listeners", async () => {
  const bus = new InMemoryAppEventBus();
  const events: AppEvent[] = [];
  const subscription = bus.subscribe((event) => {
    events.push(event);
  });

  await bus.publish(commandStartedEvent);
  subscription.unsubscribe();
  await bus.publish(phaseOutputEvent);

  assert.deepEqual(events, [commandStartedEvent]);
});
