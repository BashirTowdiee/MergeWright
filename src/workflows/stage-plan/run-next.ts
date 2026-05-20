import path from "node:path";
import { readStagePlan } from "../../stage-plan-store.js";
import { assertRunnableStage } from "../../stage-status.js";
import { StageExecutionError } from "./errors.js";
import { findStage, restoreStagePlanStatus, updateStagePlanStatus, validateDependencies } from "./plan-state.js";
import { assertCanProgress, findNextStageForLinearProgression } from "./progression.js";
import { runSingleStageFromPlanWorkflow } from "./run-single.js";
import type { ContinueStagesOptions, RunNextStageResult, RunStagesOptions } from "./types.js";

export async function runStagesFromPlanWorkflow(options: RunStagesOptions): Promise<RunNextStageResult> {
  if (!options.stopAfterEachStage) {
    throw new Error("Only --stop-after-each-stage mode is supported in SP-5.");
  }
  return await runNextStageWithStop(options);
}

export async function continueStagesFromPlanWorkflow(options: ContinueStagesOptions): Promise<RunNextStageResult> {
  return await runNextStageWithStop(options);
}

async function runNextStageWithStop(options: {
  stagePlanArg: string;
  configArg: string;
  orchestratorRoot: string;
  allowWrites: boolean;
  dryRun: boolean;
  verbose: boolean;
  streamCodex: boolean;
  progressLogger?: ContinueStagesOptions["progressLogger"];
  runHandler?: ContinueStagesOptions["runHandler"];
}): Promise<RunNextStageResult> {
  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  const stagePlanPath = path.resolve(orchestratorRoot, options.stagePlanArg);
  const plan = await readStagePlan(stagePlanPath);
  const stagePlanDir = path.dirname(stagePlanPath);

  assertCanProgress(plan);
  const nextStage = findNextStageForLinearProgression(plan);
  if (!nextStage) {
    return { stagePlanPath, dryRun: options.dryRun, stagePlanStatus: plan.status, noPendingStages: true };
  }

  assertRunnableStage(nextStage);
  validateDependencies(plan, nextStage);
  const stageArtefactsDir = path.resolve(stagePlanDir, "stages", nextStage.id);

  if (options.dryRun) {
    return {
      stageId: nextStage.id,
      status: "review_required",
      stagePlanPath,
      stageArtefactsDir,
      dryRun: true,
      stagePlanStatus: plan.status,
      noPendingStages: false
    };
  }

  const previousPlanStatus = plan.status;
  const previousPlanUpdatedAt = plan.updatedAt;
  await updateStagePlanStatus(stagePlanPath, "running");

  try {
    const result = await runSingleStageFromPlanWorkflow({
      stageId: nextStage.id,
      stagePlanArg: stagePlanPath,
      configArg: options.configArg,
      orchestratorRoot,
      allowWrites: options.allowWrites,
      dryRun: false,
      verbose: options.verbose,
      streamCodex: options.streamCodex,
      progressLogger: options.progressLogger,
      runHandler: options.runHandler
    });
    await updateStagePlanStatus(stagePlanPath, "paused");
    return {
      stageId: result.stageId,
      status: result.status,
      stagePlanPath,
      stageArtefactsDir: result.stageArtefactsDir,
      dryRun: false,
      stagePlanStatus: "paused",
      noPendingStages: false
    };
  } catch (error) {
    if (error instanceof StageExecutionError && error.executionStarted) {
      await updateStagePlanStatus(stagePlanPath, "failed");
      throw error.cause ?? error;
    }
    await restoreStagePlanStatus(stagePlanPath, previousPlanStatus, previousPlanUpdatedAt);
    if (error instanceof StageExecutionError) {
      throw error.cause ?? error;
    }
    throw error;
  }
}
