import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGitClient } from "../../git.js";
import { readStagePlan } from "../../stage-plan-store.js";
import { writeStageReport } from "./artefacts.js";
import { findStage, persistPlan } from "./plan-state.js";
import { assertFilesWithinStageScope, buildDefaultCommitMessage } from "./scope.js";
import type { AcceptStageOptions, AcceptStageResult } from "./types.js";

export async function acceptStageFromPlanWorkflow(options: AcceptStageOptions): Promise<AcceptStageResult> {
  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  const stagePlanPath = path.resolve(orchestratorRoot, options.stagePlanArg);
  const plan = await readStagePlan(stagePlanPath);
  const stage = findStage(plan, options.stageId);

  if (stage.status !== "review_required" && stage.status !== "passed") {
    throw new Error(`Stage "${stage.id}" cannot be accepted from status "${stage.status}". Allowed statuses: review_required, passed.`);
  }

  stage.status = "accepted";
  plan.updatedAt = new Date().toISOString();
  await persistPlan(stagePlanPath, plan);

  const stagePlanDir = path.dirname(stagePlanPath);
  const stageArtefactsDir = path.resolve(stagePlanDir, "stages", stage.id);
  await mkdir(stageArtefactsDir, { recursive: true });
  await writeStageReport({ stageArtefactsDir, plan, stage, runDir: undefined, finalStatus: "accepted", failure: undefined, commitSha: undefined });

  if (!options.autoCommit) {
    return { stageId: stage.id, status: "accepted", stagePlanPath, stageArtefactsDir };
  }

  const git = options.git ?? createGitClient();
  await git.assertGitAvailable(orchestratorRoot);
  await git.getWorktreeStatus(orchestratorRoot);
  const changedFiles = await git.getChangedFiles(orchestratorRoot);
  if (changedFiles.length === 0 || !(await git.hasDiff(orchestratorRoot))) {
    throw new Error("accept-stage --auto-commit requires a non-empty git diff.");
  }
  assertFilesWithinStageScope(changedFiles, stage);

  const message = options.commitMessage?.trim() || buildDefaultCommitMessage(plan, stage);
  const commitSha = await git.commitAll(orchestratorRoot, message);
  const headSha = await git.getHeadSha(orchestratorRoot);
  if (!commitSha || !headSha) {
    throw new Error("Failed to resolve commit SHA after git commit.");
  }

  stage.commitSha = headSha;
  stage.status = "committed";
  plan.updatedAt = new Date().toISOString();
  await persistPlan(stagePlanPath, plan);
  await writeStageReport({ stageArtefactsDir, plan, stage, runDir: undefined, finalStatus: "committed", failure: undefined, commitSha: headSha });

  return { stageId: stage.id, status: "committed", stagePlanPath, stageArtefactsDir, commitSha: headSha };
}
