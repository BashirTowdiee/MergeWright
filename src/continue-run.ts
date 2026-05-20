import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeCheckCommand, resolveCheckCommandCwd } from "./commands.js";
import type { AgentExecutionBackendMetadata, AgentExecutor } from "./agent-executor.js";
import { loadAndValidateConfig, resolveConfigPath } from "./config.js";
import { createAgentExecutor } from "./execution-backends/agent-executor.js";
import { serialiseBackendCommandArtefact } from "./execution-backends/backend-command-artefact.js";
import { writePlanHtmlFromRun } from "./plan-html.js";
import { loadPromptTemplates, renderTemplate, type TemplateVariables } from "./prompts.js";
import { formatDurationMs, NOOP_PROGRESS_LOGGER, type ProgressLogger } from "./progress-logger.js";
import { parseReviewToFixOutput } from "./review-to-fix-output.js";
import { captureWriteAuditPostStateAndWriteArtefacts, captureWriteAuditPreState } from "./write-audit.js";
import { markRunFailure, markRunSuccess, toRunRelativePath, updateRunPhase, writeRunMetadata, type RunMetadata, type RunPhaseName, type RunPhaseStatus } from "./run-metadata.js";
import { resolveRunDir, resolveRunsRoot, validateRunId } from "./runs.js";
import { checkWriteSafety } from "./write-safety.js";

export interface ContinueOptions {
  runId: string;
  configArg: string;
  executeBuilder?: boolean;
  executeReviewer?: boolean;
  planFix?: boolean;
  executeFix?: boolean;
  runChecks?: boolean;
  allowWrites?: boolean;
  streamCodex?: boolean;
  dryRun: boolean;
  verbose: boolean;
  orchestratorRoot: string;
  progressLogger?: ProgressLogger;
  codexExecutor?: AgentExecutor;
  writeAuditPreCapture?: typeof captureWriteAuditPreState;
  writeAuditPostCapture?: typeof captureWriteAuditPostStateAndWriteArtefacts;
  checkCommandExecutor?: typeof executeCheckCommand;
  metadataWriter?: typeof writeRunMetadata;
  planHtml?: boolean;
}

export interface ContinueResult {
  runId: string;
  runDir: string;
  configPath: string;
  dryRun: boolean;
  selectedPhases: string[];
  before: Record<RunPhaseName, RunPhaseStatus>;
  after: Record<RunPhaseName, RunPhaseStatus>;
  artefacts: string[];
  skippedFixBecauseProceed: boolean;
  allowWrites: boolean;
  writeSafetyState: "not checked" | "passed" | "failed" | "skipped by dry-run";
  writeEnabledPhases: Array<"builder" | "fix">;
}

type ContinuePhase = "builder" | "reviewer" | "fixPlanning" | "fixExecution" | "checks";
const ORDERED_PHASES: ContinuePhase[] = ["builder", "reviewer", "fixPlanning", "fixExecution", "checks"];
const REQUIRED_PHASES: RunPhaseName[] = ["planner", "builder", "reviewer", "fixPlanning", "fixExecution", "checks"];
const VALID_RUN_STATUSES = new Set<RunMetadata["status"]>(["running", "success", "failed"]);
const VALID_PHASE_STATUSES = new Set<RunPhaseStatus>(["unknown", "disabled", "skipped", "executed", "failed"]);

