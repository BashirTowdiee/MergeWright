import type { AppCommand, AppCommandType } from "./app-command.js";
import type { CommandRisk } from "./command-risk.js";
import { requiresConfirmationForRisk } from "./command-risk.js";

export type ConfirmationRequirement = {
  readonly required: boolean;
  readonly reason?: string;
};

export type CommandConfirmationState =
  | { readonly status: "not_required" }
  | {
      readonly status: "required";
      readonly commandId: string;
      readonly commandType: AppCommandType;
      readonly risk: CommandRisk;
      readonly satisfied: boolean;
      readonly reason: string;
    };

export function getConfirmationRequirement(command: AppCommand, risk: CommandRisk): ConfirmationRequirement {
  const state = getCommandConfirmationState(command, risk);

  if (state.status === "not_required" || state.satisfied) {
    return { required: false };
  }

  return {
    required: true,
    reason: state.reason
  };
}

export function getCommandConfirmationState(command: AppCommand, risk: CommandRisk): CommandConfirmationState {
  if (!requiresConfirmationForRisk(risk)) {
    return { status: "not_required" };
  }

  const satisfied = command.type === "approve-stage" && command.confirmationToken !== undefined;

  return {
    status: "required",
    commandId: command.commandId,
    commandType: command.type,
    risk,
    satisfied,
    reason: `${command.type} requires confirmation because its risk is ${risk}.`
  };
}
