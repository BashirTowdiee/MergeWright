import type { AppCommandResult } from "../application/commands/app-command-result.js";

export type TuiCommandResultState =
  | { readonly status: "idle" }
  | { readonly status: "completed"; readonly intentId: string; readonly result: AppCommandResult };

export function createIdleCommandResultState(): TuiCommandResultState {
  return { status: "idle" };
}

export function showCommandResult(intentId: string, result: AppCommandResult): TuiCommandResultState {
  return { status: "completed", intentId, result };
}

export function clearCommandResult(): TuiCommandResultState {
  return createIdleCommandResultState();
}

export function formatCommandResultNotice(state: TuiCommandResultState): string {
  if (state.status === "idle") {
    return "No command result selected.";
  }

  if (state.result.ok) {
    return `Command result: ${state.result.message}`;
  }

  return `Command failed: ${state.result.code} ${state.result.reason}`;
}
