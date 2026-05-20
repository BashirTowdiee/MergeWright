import type { Stage, StagePlan } from "./stage-plan.js";
import { assertCanProgress, findNextRunnableStage, findNextStageForLinearProgression } from "./workflows/stage-plan/progression.js";
import { acceptStageFromPlanWorkflow } from "./workflows/stage-plan/accept-stage.js";
import { continueStagesFromPlanWorkflow, runStagesFromPlanWorkflow } from "./workflows/stage-plan/run-next.js";
import { runSingleStageFromPlanWorkflow } from "./workflows/stage-plan/run-single.js";
import { fixStageFromPlanWorkflow } from "./workflows/stage-plan/fix-stage.js";
import type {
  AcceptStageOptions,
  AcceptStageResult,
  ContinueStagesOptions,
  FixStageOptions,
  FixStageResult,
  RunNextStageResult,
  RunStagePlanOptions,
  RunStagePlanResult,
  RunStagesOptions
} from "./workflows/stage-plan/types.js";

export type {
  RunStagePlanOptions,
  RunStagePlanResult,
  AcceptStageOptions,
  AcceptStageResult,
  FixStageOptions,
  FixStageResult,
  RunStagesOptions,
  ContinueStagesOptions,
  RunNextStageResult
};

export async function runSingleStageFromPlan(options: RunStagePlanOptions): Promise<RunStagePlanResult> {
  return await runSingleStageFromPlanWorkflow(options);
}

export async function acceptStageFromPlan(options: AcceptStageOptions): Promise<AcceptStageResult> {
  return await acceptStageFromPlanWorkflow(options);
}

export async function fixStageFromPlan(options: FixStageOptions): Promise<FixStageResult> {
  return await fixStageFromPlanWorkflow(options);
}

export async function runStagesFromPlan(options: RunStagesOptions): Promise<RunNextStageResult> {
  return await runStagesFromPlanWorkflow(options);
}

export async function continueStagesFromPlan(options: ContinueStagesOptions): Promise<RunNextStageResult> {
  return await continueStagesFromPlanWorkflow(options);
}

export { findNextRunnableStage, findNextStageForLinearProgression, assertCanProgress };
export type { Stage, StagePlan };
