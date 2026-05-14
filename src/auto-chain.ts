import path from "node:path";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { loadAndValidateConfig, resolveConfigPath } from "./config.js";
import { DEFAULT_CODEX_EXEC_CAPABILITIES, executeCodex } from "./codex.js";
import { loadPromptTemplates, renderTemplate } from "./prompts.js";
import { validateStageName } from "./stage.js";
import { NOOP_PROGRESS_LOGGER, type ProgressLogger } from "./progress-logger.js";
import { parseReviewerOutput, type ReviewerVerdict } from "./reviewer-output.js";
import { parseReviewToFixOutput, type ReviewToFixDecision } from "./review-to-fix-output.js";
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

export type AutoChainFinalStatus =
  | "PASS"
  | "NEEDS_FIX"
  | "NEEDS_FIX_WRITE_DISABLED"
  | "MAX_FIX_ATTEMPTS_REACHED"
  | "CHECKS_FAILED"
  | "FAILED";
export type AutoChainFixDecision = "PROCEED" | "FIX_REQUIRED" | "unavailable";
export type AutoChainChecksState = "executed" | "skipped" | "failed";

export interface AutoChainExecutionOptions {
  stageName: string;
  configArg: string;
  orchestratorRoot: string;
  repoOverride?: string;
  allowWrites: boolean;
  streamCodex: boolean;
  maxFixAttempts: number;
  verbose: boolean;
  progressLogger?: ProgressLogger;
  runStageHandler: (options: RunOptions) => Promise<RunResult>;
  continueRunHandler: (options: ContinueOptions) => Promise<ContinueResult>;
  codexExecutor?: typeof executeCodex;
}

export interface AutoChainExecutionSummary {
  stageName: string;
  runDir: string;
  reviewerVerdict: ReviewerVerdict;
  fixDecision: AutoChainFixDecision;
  checks: AutoChainChecksState;
  finalStatus: AutoChainFinalStatus;
  attemptsUsed: number;
}

interface AutoChainAttemptSummary {
  attempt: number;
  fixDecision: "FIX_REQUIRED";
  fixExecuted: boolean;
  reviewerVerdictAfterFix?: ReviewerVerdict;
  reviewToFixDecisionForNextAttempt?: ReviewToFixDecision;
  artefacts: string[];
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
  let finalStatus: AutoChainFinalStatus = "FAILED";
  let checks: AutoChainChecksState = "skipped";
  let attemptsUsed = 0;
  const attempts: AutoChainAttemptSummary[] = [];

