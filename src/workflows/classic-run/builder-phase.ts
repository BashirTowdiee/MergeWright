import path from "node:path";
import { serialiseBackendCommandArtefact } from "../../execution-backends/backend-command-artefact.js";
import { formatDurationMs, type ProgressLogger } from "../../progress-logger.js";
import type { RunPhaseName, RunMetadata } from "../../run-metadata.js";
import { captureWriteAuditPreState } from "../../write-audit.js";
import { runCodexPhase } from "./phase-executor.js";

export async function executeBuilderPhase(input: {
  executeBuilder: boolean;
  allowWrites: boolean;
  streamCodex: boolean;
  runDir: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  extractedBuilderPrompt: string;
  progressLogger: ProgressLogger;
  config: {
    agents: { builder: { model: string; reasoningEffort: string } };
    safety: { requireGitRepo: boolean };
  };
  executor: (...args: any[]) => Promise<any>;
  artefacts: Record<string, string>;
  metadata: RunMetadata;
  ensureWriteSafetyIfNeeded: () => Promise<void>;
  writeAuditPreCapture: typeof captureWriteAuditPreState;
  writeAuditPostCapture: (args: any) => Promise<any>;
  updatePhaseAndPersist: (phase: RunPhaseName, update: any) => Promise<void>;
  bestEffortUpdatePhaseAndPersistOnFailure: (phase: RunPhaseName, update: any) => Promise<void>;
  writeArtefacts: (runDir: string, artefacts: Record<string, string>) => Promise<string[]>;
  setFailedPhase: (phase: RunPhaseName) => void;
  onBuilderCompleted: (output: string, metadata: any) => void;
  refreshReviewerPreview: (builderWasExecuted: boolean) => void;
}): Promise<void> {
  const {
    executeBuilder,
    allowWrites,
    streamCodex,
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
    setFailedPhase,
    onBuilderCompleted
    ,
    refreshReviewerPreview
  } = input;

  if (!executeBuilder) {
    artefacts["builder-output.placeholder.md"] =
      "# Placeholder\n\nBuilder execution was not requested. Pass --execute-builder (with --execute-planner) to execute once.";
    return;
  }

  progressLogger.phaseStart("builder");
  progressLogger.verbose(`builder model=${config.agents.builder.model} reasoning=${config.agents.builder.reasoningEffort} sandbox=${allowWrites ? "workspace-write" : "read-only"}`);
  if (allowWrites) {
    await ensureWriteSafetyIfNeeded();
  }
  setFailedPhase("builder");
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
  await runCodexPhase({
    phase: "builder",
    streamCodex,
    progressLogger,
    action: async () => {
      builderExecution = await executor(
        {
          prompt: extractedBuilderPrompt,
          role: "builder",
          model: config.agents.builder.model,
          reasoningEffort: config.agents.builder.reasoningEffort,
          workspaceRoot: targetWorkspaceRoot,
          outputLastMessagePath: builderOutputLastMessagePath,
          dryRun: false,
          requireGitRepo: config.safety.requireGitRepo,
          orchestratorRoot,
          sandboxMode: allowWrites ? "workspace-write" : "read-only"
        },
        {
          streamOutput: streamCodex,
          onStdoutChunk: (chunk: string) => progressLogger.codexStdout(chunk),
          onStderrChunk: (chunk: string) => progressLogger.codexStderr(chunk)
        }
      );
    }
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
  onBuilderCompleted(builderExecution.outputLastMessage, {
    stdout: builderExecution.stdout,
    stderr: builderExecution.stderr,
    exitCode: builderExecution.exitCode,
    signal: builderExecution.signal,
    durationMs: builderExecution.durationMs,
    success: builderExecution.success,
    skipped: builderExecution.skipped
  });
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
