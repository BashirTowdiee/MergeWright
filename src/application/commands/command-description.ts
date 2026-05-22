import type { AppCommand, AppCommandType } from "./app-command.js";
import { getCommandMetadata } from "./command-metadata.js";
import type { CommandRisk } from "./command-risk.js";
import { getConfirmationRequirement } from "./confirmation.js";

export type CommandDescription = {
  readonly commandId: string;
  readonly type: AppCommandType;
  readonly title: string;
  readonly summary: string;
  readonly risk: CommandRisk;
  readonly requiresConfirmation: boolean;
  readonly preconditions: readonly string[];
  readonly effects: readonly string[];
  readonly blockedReason?: string;
};

export function describeCommand(command: AppCommand, risk: CommandRisk): CommandDescription {
  const confirmation = getConfirmationRequirement(command, risk);
  const metadata = getCommandMetadata(command.type);

  return {
    commandId: command.commandId,
    type: command.type,
    title: metadata.title,
    summary: metadata.summary,
    risk,
    requiresConfirmation: confirmation.required,
    preconditions: metadata.preconditions,
    effects: metadata.effects,
    blockedReason: confirmation.reason
  };
}
