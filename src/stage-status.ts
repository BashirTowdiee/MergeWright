import type { Stage, StageStatus } from "./stage-plan.js";

const RUNNABLE_STAGE_STATUSES = new Set<StageStatus>(["pending", "failed"]);
const BLOCKED_RUN_STAGE_STATUSES = new Set<StageStatus>([
  "running",
  "review_required",
  "accepted",
  "committed",
  "needs_revision",
  "invalidated",
  "skipped",
  "fixing",
  "fix_required",
  "passed"
]);
const DEPENDENCY_READY_STATUSES = new Set<StageStatus>(["accepted", "committed"]);

export function isRunnableStageStatus(status: StageStatus): boolean {
  return RUNNABLE_STAGE_STATUSES.has(status);
}

export function assertRunnableStage(stage: Stage): void {
  if (isRunnableStageStatus(stage.status)) {
    return;
  }
  if (BLOCKED_RUN_STAGE_STATUSES.has(stage.status)) {
    throw new Error(
      `Stage "${stage.id}" is not runnable from status "${stage.status}". Runnable statuses: pending, failed.`
    );
  }
  throw new Error(`Stage "${stage.id}" is not runnable from status "${stage.status}".`);
}

export function assertDependencyReady(stage: Stage, dependencyStage: Stage): void {
  if (DEPENDENCY_READY_STATUSES.has(dependencyStage.status)) {
    return;
  }
  throw new Error(
    `Stage "${stage.id}" depends on "${dependencyStage.id}", but dependency status is "${dependencyStage.status}". Dependencies must be accepted or committed.`
  );
}

