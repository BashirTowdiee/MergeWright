import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadAndValidateConfig, resolveConfigPath } from "../../config.js";
import { NOOP_PROGRESS_LOGGER } from "../../progress-logger.js";
import { runStage } from "../../runner.js";
import { readStagePlan } from "../../stage-plan-store.js";
import { reassessStagePlan } from "../../stage-reassessment.js";
import { writeJson, writePhaseOutputs, writeStageReport } from "./artefacts.js";
import { findStage, persistPlan } from "./plan-state.js";
import { buildFixStagePrompt, isFixableStageStatus, renderFeedbackFile } from "./prompts.js";
import type { FixStageOptions, FixStageResult } from "./types.js";

export async function fixStageFromPlanWorkflow(options: FixStageOptions): Promise<FixStageResult> {
  const feedback = options.feedback.trim();
  if (!feedback) {
    throw new Error("fix-stage requires non-empty --feedback.");
  }

  const progressLogger = options.progressLogger ?? NOOP_PROGRESS_LOGGER;
  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  const stagePlanPath = path.resolve(orchestratorRoot, options.stagePlanArg);
  const plan = await readStagePlan(stagePlanPath);
  const stage = findStage(plan, options.stageId);

  if (stage.status === "committed" || stage.commitSha) {
    throw new Error(`Cannot fix committed stage.\n\nStage ${stage.id} has already been committed.\nCreate a correction stage in a later workflow instead of rewriting committed work.`);
  }
  if (stage.status === "invalidated" || stage.status === "skipped") {
    throw new Error(`Stage "${stage.id}" cannot be fixed from status "${stage.status}".`);
  }
  if (stage.status === "pending") {
    throw new Error(`Stage "${stage.id}" cannot be fixed from status "pending".`);
  }
  if (!isFixableStageStatus(stage.status)) {
    throw new Error(`Stage "${stage.id}" cannot be fixed from status "${stage.status}". Allowed statuses: review_required, failed, fix_required, accepted (without commitSha).`);
  }

  const stagePlanDir = path.dirname(stagePlanPath);
  const stageArtefactsDir = path.resolve(stagePlanDir, "stages", stage.id);
  await mkdir(stageArtefactsDir, { recursive: true });
  const feedbackPath = path.join(stageArtefactsDir, `feedback-revision-${stage.revision + 1}.md`);
  await writeFile(feedbackPath, renderFeedbackFile(stage, feedback), "utf8");

  const configPath = resolveConfigPath(orchestratorRoot, options.configArg);
  const config = await loadAndValidateConfig(configPath);
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "fix-stage-"));
  const tmpStagesDir = path.join(tmpRoot, "stages");
  const tmpConfigPath = path.join(tmpRoot, "config.fix-stage.json");
  const runHandler = options.runHandler ?? runStage;

  await mkdir(tmpStagesDir, { recursive: true });
  const stagePrompt = await buildFixStagePrompt(plan, stage, feedback, stageArtefactsDir);
  await writeFile(path.join(tmpStagesDir, `${stage.id}.md`), stagePrompt, "utf8");
  await writeFile(tmpConfigPath, `${JSON.stringify({ ...config, paths: { ...config.paths, stagesDir: tmpStagesDir } }, null, 2)}\n`, "utf8");

  let executionStarted = false;
  try {
    stage.status = "fixing";
    plan.updatedAt = new Date().toISOString();
    await persistPlan(stagePlanPath, plan);
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
    stage.revision += 1;
    stage.status = "review_required";
    plan.updatedAt = new Date().toISOString();
    await persistPlan(stagePlanPath, plan);
    await writeStageReport({ stageArtefactsDir, plan, stage, runDir: runResult.runDir, finalStatus: "review_required", failure: undefined });

    let reassessment = undefined;
    if (options.reassessDownstream) {
      const hasDownstream = plan.stages.some((item) => item.id !== stage.id && item.index > stage.index);
      if (hasDownstream) {
        reassessment = await (options.reassessHandler ?? reassessStagePlan)({
          stagePlanArg: stagePlanPath,
          sourceStageId: stage.id,
          configArg: options.configArg,
          orchestratorRoot,
          dryRun: false
        });
      }
    }

    return { stageId: stage.id, status: "review_required", revision: stage.revision, stagePlanPath, stageArtefactsDir, feedbackPath, reassessment };
  } catch (error) {
    if (executionStarted) {
      stage.status = "failed";
      plan.updatedAt = new Date().toISOString();
      await persistPlan(stagePlanPath, plan);
      await writeStageReport({ stageArtefactsDir, plan, stage, runDir: undefined, finalStatus: "failed", failure: error });
    }
    throw error;
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}
