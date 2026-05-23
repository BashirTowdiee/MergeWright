import type { AppCommandService } from "../application/commands/app-command-service.js";
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
    const result = await this.commandService.execute(submission.command);
    return {
      intentId: submission.intentId,
      result
    };
  }
}
