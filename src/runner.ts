import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeCheckCommand } from "./commands.js";
import type { CodexExecutor } from "./codex.js";
import { renderTemplate, type TemplateVariables } from "./prompts.js";
import { NOOP_PROGRESS_LOGGER, type ProgressLogger } from "./progress-logger.js";
import { captureWriteAuditPostStateAndWriteArtefacts, captureWriteAuditPreState } from "./write-audit.js";
import {
  addRunArtefact,
  updateRunPhase,
  writeRunMetadata,
  type RunMetadata,
  type RunPhaseName
} from "./run-metadata.js";
import { validateStageName } from "./stage.js";
import { checkWriteSafety, type WriteSafetyResult } from "./write-safety.js";
import { createInitialClassicRunArtefacts } from "./workflows/classic-run/run-artefacts.js";
import { resolveClassicRunExecutionOptions } from "./workflows/classic-run/run-context.js";
import { validateRunOptions } from "./workflows/classic-run/run-options-validation.js";
import { createInitialClassicRunMetadata, prepareClassicRunContext } from "./workflows/classic-run/run-setup.js";
import { executePlannerPhase } from "./workflows/classic-run/planner-phase.js";
import { executeBuilderPhase } from "./workflows/classic-run/builder-phase.js";
import { executeReviewerPhase } from "./workflows/classic-run/reviewer-phase.js";
import { executeFixPlanningPhase } from "./workflows/classic-run/fix-planning-phase.js";
import { executeFixPhase } from "./workflows/classic-run/fix-phase.js";
import { executeChecksPhase } from "./workflows/classic-run/checks-phase.js";
import { finaliseClassicRunSuccess } from "./workflows/classic-run/run-finalisation.js";
import { finaliseClassicRunFailure } from "./workflows/classic-run/run-failure.js";
import { buildClassicRunResult } from "./workflows/classic-run/run-result.js";

export interface RunOptions {
  stageName: string;
  configArg: string;
  repoOverride?: string;
  dryRun: boolean;
  executePlanner?: boolean;
  executeBuilder?: boolean;
  executeReviewer?: boolean;
  planFix?: boolean;
  executeFix?: boolean;
  runChecks?: boolean;
  allowWrites?: boolean;
  streamCodex?: boolean;
  verbose: boolean;
  orchestratorRoot: string;
  progressLogger?: ProgressLogger;
  codexExecutor?: CodexExecutor;
  writeAuditPreCapture?: typeof captureWriteAuditPreState;
  writeAuditPostCapture?: typeof captureWriteAuditPostStateAndWriteArtefacts;
  checkCommandExecutor?: typeof executeCheckCommand;
  metadataWriter?: typeof writeRunMetadata;
  preset?: string;
  planHtml?: boolean;
}

export interface RunResult {
  stageName: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  configPath: string;
  runDir: string;
  artefacts: string[];
  dryRun: boolean;
  checksState: "disabled" | "skipped by dry-run" | "executed" | "failed";
  allowWrites: boolean;
  writeSafetyState: "not checked" | "passed" | "failed" | "skipped by dry-run";
  writeEnabledPhases: Array<"builder" | "fix">;
}

