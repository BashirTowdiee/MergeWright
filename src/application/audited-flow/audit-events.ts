export type AuditedFlowAuditEventType =
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

export interface AuditedFlowAuditEvent {
  type: AuditedFlowAuditEventType;
  runId: string;
  occurredAt: string;
  stageId?: string;
  executorId?: string;
  payload?: Record<string, unknown>;
}
