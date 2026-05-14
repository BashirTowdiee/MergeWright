import path from "node:path";
import { readFile } from "node:fs/promises";
import { loadAndValidateConfig, resolveConfigPath } from "./config.js";
import { validateStageName } from "./stage.js";
import { NOOP_PROGRESS_LOGGER, type ProgressLogger } from "./progress-logger.js";
import { parseReviewerOutput, type ReviewerVerdict } from "./reviewer-output.js";
import type { RunResult, RunOptions } from "./runner.js";
import type { ContinueOptions, ContinueResult } from "./continue-run.js";

export interface AutoChainDryRunOptions {
  stageName: string;
  configArg: string;
  orchestratorRoot: string;
  repoOverride?: string;
  allowWrites: boolean;
  streamCodex: boolean;
  maxFixAttempts: number;
  progressLogger?: ProgressLogger;
}

export interface AutoChainDryRunSummary {
  stageName: string;
  configPath: string;
  targetWorkspaceRoot: string;
  allowWrites: boolean;
  streamCodex: boolean;
  maxFixAttempts: number;
}

export type AutoChainFinalStatus = "PASS" | "NEEDS_FIX" | "CHECKS_FAILED" | "FAILED";
export type AutoChainFixDecision = "PROCEED" | "FIX_REQUIRED" | "unavailable";
export type AutoChainChecksState = "executed" | "skipped" | "failed";

export interface AutoChainExecutionOptions {
  stageName: string;
  configArg: string;
  orchestratorRoot: string;
  repoOverride?: string;
  allowWrites: boolean;
  streamCodex: boolean;
  verbose: boolean;
  progressLogger?: ProgressLogger;
  runStageHandler: (options: RunOptions) => Promise<RunResult>;
  continueRunHandler: (options: ContinueOptions) => Promise<ContinueResult>;
}

export interface AutoChainExecutionSummary {
  stageName: string;
  runDir: string;
  reviewerVerdict: ReviewerVerdict;
  fixDecision: AutoChainFixDecision;
  checks: AutoChainChecksState;
  finalStatus: AutoChainFinalStatus;
}

export async function projectAutoChainDryRun(options: AutoChainDryRunOptions): Promise<AutoChainDryRunSummary> {
  const progressLogger = options.progressLogger ?? NOOP_PROGRESS_LOGGER;
  progressLogger.phaseStart("auto-chain", "projecting flow");

  validateStageName(options.stageName);
  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  const configPath = resolveConfigPath(orchestratorRoot, options.configArg);
  const config = await loadAndValidateConfig(configPath);
  const targetWorkspaceRoot = path.resolve(options.repoOverride ?? config.workspaceRoot);

  progressLogger.phaseComplete("auto-chain", "dry-run complete");
  return {
    stageName: options.stageName,
    configPath,
    targetWorkspaceRoot,
    allowWrites: options.allowWrites,
    streamCodex: options.streamCodex,
    maxFixAttempts: options.maxFixAttempts
  };
}

export function formatAutoChainDryRunSummaryLines(summary: AutoChainDryRunSummary): string[] {
  const projectionLines = buildAutoChainProjectionLines(summary.maxFixAttempts);
  return [
    "Auto-chain dry-run summary",
    "",
    `stage name: ${summary.stageName}`,
    `config path: ${summary.configPath}`,
    `target workspace root: ${summary.targetWorkspaceRoot}`,
    `allowWrites: ${summary.allowWrites}`,
    `streamCodex: ${summary.streamCodex}`,
    `max fix attempts: ${summary.maxFixAttempts}`,
    "",
    "Projected flow:",
    "",
    ...projectionLines,
    "",
    "No Codex execution, checks, git mutation, commit, push, or merge occurred."
  ];
}

export function buildAutoChainProjectionLines(maxFixAttempts: number): string[] {
  const lines: string[] = [
    "1. planner",
    "2. builder",
    "3. reviewer",
    "4. review-to-fix",
    "5. if PROCEED: checks"
  ];

  if (maxFixAttempts === 0) {
    lines.push("6. if FIX_REQUIRED: stop without fix execution because max fix attempts is 0");
    return lines;
  }

  let index = 6;
  for (let attempt = 1; attempt <= maxFixAttempts; attempt += 1) {
    const attemptPrefix = attempt === 1 ? "if FIX_REQUIRED: " : "if still FIX_REQUIRED: ";
    lines.push(`${index}. ${attemptPrefix}fix attempt ${attempt}`);
    index += 1;
    lines.push(`${index}. reviewer retry after fix attempt ${attempt}`);
    index += 1;
  }

  lines.push(`${index}. checks if reviewer passes`);
  lines.push(`${index + 1}. stop when PASS, checks fail, or max fix attempts is reached`);
  return lines;
}

