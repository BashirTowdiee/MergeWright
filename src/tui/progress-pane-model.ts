import type { AppEvent } from "../application/events/app-event.js";

export type ProgressPaneModel = {
  readonly title: string;
  readonly rows: readonly string[];
};

export function buildProgressPaneModel(events: readonly AppEvent[]): ProgressPaneModel {
  return {
    title: "Progress",
    rows: events.length === 0 ? ["No progress events received."] : events.map(formatProgressEvent)
  };
}

export function formatProgressEvent(event: AppEvent): string {
  const run = event.runId ? ` run=${event.runId}` : "";

  switch (event.type) {
    case "command.started":
      return `${event.occurredAt} command started ${event.commandType ?? "unknown"}${run}`;
    case "command.finished":
      return `${event.occurredAt} command finished ${event.commandType ?? "unknown"} ok=${event.ok}${run}`;
    case "phase.started":
      return `${event.occurredAt} phase started ${event.phase}${run}`;
    case "phase.finished":
      return `${event.occurredAt} phase finished ${event.phase} ok=${event.ok}${run}`;
    case "phase.output":
      return `${event.occurredAt} phase output ${event.phase}${run}: ${event.chunk}`;
  }
}
