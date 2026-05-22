import type { AppCommand } from "./app-command.js";
import type { CommandRisk } from "./command-risk.js";
import { requiresConfirmationForRisk } from "./command-risk.js";

export type ConfirmationRequirement = {
  readonly required: boolean;
  readonly reason?: string;
};

export function getConfirmationRequirement(command: AppCommand, risk: CommandRisk): ConfirmationRequirement {
  if (!requiresConfirmationForRisk(risk)) {
    return { required: false };
  }

  if (command.type === "approve-stage" && command.confirmationToken !== undefined) {
    return { required: false };
  }

  return {
    required: true,
    reason: `${command.type} requires confirmation because its risk is ${risk}.`
  };
}
