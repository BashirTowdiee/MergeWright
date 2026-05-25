export type TaskStatus = "queued" | "active" | "blocked" | "reviewing" | "completed" | "cancelled" | "unknown";

export type TaskRole = "planner" | "builder" | "reviewer" | "merger" | "resolver" | "unknown";

export interface TaskReadModel {
  id: string;
  title: string;
  role: TaskRole;
  status: TaskStatus;
  priority: number;
  filesInScope: string[];
  acceptanceCriteria: string[];
  dependsOn: string[];
  blockedReason?: string;
  selectedRunId?: string;
}