  if (!shouldRunChecks) {
    progressLogger.info("[auto-chain] fix required");
    if (options.maxFixAttempts === 0) {
      finalStatus = "MAX_FIX_ATTEMPTS_REACHED";
    } else if (!options.allowWrites) {
      finalStatus = "NEEDS_FIX_WRITE_DISABLED";
    } else {
      let pendingFixDecision: ReviewToFixDecision = "FIX_REQUIRED";
      const runId = path.basename(stageResult.runDir);
      let resolved = false;
      for (let attemptNumber = 1; attemptNumber <= options.maxFixAttempts; attemptNumber += 1) {
        if (pendingFixDecision !== "FIX_REQUIRED") {
          break;
        }
        attemptsUsed = attemptNumber;
        const attemptLabel = `attempt ${attemptNumber}/${options.maxFixAttempts}`;
        progressLogger.info(`[auto-chain] ${attemptLabel} fix required`);
        const attemptDirRel = `auto-chain/attempt-${String(attemptNumber).padStart(2, "0")}`;
        const attemptDirAbs = path.resolve(stageResult.runDir, attemptDirRel);
        await mkdir(attemptDirAbs, { recursive: true });
        const attemptSummary: AutoChainAttemptSummary = {
          attempt: attemptNumber,
          fixDecision: "FIX_REQUIRED",
          fixExecuted: false,
          artefacts: []
        };

        try {
          await assertReadable(
            path.resolve(stageResult.runDir, "fix-prompt.extracted.md"),
            "Auto-chain failed: missing fix prompt artefact fix-prompt.extracted.md required for fix attempt."
          );
          const extractedFixPrompt = await readFile(path.resolve(stageResult.runDir, "fix-prompt.extracted.md"), "utf8");
          if (extractedFixPrompt.trim().length === 0) {
            throw new Error("Auto-chain failed: fix-prompt.extracted.md is empty; cannot execute fix attempt.");
          }

          progressLogger.info(`[auto-chain] ${attemptLabel} fix starting`);
          await options.continueRunHandler({
            runId,
            configArg: options.configArg,
            executeFix: true,
            allowWrites: true,
            dryRun: false,
            verbose: options.verbose,
            streamCodex: options.streamCodex,
            orchestratorRoot: options.orchestratorRoot
          });
          attemptSummary.fixExecuted = true;
          progressLogger.info(`[auto-chain] ${attemptLabel} fix completed`);

          await copyExistingArtefacts(stageResult.runDir, [
            ["fix-prompt.executed.md", `${attemptDirRel}/fix-prompt.executed.md`],
            ["fix-stdout.log", `${attemptDirRel}/fix-stdout.log`],
            ["fix-stderr.log", `${attemptDirRel}/fix-stderr.log`],
            ["fix-output-last-message.md", `${attemptDirRel}/fix-output-last-message.md`],
            ["fix-exit.json", `${attemptDirRel}/fix-exit.json`],
            ["write-audit/fix/pre-status.txt", `${attemptDirRel}/write-audit/fix/pre-status.txt`],
            ["write-audit/fix/pre-diff-stat.txt", `${attemptDirRel}/write-audit/fix/pre-diff-stat.txt`],
            ["write-audit/fix/pre-diff.patch", `${attemptDirRel}/write-audit/fix/pre-diff.patch`],
            ["write-audit/fix/pre-changed-files.json", `${attemptDirRel}/write-audit/fix/pre-changed-files.json`],
            ["write-audit/fix/pre-untracked-files.json", `${attemptDirRel}/write-audit/fix/pre-untracked-files.json`],
            ["write-audit/fix/post-status.txt", `${attemptDirRel}/write-audit/fix/post-status.txt`],
            ["write-audit/fix/post-diff-stat.txt", `${attemptDirRel}/write-audit/fix/post-diff-stat.txt`],
            ["write-audit/fix/post-diff.patch", `${attemptDirRel}/write-audit/fix/post-diff.patch`],
            ["write-audit/fix/post-changed-files.json", `${attemptDirRel}/write-audit/fix/post-changed-files.json`],
            ["write-audit/fix/post-untracked-files.json", `${attemptDirRel}/write-audit/fix/post-untracked-files.json`],
            ["write-audit/fix/summary.json", `${attemptDirRel}/write-audit/fix/summary.json`]
          ]);

          progressLogger.info(`[auto-chain] ${attemptLabel} reviewer retry starting`);
          const reviewerVerdictAfterFix = await runReviewerAttemptAfterFix({
            runDir: stageResult.runDir,
            attemptDirRel,
            orchestratorRoot: options.orchestratorRoot,
            configArg: options.configArg,
            streamCodex: options.streamCodex,
            progressLogger,
            codexExecutor: options.codexExecutor ?? executeCodex
          });
          attemptSummary.reviewerVerdictAfterFix = reviewerVerdictAfterFix;
          progressLogger.info(`[auto-chain] ${attemptLabel} reviewer verdict: ${reviewerVerdictAfterFix}`);

          if (reviewerVerdictAfterFix === "PASS") {
            const checksResult = await runChecksWithClassification(options, stageResult.runDir, progressLogger);
            checks = checksResult.checks;
            finalStatus = checksResult.finalStatus;
            resolved = true;
          } else if (attemptNumber < options.maxFixAttempts) {
            const decisionForNextAttempt = await runReviewToFixAttemptAfterReviewerFailure({
              runDir: stageResult.runDir,
              attemptDirRel,
              orchestratorRoot: options.orchestratorRoot,
              configArg: options.configArg,
              streamCodex: options.streamCodex,
              progressLogger,
              codexExecutor: options.codexExecutor ?? executeCodex
            });
            attemptSummary.reviewToFixDecisionForNextAttempt = decisionForNextAttempt;
            pendingFixDecision = decisionForNextAttempt;
            if (decisionForNextAttempt === "PROCEED") {
              const checksResult = await runChecksWithClassification(options, stageResult.runDir, progressLogger);
              checks = checksResult.checks;
              finalStatus = checksResult.finalStatus;
              resolved = true;
            }
          }
        } catch (error) {
          attemptSummary.artefacts = await collectAttemptArtefacts(stageResult.runDir, attemptDirRel);
          attempts.push(attemptSummary);
          await writeAutoChainMetadata(stageResult.runDir, {
            maxFixAttempts: options.maxFixAttempts,
            attemptsUsed,
            initialReviewerVerdict: reviewerVerdict,
            finalStatus: "FAILED",
            attempts
          });
          throw error;
        }

        attemptSummary.artefacts = await collectAttemptArtefacts(stageResult.runDir, attemptDirRel);
        attempts.push(attemptSummary);
        await writeAutoChainMetadata(stageResult.runDir, {
          maxFixAttempts: options.maxFixAttempts,
          attemptsUsed,
          initialReviewerVerdict: reviewerVerdict,
          finalStatus: resolved ? finalStatus : "NEEDS_FIX",
          attempts
        });
        if (resolved) {
          break;
        }
      }

      if (!resolved) {
        checks = "skipped";
        if (pendingFixDecision !== "FIX_REQUIRED") {
          finalStatus = "NEEDS_FIX";
        } else if (attemptsUsed >= options.maxFixAttempts) {
          finalStatus = "MAX_FIX_ATTEMPTS_REACHED";
        } else {
          finalStatus = "NEEDS_FIX";
        }
      }
    }
  } else {
    const checksResult = await runChecksWithClassification(options, stageResult.runDir, progressLogger);
    checks = checksResult.checks;
    finalStatus = checksResult.finalStatus;
  }

