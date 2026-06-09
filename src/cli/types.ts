import type { runStage } from "../runner.js";
import type { continueRun } from "../continue-run.js";
import type { PipelinePreset } from "../presets.js";
import type { ProgressLogger } from "../progress-logger.js";
import type { OpenFileResult } from "../open-file.js";
import type { AutoChainExecutionSummary } from "../auto-chain.js";
import type { WriteSafetyResult } from "../write-safety.js";
import type { RunContract } from "../application/audited-flow/contract.js";
import type { AuditedFlowResult } from "../application/use-cases/execute-audited-flow-use-case.js";

export interface ParsedArgs {
  command?: string;
  help: boolean;
  stageName?: string;
  runId?: string;
  compareRunId?: string;
  projectName?: string;
  configArg?: string;
  modesArg?: string;
  goalArg?: string;
  flowArg?: string;
  workspaceArg?: string;
  repoOverride?: string;
  preset?: PipelinePreset;
  force: boolean;
  jsonOutput?: boolean;
  backendName?: string;
  opencodeCommand?: string;
  validateReadonlyContract?: boolean;
  stdoutOnly?: boolean;
  prSummary?: boolean;
  dryRun: boolean;
  executePlanner: boolean;
  executeBuilder: boolean;
  executeReviewer: boolean;
  planFix: boolean;
  executeFix: boolean;
  runChecks: boolean;
  allowWrites: boolean;
  verbose: boolean;
  streamCodex: boolean;
  autoChain: boolean;
  maxFixAttempts?: number;
  generateReport: boolean;
  planHtml: boolean;
  openPlan: boolean;
  importFrom?: string;
  importOut?: string;
  stagePlanArg?: string;
  stageId?: string;
  feedback?: string;
  stopAfterEachStage: boolean;
  fromStageId?: string;
  reassessDownstream: boolean;
  autoCommit: boolean;
  commitMessage?: string;
}

export interface SummaryResult {
  stageName: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  configPath: string;
  runDir: string;
  artefacts: string[];
  dryRun: boolean;
  checksState: "disabled" | "skipped by dry-run" | "executed" | "failed";
}

export type OpenRunDirectory = (runDir: string) => Promise<void>;
export type CheckWriteSafetyHandler = (
  configPath: string,
  orchestratorRoot: string,
  progressLogger: ProgressLogger
) => Promise<CheckWriteSafetyRunResult>;

export interface RunCommandDeps {
  checkWriteSafetyHandler?: CheckWriteSafetyHandler;
  runHandler?: typeof runStage;
  continueRunHandler?: typeof continueRun;
  autoChainHandler?: (args: {
    stageName: string;
    configArg: string;
    repoOverride?: string;
    orchestratorRoot: string;
    allowWrites: boolean;
    streamCodex: boolean;
    maxFixAttempts: number;
    verbose: boolean;
    progressLogger: ProgressLogger;
  }) => Promise<AutoChainExecutionSummary>;
  openPlanHandler?: (filePath: string) => Promise<OpenFileResult>;
  runContractHandler?: (args: {
    contract: RunContract;
    orchestratorRoot: string;
    dryRun: boolean;
  }) => Promise<AuditedFlowResult>;
}

export interface CheckWriteSafetyRunResult {
  configPath: string;
  workspaceRoot: string;
  result: WriteSafetyResult;
}
