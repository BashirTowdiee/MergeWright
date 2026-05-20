import type { SafeActionViewModel } from "./view-models.js";

export function describeSafeActionIntent(action: SafeActionViewModel | undefined): string {
  if (!action) {
    return "No safe action selected.";
  }

  if (!action.enabled) {
    return `Blocked: ${action.blockedReason ?? `${action.label} is not available for this run.`}`;
  }

  const confirmation = action.requiresConfirmation ? " Requires confirmation." : "";
  return `Preview only: ${action.label} would run later as a ${action.risk}-risk action.${confirmation}`;
}
