import type { AppCommand } from "./app-command.js";
import type { AppCommandResult } from "./app-command-result.js";
import type { AppCommandExecutionOptions, AppCommandService } from "./app-command-service.js";
import { createCommandAuditRecord } from "./command-audit-record.js";
import type { CommandAuditStore } from "./command-audit-store.js";
import { describeCommand } from "./command-description.js";
import type { CommandDescription } from "./command-description.js";
import type { CommandRisk } from "./command-risk.js";
import { getCommandConfirmationState } from "./confirmation.js";
import type { CommandConfirmationState } from "./confirmation.js";

export type CommandRiskResolver = (command: AppCommand) => CommandRisk;
export type CommandAuditInputSummaryResolver = (command: AppCommand) => string;
export type CommandAuditClock = () => string;

export type DefaultAppCommandServiceOptions = {
  readonly resolveRisk?: CommandRiskResolver;
  readonly auditStore?: CommandAuditStore;
  readonly resolveAuditInputSummary?: CommandAuditInputSummaryResolver;
  readonly auditClock?: CommandAuditClock;
};

const DEFAULT_RISK: CommandRisk = "none";

export class DefaultAppCommandService implements AppCommandService {
  private readonly resolveRisk: CommandRiskResolver;
  private readonly auditStore?: CommandAuditStore;
  private readonly resolveAuditInputSummary: CommandAuditInputSummaryResolver;
  private readonly auditClock: CommandAuditClock;

  constructor(options: DefaultAppCommandServiceOptions = {}) {
    this.resolveRisk = options.resolveRisk ?? (() => DEFAULT_RISK);
    this.auditStore = options.auditStore;
    this.resolveAuditInputSummary = options.resolveAuditInputSummary ?? defaultAuditInputSummary;
    this.auditClock = options.auditClock ?? (() => new Date().toISOString());
  }

  async describe(command: AppCommand): Promise<CommandDescription> {
    return describeCommand(command, this.resolveRisk(command));
  }

  async execute(command: AppCommand, options: AppCommandExecutionOptions = {}): Promise<AppCommandResult> {
    const risk = this.resolveRisk(command);
    const confirmation = getCommandConfirmationState(command, risk);
    const result = getConfirmationFailure(command, confirmation, options) ?? executeCommand(command);
    await this.audit(command, risk, confirmation, result);
    return result;
  }

  private async audit(command: AppCommand, risk: CommandRisk, confirmation: CommandConfirmationState, result: AppCommandResult): Promise<void> {
    if (!this.auditStore) {
      return;
    }

    await this.auditStore.append({
      record: createCommandAuditRecord({
        command,
        risk,
        confirmation,
        inputSummary: this.resolveAuditInputSummary(command),
        result,
        recordedAt: this.auditClock()
      })
    });
  }
}

function getConfirmationFailure(
  command: AppCommand,
  confirmation: CommandConfirmationState,
  options: AppCommandExecutionOptions
): AppCommandResult | undefined {
  if (confirmation.status === "not_required" || confirmation.satisfied) {
    return undefined;
  }

  if (options.confirmationContextId !== undefined || options.confirmationToken !== undefined) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "CONFIRMATION_REQUIRED",
      reason: confirmation.reason,
      details: {
        confirmationContextId: options.confirmationContextId,
        confirmationToken: options.confirmationToken
      }
    };
  }

  return {
    ok: false,
    commandId: command.commandId,
    type: command.type,
    code: "CONFIRMATION_REQUIRED",
    reason: confirmation.reason
  };
}

function executeCommand(command: AppCommand): AppCommandResult {
  if (command.type === "select-task") {
    return executeSelectTask(command);
  }

  if (command.type === "update-coordination-note") {
    return executeUpdateCoordinationNote(command);
  }

  if (command.type === "mark-task-reviewed") {
    return executeMarkTaskReviewed(command);
  }

  if (command.type === "add-task-comment") {
    return executeAddTaskComment(command);
  }

  return {
    ok: false,
    commandId: command.commandId,
    type: command.type,
    code: "EXECUTION_FAILED",
    reason: "Command execution is not wired yet."
  };
}

function defaultAuditInputSummary(command: AppCommand): string {
  return command.type;
}

function executeSelectTask(command: Extract<AppCommand, { readonly type: "select-task" }>): AppCommandResult {
  const taskId = command.taskId.trim();
  if (!taskId) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Task ID is required."
    };
  }

  return {
    ok: true,
    commandId: command.commandId,
    type: command.type,
    message: `Selected task ${taskId}.`
  };
}

function executeUpdateCoordinationNote(command: Extract<AppCommand, { readonly type: "update-coordination-note" }>): AppCommandResult {
  const note = command.note.trim();
  if (!note) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Coordination note is required."
    };
  }

  return {
    ok: true,
    commandId: command.commandId,
    type: command.type,
    message: "Coordination note accepted for service handling.",
    changedFiles: []
  };
}

function executeMarkTaskReviewed(command: Extract<AppCommand, { readonly type: "mark-task-reviewed" }>): AppCommandResult {
  const taskId = command.taskId.trim();
  if (!taskId) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Task ID is required."
    };
  }

  if (!command.reviewedAt.trim() || Number.isNaN(Date.parse(command.reviewedAt))) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Reviewed-at timestamp must be a valid date."
    };
  }

  return {
    ok: true,
    commandId: command.commandId,
    type: command.type,
    message: `Marked task ${taskId} reviewed.`,
    changedFiles: []
  };
}

function executeAddTaskComment(command: Extract<AppCommand, { readonly type: "add-task-comment" }>): AppCommandResult {
  const taskId = command.taskId.trim();
  if (!taskId) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Task ID is required."
    };
  }

  const comment = command.comment.trim();
  if (!comment) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Task comment is required."
    };
  }

  return {
    ok: true,
    commandId: command.commandId,
    type: command.type,
    message: `Comment accepted for task ${taskId}.`,
    changedFiles: []
  };
}