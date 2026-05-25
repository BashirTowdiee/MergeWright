import type { ContinueRunCommand } from "../commands/app-command.js";
import type { AppCommandResult } from "../commands/app-command-result.js";

export type ContinueRunUseCaseHandler = (command: ContinueRunCommand) => Promise<AppCommandResult> | AppCommandResult;

export interface ContinueRunUseCase {
  execute(command: ContinueRunCommand): Promise<AppCommandResult> | AppCommandResult;
}

export class DefaultContinueRunUseCase implements ContinueRunUseCase {
  constructor(private readonly handler?: ContinueRunUseCaseHandler) {}

  execute(command: ContinueRunCommand): Promise<AppCommandResult> | AppCommandResult {
    if (!command.runId.trim()) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "VALIDATION_FAILED",
        reason: "Run ID is required."
      };
    }

    if (!this.handler) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "EXECUTION_FAILED",
        reason: "Continue-run handler is not configured."
      };
    }

    return this.handler(command);
  }
}
