import path from "node:path";
import { serialiseBackendCommandArtefact } from "../../execution-backends/backend-command-artefact.js";
import { parsePlannerOutput } from "../../planner-output.js";
import { formatDurationMs, type ProgressLogger } from "../../progress-logger.js";
import type { RunPhaseName } from "../../run-metadata.js";
import { runCodexPhase } from "./phase-executor.js";

export async function executePlannerPhase(input: {
  executePlanner: boolean;
  executeBuilder: boolean;
  executeReviewer: boolean;
  planFix: boolean;
  executeFix: boolean;
  dryRun: boolean;
  runDir: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  renderedPlanner: string;
  streamCodex: boolean;
  progressLogger: ProgressLogger;
  config: {
    agents: { planner: { backend: string } };
    executionBackends: Record<string, { type: string } | undefined>;
    codex: { planner: { model: string; reasoningEffort: string } };
    safety: { requireGitRepo: boolean };
  };
  executor: (...args: any[]) => Promise<any>;
  artefacts: Record<string, string>;
  reviewerSkipBase: string;
  reviewerSkipDryRun: string;
  updatePhaseAndPersist: (phase: RunPhaseName, update: any) => Promise<void>;
  setPhaseSkipped: (phase: RunPhaseName, reason: string) => Promise<void>;
  bestEffortUpdatePhaseAndPersistOnFailure: (phase: RunPhaseName, update: any) => Promise<void>;
  writeArtefacts: (runDir: string, artefacts: Record<string, string>) => Promise<string[]>;
  refreshReviewerPreview: (builderWasExecuted: boolean) => void;
  renderReviewToFixPrompt: () => string;
  setFailedPhase: (phase: RunPhaseName) => void;
  onPlannerParsed: (plannerOutputLastMessage: string, extractedBuilderPrompt: string) => void;
}): Promise<"disabled" | "dry-run" | "executed"> {
  const {
    executePlanner,
    executeBuilder,
    executeReviewer,
    planFix,
    executeFix,
    dryRun,
    runDir,
    orchestratorRoot,
    targetWorkspaceRoot,
    renderedPlanner,
    streamCodex,
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
    setFailedPhase,
    onPlannerParsed
  } = input;

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
    return "disabled";
  }

  if (dryRun) {
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
    return "dry-run";
  }

  progressLogger.phaseStart("planner");
  progressLogger.verbose(`planner model=${config.codex.planner.model} reasoning=${config.codex.planner.reasoningEffort} sandbox=read-only`);
  await updatePhaseAndPersist("planner", { status: "unknown", startedAt: new Date().toISOString() });
  setFailedPhase("planner");
  const outputLastMessagePath = path.resolve(runDir, "06-planner-output-last-message.md");
  progressLogger.info("[planner] waiting for Codex...");
  let execution!: Awaited<ReturnType<typeof executor>>;
  await runCodexPhase({
    phase: "planner",
    streamCodex,
    progressLogger,
    action: async () => {
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
          streamOutput: streamCodex,
          onStdoutChunk: (chunk: string) => progressLogger.codexStdout(chunk),
          onStderrChunk: (chunk: string) => progressLogger.codexStderr(chunk)
        }
      );
    }
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
    onPlannerParsed(execution.outputLastMessage, parsed.finalBuilderPrompt);
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

  return "executed";
}
