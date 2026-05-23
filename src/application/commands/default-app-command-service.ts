import type { AppCommand } from "./app-command.js";
import type { AppCommandResult } from "./app-command-result.js";
import type { AppCommandService } from "./app-command-service.js";
import { describeCommand } from "./command-description.js";
import type { CommandDescription } from "./command-description.js";
import type { CommandRisk } from "./command-risk.js";

export type CommandRiskResolver = (command: AppCommand) => CommandRisk;

export type DefaultAppCommandServiceOptions = {
  readonly resolveRisk?: CommandRiskResolver;
};

const DEFAULT_RISK: CommandRisk = "none";

export class DefaultAppCommandService implements AppCommandService {
  private readonly resolveRisk: CommandRiskResolver;

  constructor(options: DefaultAppCommandServiceOptions = {}) {
    this.resolveRisk = options.resolveRisk ?? (() => DEFAULT_RISK);
  }

  async describe(command: AppCommand): Promise<CommandDescription> {
    return describeCommand(command, this.resolveRisk(command));
  }

  async execute(command: AppCommand): Promise<AppCommandResult> {
    if (command.type === "select-task") {
      return executeSelectTask(command);
    }

    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "EXECUTION_FAILED",
      reason: "Command execution is not wired yet."
    };
  }
}

function executeSelectTask(command: Extract<AppCommand, { readonly type: "select-task" }>): AppCommandResult {
  const taskId = command.taskId.trim();
  if (!taskId) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Task ID is required."
    };
  }

  return {
    ok: true,
    commandId: command.commandId,
    type: command.type,
    message: `Selected task ${taskId}.`
  };
}
