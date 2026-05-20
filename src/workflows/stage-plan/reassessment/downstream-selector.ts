import type { Stage, StagePlan } from "../../../stage-plan.js";

export function findStage(plan: StagePlan, stageId: string): Stage {
  const stage = plan.stages.find((item) => item.id === stageId);
  if (!stage) {
    throw new Error(`Unknown stage id "${stageId}" in stage plan "${plan.id}".`);
  }
  return stage;
}

export function getDownstreamStages(plan: StagePlan, sourceStageId: string): Stage[] {
  const source = findStage(plan, sourceStageId);
  const byId = new Map(plan.stages.map((stage) => [stage.id, stage] as const));

  const dependentIds = new Set<string>();
  const queue = [source.id];
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    for (const stage of plan.stages) {
      if (dependentIds.has(stage.id) || stage.id === source.id) {
        continue;
      }
      if (stage.dependsOn.includes(currentId)) {
        dependentIds.add(stage.id);
        queue.push(stage.id);
      }
    }
  }

  const downstream = new Set<string>();
  for (const stage of plan.stages) {
    if (stage.id !== source.id && stage.index > source.index) {
      downstream.add(stage.id);
    }
  }
  for (const id of dependentIds) {
    downstream.add(id);
  }

  return [...downstream]
    .map((id) => byId.get(id))
    .filter((stage): stage is Stage => stage !== undefined)
    .sort((a, b) => a.index - b.index);
}
