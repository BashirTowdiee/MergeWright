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
    return `Command result: ${formatSuccessfulCommandResult(state.result)}`;
  }

  return `Command failed: ${state.result.code} ${state.result.reason}`;
}

function formatSuccessfulCommandResult(result: Extract<AppCommandResult, { readonly ok: true }>): string {
  const metadata = formatCommandResultMetadata(result);
  return metadata.length > 0 ? `${result.message} ${metadata.join(" ")}` : result.message;
}

function formatCommandResultMetadata(result: Extract<AppCommandResult, { readonly ok: true }>): readonly string[] {
  const metadata: string[] = [];

  if (result.runId) {
    metadata.push(`Run: ${result.runId}.`);
  }

  if (result.artefacts && result.artefacts.length > 0) {
    metadata.push(`Artefacts: ${result.artefacts.join(", ")}.`);
  }

  if (result.changedFiles && result.changedFiles.length > 0) {
    metadata.push(`Changed files: ${result.changedFiles.join(", ")}.`);
  }

  return metadata;
}
