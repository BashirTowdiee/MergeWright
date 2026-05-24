import type { AppEventBus } from "../events/app-event-bus.js";
import type { AppCommand } from "./app-command.js";
import type { AppCommandResult } from "./app-command-result.js";
import type { AppCommandExecutionOptions, AppCommandService } from "./app-command-service.js";
import type { CommandDescription } from "./command-description.js";

export type CommandEventClock = () => string;
export type CommandEventIdFactory = (command: AppCommand, eventType: "command.started" | "command.finished") => string;

export type EventedAppCommandServiceOptions = {
  readonly inner: AppCommandService;
  readonly eventBus: AppEventBus;
  readonly clock?: CommandEventClock;
  readonly createEventId?: CommandEventIdFactory;
};

export class EventedAppCommandService implements AppCommandService {
  private readonly inner: AppCommandService;
  private readonly eventBus: AppEventBus;
  private readonly clock: CommandEventClock;
  private readonly createEventId: CommandEventIdFactory;

  constructor(options: EventedAppCommandServiceOptions) {
    this.inner = options.inner;
    this.eventBus = options.eventBus;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.createEventId = options.createEventId ?? defaultCommandEventId;
  }

  describe(command: AppCommand): Promise<CommandDescription> {
    return this.inner.describe(command);
  }

  async execute(command: AppCommand, options?: AppCommandExecutionOptions): Promise<AppCommandResult> {
    await this.eventBus.publish({
      type: "command.started",
      eventId: this.createEventId(command, "command.started"),
      occurredAt: this.clock(),
      commandId: command.commandId,
      commandType: command.type,
      runId: getCommandRunId(command)
    });

    const result = await this.inner.execute(command, options);

    await this.eventBus.publish({
      type: "command.finished",
      eventId: this.createEventId(command, "command.finished"),
      occurredAt: this.clock(),
      commandId: command.commandId,
      commandType: command.type,
      runId: result.ok ? result.runId ?? getCommandRunId(command) : getCommandRunId(command),
      ok: result.ok
    });

    return result;
  }
}

function defaultCommandEventId(command: AppCommand, eventType: "command.started" | "command.finished"): string {
  return `${command.commandId}:${eventType}`;
}

function getCommandRunId(command: AppCommand): string | undefined {
  return "runId" in command ? command.runId : undefined;
}
