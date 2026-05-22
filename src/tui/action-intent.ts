import type { AppCommandType } from "../application/commands/app-command.js";
import { getCommandMetadata } from "../application/commands/command-metadata.js";
import type { SafeActionId, SafeActionViewModel } from "./view-models.js";

const SAFE_ACTION_COMMAND_TYPES: Partial<Record<SafeActionId, AppCommandType>> = {
  continue: "continue-run",
  "rerun-reviewer": "retry-phase"
};

export function getSafeActionCommandType(action: SafeActionViewModel | undefined): AppCommandType | undefined {
  return action ? SAFE_ACTION_COMMAND_TYPES[action.id] : undefined;
}

export function describeSafeActionIntent(action: SafeActionViewModel | undefined): string {
  if (!action) {
    return "No safe action selected.";
  }

  if (!action.enabled) {
    return `Blocked: ${action.blockedReason ?? `${action.label} is not available for this run.`}`;
  }

  const confirmation = action.requiresConfirmation ? " Requires confirmation." : "";
  const commandType = getSafeActionCommandType(action);

  if (!commandType) {
    return `Preview only: ${action.label} would run later as a ${action.risk}-risk action.${confirmation}`;
  }

  const metadata = getCommandMetadata(commandType);
  const preconditions = metadata.preconditions.length > 0 ? ` Preconditions: ${metadata.preconditions.join(" ")}` : "";
  const effects = metadata.effects.length > 0 ? ` Effects: ${metadata.effects.join(" ")}` : "";

  return `Preview only: ${metadata.title} (${metadata.type}) would use the command boundary as a ${metadata.defaultRisk}-risk action. ${metadata.summary}${confirmation}${preconditions}${effects}`;
}