  await writeAutoChainMetadata(stageResult.runDir, {
    maxFixAttempts: options.maxFixAttempts,
    attemptsUsed,
    initialReviewerVerdict: reviewerVerdict,
    finalStatus,
    attempts
  });
  progressLogger.info(`[auto-chain] final status: ${finalStatus}`);
  return {
    stageName: options.stageName,
    runDir: stageResult.runDir,
    reviewerVerdict,
    fixDecision,
    checks,
    finalStatus,
    attemptsUsed
  };
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
    `attempts used: ${summary.attemptsUsed}`,
    `final status: ${summary.finalStatus}`,
    "no commit, push, or merge was performed"
  ];
}

async function runChecksWithClassification(
  options: AutoChainExecutionOptions,
  runDir: string,
  progressLogger: ProgressLogger
): Promise<{ checks: AutoChainChecksState; finalStatus: AutoChainFinalStatus }> {
  progressLogger.info("[auto-chain] running checks");
  const runId = path.basename(runDir);
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
    return { checks: "executed", finalStatus: "PASS" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Checks failed\./.test(message) || /Check ".+" failed/.test(message)) {
      return { checks: "failed", finalStatus: "CHECKS_FAILED" };
    }
    return { checks: "failed", finalStatus: "FAILED" };
  }
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

async function assertReadable(filePath: string, message: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(message);
  }
}

async function copyExistingArtefacts(runDir: string, copies: Array<[fromRel: string, toRel: string]>): Promise<string[]> {
  const copied: string[] = [];
  for (const [fromRel, toRel] of copies) {
    const fromAbs = path.resolve(runDir, fromRel);
    const toAbs = path.resolve(runDir, toRel);
    try {
      await access(fromAbs);
    } catch {
      continue;
    }
    await mkdir(path.dirname(toAbs), { recursive: true });
    await copyFile(fromAbs, toAbs);
    copied.push(toRel);
  }
  return copied;
}

