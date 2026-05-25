import type { SelectTaskCommand } from "../commands/app-command.js";
import type { AppCommandResult } from "../commands/app-command-result.js";

export interface SelectTaskUseCase {
  execute(command: SelectTaskCommand): Promise<AppCommandResult> | AppCommandResult;
}

export class DefaultSelectTaskUseCase implements SelectTaskUseCase {
  execute(command: SelectTaskCommand): AppCommandResult {
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
}
