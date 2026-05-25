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
import { DefaultAddTaskCommentUseCase } from "../use-cases/add-task-comment-use-case.js";
import type { AddTaskCommentUseCase } from "../use-cases/add-task-comment-use-case.js";
import { DefaultMarkTaskReviewedUseCase } from "../use-cases/mark-task-reviewed-use-case.js";
import type { MarkTaskReviewedUseCase } from "../use-cases/mark-task-reviewed-use-case.js";
import { DefaultSelectTaskUseCase } from "../use-cases/select-task-use-case.js";
import type { SelectTaskUseCase } from "../use-cases/select-task-use-case.js";
import { DefaultStartRunUseCase } from "../use-cases/start-run-use-case.js";
import type { StartRunUseCase, StartRunUseCaseHandler } from "../use-cases/start-run-use-case.js";
import { DefaultUpdateCoordinationNoteUseCase } from "../use-cases/update-coordination-note-use-case.js";
import type { UpdateCoordinationNoteUseCase } from "../use-cases/update-coordination-note-use-case.js";

export type CommandRiskResolver = (command: AppCommand) => CommandRisk;
export type CommandAuditInputSummaryResolver = (command: AppCommand) => string;
export type CommandAuditClock = () => string;
export type StartRunCommandHandler = StartRunUseCaseHandler;
export type ContinueRunCommandHandler = (command: Extract<AppCommand, { readonly type: "continue-run" }>) => Promise<AppCommandResult> | AppCommandResult;
export type RetryPhaseCommandHandler = (command: Extract<AppCommand, { readonly type: "retry-phase" }>) => Promise<AppCommandResult> | AppCommandResult;
export type ExecuteBuilderCommandHandler = (command: Extract<AppCommand, { readonly type: "execute-builder" }>) => Promise<AppCommandResult> | AppCommandResult;

export type DefaultAppCommandServiceOptions = {
  readonly resolveRisk?: CommandRiskResolver;
  readonly auditStore?: CommandAuditStore;
  readonly resolveAuditInputSummary?: CommandAuditInputSummaryResolver;
  readonly auditClock?: CommandAuditClock;
  readonly selectTaskUseCase?: SelectTaskUseCase;
  readonly updateCoordinationNoteUseCase?: UpdateCoordinationNoteUseCase;
  readonly markTaskReviewedUseCase?: MarkTaskReviewedUseCase;
  readonly addTaskCommentUseCase?: AddTaskCommentUseCase;
  readonly startRunUseCase?: StartRunUseCase;
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
  private readonly selectTaskUseCase: SelectTaskUseCase;
  private readonly updateCoordinationNoteUseCase: UpdateCoordinationNoteUseCase;
  private readonly markTaskReviewedUseCase: MarkTaskReviewedUseCase;
  private readonly addTaskCommentUseCase: AddTaskCommentUseCase;
  private readonly startRunUseCase: StartRunUseCase;
  private readonly continueRunHandler?: ContinueRunCommandHandler;
  private readonly retryPhaseHandler?: RetryPhaseCommandHandler;
  private readonly executeBuilderHandler?: ExecuteBuilderCommandHandler;

  constructor(options: DefaultAppCommandServiceOptions = {}) {
    this.resolveRisk = options.resolveRisk ?? ((command) => getCommandMetadata(command.type).defaultRisk);
    this.auditStore = options.auditStore;
    this.resolveAuditInputSummary = options.resolveAuditInputSummary ?? defaultAuditInputSummary;
    this.auditClock = options.auditClock ?? (() => new Date().toISOString());
    this.selectTaskUseCase = options.selectTaskUseCase ?? new DefaultSelectTaskUseCase();
    this.updateCoordinationNoteUseCase = options.updateCoordinationNoteUseCase ?? new DefaultUpdateCoordinationNoteUseCase();
    this.markTaskReviewedUseCase = options.markTaskReviewedUseCase ?? new DefaultMarkTaskReviewedUseCase();
    this.addTaskCommentUseCase = options.addTaskCommentUseCase ?? new DefaultAddTaskCommentUseCase();
    this.startRunUseCase = options.startRunUseCase ?? new DefaultStartRunUseCase(options.startRunHandler);
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
      (await executeCommand(command, this.selectTaskUseCase, this.updateCoordinationNoteUseCase, this.markTaskReviewedUseCase, this.addTaskCommentUseCase, this.startRunUseCase, this.continueRunHandler, this.retryPhaseHandler, this.executeBuilderHandler));
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
  selectTaskUseCase: SelectTaskUseCase,
  updateCoordinationNoteUseCase: UpdateCoordinationNoteUseCase,
  markTaskReviewedUseCase: MarkTaskReviewedUseCase,
  addTaskCommentUseCase: AddTaskCommentUseCase,
  startRunUseCase: StartRunUseCase,
  continueRunHandler: ContinueRunCommandHandler | undefined,
  retryPhaseHandler: RetryPhaseCommandHandler | undefined,
  executeBuilderHandler: ExecuteBuilderCommandHandler | undefined
): Promise<AppCommandResult> {
  if (command.type === "select-task") {
    return selectTaskUseCase.execute(command);
  }

  if (command.type === "update-coordination-note") {
    return updateCoordinationNoteUseCase.execute(command);
  }

  if (command.type === "mark-task-reviewed") {
    return markTaskReviewedUseCase.execute(command);
  }

  if (command.type === "add-task-comment") {
    return addTaskCommentUseCase.execute(command);
  }

  if (command.type === "start-run") {
    return startRunUseCase.execute(command);
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
