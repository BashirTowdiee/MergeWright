import type { AppCommandType } from "../commands/app-command.js";

export type AppEventBase = {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly runId?: string;
  readonly commandId?: string;
  readonly commandType?: AppCommandType;
};

export type CommandStartedEvent = AppEventBase & {
  readonly type: "command.started";
};

export type CommandFinishedEvent = AppEventBase & {
  readonly type: "command.finished";
  readonly ok: boolean;
};

export type PhaseStartedEvent = AppEventBase & {
  readonly type: "phase.started";
  readonly phase: string;
};

export type PhaseFinishedEvent = AppEventBase & {
  readonly type: "phase.finished";
  readonly phase: string;
  readonly ok: boolean;
};

export type PhaseOutputEvent = AppEventBase & {
  readonly type: "phase.output";
  readonly phase: string;
  readonly chunk: string;
};

export type AppEvent = CommandStartedEvent | CommandFinishedEvent | PhaseStartedEvent | PhaseFinishedEvent | PhaseOutputEvent;

export type AppEventType = AppEvent["type"];
