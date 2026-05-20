import { writeFile } from "node:fs/promises";
import path from "node:path";
import { renderStagePlanMarkdown } from "../../stage-plan-renderer.js";
import { readStagePlan, writeStagePlan } from "../../stage-plan-store.js";
import type { Stage, StagePlan } from "../../stage-plan.js";
import { assertDependencyReady } from "../../stage-status.js";

export function findStage(plan: StagePlan, stageId: string): Stage {
  const stage = plan.stages.find((item) => item.id === stageId);
  if (!stage) {
    throw new Error(`Unknown stage id "${stageId}" in stage plan "${plan.id}".`);
  }
  return stage;
}

export function validateDependencies(plan: StagePlan, stage: Stage): void {
  const byId = new Map(plan.stages.map((item) => [item.id, item] as const));
  for (const depId of stage.dependsOn) {
    const dep = byId.get(depId);
    if (!dep) continue;
    assertDependencyReady(stage, dep);
  }
}

export async function persistPlan(stagePlanPath: string, plan: StagePlan): Promise<void> {
  await writeStagePlan(stagePlanPath, plan);
  const stagePlanDir = path.dirname(stagePlanPath);
  await writeFile(path.join(stagePlanDir, "stage-plan.md"), renderStagePlanMarkdown(plan), "utf8");
}

export async function updateStagePlanStatus(stagePlanPath: string, status: StagePlan["status"]): Promise<void> {
  const plan = await readStagePlan(stagePlanPath);
  plan.status = status;
  plan.updatedAt = new Date().toISOString();
  await persistPlan(stagePlanPath, plan);
}

export async function restoreStagePlanStatus(stagePlanPath: string, status: StagePlan["status"], updatedAt: string): Promise<void> {
  const plan = await readStagePlan(stagePlanPath);
  plan.status = status;
  plan.updatedAt = updatedAt;
  await persistPlan(stagePlanPath, plan);
}
