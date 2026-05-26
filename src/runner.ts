import { executeCheckCommand } from "./commands.js";
import type { AgentExecutor } from "./agent-executor.js";
import { renderTemplate } from "./prompts.js";
import { NOOP_PROGRESS_LOGGER, type ProgressLogger } from "./progress-logger.js";
import { captureWriteAuditPostStateAndWriteArtefacts, captureWriteAuditPreState } from "./write-audit.js";
import {
  writeRunMetadata,
  type RunMetadata,
  type RunPhaseName
} from "./run-metadata.js";
import { validateStageName } from "./stage.js";
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
import { createClassicPromptState } from "./workflows/classic-run/prompt-state.js";
import { applyDisabledPhaseStatuses, createClassicRunControl } from "./workflows/classic-run/run-control.js";
import { writeClassicRunArtefacts } from "./workflows/classic-run/artefact-writer.js";

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
  codexExecutor?: AgentExecutor;
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
  const promptState = createClassicPromptState({
    templates,
    variables,
    renderedPlanner,
    metadata,
    artefacts
  });
  promptState.refreshReviewerPreview(false);

  const control = createClassicRunControl({
    allowWrites,
    dryRun: options.dryRun,
    config,
    targetWorkspaceRoot,
    progressLogger,
    metadata,
    runDir,
    artefacts,
    metadataWriter,
    writeArtefacts: writeClassicRunArtefacts
  });

  let failedPhase: RunPhaseName | undefined;
  try {
    await applyDisabledPhaseStatuses({
      executePlanner,
      executeBuilder,
      executeReviewer,
      planFix,
      executeFix,
      runChecks,
      setPhaseDisabled: control.setPhaseDisabled,
      progressLogger
    });

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
      updatePhaseAndPersist: control.updatePhaseAndPersist,
      setPhaseSkipped: control.setPhaseSkipped,
      bestEffortUpdatePhaseAndPersistOnFailure: control.bestEffortUpdatePhaseAndPersistOnFailure,
      writeArtefacts: writeClassicRunArtefacts,
      refreshReviewerPreview: promptState.refreshReviewerPreview,
      renderReviewToFixPrompt: promptState.renderReviewToFixPrompt,
      setFailedPhase: (phase) => {
        failedPhase = phase;
      },
      onPlannerParsed: promptState.setPlannerParsed
    });

    if (plannerState === "executed") {
      await executeBuilderPhase({
        executeBuilder,
        allowWrites,
        streamCodex: options.streamCodex ?? false,
        runDir,
        orchestratorRoot,
        targetWorkspaceRoot,
        extractedBuilderPrompt: promptState.getExtractedBuilderPrompt(),
        progressLogger,
        config,
        executor,
        artefacts,
        metadata,
        ensureWriteSafetyIfNeeded: control.ensureWriteSafetyIfNeeded,
        writeAuditPreCapture,
        writeAuditPostCapture,
        updatePhaseAndPersist: control.updatePhaseAndPersist,
        bestEffortUpdatePhaseAndPersistOnFailure: control.bestEffortUpdatePhaseAndPersistOnFailure,
        writeArtefacts: writeClassicRunArtefacts,
        setFailedPhase: (phase) => {
          failedPhase = phase;
        },
        onBuilderCompleted: promptState.setBuilderCompleted,
        refreshReviewerPreview: promptState.refreshReviewerPreview
      });
    }

    if (plannerState === "executed") {
      promptState.refreshReviewerPreview(executeBuilder);
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
      updatePhaseAndPersist: control.updatePhaseAndPersist,
      setPhaseSkipped: control.setPhaseSkipped,
      bestEffortUpdatePhaseAndPersistOnFailure: control.bestEffortUpdatePhaseAndPersistOnFailure,
      writeArtefacts: writeClassicRunArtefacts,
      setFailedPhase: (phase) => {
        failedPhase = phase;
      },
      onReviewerCompleted: promptState.setReviewerCompleted
    });

    artefacts["09-review-to-fix-prompt.preview.md"] = promptState.renderReviewToFixPrompt();
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
      updatePhaseAndPersist: control.updatePhaseAndPersist,
      bestEffortUpdatePhaseAndPersistOnFailure: control.bestEffortUpdatePhaseAndPersistOnFailure,
      writeArtefacts: writeClassicRunArtefacts,
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
        ensureWriteSafetyIfNeeded: control.ensureWriteSafetyIfNeeded,
        writeAuditPreCapture,
        writeAuditPostCapture,
        updatePhaseAndPersist: control.updatePhaseAndPersist,
        setPhaseSkipped: control.setPhaseSkipped,
        bestEffortUpdatePhaseAndPersistOnFailure: control.bestEffortUpdatePhaseAndPersistOnFailure,
        writeArtefacts: writeClassicRunArtefacts,
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
      updatePhaseAndPersist: control.updatePhaseAndPersist,
      setPhaseSkipped: control.setPhaseSkipped,
      bestEffortUpdatePhaseAndPersistOnFailure: control.bestEffortUpdatePhaseAndPersistOnFailure,
      writeArtefacts: writeClassicRunArtefacts,
      canRunChecks: control.canRunChecks,
      postWriteReviewStatus: metadata.postWriteReview.status,
      setFailedPhase: (phase) => {
        failedPhase = phase;
      }
    });

    const written = await finaliseClassicRunSuccess({
      runDir,
      artefacts,
      metadata,
      writeArtefacts: writeClassicRunArtefacts,
      persistMetadata: control.persistMetadata,
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
      writeSafetyState: control.getWriteSafetyState(),
      writeEnabledPhases
    });
  } catch (error) {
    return finaliseClassicRunFailure({
      error,
      failedPhase,
      metadata,
      persistMetadata: control.persistMetadata,
      progressLogger,
      runDir
    });
  }
}
