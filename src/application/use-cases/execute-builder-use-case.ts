import type { ExecuteBuilderCommand } from "../commands/app-command.js";
import type { AppCommandResult } from "../commands/app-command-result.js";

export type ExecuteBuilderUseCaseHandler = (command: ExecuteBuilderCommand) => Promise<AppCommandResult> | AppCommandResult;

export interface ExecuteBuilderUseCase {
  execute(command: ExecuteBuilderCommand): Promise<AppCommandResult> | AppCommandResult;
}

export class DefaultExecuteBuilderUseCase implements ExecuteBuilderUseCase {
  constructor(private readonly handler?: ExecuteBuilderUseCaseHandler) {}

  execute(command: ExecuteBuilderCommand): Promise<AppCommandResult> | AppCommandResult {
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
        reason: "Execute-builder handler is not configured."
      };
    }

    return this.handler(command);
  }
}