export async function executeAutoChainSinglePass(
  options: AutoChainExecutionOptions
): Promise<AutoChainExecutionSummary> {
  const progressLogger = options.progressLogger ?? NOOP_PROGRESS_LOGGER;
  progressLogger.info("[auto-chain] starting");

  const stageResult = await options.runStageHandler({
    stageName: options.stageName,
    configArg: options.configArg,
    repoOverride: options.repoOverride,
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    executeFix: false,
    runChecks: false,
    allowWrites: options.allowWrites,
    verbose: options.verbose,
    streamCodex: options.streamCodex,
    orchestratorRoot: options.orchestratorRoot
  });

  progressLogger.info("[auto-chain] parsing reviewer verdict");
  const reviewerArtefact = "reviewer-output-last-message.md";
  const reviewerOutputPath = path.resolve(stageResult.runDir, reviewerArtefact);
  const reviewerOutput = await readReviewerOutputOrThrow({
    reviewerOutputPath,
    runDir: stageResult.runDir,
    reviewerArtefact
  });
  const reviewerVerdict = parseReviewerOutput(reviewerOutput).verdict;
  progressLogger.info(`[auto-chain] reviewer verdict: ${reviewerVerdict}`);

  const fixDecisionPath = path.resolve(stageResult.runDir, "review-to-fix-decision.json");
  const fixDecision = await readFixDecisionIfAvailable(fixDecisionPath);
  progressLogger.info(`[auto-chain] fix decision: ${fixDecision}`);

  const shouldRunChecks = reviewerVerdict === "PASS" || fixDecision === "PROCEED";
  if (!shouldRunChecks) {
    progressLogger.info("[auto-chain] skipping checks");
    progressLogger.info("[auto-chain] final status: NEEDS_FIX");
    return {
      stageName: options.stageName,
      runDir: stageResult.runDir,
      reviewerVerdict,
      fixDecision,
      checks: "skipped",
      finalStatus: "NEEDS_FIX"
    };
  }

  progressLogger.info("[auto-chain] running checks");
  const runId = path.basename(stageResult.runDir);
  try {
    await options.continueRunHandler({
      runId,
      configArg: options.configArg,
      runChecks: true,
      allowWrites: false,
      dryRun: false,
      verbose: options.verbose,
      streamCodex: options.streamCodex,
      orchestratorRoot: options.orchestratorRoot
    });
    progressLogger.info("[auto-chain] final status: PASS");
    return {
      stageName: options.stageName,
      runDir: stageResult.runDir,
      reviewerVerdict,
      fixDecision,
      checks: "executed",
      finalStatus: "PASS"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Checks failed\./.test(message) || /Check ".+" failed/.test(message)) {
      progressLogger.info("[auto-chain] final status: CHECKS_FAILED");
      return {
        stageName: options.stageName,
        runDir: stageResult.runDir,
        reviewerVerdict,
        fixDecision,
        checks: "failed",
        finalStatus: "CHECKS_FAILED"
      };
    }
    progressLogger.info("[auto-chain] final status: FAILED");
    return {
      stageName: options.stageName,
      runDir: stageResult.runDir,
      reviewerVerdict,
      fixDecision,
      checks: "failed",
      finalStatus: "FAILED"
    };
  }
}

export function formatAutoChainExecutionSummaryLines(summary: AutoChainExecutionSummary): string[] {
  return [
    "Auto-chain summary",
    "",
    `stage name: ${summary.stageName}`,
    `run directory: ${summary.runDir}`,
    `reviewer verdict: ${summary.reviewerVerdict}`,
    `fix decision: ${summary.fixDecision}`,
    `checks: ${summary.checks}`,
    `final status: ${summary.finalStatus}`,
    "no commit, push, or merge was performed"
  ];
}

async function readFixDecisionIfAvailable(filePath: string): Promise<AutoChainFixDecision> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { decision?: unknown };
    if (parsed.decision === "PROCEED" || parsed.decision === "FIX_REQUIRED") {
      return parsed.decision;
    }
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

async function readReviewerOutputOrThrow(options: {
  reviewerOutputPath: string;
  runDir: string;
  reviewerArtefact: string;
}): Promise<string> {
  try {
    return await readFile(options.reviewerOutputPath, "utf8");
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;
    if (maybeNodeError?.code === "ENOENT") {
      throw new Error(
        `Auto-chain failed: missing reviewer artefact "${options.reviewerArtefact}" in run directory "${options.runDir}". Remediation: ensure reviewer executed successfully and rerun auto-chain.`
      );
    }
    throw error;
  }
}
