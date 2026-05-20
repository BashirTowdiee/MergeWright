import path from "node:path";
import { serialiseBackendCommandArtefact } from "../../execution-backends/backend-command-artefact.js";
import { formatDurationMs, type ProgressLogger } from "../../progress-logger.js";
import type { RunPhaseName, RunMetadata } from "../../run-metadata.js";
import { runCodexPhase } from "./phase-executor.js";

export async function executeReviewerPhase(input: {
  executeReviewer: boolean;
  dryRun: boolean;
  allowWrites: boolean;
  writeEnabledPhases: Array<"builder" | "fix">;
  streamCodex: boolean;
  runDir: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  reviewerPrompt: string;
  progressLogger: ProgressLogger;
  config: {
    agents: { reviewer: { backend: string; model: string; reasoningEffort: string } };
    executionBackends: Record<string, { type: string } | undefined>;
    safety: { requireGitRepo: boolean };
  };
  executor: (...args: any[]) => Promise<any>;
  artefacts: Record<string, string>;
  metadata: RunMetadata;
  reviewerSkipBase: string;
  updatePhaseAndPersist: (phase: RunPhaseName, update: any) => Promise<void>;
  setPhaseSkipped: (phase: RunPhaseName, reason: string) => Promise<void>;
  bestEffortUpdatePhaseAndPersistOnFailure: (phase: RunPhaseName, update: any) => Promise<void>;
  writeArtefacts: (runDir: string, artefacts: Record<string, string>) => Promise<string[]>;
  setFailedPhase: (phase: RunPhaseName) => void;
  onReviewerCompleted: (output: string, metadata: any) => void;
}): Promise<void> {
  const {
    executeReviewer,
    dryRun,
    allowWrites,
    writeEnabledPhases,
    streamCodex,
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
    setFailedPhase,
    onReviewerCompleted
  } = input;

  if (!executeReviewer) {
    if (!dryRun) {
      artefacts["reviewer-output.placeholder.md"] = reviewerSkipBase;
    }
    return;
  }

  if (dryRun) {
    const reviewerBackendName = config.agents.reviewer.backend;
    const reviewerBackendType = config.executionBackends[reviewerBackendName]?.type;
    const shouldRouteDryRunReviewer = reviewerBackendType !== "codex-cli";
    if (shouldRouteDryRunReviewer) {
      const reviewerOutputLastMessagePath = path.resolve(runDir, "reviewer-output-last-message.md");
      const reviewerDryRunExecution = await executor({
        prompt: reviewerPrompt,
        role: "reviewer",
        model: config.agents.reviewer.model,
        reasoningEffort: config.agents.reviewer.reasoningEffort,
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
    return;
  }

  progressLogger.phaseStart("reviewer");
  progressLogger.verbose(`reviewer model=${config.agents.reviewer.model} reasoning=${config.agents.reviewer.reasoningEffort} sandbox=read-only`);
  await updatePhaseAndPersist("reviewer", { status: "unknown", startedAt: new Date().toISOString() });
  setFailedPhase("reviewer");
  const reviewerOutputLastMessagePath = path.resolve(runDir, "reviewer-output-last-message.md");
  progressLogger.info("[reviewer] waiting for Codex...");
  let reviewerExecution!: Awaited<ReturnType<typeof executor>>;
  await runCodexPhase({
    phase: "reviewer",
    streamCodex,
    progressLogger,
    action: async () => {
      reviewerExecution = await executor(
        {
          prompt: reviewerPrompt,
          role: "reviewer",
          model: config.agents.reviewer.model,
          reasoningEffort: config.agents.reviewer.reasoningEffort,
          workspaceRoot: targetWorkspaceRoot,
          outputLastMessagePath: reviewerOutputLastMessagePath,
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
  onReviewerCompleted(reviewerExecution.outputLastMessage, {
    stdout: reviewerExecution.stdout,
    stderr: reviewerExecution.stderr,
    exitCode: reviewerExecution.exitCode,
    signal: reviewerExecution.signal,
    durationMs: reviewerExecution.durationMs,
    success: reviewerExecution.success,
    skipped: reviewerExecution.skipped
  });
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