export async function runStage(options: RunOptions): Promise<RunResult> {
  const progressLogger = options.progressLogger ?? NOOP_PROGRESS_LOGGER;
  validateRunOptions(options);

  validateStageName(options.stageName);
  progressLogger.info(`Running stage: ${options.stageName}`);

  const context = await prepareClassicRunContext(options, progressLogger);
  const {
    orchestratorRoot,
    configPath,
    config,
    executor,
    targetWorkspaceRoot,
    stageInstruction,
    templates,
    runDir,
    variables
  } = context;
  const { executePlanner, executeBuilder, executeReviewer, planFix, executeFix, runChecks, allowWrites, writeEnabledPhases } =
    resolveClassicRunExecutionOptions(options);
  let writeSafetyState: RunResult["writeSafetyState"] = allowWrites && options.dryRun ? "skipped by dry-run" : "not checked";
  let writeSafetyResult: WriteSafetyResult | undefined;

  const metadata = createInitialClassicRunMetadata({
    options,
    context,
    executionOptions: { executePlanner, executeBuilder, executeReviewer, planFix, executeFix, runChecks, allowWrites, writeEnabledPhases }
  });
  const metadataWriter = options.metadataWriter ?? writeRunMetadata;
  const writeAuditPreCapture = options.writeAuditPreCapture ?? captureWriteAuditPreState;
  const writeAuditPostCapture = options.writeAuditPostCapture ?? captureWriteAuditPostStateAndWriteArtefacts;
  await metadataWriter(runDir, metadata);

  const renderedPlanner = renderTemplate(templates["planner-stage.md"], variables);
  const finalReviewPreview = renderTemplate(templates["final-review.md"], variables);

  const artefacts: Record<string, string> = createInitialClassicRunArtefacts({
    stageInstruction,
    renderedPlannerPrompt: renderedPlanner,
    finalReviewPromptPreview: finalReviewPreview,
    allowWrites,
    writeEnabledPhases,
    dryRun: options.dryRun,
    postWriteReviewReason: metadata.postWriteReview.reason,
    postWriteReviewRequiredByPhases: metadata.postWriteReview.requiredByPhases
  });

  const reviewerSkipBase = "# Placeholder\n\nReviewer execution was not requested. Pass --execute-reviewer (with --execute-planner) to execute once.";
  const reviewerSkipDryRun = "# Placeholder\n\nReviewer execution skipped because dryRun=true.";
  let plannerOutputLastMessage = "";
  let extractedBuilderPrompt = "";
  let builderOutputLastMessage = "";
  let builderExecutionMetadata: {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    durationMs: number;
    success: boolean;
    skipped: boolean;
  } | null = null;
  let reviewerOutputLastMessage = "";
  let reviewerExecutionMetadata: {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    durationMs: number;
    success: boolean;
    skipped: boolean;
  } | null = null;
  const refreshReviewerPreview = (builderWasExecuted: boolean): void => {
    artefacts["08-reviewer-prompt.preview.md"] = renderReviewerPrompt({
      template: templates["reviewer.md"],
      baseVariables: variables,
      plannerPrompt: renderedPlanner,
      plannerOutputLastMessage,
      extractedBuilderPrompt,
      builderOutputLastMessage,
      builderExecutionMetadata,
      builderWasExecuted,
      writeAuditContext: buildWriteAuditContext(metadata)
    });
  };
  const renderReviewToFixPrompt = (): string =>
    renderTemplate(templates["review-to-fix.md"], {
      ...variables,
      planner_output: plannerOutputLastMessage || "[not available]",
      extracted_builder_prompt: extractedBuilderPrompt || "[not available]",
      builder_output: builderOutputLastMessage || "[not available]",
      review_output: reviewerOutputLastMessage || "[not available]",
      reviewer_exit: reviewerExecutionMetadata
        ? JSON.stringify(
            {
              success: reviewerExecutionMetadata.success,
              code: reviewerExecutionMetadata.exitCode,
              signal: reviewerExecutionMetadata.signal,
              durationMs: reviewerExecutionMetadata.durationMs,
              skipped: reviewerExecutionMetadata.skipped
            },
            null,
            2
          )
        : "[not available]"
    });

  refreshReviewerPreview(false);

  const syncMetadataArtefacts = (): void => {
    for (const artefact of Object.keys(artefacts)) {
      addRunArtefact(metadata, artefact);
    }
  };
  const persistMetadata = async (priorError?: unknown): Promise<void> => {
    syncMetadataArtefacts();
    try {
      await metadataWriter(runDir, metadata);
    } catch (metadataError) {
      if (!priorError) {
        throw metadataError;
      }
    }
  };
  const updatePhaseAndPersist = async (
    phase: RunPhaseName,
    update: Parameters<typeof updateRunPhase>[2]
  ): Promise<void> => {
    updateRunPhase(metadata, phase, update);
    await persistMetadata();
  };
  const bestEffortUpdatePhaseAndPersistOnFailure = async (
    phase: RunPhaseName,
    update: Parameters<typeof updateRunPhase>[2]
  ): Promise<void> => {
    try {
      await updatePhaseAndPersist(phase, update);
    } catch {
      // Intentionally preserve original execution/check/parse failure.
    }
  };
  const setPhaseDisabled = async (phase: RunPhaseName, reason: string): Promise<void> => {
    const now = new Date().toISOString();
    await updatePhaseAndPersist(phase, { status: "disabled", reason, startedAt: now, completedAt: now });
  };
  const setPhaseSkipped = async (phase: RunPhaseName, reason: string): Promise<void> => {
    const now = new Date().toISOString();
    await updatePhaseAndPersist(phase, { status: "skipped", reason, startedAt: now, completedAt: now });
  };
  let failedPhase: RunPhaseName | undefined;
  const canRunChecks = (): { ok: boolean; reason?: string } => {
    if (!metadata.postWriteReview.required) {
      return { ok: true };
    }
    if (metadata.postWriteReview.status === "completed") {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `Checks blocked: post-write review status is "${metadata.postWriteReview.status}". Execute reviewer first to complete post-write review.`
    };
  };
  const ensureWriteSafetyIfNeeded = async (): Promise<void> => {
    if (!allowWrites || options.dryRun || writeSafetyResult) {
      if (allowWrites && options.dryRun) {
        writeSafetyState = "skipped by dry-run";
        metadata.writeSafety = { state: writeSafetyState, allowWrites };
        progressLogger.phaseSkipped("write-safety", "skipped by dry-run");
      }
      return;
    }
    progressLogger.phaseStart("write-safety", "checking target workspace");
    if (!config.writeSafety.enabled) {
      writeSafetyState = "failed";
      metadata.writeSafety = { state: writeSafetyState, allowWrites };
      artefacts["write-safety-result.json"] = JSON.stringify({ ok: false, failures: ["writeSafety.enabled is false"], summary: "Write safety check failed." }, null, 2);
      await writeArtefacts(runDir, { "write-safety-result.json": artefacts["write-safety-result.json"] });
      progressLogger.artefact("write safety result", path.resolve(runDir, "write-safety-result.json"));
      await persistMetadata();
      progressLogger.phaseFailed("write-safety", "writeSafety.enabled is false");
      throw new Error("Write mode requested but writeSafety.enabled is false.");
    }
    writeSafetyResult = await checkWriteSafety({ workspaceRoot: targetWorkspaceRoot, config });
    writeSafetyState = writeSafetyResult.ok ? "passed" : "failed";
    metadata.writeSafety = { state: writeSafetyState, allowWrites };
    artefacts["write-safety-result.json"] = JSON.stringify(writeSafetyResult, null, 2);
    await writeArtefacts(runDir, { "write-safety-result.json": artefacts["write-safety-result.json"] });
    progressLogger.artefact("write safety result", path.resolve(runDir, "write-safety-result.json"));
    await persistMetadata();
    if (!writeSafetyResult.ok) {
      progressLogger.phaseFailed("write-safety", "checks failed");
      throw new Error("Write mode blocked: write safety checks failed. See write-safety-result.json.");
    }
    progressLogger.phaseComplete("write-safety", "passed");
  };
  try {
    if (!executePlanner) {
      await setPhaseDisabled("planner", "planner execution disabled");
      progressLogger.phaseSkipped("planner", "disabled");
    }
    if (!executeBuilder) {
      await setPhaseDisabled("builder", "builder execution disabled");
      progressLogger.phaseSkipped("builder", "disabled");
    }
    if (!executeReviewer) {
      await setPhaseDisabled("reviewer", "reviewer execution disabled");
      progressLogger.phaseSkipped("reviewer", "disabled");
    }
    if (!planFix) {
      await setPhaseDisabled("fixPlanning", "fix planning disabled");
      progressLogger.phaseSkipped("fix-planning", "disabled");
    }
    if (!executeFix) {
      await setPhaseDisabled("fixExecution", "fix execution disabled");
      progressLogger.phaseSkipped("fix", "disabled");
    }
    if (!runChecks) {
      await setPhaseDisabled("checks", "target checks disabled");
    }

    const plannerState = await executePlannerPhase({
      executePlanner,
      executeBuilder,
      executeReviewer,
      planFix,
      executeFix,
      dryRun: options.dryRun,
      runDir,
      orchestratorRoot,
      targetWorkspaceRoot,
      renderedPlanner,
      streamCodex: options.streamCodex ?? false,
      progressLogger,
      config,
      executor,
      artefacts,
      reviewerSkipBase,
      reviewerSkipDryRun,
      updatePhaseAndPersist,
      setPhaseSkipped,
      bestEffortUpdatePhaseAndPersistOnFailure,
      writeArtefacts,
      refreshReviewerPreview,
      renderReviewToFixPrompt,
      setFailedPhase: (phase) => {
        failedPhase = phase;
      },
      onPlannerParsed: (plannerOutput, builderPrompt) => {
        plannerOutputLastMessage = plannerOutput;
        extractedBuilderPrompt = builderPrompt;
      }
    });

    if (plannerState === "executed") {
      await executeBuilderPhase({
        executeBuilder,
        allowWrites,
        streamCodex: options.streamCodex ?? false,
        runDir,
        orchestratorRoot,
        targetWorkspaceRoot,
        extractedBuilderPrompt,
        progressLogger,
        config,
        executor,
        artefacts,
        metadata,
        ensureWriteSafetyIfNeeded,
        writeAuditPreCapture,
        writeAuditPostCapture,
        updatePhaseAndPersist,
        bestEffortUpdatePhaseAndPersistOnFailure,
        writeArtefacts,
        setFailedPhase: (phase) => {
          failedPhase = phase;
        },
        onBuilderCompleted: (output, executionMetadata) => {
          builderOutputLastMessage = output;
          builderExecutionMetadata = executionMetadata;
        },
        refreshReviewerPreview
      });
    }

    if (plannerState === "executed") {
      refreshReviewerPreview(executeBuilder);
    }
    const reviewerPrompt = artefacts["08-reviewer-prompt.preview.md"];
    await executeReviewerPhase({
      executeReviewer,
      dryRun: options.dryRun,
      allowWrites,
      writeEnabledPhases,
      streamCodex: options.streamCodex ?? false,
      runDir,
      orchestratorRoot,
      targetWorkspaceRoot,
      reviewerPrompt,
      progressLogger,
      config,
      executor,
      artefacts,
      metadata,
      reviewerSkipBase,
      updatePhaseAndPersist,
      setPhaseSkipped,
      bestEffortUpdatePhaseAndPersistOnFailure,
      writeArtefacts,
      setFailedPhase: (phase) => {
        failedPhase = phase;
      },
      onReviewerCompleted: (output, executionMetadata) => {
        reviewerOutputLastMessage = output;
        reviewerExecutionMetadata = executionMetadata;
      }
    });

    artefacts["09-review-to-fix-prompt.preview.md"] = renderReviewToFixPrompt();
    const reviewToFixPrompt = artefacts["09-review-to-fix-prompt.preview.md"];
    const parsedReviewToFixOutput = await executeFixPlanningPhase({
      planFix,
      dryRun: options.dryRun,
      streamCodex: options.streamCodex ?? false,
      runDir,
      orchestratorRoot,
      targetWorkspaceRoot,
      reviewToFixPrompt,
      progressLogger,
      config,
      executor,
      artefacts,
      updatePhaseAndPersist,
      bestEffortUpdatePhaseAndPersistOnFailure,
      writeArtefacts,
      setFailedPhase: (phase) => {
        failedPhase = phase;
      }
    });

    if (planFix && parsedReviewToFixOutput) {
      await executeFixPhase({
        executeFix,
        dryRun: options.dryRun,
        allowWrites,
        streamCodex: options.streamCodex ?? false,
        runDir,
        orchestratorRoot,
        targetWorkspaceRoot,
        progressLogger,
        config,
        executor,
        artefacts,
        metadata,
        ensureWriteSafetyIfNeeded,
        writeAuditPreCapture,
        writeAuditPostCapture,
        updatePhaseAndPersist,
        setPhaseSkipped,
        bestEffortUpdatePhaseAndPersistOnFailure,
        writeArtefacts,
        setFailedPhase: (phase) => {
          failedPhase = phase;
        },
        fixDecision: parsedReviewToFixOutput.decision,
        fixPrompt: parsedReviewToFixOutput.finalFixPrompt ?? ""
      });
    }

    artefacts["test-output.placeholder.md"] = "# Placeholder\n\nTest execution remains disabled in current stage.";
    artefacts["diff.placeholder.patch"] = "# Placeholder\n# Git diff generation remains disabled in current stage.";

    const checksState = await executeChecksPhase({
      runChecks,
      dryRun: options.dryRun,
      runDir,
      orchestratorRoot,
      targetWorkspaceRoot,
      config,
      progressLogger,
      artefacts,
      checkCommandExecutor: options.checkCommandExecutor ?? executeCheckCommand,
      updatePhaseAndPersist,
      setPhaseSkipped,
      bestEffortUpdatePhaseAndPersistOnFailure,
      writeArtefacts,
      canRunChecks,
      postWriteReviewStatus: metadata.postWriteReview.status,
      setFailedPhase: (phase) => {
        failedPhase = phase;
      }
    });

    const written = await finaliseClassicRunSuccess({
      runDir,
      artefacts,
      metadata,
      writeArtefacts,
      persistMetadata,
      planHtml: options.planHtml ?? false,
      progressLogger
    });

    if (options.verbose) {
      void config;
    }

    progressLogger.info(options.dryRun ? "Run dry-run completed" : "Run completed successfully");

    return buildClassicRunResult({
      stageName: options.stageName,
      orchestratorRoot,
      targetWorkspaceRoot,
      configPath,
      runDir,
      artefacts: written,
      dryRun: options.dryRun,
      checksState,
      allowWrites,
      writeSafetyState,
      writeEnabledPhases
    });
  } catch (error) {
    return finaliseClassicRunFailure({
      error,
      failedPhase,
      metadata,
      persistMetadata,
      progressLogger,
      runDir
    });
  }
}

