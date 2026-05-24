import type { AppCommand } from "./app-command.js";
import type { AppCommandResult } from "./app-command-result.js";
import type { AppCommandExecutionOptions, AppCommandService } from "./app-command-service.js";
import { createCommandAuditRecord } from "./command-audit-record.js";
import type { CommandAuditStore } from "./command-audit-store.js";
import { describeCommand } from "./command-description.js";
import type { CommandDescription } from "./command-description.js";
import { getCommandMetadata } from "./command-metadata.js";
import type { CommandRisk } from "./command-risk.js";
import { getCommandConfirmationState } from "./confirmation.js";
import type { CommandConfirmationState } from "./confirmation.js";

export type CommandRiskResolver = (command: AppCommand) => CommandRisk;
export type CommandAuditInputSummaryResolver = (command: AppCommand) => string;
export type CommandAuditClock = () => string;
export type StartRunCommandHandler = (command: Extract<AppCommand, { readonly type: "start-run" }>) => Promise<AppCommandResult> | AppCommandResult;
export type ContinueRunCommandHandler = (command: Extract<AppCommand, { readonly type: "continue-run" }>) => Promise<AppCommandResult> | AppCommandResult;
export type RetryPhaseCommandHandler = (command: Extract<AppCommand, { readonly type: "retry-phase" }>) => Promise<AppCommandResult> | AppCommandResult;
export type ExecuteBuilderCommandHandler = (command: Extract<AppCommand, { readonly type: "execute-builder" }>) => Promise<AppCommandResult> | AppCommandResult;

export type DefaultAppCommandServiceOptions = {
  readonly resolveRisk?: CommandRiskResolver;
  readonly auditStore?: CommandAuditStore;
  readonly resolveAuditInputSummary?: CommandAuditInputSummaryResolver;
  readonly auditClock?: CommandAuditClock;
  readonly startRunHandler?: StartRunCommandHandler;
  readonly continueRunHandler?: ContinueRunCommandHandler;
  readonly retryPhaseHandler?: RetryPhaseCommandHandler;
  readonly executeBuilderHandler?: ExecuteBuilderCommandHandler;
};

export class DefaultAppCommandService implements AppCommandService {
  private readonly resolveRisk: CommandRiskResolver;
  private readonly auditStore?: CommandAuditStore;
  private readonly resolveAuditInputSummary: CommandAuditInputSummaryResolver;
  private readonly auditClock: CommandAuditClock;
  private readonly startRunHandler?: StartRunCommandHandler;
  private readonly continueRunHandler?: ContinueRunCommandHandler;
  private readonly retryPhaseHandler?: RetryPhaseCommandHandler;
  private readonly executeBuilderHandler?: ExecuteBuilderCommandHandler;

  constructor(options: DefaultAppCommandServiceOptions = {}) {
    this.resolveRisk = options.resolveRisk ?? ((command) => getCommandMetadata(command.type).defaultRisk);
    this.auditStore = options.auditStore;
    this.resolveAuditInputSummary = options.resolveAuditInputSummary ?? defaultAuditInputSummary;
    this.auditClock = options.auditClock ?? (() => new Date().toISOString());
    this.startRunHandler = options.startRunHandler;
    this.continueRunHandler = options.continueRunHandler;
    this.retryPhaseHandler = options.retryPhaseHandler;
    this.executeBuilderHandler = options.executeBuilderHandler;
  }

  async describe(command: AppCommand): Promise<CommandDescription> {
    return describeCommand(command, this.resolveRisk(command));
  }

  async execute(command: AppCommand, options: AppCommandExecutionOptions = {}): Promise<AppCommandResult> {
    const risk = this.resolveRisk(command);
    const confirmation = getCommandConfirmationState(command, risk);
    const result =
      getConfirmationFailure(command, confirmation, options) ??
      (await executeCommand(command, this.startRunHandler, this.continueRunHandler, this.retryPhaseHandler, this.executeBuilderHandler));
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

async function executeCommand(
  command: AppCommand,
  startRunHandler: StartRunCommandHandler | undefined,
  continueRunHandler: ContinueRunCommandHandler | undefined,
  retryPhaseHandler: RetryPhaseCommandHandler | undefined,
  executeBuilderHandler: ExecuteBuilderCommandHandler | undefined
): Promise<AppCommandResult> {
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

  if (command.type === "start-run") {
    return executeStartRun(command, startRunHandler);
  }

  if (command.type === "continue-run") {
    return executeContinueRun(command, continueRunHandler);
  }

  if (command.type === "retry-phase") {
    return executeRetryPhase(command, retryPhaseHandler);
  }

  if (command.type === "execute-builder") {
    return executeBuilder(command, executeBuilderHandler);
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

function executeStartRun(command: Extract<AppCommand, { readonly type: "start-run" }>, handler: StartRunCommandHandler | undefined): Promise<AppCommandResult> | AppCommandResult {
  if (!command.stageName.trim()) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Stage name is required."
    };
  }

  if (!command.configPath.trim()) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Config path is required."
    };
  }

  if (!handler) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "EXECUTION_FAILED",
      reason: "Start-run handler is not configured."
    };
  }

  return handler(command);
}

function executeContinueRun(command: Extract<AppCommand, { readonly type: "continue-run" }>, handler: ContinueRunCommandHandler | undefined): Promise<AppCommandResult> | AppCommandResult {
  if (!command.runId.trim()) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Run ID is required."
    };
  }

  if (!handler) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "EXECUTION_FAILED",
      reason: "Continue-run handler is not configured."
    };
  }

  return handler(command);
}

function executeRetryPhase(command: Extract<AppCommand, { readonly type: "retry-phase" }>, handler: RetryPhaseCommandHandler | undefined): Promise<AppCommandResult> | AppCommandResult {
  if (!command.runId.trim()) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Run ID is required."
    };
  }

  if (command.phase !== "reviewer") {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Only reviewer retry-phase commands are currently supported."
    };
  }

  if (!handler) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "EXECUTION_FAILED",
      reason: "Retry-phase handler is not configured."
    };
  }

  return handler(command);
}

function executeBuilder(command: Extract<AppCommand, { readonly type: "execute-builder" }>, handler: ExecuteBuilderCommandHandler | undefined): Promise<AppCommandResult> | AppCommandResult {
  if (!command.runId.trim()) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "VALIDATION_FAILED",
      reason: "Run ID is required."
    };
  }

  if (!handler) {
    return {
      ok: false,
      commandId: command.commandId,
      type: command.type,
      code: "EXECUTION_FAILED",
      reason: "Execute-builder handler is not configured."
    };
  }

  return handler(command);
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
