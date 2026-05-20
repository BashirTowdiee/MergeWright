import type { ProgressLogger } from "../../progress-logger.js";
import type { runStage, RunResult } from "../../runner.js";
import type { ReassessStagePlanResult } from "../../stage-reassessment.js";
import type { GitClient } from "../../git.js";
import type { StagePlan } from "../../stage-plan.js";

export type StageRunHandler = typeof runStage;

export interface RunStagePlanOptions {
  stageId: string;
  stagePlanArg: string;
  configArg: string;
  orchestratorRoot: string;
  allowWrites: boolean;
  dryRun: boolean;
  verbose: boolean;
  streamCodex: boolean;
  progressLogger?: ProgressLogger;
  runHandler?: StageRunHandler;
}

export interface RunStagePlanResult {
  stageId: string;
  status: "review_required";
  stagePlanPath: string;
  stageArtefactsDir: string;
  dryRun: boolean;
}

export interface AcceptStageOptions {
  stageId: string;
  stagePlanArg: string;
  orchestratorRoot: string;
  autoCommit?: boolean;
  commitMessage?: string;
  git?: GitClient;
}

export interface AcceptStageResult {
  stageId: string;
  status: "accepted" | "committed";
  stagePlanPath: string;
  stageArtefactsDir: string;
  commitSha?: string;
}

export interface FixStageOptions {
  stageId: string;
  stagePlanArg: string;
  configArg: string;
  feedback: string;
  orchestratorRoot: string;
  allowWrites: boolean;
  verbose: boolean;
  streamCodex: boolean;
  progressLogger?: ProgressLogger;
  runHandler?: StageRunHandler;
  reassessDownstream?: boolean;
  reassessHandler?: (args: {
    stagePlanArg: string;
    sourceStageId: string;
    configArg: string;
    orchestratorRoot: string;
    dryRun: boolean;
  }) => Promise<ReassessStagePlanResult>;
}

export interface FixStageResult {
  stageId: string;
  status: "review_required";
  revision: number;
  stagePlanPath: string;
  stageArtefactsDir: string;
  feedbackPath: string;
  reassessment?: ReassessStagePlanResult;
}

export interface RunStagesOptions {
  stagePlanArg: string;
  configArg: string;
  orchestratorRoot: string;
  allowWrites: boolean;
  dryRun: boolean;
  verbose: boolean;
  streamCodex: boolean;
  stopAfterEachStage: boolean;
  progressLogger?: ProgressLogger;
  runHandler?: StageRunHandler;
}

export interface ContinueStagesOptions {
  stagePlanArg: string;
  configArg: string;
  orchestratorRoot: string;
  allowWrites: boolean;
  dryRun: boolean;
  verbose: boolean;
  streamCodex: boolean;
  progressLogger?: ProgressLogger;
  runHandler?: StageRunHandler;
}

export interface RunNextStageResult {
  stageId?: string;
  status?: "review_required";
  stagePlanPath: string;
  stageArtefactsDir?: string;
  dryRun: boolean;
  stagePlanStatus: StagePlan["status"];
  noPendingStages: boolean;
}

export type { RunResult };
