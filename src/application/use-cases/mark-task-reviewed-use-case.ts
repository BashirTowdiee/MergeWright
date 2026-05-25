import type { MarkTaskReviewedCommand } from "../commands/app-command.js";
import type { AppCommandResult } from "../commands/app-command-result.js";

export interface MarkTaskReviewedUseCase {
  execute(command: MarkTaskReviewedCommand): Promise<AppCommandResult> | AppCommandResult;
}

export class DefaultMarkTaskReviewedUseCase implements MarkTaskReviewedUseCase {
  execute(command: MarkTaskReviewedCommand): AppCommandResult {
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

    if (!command.reviewedAt.trim() || Number.isNaN(Date.parse(command.reviewedAt))) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "VALIDATION_FAILED",
        reason: "Reviewed-at timestamp must be a valid date."
      };
    }

    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: `Marked task ${taskId} reviewed.`,
      changedFiles: []
    };
  }
}
