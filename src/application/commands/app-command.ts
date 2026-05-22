import type { CommandMetadata } from "./command-source.js";

export type SelectTaskCommand = CommandMetadata & {
  readonly type: "select-task";
  readonly taskId: string;
};

export type UpdateCoordinationNoteCommand = CommandMetadata & {
  readonly type: "update-coordination-note";
  readonly note: string;
  readonly expectedRevision?: string;
};

export type MarkTaskReviewedCommand = CommandMetadata & {
  readonly type: "mark-task-reviewed";
  readonly taskId: string;
  readonly reviewedAt: string;
};

export type AddTaskCommentCommand = CommandMetadata & {
  readonly type: "add-task-comment";
  readonly taskId: string;
  readonly comment: string;
};

export type StartRunCommand = CommandMetadata & {
  readonly type: "start-run";
  readonly stageName: string;
  readonly configPath: string;
  readonly preset?: string;
};

export type ContinueRunCommand = CommandMetadata & {
  readonly type: "continue-run";
  readonly runId: string;
};

export type RetryPhaseCommand = CommandMetadata & {
  readonly type: "retry-phase";
  readonly runId: string;
  readonly phase: "planner" | "builder" | "reviewer" | "checks" | "fix-planning" | "fix-execution";
};

export type ApproveStageCommand = CommandMetadata & {
  readonly type: "approve-stage";
  readonly stageId: string;
  readonly confirmationToken?: string;
};

export type ReassessStagePlanCommand = CommandMetadata & {
  readonly type: "reassess-stage-plan";
  readonly stageId: string;
  readonly reason?: string;
};

export type AppCommand =
  | SelectTaskCommand
  | UpdateCoordinationNoteCommand
  | MarkTaskReviewedCommand
  | AddTaskCommentCommand
  | StartRunCommand
  | ContinueRunCommand
  | RetryPhaseCommand
  | ApproveStageCommand
  | ReassessStagePlanCommand;

export type AppCommandType = AppCommand["type"];

export const APP_COMMAND_TYPES: readonly AppCommandType[] = [
  "select-task",
  "update-coordination-note",
  "mark-task-reviewed",
  "add-task-comment",
  "start-run",
  "continue-run",
  "retry-phase",
  "approve-stage",
  "reassess-stage-plan"
];
