import type { UpdateCoordinationNoteCommand } from "../commands/app-command.js";
import type { AppCommandResult } from "../commands/app-command-result.js";

export interface UpdateCoordinationNoteUseCase {
  execute(command: UpdateCoordinationNoteCommand): Promise<AppCommandResult> | AppCommandResult;
}

export class DefaultUpdateCoordinationNoteUseCase implements UpdateCoordinationNoteUseCase {
  execute(command: UpdateCoordinationNoteCommand): AppCommandResult {
    const note = command.note.trim();
    if (!note) {
      return {
        ok: false,
        commandId: command.commandId,
        type: command.type,
        code: "VALIDATION_FAILED",
        reason: "Coordination note is required."
      };
    }

    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: "Coordination note accepted for service handling.",
      changedFiles: []
    };
  }
}
