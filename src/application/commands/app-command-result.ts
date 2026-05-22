import type { AppCommandType } from "./app-command.js";
import type { AppCommandError } from "./app-command-error.js";

export type AppCommandSuccessResult = {
  readonly ok: true;
  readonly commandId: string;
  readonly type: AppCommandType;
  readonly message: string;
  readonly changedFiles?: readonly string[];
  readonly artefacts?: readonly string[];
  readonly runId?: string;
  readonly stageId?: string;
  readonly warnings?: readonly string[];
};

export type AppCommandFailureResult = AppCommandError & {
  readonly ok: false;
  readonly commandId: string;
  readonly type: AppCommandType;
};

export type AppCommandResult = AppCommandSuccessResult | AppCommandFailureResult;

export function isAppCommandSuccess(result: AppCommandResult): result is AppCommandSuccessResult {
  return result.ok;
}

export function isAppCommandFailure(result: AppCommandResult): result is AppCommandFailureResult {
  return !result.ok;
}
