import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadAndValidateConfig, resolveConfigPath } from "../../config.js";
import { NOOP_PROGRESS_LOGGER } from "../../progress-logger.js";
import { runStage } from "../../runner.js";
import { readStagePlan } from "../../stage-plan-store.js";
import { assertRunnableStage } from "../../stage-status.js";
import { writeJson, writePhaseOutputs, writeStageReport } from "./artefacts.js";
import { asStageExecutionError } from "./errors.js";
import { persistPlan, findStage, validateDependencies } from "./plan-state.js";
import { buildStagePrompt } from "./prompts.js";
import type { RunStagePlanOptions, RunStagePlanResult } from "./types.js";

export async function runSingleStageFromPlanWorkflow(options: RunStagePlanOptions): Promise<RunStagePlanResult> {
  const progressLogger = options.progressLogger ?? NOOP_PROGRESS_LOGGER;
  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  const stagePlanPath = path.resolve(orchestratorRoot, options.stagePlanArg);
  const plan = await readStagePlan(stagePlanPath);
  const stage = findStage(plan, options.stageId);
  assertRunnableStage(stage);
  validateDependencies(plan, stage);

  const stagePlanDir = path.dirname(stagePlanPath);
  const stageArtefactsDir = path.resolve(stagePlanDir, "stages", stage.id);
  const stagePrompt = buildStagePrompt(plan, stage);

  if (options.dryRun) {
    progressLogger.info(`[run-stage] dry-run: validated stage "${stage.id}"`);
    return { stageId: stage.id, status: "review_required", stagePlanPath, stageArtefactsDir, dryRun: true };
  }

  const configPath = resolveConfigPath(orchestratorRoot, options.configArg);
  const config = await loadAndValidateConfig(configPath);
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "run-stage-"));
  const tmpStagesDir = path.join(tmpRoot, "stages");
  const tmpConfigPath = path.join(tmpRoot, "config.run-stage.json");
  const runHandler = options.runHandler ?? runStage;

  await mkdir(tmpStagesDir, { recursive: true });
  await writeFile(path.join(tmpStagesDir, `${stage.id}.md`), stagePrompt, "utf8");
  await writeFile(tmpConfigPath, `${JSON.stringify({ ...config, paths: { ...config.paths, stagesDir: tmpStagesDir } }, null, 2)}\n`, "utf8");

  let executionStarted = false;
  try {
    await mkdir(stageArtefactsDir, { recursive: true });
    await writeJson(path.join(stageArtefactsDir, "stage.json"), stage);
    await writeFile(path.join(stageArtefactsDir, "stage-prompt.md"), stagePrompt, "utf8");

    executionStarted = true;
    const runResult = await runHandler({
      stageName: stage.id,
      configArg: tmpConfigPath,
      dryRun: false,
      executePlanner: true,
      executeBuilder: true,
      executeReviewer: true,
      runChecks: true,
      allowWrites: options.allowWrites,
      streamCodex: options.streamCodex,
      verbose: options.verbose,
      orchestratorRoot,
      progressLogger
    });

    await writePhaseOutputs(stageArtefactsDir, runResult.runDir);
    await writeStageReport({ stageArtefactsDir, plan, stage, runDir: runResult.runDir, finalStatus: "review_required", failure: undefined });

    stage.status = "review_required";
    plan.updatedAt = new Date().toISOString();
    await persistPlan(stagePlanPath, plan);

    return { stageId: stage.id, status: "review_required", stagePlanPath, stageArtefactsDir, dryRun: false };
  } catch (error) {
    if (executionStarted) {
      stage.status = "failed";
      plan.updatedAt = new Date().toISOString();
      await persistPlan(stagePlanPath, plan);
      await writeStageReport({ stageArtefactsDir, plan, stage, runDir: undefined, finalStatus: "failed", failure: error });
    }
    throw asStageExecutionError(error, executionStarted);
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}
