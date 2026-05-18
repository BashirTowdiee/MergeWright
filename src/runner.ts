import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadAndValidateConfig, resolveConfigPath, validateWorkspaceSafety } from "./config.js";
import { executeCheckCommand, resolveCheckCommandCwd } from "./commands.js";
import type { CodexExecutor } from "./codex.js";
import { createCodexCompatibleExecutor } from "./execution-backends/codex-compatible-executor.js";
import { serialiseBackendCommandArtefact } from "./execution-backends/backend-command-artefact.js";
import { parsePlannerOutput } from "./planner-output.js";
import { writePlanHtmlFromRun } from "./plan-html.js";
import { loadPromptTemplates, renderTemplate, type TemplateVariables } from "./prompts.js";
import { formatDurationMs, NOOP_PROGRESS_LOGGER, type ProgressLogger } from "./progress-logger.js";
import { parseReviewToFixOutput } from "./review-to-fix-output.js";
import { captureWriteAuditPostStateAndWriteArtefacts, captureWriteAuditPreState } from "./write-audit.js";
import {
  addRunArtefact,
  createInitialRunMetadata,
  markRunFailure,
  markRunSuccess,
  toRunRelativePath,
  updateRunPhase,
  writeRunMetadata,
  type RunMetadata,
  type RunPhaseName
} from "./run-metadata.js";
import { validateStageName } from "./stage.js";
import { checkWriteSafety, type WriteSafetyResult } from "./write-safety.js";

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
  if ((options.executeBuilder ?? false) && !(options.executePlanner ?? false)) {
    throw new Error("--execute-builder requires --execute-planner");
  }
  if ((options.executeReviewer ?? false) && !(options.executePlanner ?? false)) {
    throw new Error("--execute-reviewer requires --execute-planner");
  }
  if ((options.planFix ?? false) && !(options.executeReviewer ?? false)) {
    throw new Error("--plan-fix requires --execute-reviewer");
  }
  if ((options.executeFix ?? false) && !(options.planFix ?? false)) {
    throw new Error("--execute-fix requires --plan-fix");
  }
  if ((options.allowWrites ?? false) && !(options.executeBuilder ?? false) && !(options.executeFix ?? false)) {
    throw new Error("--allow-writes requires --execute-builder or --execute-fix.");
  }
  if ((options.allowWrites ?? false) && ((options.executeBuilder ?? false) || (options.executeFix ?? false)) && !(options.executeReviewer ?? false) && !options.dryRun) {
    throw new Error("--allow-writes requires --execute-reviewer for post-write review");
  }

  validateStageName(options.stageName);
  progressLogger.info(`Running stage: ${options.stageName}`);

  const orchestratorRoot = path.resolve(options.orchestratorRoot);
  progressLogger.phaseStart("setup", "loading config");
  const configPath = resolveConfigPath(orchestratorRoot, options.configArg);
  const config = await loadAndValidateConfig(configPath);
  const executor: CodexExecutor = createCodexCompatibleExecutor(config, {
    overrideCodexExecutor: options.codexExecutor
  });
  progressLogger.verbose(`Config: ${configPath}`);

  const targetWorkspaceRoot = path.resolve(options.repoOverride ?? config.workspaceRoot);
  progressLogger.info(`Target: ${targetWorkspaceRoot}`);
  progressLogger.phaseStart("setup", "validating workspace");
  await validateWorkspaceSafety(targetWorkspaceRoot, config.safety.requireGitRepo);

  const stagesDir = path.resolve(orchestratorRoot, config.paths.stagesDir);
  const promptsDir = path.resolve(orchestratorRoot, config.paths.promptsDir);
  const runsBaseDir = resolveAndValidateRunsBaseDir(
    orchestratorRoot,
    targetWorkspaceRoot,
    config.paths.runsDir,
    config.projectName
  );

  const stagePath = path.resolve(stagesDir, `${options.stageName}.md`);
  progressLogger.phaseStart("setup", "loading stage file");
  const stageInstruction = await readRequired(stagePath, "stage file");
  progressLogger.phaseStart("setup", "rendering prompts");
  const templates = await loadPromptTemplates(promptsDir);
  progressLogger.verbose(`Stage file: ${stagePath}`);
  progressLogger.verbose(`Prompts dir: ${promptsDir}`);

  const timestamp = makeTimestamp();
  const runId = `${timestamp}-${options.stageName}`;
  const runDir = path.resolve(runsBaseDir, runId);
  progressLogger.phaseStart("setup", "creating run directory");
  await mkdir(runDir, { recursive: true });
  progressLogger.phaseComplete("setup", `run directory: ${runDir}`);

  const executePlanner = options.executePlanner ?? false;
  const executeBuilder = options.executeBuilder ?? false;
  const executeReviewer = options.executeReviewer ?? false;
  const planFix = options.planFix ?? false;
  const executeFix = options.executeFix ?? false;
  const runChecks = options.runChecks ?? false;
  const allowWrites = options.allowWrites ?? false;
  const writeEnabledPhases: Array<"builder" | "fix"> = [
    ...(executeBuilder ? (["builder"] as const) : []),
    ...(executeFix ? (["fix"] as const) : [])
  ];
  let writeSafetyState: RunResult["writeSafetyState"] = allowWrites && options.dryRun ? "skipped by dry-run" : "not checked";
  let writeSafetyResult: WriteSafetyResult | undefined;

  const metadata = createInitialRunMetadata({
    runId,
    projectName: config.projectName,
    stageName: options.stageName,
    preset: options.preset,
    workspaceRoot: targetWorkspaceRoot,
    orchestratorRoot,
    configPath,
    resolvedOptions: {
      dryRun: options.dryRun,
      allowWrites,
      executePlanner,
      executeBuilder,
      executeReviewer,
      planFix,
      executeFix,
      runChecks
    }
  });
  const metadataWriter = options.metadataWriter ?? writeRunMetadata;
  const writeAuditPreCapture = options.writeAuditPreCapture ?? captureWriteAuditPreState;
  const writeAuditPostCapture = options.writeAuditPostCapture ?? captureWriteAuditPostStateAndWriteArtefacts;
  const runCodexPhase = async (phase: "planner" | "builder" | "reviewer" | "fix-planning" | "fix", action: () => Promise<void>): Promise<void> => {
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
  metadata.writeSafety = { state: options.dryRun && allowWrites ? "skipped by dry-run" : "not checked", allowWrites };
  metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
  metadata.postWriteReview = metadata.postWriteReview ?? {
    required: false,
    status: "not-required",
    reason: "no write-enabled builder/fix executed",
    requiredByPhases: [],
    artefacts: []
  };
  if (allowWrites && writeEnabledPhases.length > 0) {
    metadata.postWriteReview = {
      required: true,
      status: options.dryRun ? "not-required" : "pending",
      reason: "write-enabled builder/fix executed",
      requiredByPhases: writeEnabledPhases.map((phase) => (phase === "builder" ? "builder" : "fixExecution")),
      artefacts: options.dryRun ? [] : ["post-write-review-required.json", "post-write-review-status.json"]
    };
  }
  await metadataWriter(runDir, metadata);

  const variables = buildTemplateVariables({
    stageName: options.stageName,
    stageInstruction,
    timestamp,
    workspaceRoot: targetWorkspaceRoot,
    runDir
  });

  const renderedPlanner = renderTemplate(templates["planner-stage.md"], variables);
  const finalReviewPreview = renderTemplate(templates["final-review.md"], variables);

  const artefacts: Record<string, string> = {
    "01-stage-input.md": stageInstruction,
    "02-rendered-planner-prompt.md": renderedPlanner,
    "10-final-review-prompt.preview.md": finalReviewPreview
  };
  if (allowWrites && writeEnabledPhases.length > 0) {
    if (!options.dryRun) {
      artefacts["post-write-review-required.json"] = JSON.stringify(
        {
          required: true,
          reason: metadata.postWriteReview.reason,
          requiredByPhases: metadata.postWriteReview.requiredByPhases
        },
        null,
        2
      );
      artefacts["post-write-review-status.json"] = JSON.stringify({ status: "pending", reason: "awaiting reviewer execution" }, null, 2);
    } else {
      artefacts["post-write-review-status.json"] = JSON.stringify(
        { status: "not-required", reason: "dryRun=true; post-write review would be required when writes execute" },
        null,
        2
      );
    }
  }

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

  if (!executePlanner) {
    artefacts["03-planner-output.placeholder.md"] = "# Placeholder\n\nPlanner execution is disabled. Pass --execute-planner to enable planner extraction mode.";
    artefacts["04-builder-prompt.placeholder.md"] = "# Placeholder\n\nBuilder prompt extraction is disabled until planner execution is enabled.";
    artefacts["05-builder-output.placeholder.md"] = "# Placeholder\n\nBuilder execution was not requested. Pass --execute-builder (with --execute-planner) to execute once.";
    artefacts["06-test-output.placeholder.md"] = "# Placeholder\n\nTest execution remains disabled in current stage.";
    artefacts["07-diff.placeholder.patch"] = "# Placeholder\n# Git diff generation remains disabled in current stage.";
    artefacts["reviewer-output.placeholder.md"] = reviewerSkipBase;
    artefacts["09-review-to-fix-prompt.preview.md"] = renderReviewToFixPrompt();
    artefacts["review-to-fix-output.placeholder.md"] = "# Placeholder\n\nReview-to-fix execution was not requested. Pass --plan-fix (with --execute-reviewer) to execute once.";
    if (executeFix) {
      artefacts["fix-skipped.json"] = JSON.stringify(
        { skipped: true, reason: "Fix execution skipped because planner execution is disabled." },
        null,
        2
      );
    }
  } else if (options.dryRun) {
    const plannerBackendName = config.agents.planner.backend;
    const plannerBackendType = config.executionBackends[plannerBackendName]?.type;
    const shouldRouteDryRunPlanner = plannerBackendType !== "codex-cli";
    let plannerDryRunExecution: Awaited<ReturnType<typeof executor>> | undefined;
    if (shouldRouteDryRunPlanner) {
      const outputLastMessagePath = path.resolve(runDir, "06-planner-output-last-message.md");
      plannerDryRunExecution = await executor({
        prompt: renderedPlanner,
        role: "planner",
        model: config.codex.planner.model,
        reasoningEffort: config.codex.planner.reasoningEffort,
        workspaceRoot: targetWorkspaceRoot,
        outputLastMessagePath,
        dryRun: true,
        requireGitRepo: config.safety.requireGitRepo,
        orchestratorRoot,
        sandboxMode: "read-only"
      });
      artefacts["03-planner-command.args.json"] = serialiseBackendCommandArtefact({
        command: plannerDryRunExecution.command,
        args: plannerDryRunExecution.args,
        cwd: plannerDryRunExecution.cwd,
        outputLastMessagePath: plannerDryRunExecution.outputLastMessagePath,
        promptViaStdin: true,
        sandboxMode: "read-only",
        backend: plannerDryRunExecution.backend
      });
      artefacts["04-planner-stdout.log"] = plannerDryRunExecution.stdout;
      artefacts["05-planner-stderr.log"] = plannerDryRunExecution.stderr;
      artefacts["06-planner-output-last-message.md"] = plannerDryRunExecution.outputLastMessage;
      artefacts["07-planner-exit.json"] = JSON.stringify(
        {
          success: plannerDryRunExecution.success,
          code: plannerDryRunExecution.exitCode,
          signal: plannerDryRunExecution.signal,
          durationMs: plannerDryRunExecution.durationMs,
          skipped: plannerDryRunExecution.skipped
        },
        null,
        2
      );
    } else {
      artefacts["03-planner-command.args.json"] = JSON.stringify({ skipped: true, reason: "dryRun=true" }, null, 2);
      artefacts["04-planner-stdout.log"] = "";
      artefacts["05-planner-stderr.log"] = "Planner execution skipped because dryRun=true.";
      artefacts["06-planner-output-last-message.md"] = "";
      artefacts["07-planner-exit.json"] = JSON.stringify(
        { skipped: true, success: true, code: 0, signal: null, durationMs: 0 },
        null,
        2
      );
    }
    await updatePhaseAndPersist("planner", {
      status: "skipped",
      reason: "planner execution skipped because dryRun=true",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      ...(plannerDryRunExecution?.backend ? { backend: plannerDryRunExecution.backend } : {})
    });
    progressLogger.phaseSkipped("planner", "skipped by dry-run");
    if (executeBuilder) {
      await setPhaseSkipped("builder", "builder execution skipped because dryRun=true");
      progressLogger.phaseSkipped("builder", "skipped by dry-run");
    }
    if (planFix) {
      await setPhaseSkipped("fixPlanning", "review-to-fix execution skipped because dryRun=true");
      progressLogger.phaseSkipped("fix-planning", "skipped by dry-run");
    }
    if (executeFix) {
      await setPhaseSkipped("fixExecution", "fix execution skipped because dryRun=true");
      progressLogger.phaseSkipped("fix", "skipped by dry-run");
    }
    artefacts["builder-output.placeholder.md"] = "# Placeholder\n\nBuilder execution skipped because dryRun=true.";
    artefacts["test-output.placeholder.md"] = "# Placeholder\n\nTest execution remains disabled in current stage.";
    artefacts["diff.placeholder.patch"] = "# Placeholder\n# Git diff generation remains disabled in current stage.";
    artefacts["reviewer-output.placeholder.md"] = reviewerSkipDryRun;
    if (executeReviewer) {
      const reviewerBackendName = config.agents.reviewer.backend;
      const reviewerBackendType = config.executionBackends[reviewerBackendName]?.type;
      const shouldRouteDryRunReviewer = reviewerBackendType !== "codex-cli";
      if (shouldRouteDryRunReviewer) {
        const reviewerPrompt = artefacts["08-reviewer-prompt.preview.md"];
        const reviewerOutputLastMessagePath = path.resolve(runDir, "reviewer-output-last-message.md");
        const reviewerDryRunExecution = await executor({
          prompt: reviewerPrompt,
          role: "reviewer",
          model: config.codex.reviewer.model,
          reasoningEffort: config.codex.reviewer.reasoningEffort,
          workspaceRoot: targetWorkspaceRoot,
          outputLastMessagePath: reviewerOutputLastMessagePath,
          dryRun: true,
          requireGitRepo: config.safety.requireGitRepo,
          orchestratorRoot,
          sandboxMode: "read-only"
        });
        artefacts["reviewer-command.json"] = serialiseBackendCommandArtefact({
          command: reviewerDryRunExecution.command,
          args: reviewerDryRunExecution.args,
          cwd: reviewerDryRunExecution.cwd,
          outputLastMessagePath: reviewerDryRunExecution.outputLastMessagePath,
          promptViaStdin: true,
          sandboxMode: "read-only",
          backend: reviewerDryRunExecution.backend
        });
        artefacts["reviewer-stdout.log"] = reviewerDryRunExecution.stdout;
        artefacts["reviewer-stderr.log"] = reviewerDryRunExecution.stderr;
        artefacts["reviewer-output-last-message.md"] = reviewerDryRunExecution.outputLastMessage;
        artefacts["reviewer-exit.json"] = JSON.stringify(
          {
            success: reviewerDryRunExecution.success,
            code: reviewerDryRunExecution.exitCode,
            signal: reviewerDryRunExecution.signal,
            durationMs: reviewerDryRunExecution.durationMs,
            skipped: reviewerDryRunExecution.skipped
          },
          null,
          2
        );
        await updatePhaseAndPersist("reviewer", {
          status: "skipped",
          reason: "reviewer execution skipped because dryRun=true",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          backend: reviewerDryRunExecution.backend
        });
      } else {
        await setPhaseSkipped("reviewer", "reviewer execution skipped because dryRun=true");
        artefacts["reviewer-skipped.json"] = JSON.stringify(
          { skipped: true, reason: "Reviewer execution skipped because dryRun=true." },
          null,
          2
        );
      }
      progressLogger.phaseSkipped("reviewer", "skipped by dry-run");
    }
    artefacts["09-review-to-fix-prompt.preview.md"] = renderReviewToFixPrompt();
    if (planFix) {
      artefacts["review-to-fix-skipped.json"] = JSON.stringify(
        { skipped: true, reason: "Review-to-fix execution skipped because dryRun=true." },
        null,
        2
      );
      if (executeFix) {
        artefacts["fix-skipped.json"] = JSON.stringify(
          { skipped: true, reason: "Fix execution skipped because dryRun=true." },
          null,
          2
        );
      }
    } else {
      artefacts["review-to-fix-output.placeholder.md"] =
        "# Placeholder\n\nReview-to-fix execution was not requested. Pass --plan-fix (with --execute-reviewer) to execute once.";
      if (executeFix) {
        artefacts["fix-skipped.json"] = JSON.stringify(
          { skipped: true, reason: "Fix execution skipped because dryRun=true." },
          null,
          2
        );
      }
    }
  } else {
    progressLogger.phaseStart("planner");
    progressLogger.verbose(`planner model=${config.codex.planner.model} reasoning=${config.codex.planner.reasoningEffort} sandbox=read-only`);
    await updatePhaseAndPersist("planner", { status: "unknown", startedAt: new Date().toISOString() });
    failedPhase = "planner";
    const outputLastMessagePath = path.resolve(runDir, "06-planner-output-last-message.md");
    progressLogger.info("[planner] waiting for Codex...");
    let execution!: Awaited<ReturnType<typeof executor>>;
    await runCodexPhase("planner", async () => {
      execution = await executor(
        {
          prompt: renderedPlanner,
          role: "planner",
          model: config.codex.planner.model,
          reasoningEffort: config.codex.planner.reasoningEffort,
          workspaceRoot: targetWorkspaceRoot,
          outputLastMessagePath,
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

    artefacts["03-planner-command.args.json"] = serialiseBackendCommandArtefact({
      command: execution.command,
      args: execution.args,
      cwd: execution.cwd,
      outputLastMessagePath: execution.outputLastMessagePath,
      promptViaStdin: true,
      backend: execution.backend
    });
    artefacts["04-planner-stdout.log"] = execution.stdout;
    artefacts["05-planner-stderr.log"] = execution.stderr;
    artefacts["06-planner-output-last-message.md"] = execution.outputLastMessage;
    artefacts["07-planner-exit.json"] = JSON.stringify(
      {
        success: execution.success,
        code: execution.exitCode,
        signal: execution.signal,
        durationMs: execution.durationMs,
        skipped: execution.skipped
      },
      null,
      2
    );

    if (!execution.success) {
      const plannerExecutionError = new Error(
        `Planner execution failed with exit code ${execution.exitCode ?? "null"}${execution.signal ? ` signal ${execution.signal}` : ""}. Diagnostics written to ${runDir}`
      );
      progressLogger.phaseFailed("planner", plannerExecutionError);
      await bestEffortUpdatePhaseAndPersistOnFailure("planner", {
        status: "failed",
        completedAt: new Date().toISOString(),
        artefacts: ["03-planner-command.args.json", "04-planner-stdout.log", "05-planner-stderr.log", "06-planner-output-last-message.md", "07-planner-exit.json"]
      });
      artefacts["reviewer-skipped.json"] = JSON.stringify(
        { skipped: true, reason: "Reviewer execution skipped because planner execution failed." },
        null,
        2
      );
      await writeArtefacts(runDir, artefacts);
      throw plannerExecutionError;
    }

    try {
      const parsed = parsePlannerOutput(execution.outputLastMessage);
      artefacts["planner-decision.json"] = JSON.stringify({ decision: parsed.decision }, null, 2);
      artefacts["builder-prompt.extracted.md"] = parsed.finalBuilderPrompt;
      extractedBuilderPrompt = parsed.finalBuilderPrompt;
      plannerOutputLastMessage = execution.outputLastMessage;
      refreshReviewerPreview(false);
      await updatePhaseAndPersist("planner", {
        status: "executed",
        completedAt: new Date().toISOString(),
        backend: execution.backend,
        artefacts: [
          "03-planner-command.args.json",
          "04-planner-stdout.log",
          "05-planner-stderr.log",
          "06-planner-output-last-message.md",
          "07-planner-exit.json",
          "planner-decision.json",
          "builder-prompt.extracted.md"
        ]
      });
      progressLogger.phaseComplete("planner", `completed in ${formatDurationMs(execution.durationMs)}`);
      progressLogger.artefact("planner output", path.resolve(runDir, "06-planner-output-last-message.md"));
      progressLogger.artefact("extracted builder prompt", path.resolve(runDir, "builder-prompt.extracted.md"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const plannerParseError = new Error(`Planner output parsing failed. Diagnostics written to ${runDir}. ${message}`);
      artefacts["planner-output-parse-error.json"] = JSON.stringify({ error: message }, null, 2);
      progressLogger.phaseFailed("planner", plannerParseError);
      await bestEffortUpdatePhaseAndPersistOnFailure("planner", {
        status: "failed",
        completedAt: new Date().toISOString(),
        artefacts: ["planner-output-parse-error.json"]
      });
      await writeArtefacts(runDir, artefacts);
      throw plannerParseError;
    }

    if (!executeBuilder) {
      artefacts["builder-output.placeholder.md"] =
        "# Placeholder\n\nBuilder execution was not requested. Pass --execute-builder (with --execute-planner) to execute once.";
    } else {
      progressLogger.phaseStart("builder");
      progressLogger.verbose(`builder model=${config.codex.builder.model} reasoning=${config.codex.builder.reasoningEffort} sandbox=${allowWrites ? "workspace-write" : "read-only"}`);
      if (allowWrites) {
        await ensureWriteSafetyIfNeeded();
      }
      failedPhase = "builder";
      let builderAudit: Awaited<ReturnType<typeof captureWriteAuditPreState>> | undefined;
      if (allowWrites) {
        try {
          progressLogger.phaseStart("write-audit:builder", "capturing pre-write state");
          builderAudit = await writeAuditPreCapture({ phase: "builder", workspaceRoot: targetWorkspaceRoot });
          progressLogger.phaseComplete("write-audit:builder", "pre-write captured");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const preCaptureError = new Error(`Builder write-audit pre-capture failed: ${message}`);
          metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
          metadata.writeAudit.builder = { status: "failed", reason: `pre-capture failed: ${message}` };
          await bestEffortUpdatePhaseAndPersistOnFailure("builder", {
            status: "failed",
            completedAt: new Date().toISOString()
          });
          progressLogger.phaseFailed("write-audit:builder", preCaptureError);
          progressLogger.phaseFailed("builder", preCaptureError);
          throw preCaptureError;
        }
      }
      let builderAuditError: Error | undefined;
      let builderExecutionError: Error | undefined;
      await updatePhaseAndPersist("builder", { status: "unknown", startedAt: new Date().toISOString() });
      const builderOutputLastMessagePath = path.resolve(runDir, "builder-output-last-message.md");
      progressLogger.info("[builder] waiting for Codex...");
      let builderExecution!: Awaited<ReturnType<typeof executor>>;
      await runCodexPhase("builder", async () => {
        builderExecution = await executor(
          {
            prompt: extractedBuilderPrompt,
            role: "builder",
            model: config.codex.builder.model,
            reasoningEffort: config.codex.builder.reasoningEffort,
            workspaceRoot: targetWorkspaceRoot,
            outputLastMessagePath: builderOutputLastMessagePath,
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

      artefacts["builder-command.json"] = serialiseBackendCommandArtefact({
        command: builderExecution.command,
        args: builderExecution.args,
        cwd: builderExecution.cwd,
        outputLastMessagePath: builderExecution.outputLastMessagePath,
        promptViaStdin: true,
        sandboxMode: allowWrites ? "workspace-write" : "read-only",
        backend: builderExecution.backend
      });
      artefacts["builder-prompt.executed.md"] = extractedBuilderPrompt;
      artefacts["builder-stdout.log"] = builderExecution.stdout;
      artefacts["builder-stderr.log"] = builderExecution.stderr;
      artefacts["builder-output-last-message.md"] = builderExecution.outputLastMessage;
      builderOutputLastMessage = builderExecution.outputLastMessage;
      builderExecutionMetadata = {
        stdout: builderExecution.stdout,
        stderr: builderExecution.stderr,
        exitCode: builderExecution.exitCode,
        signal: builderExecution.signal,
        durationMs: builderExecution.durationMs,
        success: builderExecution.success,
        skipped: builderExecution.skipped
      };
      artefacts["builder-exit.json"] = JSON.stringify(
        {
          success: builderExecution.success,
          code: builderExecution.exitCode,
          signal: builderExecution.signal,
          durationMs: builderExecution.durationMs,
          skipped: builderExecution.skipped
        },
        null,
        2
      );
      if (builderAudit) {
        try {
          progressLogger.phaseStart("write-audit:builder", "capturing post-write state");
          const summary = await writeAuditPostCapture({ runDir, capture: builderAudit });
          metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
          metadata.writeAudit.builder = {
            status: "captured",
            artefacts: summary.artefacts,
            changedFiles: summary.changedFilesAddedByPhase
          };
          progressLogger.phaseComplete("write-audit:builder", "post-write captured");
          progressLogger.artefact("write-audit:builder summary", path.resolve(runDir, "write-audit/builder/summary.json"));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          builderAuditError = new Error(`Builder write-audit capture failed: ${message}`);
          metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
          metadata.writeAudit.builder = {
            status: builderExecution.success ? "failed" : "partial",
            reason: message
          };
        }
      }

      if (!builderExecution.success) {
        builderExecutionError = new Error(
          `Builder execution failed with exit code ${builderExecution.exitCode ?? "null"}${builderExecution.signal ? ` signal ${builderExecution.signal}` : ""}. Diagnostics written to ${runDir}`
        );
      }
      if (builderAuditError) {
        await writeArtefacts(runDir, artefacts);
        await bestEffortUpdatePhaseAndPersistOnFailure("builder", {
          status: builderExecution.success ? "failed" : "failed",
          completedAt: new Date().toISOString(),
          artefacts: ["builder-command.json", "builder-stdout.log", "builder-stderr.log", "builder-output-last-message.md", "builder-exit.json"]
        });
        progressLogger.phaseFailed("write-audit:builder", builderAuditError);
        progressLogger.phaseFailed("builder", builderExecutionError ?? builderAuditError);
        throw builderExecutionError ?? builderAuditError;
      }
      if (builderExecutionError) {
        await bestEffortUpdatePhaseAndPersistOnFailure("builder", {
          status: "failed",
          completedAt: new Date().toISOString(),
          artefacts: ["builder-command.json", "builder-stdout.log", "builder-stderr.log", "builder-output-last-message.md", "builder-exit.json"]
        });
        refreshReviewerPreview(true);
        artefacts["reviewer-skipped.json"] = JSON.stringify(
          { skipped: true, reason: "Reviewer execution skipped because builder execution failed." },
          null,
          2
        );
        await writeArtefacts(runDir, artefacts);
        progressLogger.phaseFailed("builder", builderExecutionError);
        throw builderExecutionError;
      }
      await updatePhaseAndPersist("builder", {
        status: "executed",
        completedAt: new Date().toISOString(),
        backend: builderExecution.backend,
        artefacts: ["builder-command.json", "builder-prompt.executed.md", "builder-stdout.log", "builder-stderr.log", "builder-output-last-message.md", "builder-exit.json"]
      });
      progressLogger.phaseComplete("builder", `completed in ${formatDurationMs(builderExecution.durationMs)}`);
      progressLogger.artefact("builder output", path.resolve(runDir, "builder-output-last-message.md"));
    }

    refreshReviewerPreview(executeBuilder);
    const reviewerPrompt = artefacts["08-reviewer-prompt.preview.md"];

    if (!executeReviewer) {
      artefacts["reviewer-output.placeholder.md"] = reviewerSkipBase;
    } else {
      progressLogger.phaseStart("reviewer");
      progressLogger.verbose(`reviewer model=${config.codex.reviewer.model} reasoning=${config.codex.reviewer.reasoningEffort} sandbox=read-only`);
      await updatePhaseAndPersist("reviewer", { status: "unknown", startedAt: new Date().toISOString() });
      failedPhase = "reviewer";
      const reviewerOutputLastMessagePath = path.resolve(runDir, "reviewer-output-last-message.md");
      progressLogger.info("[reviewer] waiting for Codex...");
      let reviewerExecution!: Awaited<ReturnType<typeof executor>>;
      await runCodexPhase("reviewer", async () => {
        reviewerExecution = await executor(
          {
            prompt: reviewerPrompt,
            role: "reviewer",
            model: config.codex.reviewer.model,
            reasoningEffort: config.codex.reviewer.reasoningEffort,
            workspaceRoot: targetWorkspaceRoot,
            outputLastMessagePath: reviewerOutputLastMessagePath,
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

      artefacts["reviewer-command.json"] = serialiseBackendCommandArtefact({
        command: reviewerExecution.command,
        args: reviewerExecution.args,
        cwd: reviewerExecution.cwd,
        outputLastMessagePath: reviewerExecution.outputLastMessagePath,
        promptViaStdin: true,
        sandboxMode: "read-only",
        backend: reviewerExecution.backend
      });
      artefacts["reviewer-stdout.log"] = reviewerExecution.stdout;
      artefacts["reviewer-stderr.log"] = reviewerExecution.stderr;
      artefacts["reviewer-output-last-message.md"] = reviewerExecution.outputLastMessage;
      reviewerOutputLastMessage = reviewerExecution.outputLastMessage;
      reviewerExecutionMetadata = {
        stdout: reviewerExecution.stdout,
        stderr: reviewerExecution.stderr,
        exitCode: reviewerExecution.exitCode,
        signal: reviewerExecution.signal,
        durationMs: reviewerExecution.durationMs,
        success: reviewerExecution.success,
        skipped: reviewerExecution.skipped
      };
      artefacts["reviewer-exit.json"] = JSON.stringify(
        {
          success: reviewerExecution.success,
          code: reviewerExecution.exitCode,
          signal: reviewerExecution.signal,
          durationMs: reviewerExecution.durationMs,
          skipped: reviewerExecution.skipped
        },
        null,
        2
      );

      if (!reviewerExecution.success) {
        if (allowWrites && writeEnabledPhases.length > 0) {
          metadata.postWriteReview = {
            ...metadata.postWriteReview,
            required: true,
            status: "failed",
            reason: "reviewer execution failed",
            requiredByPhases: writeEnabledPhases.map((phase) => (phase === "builder" ? "builder" : "fixExecution")),
            artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
          };
          artefacts["post-write-review-status.json"] = JSON.stringify({ status: "failed", reason: "reviewer execution failed" }, null, 2);
        }
        const reviewerExecutionError = new Error(
          `Reviewer execution failed with exit code ${reviewerExecution.exitCode ?? "null"}${reviewerExecution.signal ? ` signal ${reviewerExecution.signal}` : ""}. Diagnostics written to ${runDir}`
        );
        progressLogger.phaseFailed("reviewer", reviewerExecutionError);
        await bestEffortUpdatePhaseAndPersistOnFailure("reviewer", {
          status: "failed",
          completedAt: new Date().toISOString(),
          artefacts: ["reviewer-command.json", "reviewer-stdout.log", "reviewer-stderr.log", "reviewer-output-last-message.md", "reviewer-exit.json"]
        });
        await writeArtefacts(runDir, artefacts);
        throw reviewerExecutionError;
      }
      await updatePhaseAndPersist("reviewer", {
        status: "executed",
        completedAt: new Date().toISOString(),
        backend: reviewerExecution.backend,
        artefacts: ["reviewer-command.json", "reviewer-stdout.log", "reviewer-stderr.log", "reviewer-output-last-message.md", "reviewer-exit.json"]
      });
      progressLogger.phaseComplete("reviewer", `completed in ${formatDurationMs(reviewerExecution.durationMs)}`);
      progressLogger.artefact("reviewer output", path.resolve(runDir, "reviewer-output-last-message.md"));
      if (allowWrites && writeEnabledPhases.length > 0) {
        metadata.postWriteReview = {
          ...metadata.postWriteReview,
          required: true,
          status: "completed",
          reason: "reviewer executed after write-enabled builder/fix",
          requiredByPhases: writeEnabledPhases.map((phase) => (phase === "builder" ? "builder" : "fixExecution")),
          artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
        };
        artefacts["post-write-review-status.json"] = JSON.stringify({ status: "completed", reason: metadata.postWriteReview.reason }, null, 2);
        progressLogger.phaseComplete("post-write-review", "completed");
      }
    }

    artefacts["09-review-to-fix-prompt.preview.md"] = renderReviewToFixPrompt();
    const reviewToFixPrompt = artefacts["09-review-to-fix-prompt.preview.md"];
    if (!planFix) {
      artefacts["review-to-fix-output.placeholder.md"] =
        "# Placeholder\n\nReview-to-fix execution was not requested. Pass --plan-fix (with --execute-reviewer) to execute once.";
    } else {
      progressLogger.phaseStart("fix-planning");
      progressLogger.verbose(`fix-planning model=${config.codex.planner.model} reasoning=${config.codex.planner.reasoningEffort} sandbox=read-only`);
      await updatePhaseAndPersist("fixPlanning", { status: "unknown", startedAt: new Date().toISOString() });
      failedPhase = "fixPlanning";
      const reviewToFixOutputLastMessagePath = path.resolve(runDir, "review-to-fix-output-last-message.md");
      progressLogger.info("[fix-planning] waiting for Codex...");
      let reviewToFixExecution!: Awaited<ReturnType<typeof executor>>;
      await runCodexPhase("fix-planning", async () => {
        reviewToFixExecution = await executor(
          {
            prompt: reviewToFixPrompt,
            role: "planner",
            model: config.codex.planner.model,
            reasoningEffort: config.codex.planner.reasoningEffort,
            workspaceRoot: targetWorkspaceRoot,
            outputLastMessagePath: reviewToFixOutputLastMessagePath,
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

      artefacts["review-to-fix-command.json"] = serialiseBackendCommandArtefact({
        command: reviewToFixExecution.command,
        args: reviewToFixExecution.args,
        cwd: reviewToFixExecution.cwd,
        outputLastMessagePath: reviewToFixExecution.outputLastMessagePath,
        promptViaStdin: true,
        sandboxMode: "read-only",
        backend: reviewToFixExecution.backend
      });
      artefacts["review-to-fix-stdout.log"] = reviewToFixExecution.stdout;
      artefacts["review-to-fix-stderr.log"] = reviewToFixExecution.stderr;
      artefacts["review-to-fix-output-last-message.md"] = reviewToFixExecution.outputLastMessage;
      artefacts["review-to-fix-exit.json"] = JSON.stringify(
        {
          success: reviewToFixExecution.success,
          code: reviewToFixExecution.exitCode,
          signal: reviewToFixExecution.signal,
          durationMs: reviewToFixExecution.durationMs,
          skipped: reviewToFixExecution.skipped
        },
        null,
        2
      );

      if (!reviewToFixExecution.success) {
        const reviewToFixExecutionError = new Error(
          `Review-to-fix execution failed with exit code ${reviewToFixExecution.exitCode ?? "null"}${reviewToFixExecution.signal ? ` signal ${reviewToFixExecution.signal}` : ""}. Diagnostics written to ${runDir}`
        );
        progressLogger.phaseFailed("fix-planning", reviewToFixExecutionError);
        await bestEffortUpdatePhaseAndPersistOnFailure("fixPlanning", {
          status: "failed",
          completedAt: new Date().toISOString(),
          artefacts: ["review-to-fix-command.json", "review-to-fix-stdout.log", "review-to-fix-stderr.log", "review-to-fix-output-last-message.md", "review-to-fix-exit.json"]
        });
        await writeArtefacts(runDir, artefacts);
        throw reviewToFixExecutionError;
      }

      let parsedReviewToFixOutput: ReturnType<typeof parseReviewToFixOutput>;
      try {
        parsedReviewToFixOutput = parseReviewToFixOutput(reviewToFixExecution.outputLastMessage);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const reviewToFixParseError = new Error(
          `Review-to-fix output parsing failed. Diagnostics written to ${runDir}. ${message}`
        );
        artefacts["review-to-fix-parse-error.json"] = JSON.stringify({ error: message }, null, 2);
        progressLogger.phaseFailed("fix-planning", reviewToFixParseError);
        await bestEffortUpdatePhaseAndPersistOnFailure("fixPlanning", {
          status: "failed",
          completedAt: new Date().toISOString(),
          artefacts: ["review-to-fix-parse-error.json"]
        });
        await writeArtefacts(runDir, artefacts);
        throw reviewToFixParseError;
      }

      artefacts["review-to-fix-decision.json"] = JSON.stringify(
        {
          decision: parsedReviewToFixOutput.decision,
          rationale: parsedReviewToFixOutput.rationale
        },
        null,
        2
      );
      if (parsedReviewToFixOutput.decision === "FIX_REQUIRED") {
        artefacts["fix-prompt.extracted.md"] = parsedReviewToFixOutput.finalFixPrompt ?? "";
        progressLogger.artefact("extracted fix prompt", path.resolve(runDir, "fix-prompt.extracted.md"));
        if (!executeFix) {
          artefacts["fix-skipped.json"] = JSON.stringify({ skipped: true, reason: "fix execution disabled" }, null, 2);
        } else {
          progressLogger.phaseStart("fix");
          progressLogger.verbose(`fix model=${config.codex.builder.model} reasoning=${config.codex.builder.reasoningEffort} sandbox=${allowWrites ? "workspace-write" : "read-only"}`);
          if (allowWrites) {
            await ensureWriteSafetyIfNeeded();
          }
          failedPhase = "fixExecution";
          let fixAudit: Awaited<ReturnType<typeof captureWriteAuditPreState>> | undefined;
          if (allowWrites) {
            try {
              progressLogger.phaseStart("write-audit:fix", "capturing pre-write state");
              fixAudit = await writeAuditPreCapture({ phase: "fix", workspaceRoot: targetWorkspaceRoot });
              progressLogger.phaseComplete("write-audit:fix", "pre-write captured");
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              const preCaptureError = new Error(`Fix write-audit pre-capture failed: ${message}`);
              metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
              metadata.writeAudit.fix = { status: "failed", reason: `pre-capture failed: ${message}` };
              await bestEffortUpdatePhaseAndPersistOnFailure("fixExecution", {
                status: "failed",
                completedAt: new Date().toISOString()
              });
              progressLogger.phaseFailed("write-audit:fix", preCaptureError);
              progressLogger.phaseFailed("fix", preCaptureError);
              throw preCaptureError;
            }
          }
          let fixAuditError: Error | undefined;
          let fixExecutionError: Error | undefined;
          await updatePhaseAndPersist("fixExecution", { status: "unknown", startedAt: new Date().toISOString() });
          const fixPrompt = parsedReviewToFixOutput.finalFixPrompt ?? "";
          const fixOutputLastMessagePath = path.resolve(runDir, "fix-output-last-message.md");
          progressLogger.info("[fix] waiting for Codex...");
          let fixExecution!: Awaited<ReturnType<typeof executor>>;
          await runCodexPhase("fix", async () => {
            fixExecution = await executor(
              {
                prompt: fixPrompt,
                role: "builder",
                model: config.codex.builder.model,
                reasoningEffort: config.codex.builder.reasoningEffort,
                workspaceRoot: targetWorkspaceRoot,
                outputLastMessagePath: fixOutputLastMessagePath,
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
          artefacts["fix-command.json"] = serialiseBackendCommandArtefact({
            command: fixExecution.command,
            args: fixExecution.args,
            cwd: fixExecution.cwd,
            outputLastMessagePath: fixExecution.outputLastMessagePath,
            promptViaStdin: true,
            sandboxMode: allowWrites ? "workspace-write" : "read-only",
            backend: fixExecution.backend
          });
          artefacts["fix-prompt.executed.md"] = fixPrompt;
          artefacts["fix-stdout.log"] = fixExecution.stdout;
          artefacts["fix-stderr.log"] = fixExecution.stderr;
          artefacts["fix-output-last-message.md"] = fixExecution.outputLastMessage;
          artefacts["fix-exit.json"] = JSON.stringify(
            {
              success: fixExecution.success,
              code: fixExecution.exitCode,
              signal: fixExecution.signal,
              durationMs: fixExecution.durationMs,
              skipped: fixExecution.skipped
            },
            null,
            2
          );
          if (fixAudit) {
            try {
              progressLogger.phaseStart("write-audit:fix", "capturing post-write state");
              const summary = await writeAuditPostCapture({ runDir, capture: fixAudit });
              metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
              metadata.writeAudit.fix = {
                status: "captured",
                artefacts: summary.artefacts,
                changedFiles: summary.changedFilesAddedByPhase
              };
              progressLogger.phaseComplete("write-audit:fix", "post-write captured");
              progressLogger.artefact("write-audit:fix summary", path.resolve(runDir, "write-audit/fix/summary.json"));
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              fixAuditError = new Error(`Fix write-audit capture failed: ${message}`);
              metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
              metadata.writeAudit.fix = {
                status: fixExecution.success ? "failed" : "partial",
                reason: message
              };
            }
          }
          if (!fixExecution.success) {
            fixExecutionError = new Error(
              `Fix execution failed with exit code ${fixExecution.exitCode ?? "null"}${fixExecution.signal ? ` signal ${fixExecution.signal}` : ""}. Diagnostics written to ${runDir}`
            );
          }
          if (fixAuditError) {
            await writeArtefacts(runDir, artefacts);
            await bestEffortUpdatePhaseAndPersistOnFailure("fixExecution", {
              status: "failed",
              completedAt: new Date().toISOString(),
              artefacts: ["fix-command.json", "fix-prompt.executed.md", "fix-stdout.log", "fix-stderr.log", "fix-output-last-message.md", "fix-exit.json"]
            });
            progressLogger.phaseFailed("write-audit:fix", fixAuditError);
            progressLogger.phaseFailed("fix", fixExecutionError ?? fixAuditError);
            throw fixExecutionError ?? fixAuditError;
          }
          if (fixExecutionError) {
            await bestEffortUpdatePhaseAndPersistOnFailure("fixExecution", {
              status: "failed",
              completedAt: new Date().toISOString(),
              artefacts: ["fix-command.json", "fix-prompt.executed.md", "fix-stdout.log", "fix-stderr.log", "fix-output-last-message.md", "fix-exit.json"]
            });
            await writeArtefacts(runDir, artefacts);
            progressLogger.phaseFailed("fix", fixExecutionError);
            throw fixExecutionError;
          }
          await updatePhaseAndPersist("fixExecution", {
            status: "executed",
            completedAt: new Date().toISOString(),
            backend: fixExecution.backend,
            artefacts: ["fix-command.json", "fix-prompt.executed.md", "fix-stdout.log", "fix-stderr.log", "fix-output-last-message.md", "fix-exit.json"]
          });
          progressLogger.phaseComplete("fix", `completed in ${formatDurationMs(fixExecution.durationMs)}`);
          progressLogger.artefact("fix output", path.resolve(runDir, "fix-output-last-message.md"));
        }
      } else {
        artefacts["review-to-fix-decision.proceed.json"] = JSON.stringify({ proceed: true }, null, 2);
        artefacts["fix-skipped.json"] = JSON.stringify(
          { skipped: true, reason: "review-to-fix decision was PROCEED" },
          null,
          2
        );
        if (executeFix) {
          await setPhaseSkipped("fixExecution", "fix execution skipped because review-to-fix decision was PROCEED");
          progressLogger.phaseSkipped("fix", "skipped because proceed");
        }
      }
      await updatePhaseAndPersist("fixPlanning", {
        status: "executed",
        completedAt: new Date().toISOString(),
        backend: reviewToFixExecution.backend,
        artefacts: ["review-to-fix-command.json", "review-to-fix-stdout.log", "review-to-fix-stderr.log", "review-to-fix-output-last-message.md", "review-to-fix-exit.json", "review-to-fix-decision.json"]
      });
      progressLogger.phaseComplete("fix-planning", `completed in ${formatDurationMs(reviewToFixExecution.durationMs)}`);
      progressLogger.artefact("fix-planning output", path.resolve(runDir, "review-to-fix-output-last-message.md"));
    }

    artefacts["test-output.placeholder.md"] = "# Placeholder\n\nTest execution remains disabled in current stage.";
    artefacts["diff.placeholder.patch"] = "# Placeholder\n# Git diff generation remains disabled in current stage.";
  }

    let checksState: RunResult["checksState"] = "disabled";
    const checkCommandExecutor = options.checkCommandExecutor ?? executeCheckCommand;
    if (!runChecks) {
      artefacts["checks-status.json"] = JSON.stringify({ state: "disabled", reason: "--run-checks not set" }, null, 2);
      progressLogger.phaseSkipped("checks", "disabled");
    } else if (options.dryRun) {
      checksState = "skipped by dry-run";
      await setPhaseSkipped("checks", "target checks skipped because dryRun=true");
      artefacts["checks-status.json"] = JSON.stringify(
        { state: "skipped by dry-run", reason: "dryRun=true", total: config.commands.checks.length },
        null,
        2
      );
      progressLogger.phaseSkipped("checks", "skipped by dry-run");
    } else if (!canRunChecks().ok) {
      checksState = "failed";
      failedPhase = "checks";
      const reason = canRunChecks().reason ?? "checks blocked";
      await bestEffortUpdatePhaseAndPersistOnFailure("checks", {
        status: "failed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        reason,
        artefacts: ["checks-status.json"]
      });
      artefacts["checks-status.json"] = JSON.stringify(
        { state: "blocked", reason, postWriteReviewStatus: metadata.postWriteReview.status },
        null,
        2
      );
      const writtenBeforeThrow = await writeArtefacts(runDir, artefacts);
      progressLogger.phaseFailed("checks", reason);
      throw new Error(`Checks blocked. Diagnostics written to ${runDir}. ${reason}. Artefacts: ${writtenBeforeThrow.length}`);
    } else if (config.commands.checks.length === 0) {
      checksState = "executed";
      await updatePhaseAndPersist("checks", {
        status: "executed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        reason: "no checks configured",
        artefacts: ["checks-status.json"]
      });
      artefacts["checks-status.json"] = JSON.stringify(
        { state: "executed", total: 0, noChecksConfigured: true },
        null,
        2
      );
      progressLogger.phaseComplete("checks", "completed (no checks configured)");
    } else {
      progressLogger.phaseStart("checks");
      failedPhase = "checks";
      await updatePhaseAndPersist("checks", { status: "unknown", startedAt: new Date().toISOString() });
      let completed = 0;
      try {
        for (let i = 0; i < config.commands.checks.length; i += 1) {
          const check = config.commands.checks[i];
          progressLogger.info(`[checks] running: ${check.name}`);
          progressLogger.verbose(`[checks] command: ${check.command} ${check.args.join(" ")}`);
          const cwd = resolveCheckCommandCwd(check, orchestratorRoot, targetWorkspaceRoot);
          const result = await checkCommandExecutor({
            name: check.name,
            command: check.command,
            args: check.args,
            cwd
          });
          const base = `checks/${String(i + 1).padStart(2, "0")}-${sanitizeCheckName(check.name)}`;
          artefacts[`${base}-command.json`] = JSON.stringify(
            {
              name: result.name,
              command: result.command,
              args: result.args,
              cwd: result.cwd
            },
            null,
            2
          );
          artefacts[`${base}-stdout.log`] = result.stdout;
          artefacts[`${base}-stderr.log`] = result.stderr;
          artefacts[`${base}-exit.json`] = JSON.stringify(
            {
              success: result.success,
              code: result.exitCode,
              signal: result.signal,
              durationMs: result.durationMs
            },
            null,
            2
          );
          completed += 1;
          if (!result.success) {
            throw new Error(
              `Check "${check.name}" failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}`
            );
          }
        }
        checksState = "executed";
        await updatePhaseAndPersist("checks", {
          status: "executed",
          completedAt: new Date().toISOString(),
          artefacts: ["checks-status.json"]
        });
        artefacts["checks-status.json"] = JSON.stringify(
          { state: "executed", total: config.commands.checks.length, completed },
          null,
          2
        );
        progressLogger.phaseComplete("checks", "completed");
      } catch (error) {
        checksState = "failed";
        const message = error instanceof Error ? error.message : String(error);
        const checksFailureMessage = `Checks failed. Diagnostics written to ${runDir}. ${message}. Artefacts: `;
        await bestEffortUpdatePhaseAndPersistOnFailure("checks", {
          status: "failed",
          completedAt: new Date().toISOString(),
          artefacts: ["checks-status.json"]
        });
        artefacts["checks-status.json"] = JSON.stringify(
          {
            state: "failed",
            total: config.commands.checks.length,
            completed,
            error: message
          },
          null,
          2
        );
        const writtenBeforeThrow = await writeArtefacts(runDir, artefacts);
        progressLogger.phaseFailed("checks", message);
        throw new Error(`${checksFailureMessage}${writtenBeforeThrow.length}`);
      }
    }

    const written = await writeArtefacts(runDir, artefacts);
    if (options.planHtml) {
      const planHtmlPath = await writePlanHtmlFromRun(
        runDir,
        metadata,
        written.map((filePath) => toRunRelativePath(runDir, filePath))
      );
      written.push(planHtmlPath);
      progressLogger.artefact("plan html", planHtmlPath);
    }
    for (const artefact of written) {
      addRunArtefact(metadata, toRunRelativePath(runDir, artefact));
    }
    markRunSuccess(metadata);
    await persistMetadata();

    if (options.verbose) {
      void config;
    }

    progressLogger.info(options.dryRun ? "Run dry-run completed" : "Run completed successfully");

    return {
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
    };
  } catch (error) {
    markRunFailure(metadata, error, failedPhase);
    await persistMetadata(error);
    if (failedPhase) {
      progressLogger.phaseFailed(failedPhase, error);
      progressLogger.info(`Run failed during phase: ${failedPhase}`);
    } else {
      progressLogger.phaseFailed("run", error);
    }
    progressLogger.info(`Diagnostics: ${runDir}`);
    throw error;
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

function resolveAndValidateRunsBaseDir(
  orchestratorRoot: string,
  targetWorkspaceRoot: string,
  configuredRunsDir: string,
  projectName: string
): string {
  const resolved = path.resolve(orchestratorRoot, configuredRunsDir);
  const relToOrchestrator = path.relative(orchestratorRoot, resolved);
  if (relToOrchestrator.startsWith("..") || path.isAbsolute(relToOrchestrator)) {
    throw new Error(
      `Invalid config: paths.runsDir must resolve inside orchestrator root ${orchestratorRoot}. Resolved: ${resolved}`
    );
  }

  const relToTarget = path.relative(targetWorkspaceRoot, resolved);
  if (!(relToTarget.startsWith("..") || path.isAbsolute(relToTarget))) {
    throw new Error(
      `Invalid config: paths.runsDir must not resolve inside target workspace ${targetWorkspaceRoot}. Resolved: ${resolved}`
    );
  }

  const expected = path.resolve(orchestratorRoot, "runs", normalizeProjectNameForRunPath(projectName));
  if (resolved !== expected) {
    throw new Error(
      `Invalid config: paths.runsDir must resolve to runs/<projectName>. Expected: ${expected}. Resolved: ${resolved}`
    );
  }

  return resolved;
}

function normalizeProjectNameForRunPath(projectName: string): string {
  return projectName.trim().toLowerCase();
}

async function readRequired(filePath: string, kind: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Missing ${kind}: ${filePath}. ${msg}`);
  }
}

function makeTimestamp(date = new Date()): string {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function buildTemplateVariables(input: {
  stageName: string;
  stageInstruction: string;
  timestamp: string;
  workspaceRoot: string;
  runDir: string;
}): TemplateVariables {
  return {
    stage_name: input.stageName,
    stage_instruction: input.stageInstruction,
    timestamp: input.timestamp,
    workspace_root: input.workspaceRoot,
    run_dir: input.runDir,
    git_status: "[placeholder: git status skipped in current stage]",
    builder_output: "[placeholder: builder output skipped in current stage]",
    test_output: "[placeholder: test output skipped in current stage]",
    git_diff: "[placeholder: git diff skipped in current stage]",
    review_output: "[placeholder: review output skipped in current stage]"
  };
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

function sanitizeCheckName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}