export async function continueRun(options: ContinueOptions): Promise<ContinueResult> {
  const progressLogger = options.progressLogger ?? NOOP_PROGRESS_LOGGER;
  validateRunId(options.runId);
  progressLogger.info(`Continuing run: ${options.runId}`);
  const selected = selectedPhases(options);
  if (selected.length === 0) {
    throw new Error("continue-run requires at least one phase flag. Supported flags: --execute-builder, --execute-reviewer, --plan-fix, --execute-fix, --run-checks.");
  }
  const allowWrites = options.allowWrites ?? false;
  const writeEnabledPhases: Array<"builder" | "fix"> = [
    ...(options.executeBuilder ? (["builder"] as const) : []),
    ...(options.executeFix ? (["fix"] as const) : [])
  ];
  if (allowWrites && writeEnabledPhases.length === 0) {
    throw new Error("--allow-writes requires at least one write-eligible continuation phase: --execute-builder or --execute-fix.");
  }

  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  progressLogger.phaseStart("setup", "loading config");
  const configPath = resolveConfigPath(orchestratorRoot, options.configArg);
  const config = await loadAndValidateConfig(configPath);
  progressLogger.verbose(`Config: ${configPath}`);
  const runsRoot = resolveRunsRoot(orchestratorRoot, config);
  progressLogger.phaseStart("setup", "loading run metadata");
  const runDir = resolveRunDir(runsRoot, options.runId);
  const metadata = await readRequiredRunMetadata(runDir, options.runId);
  assertRunOwnership(metadata, runDir, runsRoot, config.projectName);
  progressLogger.phaseComplete("setup", `run directory: ${runDir}`);
  progressLogger.info(`Target: ${metadata.workspaceRoot}`);
  progressLogger.info(`[continue] selected phases: ${selected.join(", ")}`);
  const projectedMetadata = cloneMetadata(metadata);
  metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
  metadata.postWriteReview = metadata.postWriteReview ?? {
    required: false,
    status: "not-required",
    reason: "no write-enabled builder/fix executed",
    requiredByPhases: [],
    artefacts: []
  };

  const before = snapshotStatuses(metadata);
  const artefacts: string[] = [];
  const metadataWriter = options.metadataWriter ?? writeRunMetadata;
  const codexExecutor: AgentExecutor = createAgentExecutor(config, {
    overrideAgentExecutor: options.codexExecutor
  });
  const writeAuditPreCapture = options.writeAuditPreCapture ?? captureWriteAuditPreState;
  const writeAuditPostCapture = options.writeAuditPostCapture ?? captureWriteAuditPostStateAndWriteArtefacts;
  const checkCommandExecutor = options.checkCommandExecutor ?? executeCheckCommand;
  const runCodexPhase = async (phase: "builder" | "reviewer" | "fix-planning" | "fix", action: () => Promise<void>): Promise<void> => {
    if (!options.streamCodex) {
      await action();
      return;
    }
    progressLogger.codexStreamStart(phase);
    try {
      await action();
    } finally {
      progressLogger.codexStreamEnd(phase);
    }
  };

  const updatePhase = async (
    phase: RunPhaseName,
    status: RunPhaseStatus,
    reason?: string,
    phaseArtefacts?: string[],
    backend?: AgentExecutionBackendMetadata
  ) => {
    updateRunPhase(metadata, phase, {
      status,
      startedAt: metadata.phases[phase]?.startedAt ?? new Date().toISOString(),
      completedAt: status === "executed" || status === "skipped" || status === "failed" || status === "disabled" ? new Date().toISOString() : undefined,
      reason,
      artefacts: phaseArtefacts,
      ...(backend ? { backend } : {})
    });
    if (!options.dryRun) {
      await metadataWriter(runDir, metadata);
    }
  };
  const bestEffortPhaseFailure = async (phase: RunPhaseName, reason: string, phaseArtefacts?: string[]) => {
    try {
      await updatePhase(phase, "failed", reason, phaseArtefacts);
    } catch {
      // preserve primary execution error
    }
  };

  let failedPhase: RunPhaseName | undefined;
  let skippedFixBecauseProceed = false;
  let writeSafetyState: ContinueResult["writeSafetyState"] = allowWrites && options.dryRun ? "skipped by dry-run" : "not checked";
  let writeSafetyChecked = false;
  const persistWriteSafetyState = async (
    state: ContinueResult["writeSafetyState"],
    reason?: string,
    writeSafetyArtefacts?: string[]
  ): Promise<void> => {
    metadata.writeSafety = {
      ...(metadata.writeSafety ?? { allowWrites }),
      allowWrites,
      state,
      ...(state === "skipped by dry-run"
        ? { status: "skipped" as const }
        : state === "passed" || state === "failed"
          ? { status: state }
          : {}),
      ...(reason ? { reason } : {}),
      ...(writeSafetyArtefacts && writeSafetyArtefacts.length > 0 ? { artefacts: writeSafetyArtefacts } : {})
    };
    if (!options.dryRun) {
      await metadataWriter(runDir, metadata);
    }
  };
  const ensureWriteSafetyIfNeeded = async (): Promise<void> => {
    if (!allowWrites || options.dryRun || writeSafetyChecked) {
      if (allowWrites && options.dryRun) {
        writeSafetyState = "skipped by dry-run";
        progressLogger.phaseSkipped("write-safety", "skipped by dry-run");
      }
      return;
    }
    progressLogger.phaseStart("write-safety", "checking target workspace");
    if (!config.writeSafety.enabled) {
      writeSafetyState = "failed";
      const result = { ok: false, failures: ["writeSafety.enabled is false"], summary: "Write safety check failed." };
      await writeJson(runDir, "write-safety-result.json", result, artefacts, true);
      progressLogger.artefact("write safety result", path.resolve(runDir, "write-safety-result.json"));
      try {
        await persistWriteSafetyState(writeSafetyState, "writeSafety.enabled is false", ["write-safety-result.json"]);
      } catch {
        // preserve original safety error
      }
      progressLogger.phaseFailed("write-safety", "writeSafety.enabled is false");
      throw new Error("Write mode requested but writeSafety.enabled is false.");
    }
    const result = await checkWriteSafety({ workspaceRoot: metadata.workspaceRoot, config });
    writeSafetyChecked = true;
    writeSafetyState = result.ok ? "passed" : "failed";
    await writeJson(runDir, "write-safety-result.json", result, artefacts, true);
    progressLogger.artefact("write safety result", path.resolve(runDir, "write-safety-result.json"));
    if (!result.ok) {
      try {
        await persistWriteSafetyState(writeSafetyState, "write safety checks failed", ["write-safety-result.json"]);
      } catch {
        // preserve original safety error
      }
      progressLogger.phaseFailed("write-safety", "checks failed");
      throw new Error("Write mode blocked: write safety checks failed. See write-safety-result.json.");
    }
    await persistWriteSafetyState(writeSafetyState, undefined, ["write-safety-result.json"]);
    progressLogger.phaseComplete("write-safety", "passed");
  };
  const mergeRequiredByPhases = (
    existing: Array<"builder" | "fixExecution">,
    incoming: Array<"builder" | "fixExecution">
  ): Array<"builder" | "fixExecution"> => {
    const union = new Set<"builder" | "fixExecution">([...existing, ...incoming]);
    return (["builder", "fixExecution"] as const).filter((phase): phase is "builder" | "fixExecution" => union.has(phase));
  };
  const setPostWriteReviewPending = async (phases: Array<"builder" | "fixExecution">): Promise<void> => {
    const requiredByPhases = mergeRequiredByPhases(metadata.postWriteReview.requiredByPhases ?? [], phases);
    metadata.postWriteReview = {
      required: true,
      status: "pending",
      reason: "write-enabled builder/fix executed",
      requiredByPhases,
      artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
    };
    progressLogger.phaseStart("post-write-review", `pending (${requiredByPhases.join(", ")})`);
    if (!options.dryRun) {
      await writeJson(runDir, "post-write-review-required.json", {
        required: true,
        status: "pending",
        reason: metadata.postWriteReview.reason,
        requiredByPhases
      }, artefacts, true);
      await writeJson(runDir, "post-write-review-status.json", { status: "pending", reason: metadata.postWriteReview.reason }, artefacts, true);
      await metadataWriter(runDir, metadata);
    }
  };
  const setPostWriteReviewCompleted = async (): Promise<void> => {
    metadata.postWriteReview = {
      ...metadata.postWriteReview,
      required: true,
      status: "completed",
      reason: "reviewer executed after write-enabled builder/fix",
      artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
    };
    progressLogger.phaseComplete("post-write-review", "completed");
    if (!options.dryRun) {
      await writeJson(runDir, "post-write-review-status.json", { status: "completed", reason: metadata.postWriteReview.reason }, artefacts, true);
      await metadataWriter(runDir, metadata);
    }
  };
  const setPostWriteReviewFailed = async (reason: string): Promise<void> => {
    metadata.postWriteReview = {
      ...metadata.postWriteReview,
      required: true,
      status: "failed",
      reason,
      artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
    };
    progressLogger.phaseFailed("post-write-review", reason);
    if (!options.dryRun) {
      await writeJson(runDir, "post-write-review-status.json", { status: "failed", reason }, artefacts, true);
      await metadataWriter(runDir, metadata);
    }
  };
  const canRunChecksWithMetadata = (source: RunMetadata): { ok: boolean; reason?: string } => {
    const postWriteReview = source.postWriteReview;
    if (!postWriteReview.required) {
      return { ok: true };
    }
    if (postWriteReview.status === "completed") {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `Checks blocked: post-write review status is "${postWriteReview.status}". Execute reviewer first to complete post-write review.`
    };
  };
  try {
    if (allowWrites && options.dryRun) {
      writeSafetyState = "skipped by dry-run";
      progressLogger.phaseSkipped("write-safety", "skipped by dry-run");
    }
    if (allowWrites) {
      await persistWriteSafetyState(writeSafetyState, options.dryRun ? "dryRun=true" : undefined);
    }
    let templates: Awaited<ReturnType<typeof loadPromptTemplates>> | undefined;
    const needsPromptTemplates = selected.includes("reviewer") || selected.includes("fixPlanning");
    if (needsPromptTemplates) {
      const promptsDir = path.resolve(orchestratorRoot, config.paths.promptsDir);
      templates = await loadPromptTemplates(promptsDir);
      progressLogger.verbose(`Prompts dir: ${promptsDir}`);
    }

    for (const phase of ORDERED_PHASES) {
      if (!selected.includes(phase)) continue;

      if (phase === "builder") {
        progressLogger.phaseStart("builder");
        ensurePlannerExecuted(projectedMetadata);
        ensurePhaseNotExecuted(projectedMetadata, "builder", "Builder");
        await assertArtefactExists(runDir, "builder-prompt.extracted.md", "Builder continuation requires extracted builder prompt artefact.");
        await assertArtefactsAbsent(runDir, ["builder-command.json", "builder-stdout.log", "builder-stderr.log", "builder-output-last-message.md", "builder-exit.json", "builder-prompt.executed.md"], "Builder");
        if (options.dryRun) {
          progressLogger.phaseSkipped("builder", "skipped by dry-run");
          projectedMetadata.phases.builder = { ...projectedMetadata.phases.builder, status: "executed" };
          if (allowWrites) {
            projectedMetadata.postWriteReview = {
              ...projectedMetadata.postWriteReview,
              required: true,
              status: "pending",
              reason: "write-enabled builder/fix executed",
              requiredByPhases: mergeRequiredByPhases(projectedMetadata.postWriteReview.requiredByPhases ?? [], ["builder"]),
              artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
            };
          }
          continue;
        }
        if (allowWrites) {
          await ensureWriteSafetyIfNeeded();
        }
        progressLogger.verbose(`builder model=${config.codex.builder.model} reasoning=${config.codex.builder.reasoningEffort} sandbox=${allowWrites ? "workspace-write" : "read-only"}`);
        failedPhase = "builder";
        let builderAudit: Awaited<ReturnType<typeof captureWriteAuditPreState>> | undefined;
        if (allowWrites) {
          try {
            progressLogger.phaseStart("write-audit:builder", "capturing pre-write state");
            builderAudit = await writeAuditPreCapture({ phase: "builder", workspaceRoot: metadata.workspaceRoot });
            progressLogger.phaseComplete("write-audit:builder", "pre-write captured");
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const preCaptureError = new Error(`Builder write-audit pre-capture failed: ${message}`);
            metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
            metadata.writeAudit.builder = { status: "failed", reason: `pre-capture failed: ${message}` };
            await bestEffortPhaseFailure("builder", "builder write-audit pre-capture failed");
            progressLogger.phaseFailed("write-audit:builder", preCaptureError);
            progressLogger.phaseFailed("builder", preCaptureError);
            throw preCaptureError;
          }
        }
        let builderAuditError: Error | undefined;
        let builderExecutionError: Error | undefined;

        await updatePhase("builder", "unknown");
        const prompt = await readText(path.resolve(runDir, "builder-prompt.extracted.md"));
        const outputPath = path.resolve(runDir, "builder-output-last-message.md");
        progressLogger.info("[builder] waiting for Codex...");
        let result!: Awaited<ReturnType<typeof codexExecutor>>;
        await runCodexPhase("builder", async () => {
          result = await codexExecutor(
            {
              prompt,
              role: "builder",
              model: config.codex.builder.model,
              reasoningEffort: config.codex.builder.reasoningEffort,
              workspaceRoot: metadata.workspaceRoot,
              outputLastMessagePath: outputPath,
              dryRun: false,
              requireGitRepo: config.safety.requireGitRepo,
              orchestratorRoot,
              sandboxMode: allowWrites ? "workspace-write" : "read-only"
            },
            {
              streamOutput: options.streamCodex,
              onStdoutChunk: (chunk) => progressLogger.codexStdout(chunk),
              onStderrChunk: (chunk) => progressLogger.codexStderr(chunk)
            }
          );
        });

        await writeText(
          runDir,
          "builder-command.json",
          `${serialiseBackendCommandArtefact({
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            outputLastMessagePath: result.outputLastMessagePath,
            promptViaStdin: true,
            sandboxMode: allowWrites ? "workspace-write" : "read-only",
            backend: result.backend
          })}\n`,
          artefacts,
          false
        );
        await writeText(runDir, "builder-prompt.executed.md", prompt, artefacts, false);
        await writeText(runDir, "builder-stdout.log", result.stdout, artefacts, false);
        await writeText(runDir, "builder-stderr.log", result.stderr, artefacts, false);
        await writeText(runDir, "builder-output-last-message.md", result.outputLastMessage, artefacts, false);
        await writeJson(runDir, "builder-exit.json", { success: result.success, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);
        if (builderAudit) {
          try {
            progressLogger.phaseStart("write-audit:builder", "capturing post-write state");
            const summary = await writeAuditPostCapture({ runDir, capture: builderAudit });
            metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
            metadata.writeAudit.builder = { status: "captured", artefacts: summary.artefacts, changedFiles: summary.changedFilesAddedByPhase };
            progressLogger.phaseComplete("write-audit:builder", "post-write captured");
            progressLogger.artefact("write-audit:builder summary", path.resolve(runDir, "write-audit/builder/summary.json"));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            builderAuditError = new Error(`Builder write-audit capture failed: ${message}`);
            metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
            metadata.writeAudit.builder = { status: result.success ? "failed" : "partial", reason: message };
          }
        }

        if (!result.success) {
          builderExecutionError = new Error(`Builder execution failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}. Diagnostics written to ${runDir}`);
        }
        if (builderAuditError) {
          await bestEffortPhaseFailure("builder", "builder write-audit capture failed", ["builder-exit.json"]);
          progressLogger.phaseFailed("write-audit:builder", builderAuditError);
          progressLogger.phaseFailed("builder", builderExecutionError ?? builderAuditError);
          throw builderExecutionError ?? builderAuditError;
        }
        if (builderExecutionError) {
          await bestEffortPhaseFailure("builder", "builder execution failed", ["builder-exit.json"]);
          progressLogger.phaseFailed("builder", builderExecutionError);
          throw builderExecutionError;
        }
        await updatePhase(
          "builder",
          "executed",
          undefined,
          ["builder-command.json", "builder-prompt.executed.md", "builder-stdout.log", "builder-stderr.log", "builder-output-last-message.md", "builder-exit.json"],
          result.backend
        );
        if (allowWrites) {
          await setPostWriteReviewPending(["builder"]);
        }
        progressLogger.phaseComplete("builder", `completed in ${formatDurationMs(result.durationMs)}`);
        progressLogger.artefact("builder output", path.resolve(runDir, "builder-output-last-message.md"));
        continue;
      }

      if (phase === "reviewer") {
        progressLogger.phaseStart("reviewer");
        ensurePlannerExecuted(projectedMetadata);
        ensurePhaseNotExecuted(projectedMetadata, "reviewer", "Reviewer");
        await assertArtefactsAbsent(runDir, ["reviewer-command.json", "reviewer-stdout.log", "reviewer-stderr.log", "reviewer-output-last-message.md", "reviewer-exit.json"], "Reviewer");

        const reviewerPrompt = await renderReviewerPromptForContinuation(
          templates?.["reviewer.md"] ?? "",
          options.dryRun ? projectedMetadata : metadata,
          runDir
        );
        if (options.dryRun) {
          progressLogger.phaseSkipped("reviewer", "skipped by dry-run");
          projectedMetadata.phases.reviewer = { ...projectedMetadata.phases.reviewer, status: "executed" };
          if (projectedMetadata.postWriteReview.required && projectedMetadata.postWriteReview.status === "pending") {
            projectedMetadata.postWriteReview = {
              ...projectedMetadata.postWriteReview,
              status: "completed",
              reason: "reviewer executed after write-enabled builder/fix",
              artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
            };
          }
          continue;
        }

        failedPhase = "reviewer";
        progressLogger.verbose(`reviewer model=${config.codex.reviewer.model} reasoning=${config.codex.reviewer.reasoningEffort} sandbox=read-only`);
        await updatePhase("reviewer", "unknown");
        const outputPath = path.resolve(runDir, "reviewer-output-last-message.md");
        progressLogger.info("[reviewer] waiting for Codex...");
        let result!: Awaited<ReturnType<typeof codexExecutor>>;
        await runCodexPhase("reviewer", async () => {
          result = await codexExecutor(
            {
              prompt: reviewerPrompt,
              role: "reviewer",
              model: config.codex.reviewer.model,
              reasoningEffort: config.codex.reviewer.reasoningEffort,
              workspaceRoot: metadata.workspaceRoot,
              outputLastMessagePath: outputPath,
              dryRun: false,
              requireGitRepo: config.safety.requireGitRepo,
              orchestratorRoot,
              sandboxMode: "read-only"
            },
            {
              streamOutput: options.streamCodex,
              onStdoutChunk: (chunk) => progressLogger.codexStdout(chunk),
              onStderrChunk: (chunk) => progressLogger.codexStderr(chunk)
            }
          );
        });

        if (!result.success) {
          await writeJson(runDir, "reviewer-exit.json", { success: false, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);
          if (metadata.postWriteReview.required && metadata.postWriteReview.status === "pending") {
            await setPostWriteReviewFailed("reviewer execution failed");
          }
          await bestEffortPhaseFailure("reviewer", "reviewer execution failed", ["reviewer-exit.json"]);
          const reviewerError = new Error(`Reviewer execution failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}. Diagnostics written to ${runDir}`);
          progressLogger.phaseFailed("reviewer", reviewerError);
          throw reviewerError;
        }

        await writeText(runDir, "08-reviewer-prompt.preview.md", reviewerPrompt, artefacts, true);
        await writeText(
          runDir,
          "reviewer-command.json",
          `${serialiseBackendCommandArtefact({
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            outputLastMessagePath: result.outputLastMessagePath,
            promptViaStdin: true,
            backend: result.backend
          })}\n`,
          artefacts,
          false
        );
        await writeText(runDir, "reviewer-stdout.log", result.stdout, artefacts, false);
        await writeText(runDir, "reviewer-stderr.log", result.stderr, artefacts, false);
        await writeText(runDir, "reviewer-output-last-message.md", result.outputLastMessage, artefacts, false);
        await writeJson(runDir, "reviewer-exit.json", { success: true, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);

        await updatePhase(
          "reviewer",
          "executed",
          undefined,
          ["reviewer-command.json", "reviewer-stdout.log", "reviewer-stderr.log", "reviewer-output-last-message.md", "reviewer-exit.json"],
          result.backend
        );
        if (metadata.postWriteReview.required && metadata.postWriteReview.status === "pending") {
          await setPostWriteReviewCompleted();
          progressLogger.phaseComplete("post-write-review", "completed");
        }
        progressLogger.phaseComplete("reviewer", `completed in ${formatDurationMs(result.durationMs)}`);
        progressLogger.artefact("reviewer output", path.resolve(runDir, "reviewer-output-last-message.md"));
        continue;
      }

      if (phase === "fixPlanning") {
        progressLogger.phaseStart("fix-planning");
        ensurePhaseExecuted(projectedMetadata, "reviewer", "--plan-fix requires reviewer phase executed.");
        ensurePhaseNotExecuted(projectedMetadata, "fixPlanning", "Fix planning");
        const reviewerProjectedInThisDryRun =
          options.dryRun && metadata.phases.reviewer?.status !== "executed" && projectedMetadata.phases.reviewer?.status === "executed";
        if (!reviewerProjectedInThisDryRun) {
          await assertArtefactExists(runDir, "reviewer-output-last-message.md", "Fix planning requires reviewer output artefact.");
        }
        await assertArtefactsAbsent(runDir, ["review-to-fix-command.json", "review-to-fix-stdout.log", "review-to-fix-stderr.log", "review-to-fix-output-last-message.md", "review-to-fix-exit.json", "review-to-fix-decision.json", "fix-prompt.extracted.md", "review-to-fix-decision.proceed.json"], "Fix planning");

        const reviewToFixPrompt = await renderReviewToFixPromptForContinuation(templates?.["review-to-fix.md"] ?? "", projectedMetadata, runDir);
        if (options.dryRun) {
          progressLogger.phaseSkipped("fix-planning", "skipped by dry-run");
          projectedMetadata.phases.fixPlanning = { ...projectedMetadata.phases.fixPlanning, status: "executed" };
          continue;
        }

        failedPhase = "fixPlanning";
        progressLogger.verbose(`fix-planning model=${config.codex.planner.model} reasoning=${config.codex.planner.reasoningEffort} sandbox=read-only`);
        await updatePhase("fixPlanning", "unknown");
        const outputPath = path.resolve(runDir, "review-to-fix-output-last-message.md");
        progressLogger.info("[fix-planning] waiting for Codex...");
        let result!: Awaited<ReturnType<typeof codexExecutor>>;
        await runCodexPhase("fix-planning", async () => {
          result = await codexExecutor(
            {
              prompt: reviewToFixPrompt,
              role: "planner",
              model: config.codex.planner.model,
              reasoningEffort: config.codex.planner.reasoningEffort,
              workspaceRoot: metadata.workspaceRoot,
              outputLastMessagePath: outputPath,
              dryRun: false,
              requireGitRepo: config.safety.requireGitRepo,
              orchestratorRoot,
              sandboxMode: "read-only"
            },
            {
              streamOutput: options.streamCodex,
              onStdoutChunk: (chunk) => progressLogger.codexStdout(chunk),
              onStderrChunk: (chunk) => progressLogger.codexStderr(chunk)
            }
          );
        });

        if (!result.success) {
          await writeJson(runDir, "review-to-fix-exit.json", { success: false, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);
          await bestEffortPhaseFailure("fixPlanning", "review-to-fix execution failed", ["review-to-fix-exit.json"]);
          const fixPlanError = new Error(`Review-to-fix execution failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}. Diagnostics written to ${runDir}`);
          progressLogger.phaseFailed("fix-planning", fixPlanError);
          throw fixPlanError;
        }

        await writeText(runDir, "09-review-to-fix-prompt.preview.md", reviewToFixPrompt, artefacts, true);
        await writeText(
          runDir,
          "review-to-fix-command.json",
          `${serialiseBackendCommandArtefact({
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            outputLastMessagePath: result.outputLastMessagePath,
            promptViaStdin: true,
            backend: result.backend
          })}\n`,
          artefacts,
          false
        );
        await writeText(runDir, "review-to-fix-stdout.log", result.stdout, artefacts, false);
        await writeText(runDir, "review-to-fix-stderr.log", result.stderr, artefacts, false);
        await writeText(runDir, "review-to-fix-output-last-message.md", result.outputLastMessage, artefacts, false);
        await writeJson(runDir, "review-to-fix-exit.json", { success: true, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);

        const parsed = parseReviewToFixOutput(result.outputLastMessage);
        await writeJson(runDir, "review-to-fix-decision.json", { decision: parsed.decision, rationale: parsed.rationale }, artefacts, false);
        if (parsed.decision === "FIX_REQUIRED") {
          await writeText(runDir, "fix-prompt.extracted.md", parsed.finalFixPrompt ?? "", artefacts, false);
          progressLogger.artefact("extracted fix prompt", path.resolve(runDir, "fix-prompt.extracted.md"));
        } else {
          await writeJson(runDir, "review-to-fix-decision.proceed.json", { proceed: true }, artefacts, false);
        }

        await updatePhase(
          "fixPlanning",
          "executed",
          undefined,
          ["review-to-fix-command.json", "review-to-fix-stdout.log", "review-to-fix-stderr.log", "review-to-fix-output-last-message.md", "review-to-fix-exit.json", "review-to-fix-decision.json"],
          result.backend
        );
        progressLogger.phaseComplete("fix-planning", `completed in ${formatDurationMs(result.durationMs)}`);
        progressLogger.artefact("fix-planning output", path.resolve(runDir, "review-to-fix-output-last-message.md"));
        continue;
      }

      if (phase === "fixExecution") {
        progressLogger.phaseStart("fix");
        ensurePhaseExecuted(projectedMetadata, "fixPlanning", "--execute-fix requires fixPlanning phase executed.");
        ensurePhaseNotExecuted(projectedMetadata, "fixExecution", "Fix execution");
        const fixPlanningProjectedInThisDryRun =
          options.dryRun && metadata.phases.fixPlanning?.status !== "executed" && projectedMetadata.phases.fixPlanning?.status === "executed";
        const decision = await readFixDecision(runDir, options.dryRun && fixPlanningProjectedInThisDryRun);
        if (options.dryRun) {
          if (decision === "PROCEED") {
            skippedFixBecauseProceed = true;
            projectedMetadata.phases.fixExecution = { ...projectedMetadata.phases.fixExecution, status: "skipped" };
            progressLogger.phaseSkipped("fix", "skipped because proceed");
          } else {
            projectedMetadata.phases.fixExecution = { ...projectedMetadata.phases.fixExecution, status: "executed" };
            if (allowWrites) {
              projectedMetadata.postWriteReview = {
                ...projectedMetadata.postWriteReview,
                required: true,
                status: "pending",
                reason: "write-enabled builder/fix executed",
                requiredByPhases: mergeRequiredByPhases(projectedMetadata.postWriteReview.requiredByPhases ?? [], ["fixExecution"]),
                artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
              };
            }
          }
          if (decision !== "PROCEED") {
            progressLogger.phaseSkipped("fix", "skipped by dry-run");
          }
          continue;
        }

        if (decision === "PROCEED") {
          skippedFixBecauseProceed = true;
          await updatePhase("fixExecution", "skipped", "fix execution skipped because review-to-fix decision was PROCEED");
          await writeJson(runDir, "fix-skipped.json", { skipped: true, reason: "review-to-fix decision was PROCEED" }, artefacts, false);
          progressLogger.phaseSkipped("fix", "skipped because proceed");
          continue;
        }
        if (allowWrites) {
          await ensureWriteSafetyIfNeeded();
        }
        progressLogger.verbose(`fix model=${config.codex.builder.model} reasoning=${config.codex.builder.reasoningEffort} sandbox=${allowWrites ? "workspace-write" : "read-only"}`);
        failedPhase = "fixExecution";
        let fixAudit: Awaited<ReturnType<typeof captureWriteAuditPreState>> | undefined;
        if (allowWrites) {
          try {
            progressLogger.phaseStart("write-audit:fix", "capturing pre-write state");
            fixAudit = await writeAuditPreCapture({ phase: "fix", workspaceRoot: metadata.workspaceRoot });
            progressLogger.phaseComplete("write-audit:fix", "pre-write captured");
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const preCaptureError = new Error(`Fix write-audit pre-capture failed: ${message}`);
            metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
            metadata.writeAudit.fix = { status: "failed", reason: `pre-capture failed: ${message}` };
            await bestEffortPhaseFailure("fixExecution", "fix write-audit pre-capture failed");
            progressLogger.phaseFailed("write-audit:fix", preCaptureError);
            progressLogger.phaseFailed("fix", preCaptureError);
            throw preCaptureError;
          }
        }
        let fixAuditError: Error | undefined;
        let fixExecutionError: Error | undefined;

        await assertArtefactExists(runDir, "fix-prompt.extracted.md", "Fix execution requires extracted fix prompt artefact.");
        await assertArtefactsAbsent(runDir, ["fix-command.json", "fix-stdout.log", "fix-stderr.log", "fix-output-last-message.md", "fix-exit.json", "fix-prompt.executed.md"], "Fix execution");

        await updatePhase("fixExecution", "unknown");
        const prompt = await readText(path.resolve(runDir, "fix-prompt.extracted.md"));
        const outputPath = path.resolve(runDir, "fix-output-last-message.md");
        progressLogger.info("[fix] waiting for Codex...");
        let result!: Awaited<ReturnType<typeof codexExecutor>>;
        await runCodexPhase("fix", async () => {
          result = await codexExecutor(
            {
              prompt,
              role: "builder",
              model: config.codex.builder.model,
              reasoningEffort: config.codex.builder.reasoningEffort,
              workspaceRoot: metadata.workspaceRoot,
              outputLastMessagePath: outputPath,
              dryRun: false,
              requireGitRepo: config.safety.requireGitRepo,
              orchestratorRoot,
              sandboxMode: allowWrites ? "workspace-write" : "read-only"
            },
            {
              streamOutput: options.streamCodex,
              onStdoutChunk: (chunk) => progressLogger.codexStdout(chunk),
              onStderrChunk: (chunk) => progressLogger.codexStderr(chunk)
            }
          );
        });

        await writeText(
          runDir,
          "fix-command.json",
          `${serialiseBackendCommandArtefact({
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            outputLastMessagePath: result.outputLastMessagePath,
            promptViaStdin: true,
            sandboxMode: allowWrites ? "workspace-write" : "read-only",
            backend: result.backend
          })}\n`,
          artefacts,
          false
        );
        await writeText(runDir, "fix-prompt.executed.md", prompt, artefacts, false);
        await writeText(runDir, "fix-stdout.log", result.stdout, artefacts, false);
        await writeText(runDir, "fix-stderr.log", result.stderr, artefacts, false);
        await writeText(runDir, "fix-output-last-message.md", result.outputLastMessage, artefacts, false);
        await writeJson(runDir, "fix-exit.json", { success: result.success, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);
        if (fixAudit) {
          try {
            progressLogger.phaseStart("write-audit:fix", "capturing post-write state");
            const summary = await writeAuditPostCapture({ runDir, capture: fixAudit });
            metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
            metadata.writeAudit.fix = { status: "captured", artefacts: summary.artefacts, changedFiles: summary.changedFilesAddedByPhase };
            progressLogger.phaseComplete("write-audit:fix", "post-write captured");
            progressLogger.artefact("write-audit:fix summary", path.resolve(runDir, "write-audit/fix/summary.json"));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            fixAuditError = new Error(`Fix write-audit capture failed: ${message}`);
            metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
            metadata.writeAudit.fix = { status: result.success ? "failed" : "partial", reason: message };
          }
        }

        if (!result.success) {
          fixExecutionError = new Error(`Fix execution failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}. Diagnostics written to ${runDir}`);
        }
        if (fixAuditError) {
          await bestEffortPhaseFailure("fixExecution", "fix write-audit capture failed", ["fix-exit.json"]);
          progressLogger.phaseFailed("write-audit:fix", fixAuditError);
          progressLogger.phaseFailed("fix", fixExecutionError ?? fixAuditError);
          throw fixExecutionError ?? fixAuditError;
        }
        if (fixExecutionError) {
          await bestEffortPhaseFailure("fixExecution", "fix execution failed", ["fix-exit.json"]);
          progressLogger.phaseFailed("fix", fixExecutionError);
          throw fixExecutionError;
        }
        await updatePhase(
          "fixExecution",
          "executed",
          undefined,
          ["fix-command.json", "fix-prompt.executed.md", "fix-stdout.log", "fix-stderr.log", "fix-output-last-message.md", "fix-exit.json"],
          result.backend
        );
        if (allowWrites) {
          await setPostWriteReviewPending(["fixExecution"]);
        }
        progressLogger.phaseComplete("fix", `completed in ${formatDurationMs(result.durationMs)}`);
        progressLogger.artefact("fix output", path.resolve(runDir, "fix-output-last-message.md"));
        continue;
      }

      if (phase === "checks") {
        progressLogger.phaseStart("checks");
        ensurePhaseNotExecuted(projectedMetadata, "checks", "Checks");
        const checksGate = canRunChecksWithMetadata(options.dryRun ? projectedMetadata : metadata);
        if (!checksGate.ok) {
          if (options.dryRun) {
            progressLogger.phaseFailed("checks", checksGate.reason ?? "checks blocked");
            throw new Error(checksGate.reason);
          }
          await writeJson(
            runDir,
            "checks-status.json",
            { state: "blocked", reason: checksGate.reason, postWriteReviewStatus: metadata.postWriteReview.status },
            artefacts,
            false
          );
          await bestEffortPhaseFailure("checks", checksGate.reason ?? "checks blocked", ["checks-status.json"]);
          progressLogger.phaseFailed("checks", checksGate.reason ?? "checks blocked");
          throw new Error(checksGate.reason);
        }
        if (options.dryRun) {
          progressLogger.phaseSkipped("checks", "skipped by dry-run");
          projectedMetadata.phases.checks = { ...projectedMetadata.phases.checks, status: "executed" };
          continue;
        }

        failedPhase = "checks";
        await updatePhase("checks", "unknown");
        let completed = 0;
        for (let i = 0; i < config.commands.checks.length; i += 1) {
          const check = config.commands.checks[i];
          progressLogger.info(`[checks] running: ${check.name}`);
          progressLogger.verbose(`[checks] command: ${check.command} ${check.args.join(" ")}`);
          const cwd = resolveCheckCommandCwd(check, orchestratorRoot, metadata.workspaceRoot);
          const result = await checkCommandExecutor({ name: check.name, command: check.command, args: check.args, cwd });
          const base = `checks/${String(i + 1).padStart(2, "0")}-${sanitizeCheckName(check.name)}`;
          await writeJson(runDir, `${base}-command.json`, { name: result.name, command: result.command, args: result.args, cwd: result.cwd }, artefacts, false);
          await writeText(runDir, `${base}-stdout.log`, result.stdout, artefacts, false);
          await writeText(runDir, `${base}-stderr.log`, result.stderr, artefacts, false);
          await writeJson(runDir, `${base}-exit.json`, { success: result.success, code: result.exitCode, signal: result.signal, durationMs: result.durationMs }, artefacts, false);
          completed += 1;
          if (!result.success) {
            await writeJson(runDir, "checks-status.json", { state: "failed", total: config.commands.checks.length, completed, error: `Check \"${check.name}\" failed` }, artefacts, false);
            await bestEffortPhaseFailure("checks", `check failed: ${check.name}`, ["checks-status.json"]);
            progressLogger.phaseFailed("checks", `check failed: ${check.name}`);
            throw new Error(`Checks failed. Diagnostics written to ${runDir}. Check \"${check.name}\" failed.`);
          }
        }

        await writeJson(runDir, "checks-status.json", { state: "executed", total: config.commands.checks.length, completed }, artefacts, false);
        await updatePhase("checks", "executed", config.commands.checks.length === 0 ? "no checks configured" : undefined, ["checks-status.json"]);
        progressLogger.phaseComplete("checks", "completed");
      }
    }

    if (options.planHtml) {
      const planHtmlPath = await writePlanHtmlFromRun(runDir, metadata, metadata.artefacts);
      artefacts.push(planHtmlPath);
      progressLogger.artefact("plan html", planHtmlPath);
    }
    if (!options.dryRun) {
      for (const artefact of artefacts) {
        const rel = toRunRelativePath(runDir, artefact);
        if (!metadata.artefacts.includes(rel)) {
          metadata.artefacts.push(rel);
        }
      }
      metadata.artefacts.sort((a, b) => a.localeCompare(b));
      markRunSuccess(metadata);
      await metadataWriter(runDir, metadata);
    }

    if (options.verbose) {
      void config;
    }

    progressLogger.info(options.dryRun ? "Run dry-run completed" : "Run completed successfully");

    return { runId: options.runId, runDir, configPath, dryRun: options.dryRun, selectedPhases: selected, before, after: snapshotStatuses(metadata), artefacts, skippedFixBecauseProceed, allowWrites, writeSafetyState, writeEnabledPhases };
  } catch (error) {
    if (!options.dryRun) {
      markRunFailure(metadata, error, failedPhase);
      try {
        await metadataWriter(runDir, metadata);
      } catch {
        // preserve original execution error
      }
    }
    if (failedPhase) {
      progressLogger.phaseFailed(failedPhase, error);
      progressLogger.info(`Run failed during phase: ${failedPhase}`);
    } else {
      progressLogger.phaseFailed("continue-run", error);
    }
    progressLogger.info(`Diagnostics: ${runDir}`);
    throw error;
  }
}

async function renderReviewerPromptForContinuation(template: string, metadata: RunMetadata, runDir: string): Promise<string> {
  const stageInstruction = await readText(path.resolve(runDir, "01-stage-input.md"), "");
  const plannerPrompt = await readText(path.resolve(runDir, "02-rendered-planner-prompt.md"), "[not available]");
  const plannerOutput = await readText(path.resolve(runDir, "06-planner-output-last-message.md"), "[not available]");
  const extractedBuilderPrompt = await readText(path.resolve(runDir, "builder-prompt.extracted.md"), "[not available]");
  const builderOutput = await readText(path.resolve(runDir, "builder-output-last-message.md"), "[not available]");
  const builderStdout = await readText(path.resolve(runDir, "builder-stdout.log"), "[not available]");
  const builderStderr = await readText(path.resolve(runDir, "builder-stderr.log"), "[not available]");
  const builderExit = await readText(path.resolve(runDir, "builder-exit.json"), "[not available]");
  const builderExecuted = metadata.phases.builder.status === "executed";

  const variables: TemplateVariables = {
    stage_name: metadata.stageName,
    stage_instruction: stageInstruction,
    timestamp: metadata.startedAt,
    workspace_root: metadata.workspaceRoot,
    run_dir: runDir,
    planner_prompt: plannerPrompt,
    planner_output: plannerOutput,
    extracted_builder_prompt: extractedBuilderPrompt,
    builder_output: builderOutput,
    builder_stdout: builderStdout,
    builder_stderr: builderStderr,
    builder_exit: builderExit,
    builder_execution_state: builderExecuted
      ? "Builder executed. Review planner output, extracted builder prompt, and builder execution results."
      : "Builder was not executed in Stage E. Limit review to planner output and extracted builder prompt artefacts.",
    stage_e_execution_scope:
      "Stage E scope: review-to-fix loop, git commands, and test/build execution are all disabled and must remain unexecuted.",
    write_audit_context: buildWriteAuditContext(metadata),
    test_output: "[placeholder: test output skipped in Stage E]",
    git_diff: "[placeholder: git diff skipped in Stage E]",
    git_status: "[placeholder: git status skipped in Stage E]"
  };
  return renderTemplate(template, variables);
}

async function renderReviewToFixPromptForContinuation(template: string, metadata: RunMetadata, runDir: string): Promise<string> {
  const stageInstruction = await readText(path.resolve(runDir, "01-stage-input.md"), "");
  const plannerOutput = await readText(path.resolve(runDir, "06-planner-output-last-message.md"), "[not available]");
  const extractedBuilderPrompt = await readText(path.resolve(runDir, "builder-prompt.extracted.md"), "[not available]");
  const builderOutput = await readText(path.resolve(runDir, "builder-output-last-message.md"), "[not available]");
  const reviewOutput = await readText(path.resolve(runDir, "reviewer-output-last-message.md"), "[not available]");
  const reviewerExit = await readText(path.resolve(runDir, "reviewer-exit.json"), "[not available]");
  return renderTemplate(template, {
    stage_name: metadata.stageName,
    stage_instruction: stageInstruction,
    timestamp: metadata.startedAt,
    workspace_root: metadata.workspaceRoot,
    run_dir: runDir,
    planner_output: plannerOutput,
    extracted_builder_prompt: extractedBuilderPrompt,
    builder_output: builderOutput,
    review_output: reviewOutput,
    reviewer_exit: reviewerExit,
    git_status: "[placeholder: git status skipped in current stage]",
    test_output: "[placeholder: test output skipped in current stage]",
    git_diff: "[placeholder: git diff skipped in current stage]"
  });
}

function selectedPhases(options: ContinueOptions): ContinuePhase[] {
  const phases: ContinuePhase[] = [];
  if (options.executeBuilder) phases.push("builder");
  if (options.executeReviewer) phases.push("reviewer");
  if (options.planFix) phases.push("fixPlanning");
  if (options.executeFix) phases.push("fixExecution");
  if (options.runChecks) phases.push("checks");
  return phases;
}

function ensurePlannerExecuted(metadata: RunMetadata): void {
  ensurePhaseExecuted(metadata, "planner", "Continuation requires planner phase executed in run.json.");
}

function ensurePhaseExecuted(metadata: RunMetadata, phase: RunPhaseName, message: string): void {
  if (metadata.phases[phase]?.status !== "executed") {
    throw new Error(message);
  }
}

function ensurePhaseNotExecuted(metadata: RunMetadata, phase: RunPhaseName, label: string): void {
  if (metadata.phases[phase]?.status === "executed") {
    throw new Error(`${label} continuation is not allowed because the phase is already executed.`);
  }
}

async function readRequiredRunMetadata(runDir: string, runId: string): Promise<RunMetadata> {
  const runMetadataPath = path.resolve(runDir, "run.json");
  let raw: string;
  try {
    raw = await readFile(runMetadataPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`run.json is required for continue-run and was not found/readable at ${runMetadataPath}. ${message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`run.json is malformed for run ${runId}: ${message}`);
  }
  return validateRunMetadata(parsed, runId);
}

function validateRunMetadata(value: unknown, expectedRunId: string): RunMetadata {
  const invalid = (message: string): never => {
    throw new Error(`Invalid run metadata: ${message}`);
  };
  if (!value || typeof value !== "object") invalid("root must be an object.");
  const v = value as Record<string, unknown>;

  if (v.version !== 1) invalid("version must be 1.");
  for (const key of ["runId", "projectName", "stageName", "workspaceRoot", "orchestratorRoot", "configPath"] as const) {
    const field = v[key];
    if (typeof field !== "string" || field.trim().length === 0) invalid(`${key} must be a non-empty string.`);
  }
  if (v.runId !== expectedRunId) invalid(`runId mismatch. Expected ${expectedRunId}, got ${String(v.runId)}.`);
  if (!VALID_RUN_STATUSES.has(v.status as RunMetadata["status"])) {
    invalid("status must be one of running, success, failed.");
  }
  if (!v.resolvedOptions || typeof v.resolvedOptions !== "object") invalid("resolvedOptions must be an object.");
  if (!v.phases || typeof v.phases !== "object") invalid("phases must be an object.");
  const phases = v.phases as Record<string, unknown>;
  for (const phase of REQUIRED_PHASES) {
    const phaseValue = phases[phase];
    if (!phaseValue || typeof phaseValue !== "object") invalid(`phases.${phase} is required.`);
    const status = (phaseValue as Record<string, unknown>).status;
    if (!VALID_PHASE_STATUSES.has(status as RunPhaseStatus)) {
      invalid(`phases.${phase}.status must be one of unknown, disabled, skipped, executed, failed.`);
    }
  }
  if (v.artefacts !== undefined && !Array.isArray(v.artefacts)) invalid("artefacts must be an array when present.");
  return v as unknown as RunMetadata;
}

function assertRunOwnership(metadata: RunMetadata, runDir: string, runsRoot: string, configuredProjectName: string): void {
  if (metadata.runId !== path.basename(runDir)) {
    throw new Error(`run.json runId mismatch. Expected ${path.basename(runDir)}, got ${metadata.runId}.`);
  }
  const rel = path.relative(runsRoot, runDir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Run directory resolves outside configured runs root. runsRoot=${runsRoot} runDir=${runDir}`);
  }
  if (metadata.projectName.trim().toLowerCase() !== configuredProjectName.trim().toLowerCase()) {
    throw new Error(`Run project mismatch. run.json project=${metadata.projectName}, config project=${configuredProjectName}.`);
  }
}

function snapshotStatuses(metadata: RunMetadata): Record<RunPhaseName, RunPhaseStatus> {
  return {
    planner: metadata.phases.planner?.status ?? "unknown",
    builder: metadata.phases.builder?.status ?? "unknown",
    reviewer: metadata.phases.reviewer?.status ?? "unknown",
    fixPlanning: metadata.phases.fixPlanning?.status ?? "unknown",
    fixExecution: metadata.phases.fixExecution?.status ?? "unknown",
    checks: metadata.phases.checks?.status ?? "unknown"
  };
}

async function readFixDecision(runDir: string, allowMissingDecisionForProjectedDryRun = false): Promise<"FIX_REQUIRED" | "PROCEED" | undefined> {
  const decisionPath = path.resolve(runDir, "review-to-fix-decision.json");
  const raw = await readText(decisionPath, "");
  if (!raw) {
    if (allowMissingDecisionForProjectedDryRun) return undefined;
    throw new Error("Fix execution requires review-to-fix-decision.json with decision FIX_REQUIRED.");
  }
  let parsed: { decision?: string };
  try {
    parsed = JSON.parse(raw) as { decision?: string };
  } catch {
    if (allowMissingDecisionForProjectedDryRun) return undefined;
    throw new Error("Fix execution requires review-to-fix-decision.json with decision FIX_REQUIRED or PROCEED.");
  }
  if (parsed.decision === "FIX_REQUIRED" || parsed.decision === "PROCEED") {
    return parsed.decision;
  }
  if (allowMissingDecisionForProjectedDryRun) return undefined;
  throw new Error("Fix execution requires review-to-fix-decision.json with decision FIX_REQUIRED or PROCEED.");
}

function cloneMetadata(metadata: RunMetadata): RunMetadata {
  return JSON.parse(JSON.stringify(metadata)) as RunMetadata;
}

async function assertArtefactsAbsent(runDir: string, fileNames: string[], phaseLabel: string): Promise<void> {
  for (const fileName of fileNames) {
    const absolute = path.resolve(runDir, fileName);
    try {
      await access(absolute);
      throw new Error(`${phaseLabel} continuation is not allowed because artefact already exists: ${fileName}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

async function assertArtefactExists(runDir: string, relativePath: string, message: string): Promise<void> {
  const absolute = path.resolve(runDir, relativePath);
  try {
    await access(absolute);
  } catch {
    throw new Error(message);
  }
}

async function writeText(runDir: string, relativePath: string, content: string, written: string[], allowOverwrite: boolean): Promise<void> {
  const absolute = path.resolve(runDir, relativePath);
  await preventOverwriteUnlessAllowed(absolute, allowOverwrite);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
  written.push(absolute);
}

async function writeJson(runDir: string, relativePath: string, value: unknown, written: string[], allowOverwrite: boolean): Promise<void> {
  await writeText(runDir, relativePath, `${JSON.stringify(value, null, 2)}\n`, written, allowOverwrite);
}

async function preventOverwriteUnlessAllowed(filePath: string, allowOverwrite: boolean): Promise<void> {
  try {
    await access(filePath);
    if (!allowOverwrite) {
      throw new Error(`Refusing to overwrite existing artefact: ${filePath}`);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return;
    }
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) {
      throw error;
    }
    throw error;
  }
}

async function readText(filePath: string, fallback = ""): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

function sanitizeCheckName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function buildWriteAuditContext(metadata: RunMetadata): string {
  const phases: string[] = [];
  if (metadata.writeAudit?.builder?.status === "captured") phases.push("builder");
  if (metadata.writeAudit?.fix?.status === "captured") phases.push("fix");
  if (phases.length === 0) {
    return "No write-audit artefacts available for reviewer context.";
  }
  const changedFiles = Array.from(
    new Set([...(metadata.writeAudit?.builder?.changedFiles ?? []), ...(metadata.writeAudit?.fix?.changedFiles ?? [])])
  ).sort((a, b) => a.localeCompare(b));
  const artefacts = Array.from(
    new Set([...(metadata.writeAudit?.builder?.artefacts ?? []), ...(metadata.writeAudit?.fix?.artefacts ?? [])])
  ).sort((a, b) => a.localeCompare(b));
  const matching = (suffix: string): string[] => artefacts.filter((artefact) => artefact.endsWith(suffix));
  const summaries = matching("/summary.json");
  const diffStats = artefacts.filter((artefact) => artefact.endsWith("/pre-diff-stat.txt") || artefact.endsWith("/post-diff-stat.txt"));
  const patches = artefacts.filter((artefact) => artefact.endsWith("/pre-diff.patch") || artefact.endsWith("/post-diff.patch"));
  return [
    `Write-enabled phases executed: ${phases.join(", ")}`,
    `Changed files from write audit: ${changedFiles.length > 0 ? changedFiles.join(", ") : "[none]"}`,
    `Write-audit summary paths: ${summaries.length > 0 ? summaries.join(", ") : "[none]"}`,
    `Write-audit diff-stat paths: ${diffStats.length > 0 ? diffStats.join(", ") : "[none]"}`,
    `Write-audit patch paths: ${patches.length > 0 ? patches.join(", ") : "[none]"}`,
    `All write-audit artefacts: ${artefacts.length > 0 ? artefacts.join(", ") : "[none]"}`,
    "Reviewer must inspect write-enabled changes using these artefacts."
  ].join("\n");
}
