export interface AuditedFlowAuditEventView {
  readonly type:
    | "run.created"
    | "flow.selected"
    | "stage.started"
    | "prompt.generated"
    | "executor.invoked"
    | "executor.completed"
    | "command.started"
    | "command.completed"
    | "files.changed"
    | "stage.completed"
    | "run.completed"
    | "run.failed";
  readonly runId: string;
  readonly occurredAt: string;
  readonly stageId?: string;
  readonly executorId?: string;
  readonly payload?: Record<string, unknown>;
}