async function writeArtefacts(runDir: string, artefacts: Record<string, string>): Promise<string[]> {
  const entries = Object.entries(artefacts).sort(([a], [b]) => a.localeCompare(b));
  const written: string[] = [];
  for (const [fileName, content] of entries) {
    const filePath = path.resolve(runDir, fileName);
    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
      written.push(filePath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed writing artefact ${filePath}: ${msg}`);
    }
  }
  return written;
}

function renderReviewerPrompt(input: {
  template: string;
  baseVariables: TemplateVariables;
  plannerPrompt: string;
  plannerOutputLastMessage: string;
  extractedBuilderPrompt: string;
  builderOutputLastMessage: string;
  builderExecutionMetadata: {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    durationMs: number;
    success: boolean;
    skipped: boolean;
  } | null;
  builderWasExecuted: boolean;
  writeAuditContext: string;
}): string {
  const reviewerVariables: TemplateVariables = {
    ...input.baseVariables,
    planner_prompt: input.plannerPrompt,
    planner_output: input.plannerOutputLastMessage || "[not available]",
    extracted_builder_prompt: input.extractedBuilderPrompt || "[not available]",
    builder_output: input.builderOutputLastMessage || "[not available]",
    builder_stdout: input.builderExecutionMetadata?.stdout ?? "[not available]",
    builder_stderr: input.builderExecutionMetadata?.stderr ?? "[not available]",
    builder_exit: input.builderExecutionMetadata
      ? JSON.stringify(
          {
            success: input.builderExecutionMetadata.success,
            code: input.builderExecutionMetadata.exitCode,
            signal: input.builderExecutionMetadata.signal,
            durationMs: input.builderExecutionMetadata.durationMs,
            skipped: input.builderExecutionMetadata.skipped
          },
          null,
          2
        )
      : "[not available]",
    builder_execution_state: input.builderWasExecuted
      ? "Builder executed. Review planner output, extracted builder prompt, and builder execution results."
      : "Builder was not executed in Stage E. Limit review to planner output and extracted builder prompt artefacts.",
    stage_e_execution_scope:
      "Stage E scope: review-to-fix loop, git commands, and test/build execution are all disabled and must remain unexecuted.",
    write_audit_context: input.writeAuditContext,
    test_output: "[placeholder: test output skipped in Stage E]",
    git_diff: "[placeholder: git diff skipped in Stage E]",
    git_status: "[placeholder: git status skipped in Stage E]"
  };

  return renderTemplate(input.template, reviewerVariables);
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
