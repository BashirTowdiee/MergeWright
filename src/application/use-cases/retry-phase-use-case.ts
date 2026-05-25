import type { RetryPhaseCommand } from "../commands/app-command.js";
import type { AppCommandResult } from "../commands/app-command-result.js";

export type RetryPhaseUseCaseHandler = (command: RetryPhaseCommand) => Promise<AppCommandResult> | AppCommandResult;

export interface RetryPhaseUseCase {
  execute(command: RetryPhaseCommand): Promise<AppCommandResult> | AppCommandResult;
}

export class DefaultRetryPhaseUseCase implements RetryPhaseUseCase {
  constructor(private readonly handler?: RetryPhaseUseCaseHandler) {}

  execute(command: RetryPhaseCommand): Promise<AppCommandResult> | AppCommandResult {
    if (!command.runId.trim()) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "VALIDATION_FAILED",
        reason: "Run ID is required."
      };
    }

    if (command.phase !== "reviewer") {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "VALIDATION_FAILED",
        reason: "Only reviewer retry-phase commands are currently supported."
      };
    }

    if (!this.handler) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "EXECUTION_FAILED",
        reason: "Retry-phase handler is not configured."
      };
    }

    return this.handler(command);
  }
}
