import path from "node:path";
import { serialiseBackendCommandArtefact } from "../../execution-backends/backend-command-artefact.js";
import { formatDurationMs, type ProgressLogger } from "../../progress-logger.js";
import type { RunPhaseName, RunMetadata } from "../../run-metadata.js";
import { captureWriteAuditPreState } from "../../write-audit.js";
import { runCodexPhase } from "./phase-executor.js";

export async function executeFixPhase(input: {
  executeFix: boolean;
  dryRun: boolean;
  allowWrites: boolean;
  streamCodex: boolean;
  runDir: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
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
  setPhaseSkipped: (phase: RunPhaseName, reason: string) => Promise<void>;
  bestEffortUpdatePhaseAndPersistOnFailure: (phase: RunPhaseName, update: any) => Promise<void>;
  writeArtefacts: (runDir: string, artefacts: Record<string, string>) => Promise<string[]>;
  setFailedPhase: (phase: RunPhaseName) => void;
  fixDecision: "PROCEED" | "FIX_REQUIRED";
  fixPrompt: string;
}): Promise<void> {
  const {
    executeFix,
    dryRun,
    allowWrites,
    streamCodex,
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
    setFailedPhase,
    fixDecision,
    fixPrompt
  } = input;

  if (fixDecision === "PROCEED") {
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
    return;
  }

  artefacts["fix-prompt.extracted.md"] = fixPrompt ?? "";
  progressLogger.artefact("extracted fix prompt", path.resolve(runDir, "fix-prompt.extracted.md"));

  if (!executeFix) {
    artefacts["fix-skipped.json"] = JSON.stringify({ skipped: true, reason: "fix execution disabled" }, null, 2);
    return;
  }

  if (dryRun) {
    artefacts["fix-skipped.json"] = JSON.stringify(
      { skipped: true, reason: "Fix execution skipped because dryRun=true." },
      null,
      2
    );
    return;
  }

  progressLogger.phaseStart("fix");
  progressLogger.verbose(`fix model=${config.agents.builder.model} reasoning=${config.agents.builder.reasoningEffort} sandbox=${allowWrites ? "workspace-write" : "read-only"}`);
  if (allowWrites) {
    await ensureWriteSafetyIfNeeded();
  }
  setFailedPhase("fixExecution");
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
  const fixOutputLastMessagePath = path.resolve(runDir, "fix-output-last-message.md");
  progressLogger.info("[fix] waiting for Codex...");
  let fixExecution!: Awaited<ReturnType<typeof executor>>;
  await runCodexPhase({
    phase: "fix",
    streamCodex,
    progressLogger,
    action: async () => {
      fixExecution = await executor(
        {
          prompt: fixPrompt,
          role: "builder",
          model: config.agents.builder.model,
          reasoningEffort: config.agents.builder.reasoningEffort,
          workspaceRoot: targetWorkspaceRoot,
          outputLastMessagePath: fixOutputLastMessagePath,
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
