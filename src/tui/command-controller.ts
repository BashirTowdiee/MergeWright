import type { AppCommandResult } from "../application/commands/app-command-result.js";
import type { AppCommandService } from "../application/commands/app-command-service.js";
import { createCommandConfirmationToken } from "./command-confirmation-state.js";
import { previewCommandIntent, type TuiCommandIntent, type TuiCommandOutcome, type TuiCommandPreview, type TuiCommandSubmission } from "./write-model.js";

export type TuiCommandControllerOptions = {
  readonly commandService: AppCommandService;
};

export class TuiCommandController {
  private readonly commandService: AppCommandService;

  constructor(options: TuiCommandControllerOptions) {
    this.commandService = options.commandService;
  }

  async preview(intent: TuiCommandIntent): Promise<TuiCommandPreview> {
    const description = await this.commandService.describe(intent.command);
    return previewCommandIntent(intent, description);
  }

  async submit(submission: TuiCommandSubmission): Promise<TuiCommandOutcome> {
    const description = await this.commandService.describe(submission.command);

    if (description.blockedReason) {
      return {
        intentId: submission.intentId,
        result: createBlockedCommandResult(submission, description.blockedReason)
      };
    }

    if (description.requiresConfirmation) {
      const expectedToken = createCommandConfirmationToken({ intentId: submission.intentId, commandType: submission.command.type });

      if (submission.confirmationToken !== expectedToken) {
        return {
          intentId: submission.intentId,
          result: {
            ok: false,
            commandId: submission.command.commandId,
            type: submission.command.type,
            code: "CONFIRMATION_REQUIRED",
            reason: `Confirmation token required: ${expectedToken}`
          }
        };
      }
    }

    const result = await this.commandService.execute(submission.command);
    return {
      intentId: submission.intentId,
      result
    };
  }
}

function createBlockedCommandResult(submission: TuiCommandSubmission, reason: string): AppCommandResult {
  return {
    ok: false,
    commandId: submission.command.commandId,
    type: submission.command.type,
    code: "VALIDATION_FAILED",
    reason
  };
}
