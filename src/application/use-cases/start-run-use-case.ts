import type { AppCommandResult } from "../commands/app-command-result.js";
import type { StartRunCommandHandler } from "../commands/default-app-command-service.js";
import type { StartRunCommand } from "../commands/app-command.js";

export interface StartRunUseCase {
  execute(command: StartRunCommand): Promise<AppCommandResult> | AppCommandResult;
}

export class DefaultStartRunUseCase implements StartRunUseCase {
  constructor(private readonly handler?: StartRunCommandHandler) {}

  execute(command: StartRunCommand): Promise<AppCommandResult> | AppCommandResult {
    if (!command.stageName.trim()) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "VALIDATION_FAILED",
        reason: "Stage name is required."
      };
    }

    if (!command.configPath.trim()) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "VALIDATION_FAILED",
        reason: "Config path is required."
      };
    }

    if (!this.handler) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "EXECUTION_FAILED",
        reason: "Start-run handler is not configured."
      };
    }

    return this.handler(command);
  }
}
