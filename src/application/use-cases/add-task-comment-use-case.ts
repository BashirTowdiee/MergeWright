import type { AddTaskCommentCommand } from "../commands/app-command.js";
import type { AppCommandResult } from "../commands/app-command-result.js";

export interface AddTaskCommentUseCase {
  execute(command: AddTaskCommentCommand): Promise<AppCommandResult> | AppCommandResult;
}

export class DefaultAddTaskCommentUseCase implements AddTaskCommentUseCase {
  execute(command: AddTaskCommentCommand): AppCommandResult {
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

    const comment = command.comment.trim();
    if (!comment) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "VALIDATION_FAILED",
        reason: "Task comment is required."
      };
    }

    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: `Comment accepted for task ${taskId}.`,
      changedFiles: []
    };
  }
}
