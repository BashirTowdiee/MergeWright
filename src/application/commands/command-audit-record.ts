import type { AppCommand, AppCommandType } from "./app-command.js";
import type { AppCommandResult } from "./app-command-result.js";
import type { CommandActor, CommandSource } from "./command-source.js";
import type { CommandRisk } from "./command-risk.js";
import type { CommandConfirmationState } from "./confirmation.js";

export type CommandAuditRecord = {
  readonly id: string;
  readonly commandId: string;
  readonly type: AppCommandType;
  readonly source: CommandSource;
  readonly actor?: CommandActor;
  readonly risk: CommandRisk;
  readonly confirmation: CommandConfirmationState;
  readonly requestedAt: string;
  readonly recordedAt: string;
  readonly inputSummary: string;
  readonly result: AppCommandResult;
  readonly changedFiles: readonly string[];
  readonly artefacts: readonly string[];
};

export type CreateCommandAuditRecordInput = {
  readonly command: AppCommand;
  readonly risk: CommandRisk;
  readonly confirmation: CommandConfirmationState;
  readonly inputSummary: string;
  readonly result: AppCommandResult;
  readonly recordedAt: string;
  readonly id?: string;
};

export function createCommandAuditRecord(input: CreateCommandAuditRecordInput): CommandAuditRecord {
  const changedFiles = input.result.ok ? input.result.changedFiles ?? [] : [];
  const artefacts = input.result.ok ? input.result.artefacts ?? [] : [];

  return {
    id: input.id ?? `${input.command.commandId}:${input.recordedAt}`,
    commandId: input.command.commandId,
    type: input.command.type,
    source: input.command.source,
    actor: input.command.actor,
    risk: input.risk,
    confirmation: input.confirmation,
    requestedAt: input.command.requestedAt,
    recordedAt: input.recordedAt,
    inputSummary: input.inputSummary,
    result: input.result,
    changedFiles,
    artefacts
  };
}