import type { Stage, StagePlan } from "../../stage-plan.js";

export function findNextRunnableStage(plan: StagePlan): Stage | undefined {
  return findNextStageForLinearProgression(plan);
}

export function findNextStageForLinearProgression(plan: StagePlan): Stage | undefined {
  return [...plan.stages]
    .sort((a, b) => a.index - b.index)
    .find((stage) => stage.status === "pending" || stage.status === "failed");
}

export function assertCanProgress(plan: StagePlan): void {
  const ordered = [...plan.stages].sort((a, b) => a.index - b.index);

  const reviewRequired = ordered.find((stage) => stage.status === "review_required");
  if (reviewRequired) {
    throw new Error(
      `Cannot continue.\n\nStage ${reviewRequired.id} requires review.\nAccept or fix it before running the next stage.`
    );
  }

  const firstUnsettled = ordered.find((stage) => stage.status !== "accepted" && stage.status !== "committed");
  if (!firstUnsettled) return;
  if (firstUnsettled.status === "needs_revision" || firstUnsettled.status === "invalidated") {
    throw new Error(
      `Cannot continue.\n\nStage ${firstUnsettled.id} has status ${firstUnsettled.status}.\nResolve it before running the next stage.`
    );
  }

  const candidate = findNextStageForLinearProgression(plan);
  if (!candidate) return;

  for (const stage of ordered) {
    if (stage.index >= candidate.index) break;
    if (stage.status !== "accepted" && stage.status !== "committed") {
      throw new Error(
        `Cannot continue.\n\nStage ${candidate.id} is blocked by earlier stage ${stage.id} with status ${stage.status}.\nEarlier stages must be accepted or committed before continuing.`
      );
    }
  }
}
