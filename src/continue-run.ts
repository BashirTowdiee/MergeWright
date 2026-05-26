import path from "node:path";
import { executeCheckCommand } from "./commands.js";
import { loadAndValidateConfig, resolveConfigPath } from "./config.js";
import { createAgentExecutor } from "./execution-backends/agent-executor.js";
import { writePlanHtmlFromRun } from "./plan-html.js";
import { loadPromptTemplates } from "./prompts.js";
import { NOOP_PROGRESS_LOGGER } from "./progress-logger.js";
import { captureWriteAuditPostStateAndWriteArtefacts, captureWriteAuditPreState } from "./write-audit.js";
import { markRunFailure, markRunSuccess, toRunRelativePath, writeRunMetadata } from "./run-metadata.js";
import { resolveRunDir, resolveRunsRoot, validateRunId } from "./runs.js";
import { assertRunOwnership, cloneMetadata, readRequiredRunMetadata, snapshotStatuses } from "./workflows/continuation/metadata.js";
import {
  executeBuilderContinuation,
  executeChecksContinuation,
  executeFixExecutionContinuation,
  executeFixPlanningContinuation,
  executeReviewerContinuation
} from "./workflows/continuation/phase-executors.js";
import type { ContinueOptions, ContinuePhase, ContinueResult } from "./workflows/continuation/contracts.js";
import type { ContinuationState } from "./workflows/continuation/state.js";
import { persistWriteSafetyState, type ContinuationContext } from "./workflows/continuation/state.js";

export type { ContinueOptions, ContinueResult } from "./workflows/continuation/contracts.js";

const ORDERED_PHASES: ContinuePhase[] = ["builder", "reviewer", "fixPlanning", "fixExecution", "checks"];

export async function continueRun(options: ContinueOptions): Promise<ContinueResult> {
  const progressLogger = options.progressLogger ?? NOOP_PROGRESS_LOGGER;
  validateRunId(options.runId);
  progressLogger.info(`Continuing run: ${options.runId}`);

  const selected = selectedPhases(options);
  if (selected.length === 0) {
    throw new Error(
      "continue-run requires at least one phase flag. Supported flags: --execute-builder, --execute-reviewer, --plan-fix, --execute-fix, --run-checks."
    );
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

  const context: ContinuationContext = {
    options,
    runDir,
    metadata,
    codexExecutor: createAgentExecutor(config, {
      overrideAgentExecutor: options.codexExecutor
    }),
    writeAuditPreCapture: options.writeAuditPreCapture ?? captureWriteAuditPreState,
    writeAuditPostCapture: options.writeAuditPostCapture ?? captureWriteAuditPostStateAndWriteArtefacts,
    checkCommandExecutor: options.checkCommandExecutor ?? executeCheckCommand,
    metadataWriter: options.metadataWriter ?? writeRunMetadata,
    progressLogger,
    config,
    orchestratorRoot,
    allowWrites,
    writeEnabledPhases,
    artefacts
  };
  const state: ContinuationState = {
    failedPhase: undefined,
    skippedFixBecauseProceed: false,
    writeSafetyState: allowWrites && options.dryRun ? "skipped by dry-run" : "not checked",
    writeSafetyChecked: false
  };

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

  try {
    if (allowWrites && options.dryRun) {
      state.writeSafetyState = "skipped by dry-run";
      progressLogger.phaseSkipped("write-safety", "skipped by dry-run");
    }
    if (allowWrites) {
      await persistWriteSafetyState(context, state, options.dryRun ? "dryRun=true" : undefined);
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
        await executeBuilderContinuation({ context, state, projectedMetadata, templates, runCodexPhase });
        continue;
      }
      if (phase === "reviewer") {
        await executeReviewerContinuation({ context, state, projectedMetadata, templates, runCodexPhase });
        continue;
      }
      if (phase === "fixPlanning") {
        await executeFixPlanningContinuation({ context, state, projectedMetadata, templates, runCodexPhase });
        continue;
      }
      if (phase === "fixExecution") {
        await executeFixExecutionContinuation({ context, state, projectedMetadata, templates, runCodexPhase });
        continue;
      }
      if (phase === "checks") {
        await executeChecksContinuation({ context, state, projectedMetadata, templates, runCodexPhase });
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
      await context.metadataWriter(runDir, metadata);
    }

    progressLogger.info(options.dryRun ? "Run dry-run completed" : "Run completed successfully");

    return {
      runId: options.runId,
      runDir,
      configPath,
      dryRun: options.dryRun,
      selectedPhases: selected,
      before,
      after: snapshotStatuses(metadata),
      artefacts,
      skippedFixBecauseProceed: state.skippedFixBecauseProceed,
      allowWrites,
      writeSafetyState: state.writeSafetyState,
      writeEnabledPhases
    };
  } catch (error) {
    if (!options.dryRun) {
      markRunFailure(metadata, error, state.failedPhase);
      try {
        await context.metadataWriter(runDir, metadata);
      } catch {
        // preserve original execution error
      }
    }

    if (state.failedPhase) {
      progressLogger.phaseFailed(state.failedPhase, error);
      progressLogger.info(`Run failed during phase: ${state.failedPhase}`);
    } else {
      progressLogger.phaseFailed("continue-run", error);
    }
    progressLogger.info(`Diagnostics: ${runDir}`);
    throw error;
  }
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