async function collectAttemptArtefacts(runDir: string, attemptDirRel: string): Promise<string[]> {
  const expected = [
    "fix-prompt.executed.md",
    "fix-stdout.log",
    "fix-stderr.log",
    "fix-output-last-message.md",
    "fix-exit.json",
    "reviewer-prompt.md",
    "reviewer-stdout.log",
    "reviewer-stderr.log",
    "reviewer-output-last-message.md",
    "reviewer-exit.json",
    "reviewer-verdict.json",
    "review-to-fix-prompt.md",
    "review-to-fix-stdout.log",
    "review-to-fix-stderr.log",
    "review-to-fix-output-last-message.md",
    "review-to-fix-exit.json",
    "review-to-fix-decision.json",
    "write-audit/fix/pre-status.txt",
    "write-audit/fix/pre-diff-stat.txt",
    "write-audit/fix/pre-diff.patch",
    "write-audit/fix/pre-changed-files.json",
    "write-audit/fix/pre-untracked-files.json",
    "write-audit/fix/post-status.txt",
    "write-audit/fix/post-diff-stat.txt",
    "write-audit/fix/post-diff.patch",
    "write-audit/fix/post-changed-files.json",
    "write-audit/fix/post-untracked-files.json",
    "write-audit/fix/summary.json"
  ];
  const present: string[] = [];
  for (const fileName of expected) {
    const rel = `${attemptDirRel}/${fileName}`;
    try {
      await access(path.resolve(runDir, rel));
      present.push(rel);
    } catch {
      // keep only produced artefacts
    }
  }
  return present.sort((a, b) => a.localeCompare(b));
}

