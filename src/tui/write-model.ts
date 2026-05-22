import type { AppCommand, AppCommandType } from "../application/commands/app-command.js";
import type { AppCommandResult } from "../application/commands/app-command-result.js";
import type { CommandDescription } from "../application/commands/command-description.js";
import type { CommandRisk } from "../application/commands/command-risk.js";

export type TuiCommandIntent = {
  readonly id: string;
  readonly type: AppCommandType;
  readonly label: string;
  readonly command: AppCommand;
};

export type TuiCommandPreview = {
  readonly intentId: string;
  readonly description: CommandDescription;
  readonly risk: CommandRisk;
  readonly canSubmit: boolean;
  readonly requiresConfirmation: boolean;
  readonly blockedReason?: string;
};

export type TuiCommandSubmission = {
  readonly intentId: string;
  readonly command: AppCommand;
  readonly confirmationToken?: string;
};

export type TuiCommandOutcome = {
  readonly intentId: string;
  readonly result: AppCommandResult;
};

export function previewCommandIntent(intent: TuiCommandIntent, description: CommandDescription): TuiCommandPreview {
  return {
    intentId: intent.id,
    description,
    risk: description.risk,
    canSubmit: description.blockedReason === undefined && !description.requiresConfirmation,
    requiresConfirmation: description.requiresConfirmation,
    blockedReason: description.blockedReason
  };
}
