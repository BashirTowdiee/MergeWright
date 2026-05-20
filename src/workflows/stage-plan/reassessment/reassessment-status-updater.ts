import { getDownstreamStages, findStage } from "./downstream-selector.js";
import type { Stage, StagePlan } from "../../../stage-plan.js";
import type { ReassessmentResult } from "./reassessment-result-parser.js";

export function applyReassessmentResult(
  plan: StagePlan,
  result: ReassessmentResult,
  sourceStageId: string
): {
  changedStatuses: Array<{ stageId: string; from: Stage["status"]; to: Stage["status"] }>;
  stagePlanStatusChanged: boolean;
} {
  const source = findStage(plan, sourceStageId);
  const downstreamIds = new Set(getDownstreamStages(plan, source.id).map((stage) => stage.id));

  let hasBlockingDownstream = false;
  const changedStatuses: Array<{ stageId: string; from: Stage["status"]; to: Stage["status"] }> = [];

  const byId = new Map(plan.stages.map((stage) => [stage.id, stage] as const));
  for (const item of result.results) {
    if (!downstreamIds.has(item.stageId)) {
      continue;
    }
    const stage = byId.get(item.stageId);
    if (!stage) {
      continue;
    }

    if (item.classification === "needs_revision" || item.classification === "invalidated") {
      hasBlockingDownstream = true;
    }

    const nextStatus =
      item.classification === "unchanged"
        ? stage.status
        : item.classification === "needs_revision"
          ? "needs_revision"
          : "invalidated";

    if (nextStatus !== stage.status) {
      changedStatuses.push({ stageId: stage.id, from: stage.status, to: nextStatus });
      stage.status = nextStatus;
    }
  }

  let stagePlanStatusChanged = false;
  if (hasBlockingDownstream && plan.status !== "paused") {
    plan.status = "paused";
    stagePlanStatusChanged = true;
  }

  return { changedStatuses, stagePlanStatusChanged };
}