async function runReviewToFixAttemptAfterReviewerFailure(input: {
  runDir: string;
  attemptDirRel: string;
  orchestratorRoot: string;
  configArg: string;
  streamCodex: boolean;
  progressLogger: ProgressLogger;
  codexExecutor: typeof executeCodex;
}): Promise<ReviewToFixDecision> {
  input.progressLogger.info("[auto-chain] review-to-fix retry starting");
  const configPath = resolveConfigPath(path.resolve(input.orchestratorRoot), input.configArg);
  const config = await loadAndValidateConfig(configPath);
  const templates = await loadPromptTemplates(path.resolve(input.orchestratorRoot, config.paths.promptsDir));
  const reviewToFixPrompt = await buildPostFixReviewToFixPrompt(input.runDir, input.attemptDirRel, templates["review-to-fix.md"]);
  const promptPath = path.resolve(input.runDir, `${input.attemptDirRel}/review-to-fix-prompt.md`);
  await writeFile(promptPath, reviewToFixPrompt, "utf8");
  const outputPath = path.resolve(input.runDir, `${input.attemptDirRel}/review-to-fix-output-last-message.md`);
  const result = await input.codexExecutor(
    {
      prompt: reviewToFixPrompt,
      role: "planner",
      model: config.codex.planner.model,
      reasoningEffort: config.codex.planner.reasoningEffort,
      workspaceRoot: config.workspaceRoot,
      outputLastMessagePath: outputPath,
      dryRun: false,
      requireGitRepo: config.safety.requireGitRepo,
      orchestratorRoot: path.resolve(input.orchestratorRoot),
      sandboxMode: "read-only"
    },
    DEFAULT_CODEX_EXEC_CAPABILITIES,
    {
      streamOutput: input.streamCodex,
      onStdoutChunk: (chunk) => input.progressLogger.codexStdout(chunk),
      onStderrChunk: (chunk) => input.progressLogger.codexStderr(chunk)
    }
  );

  await writeFile(path.resolve(input.runDir, `${input.attemptDirRel}/review-to-fix-stdout.log`), result.stdout, "utf8");
  await writeFile(path.resolve(input.runDir, `${input.attemptDirRel}/review-to-fix-stderr.log`), result.stderr, "utf8");
  await writeFile(path.resolve(input.runDir, `${input.attemptDirRel}/review-to-fix-output-last-message.md`), result.outputLastMessage, "utf8");
  await writeFile(
    path.resolve(input.runDir, `${input.attemptDirRel}/review-to-fix-exit.json`),
    `${JSON.stringify({ success: result.success, code: result.exitCode, signal: result.signal, durationMs: result.durationMs }, null, 2)}\n`,
    "utf8"
  );
  if (!result.success) {
    throw new Error(`Post-fix review-to-fix execution failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}.`);
  }
  const parsed = parseReviewToFixOutput(result.outputLastMessage);
  await writeFile(
    path.resolve(input.runDir, `${input.attemptDirRel}/review-to-fix-decision.json`),
    `${JSON.stringify({ decision: parsed.decision, rationale: parsed.rationale }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(path.resolve(input.runDir, "fix-prompt.extracted.md"), parsed.finalFixPrompt ?? "", "utf8");
  input.progressLogger.info(`[auto-chain] review-to-fix retry decision: ${parsed.decision}`);
  return parsed.decision;
}

async function runReviewerAttemptAfterFix(input: {
  runDir: string;
  attemptDirRel: string;
  orchestratorRoot: string;
  configArg: string;
  streamCodex: boolean;
  progressLogger: ProgressLogger;
  codexExecutor: typeof executeCodex;
}): Promise<ReviewerVerdict> {
  const configPath = resolveConfigPath(path.resolve(input.orchestratorRoot), input.configArg);
  const config = await loadAndValidateConfig(configPath);
  const templates = await loadPromptTemplates(path.resolve(input.orchestratorRoot, config.paths.promptsDir));
  const reviewerPrompt = await buildPostFixReviewerPrompt(input.runDir, templates["reviewer.md"] ?? "");
  const promptPath = path.resolve(input.runDir, `${input.attemptDirRel}/reviewer-prompt.md`);
  await writeFile(promptPath, reviewerPrompt, "utf8");

  const outputPath = path.resolve(input.runDir, `${input.attemptDirRel}/reviewer-output-last-message.md`);
  const result = await input.codexExecutor(
    {
      prompt: reviewerPrompt,
      role: "reviewer",
      model: config.codex.reviewer.model,
      reasoningEffort: config.codex.reviewer.reasoningEffort,
      workspaceRoot: config.workspaceRoot,
      outputLastMessagePath: outputPath,
      dryRun: false,
      requireGitRepo: config.safety.requireGitRepo,
      orchestratorRoot: path.resolve(input.orchestratorRoot),
      sandboxMode: "read-only"
    },
    DEFAULT_CODEX_EXEC_CAPABILITIES,
    {
      streamOutput: input.streamCodex,
      onStdoutChunk: (chunk) => input.progressLogger.codexStdout(chunk),
      onStderrChunk: (chunk) => input.progressLogger.codexStderr(chunk)
    }
  );

  await writeFile(path.resolve(input.runDir, `${input.attemptDirRel}/reviewer-stdout.log`), result.stdout, "utf8");
  await writeFile(path.resolve(input.runDir, `${input.attemptDirRel}/reviewer-stderr.log`), result.stderr, "utf8");
  await writeFile(path.resolve(input.runDir, `${input.attemptDirRel}/reviewer-output-last-message.md`), result.outputLastMessage, "utf8");
  await writeFile(
    path.resolve(input.runDir, `${input.attemptDirRel}/reviewer-exit.json`),
    `${JSON.stringify({ success: result.success, code: result.exitCode, signal: result.signal, durationMs: result.durationMs }, null, 2)}\n`,
    "utf8"
  );
  if (!result.success) {
    throw new Error(`Post-fix reviewer execution failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}.`);
  }

  const parsed = parseReviewerOutput(result.outputLastMessage);
  await writeFile(
    path.resolve(input.runDir, `${input.attemptDirRel}/reviewer-verdict.json`),
    `${JSON.stringify(parsed, null, 2)}\n`,
    "utf8"
  );
  return parsed.verdict;
}

async function buildPostFixReviewerPrompt(runDir: string, template: string): Promise<string> {
  const stageInstruction = await readText(path.resolve(runDir, "01-stage-input.md"));
  const plannerPrompt = await readText(path.resolve(runDir, "02-rendered-planner-prompt.md"), "[not available]");
  const plannerOutput = await readText(path.resolve(runDir, "06-planner-output-last-message.md"), "[not available]");
  const extractedBuilderPrompt = await readText(path.resolve(runDir, "builder-prompt.extracted.md"), "[not available]");
  const builderOutput = await readText(path.resolve(runDir, "builder-output-last-message.md"), "[not available]");
  const builderStdout = await readText(path.resolve(runDir, "builder-stdout.log"), "[not available]");
  const builderStderr = await readText(path.resolve(runDir, "builder-stderr.log"), "[not available]");
  const builderExit = await readText(path.resolve(runDir, "builder-exit.json"), "[not available]");
  return renderTemplate(template, {
    stage_name: path.basename(runDir),
    stage_instruction: stageInstruction,
    timestamp: new Date().toISOString(),
    workspace_root: "[current workspace root]",
    run_dir: runDir,
    planner_prompt: plannerPrompt,
    planner_output: plannerOutput,
    extracted_builder_prompt: extractedBuilderPrompt,
    builder_output: builderOutput,
    builder_stdout: builderStdout,
    builder_stderr: builderStderr,
    builder_exit: builderExit,
    builder_execution_state:
      "Builder and a single fix attempt were executed. Review current workspace state and latest fix artefacts.",
    stage_e_execution_scope:
      "Auto-chain post-fix review scope: run read-only review only; never run tests/builds; never execute git mutation/commit/push/merge.",
    write_audit_context: "Use any write-audit artefacts present in run directory, including fix-phase write-audit summary.",
    test_output: "[placeholder: checks not run yet in post-fix review]",
    git_diff: "[placeholder: git diff skipped in this stage]",
    git_status: "[placeholder: git status skipped in this stage]"
  });
}

async function buildPostFixReviewToFixPrompt(runDir: string, attemptDirRel: string, template: string): Promise<string> {
  const stageInstruction = await readText(path.resolve(runDir, "01-stage-input.md"), "[not available]");
  const plannerOutput = await readText(path.resolve(runDir, "06-planner-output-last-message.md"), "[not available]");
  const extractedBuilderPrompt = await readText(path.resolve(runDir, "builder-prompt.extracted.md"), "[not available]");
  const builderOutput = await readText(path.resolve(runDir, "builder-output-last-message.md"), "[not available]");
  const reviewOutput = await readText(path.resolve(runDir, `${attemptDirRel}/reviewer-output-last-message.md`), "[not available]");
  const reviewerExit = await readText(path.resolve(runDir, `${attemptDirRel}/reviewer-exit.json`), "[not available]");
  return renderTemplate(template, {
    stage_name: path.basename(runDir),
    workspace_root: "[current workspace root]",
    run_dir: runDir,
    stage_instruction: stageInstruction,
    planner_output: plannerOutput,
    extracted_builder_prompt: extractedBuilderPrompt,
    builder_output: builderOutput,
    review_output: reviewOutput,
    reviewer_exit: reviewerExit
  });
}

async function readText(filePath: string, fallback = ""): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

async function writeAutoChainMetadata(
  runDir: string,
  input: {
    maxFixAttempts: number;
    attemptsUsed: number;
    initialReviewerVerdict: ReviewerVerdict;
    finalStatus: AutoChainFinalStatus;
    attempts: Array<{
      attempt: number;
      fixDecision: "FIX_REQUIRED";
      fixExecuted: boolean;
      reviewerVerdictAfterFix?: ReviewerVerdict;
      reviewToFixDecisionForNextAttempt?: ReviewToFixDecision;
      artefacts: string[];
    }>;
  }
): Promise<void> {
  const runPath = path.resolve(runDir, "run.json");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(await readFile(runPath, "utf8")) as Record<string, unknown>;
  } catch {
    // keep empty fallback; diagnostics remain in phase artefacts
  }
  parsed.autoChain = {
    enabled: true,
    maxFixAttempts: input.maxFixAttempts,
    attemptsUsed: input.attemptsUsed,
    finalStatus: input.finalStatus,
    initialReviewerVerdict: input.initialReviewerVerdict,
    attempts: input.attempts
  };
  await writeFile(runPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}
