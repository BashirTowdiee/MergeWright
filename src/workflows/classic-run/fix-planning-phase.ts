import path from "node:path";
import { serialiseBackendCommandArtefact } from "../../execution-backends/backend-command-artefact.js";
import { formatDurationMs, type ProgressLogger } from "../../progress-logger.js";
import { parseReviewToFixOutput } from "../../review-to-fix-output.js";
import type { RunPhaseName } from "../../run-metadata.js";
import { runCodexPhase } from "./phase-executor.js";

export async function executeFixPlanningPhase(input: {
  planFix: boolean;
  dryRun: boolean;
  streamCodex: boolean;
  runDir: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  reviewToFixPrompt: string;
  progressLogger: ProgressLogger;
  config: {
    codex: { planner: { model: string; reasoningEffort: string } };
    safety: { requireGitRepo: boolean };
  };
  executor: (...args: any[]) => Promise<any>;
  artefacts: Record<string, string>;
  updatePhaseAndPersist: (phase: RunPhaseName, update: any) => Promise<void>;
  bestEffortUpdatePhaseAndPersistOnFailure: (phase: RunPhaseName, update: any) => Promise<void>;
  writeArtefacts: (runDir: string, artefacts: Record<string, string>) => Promise<string[]>;
  setFailedPhase: (phase: RunPhaseName) => void;
}): Promise<ReturnType<typeof parseReviewToFixOutput> | null> {
  const {
    planFix,
    dryRun,
    streamCodex,
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
    setFailedPhase
  } = input;

  if (!planFix) {
    artefacts["review-to-fix-output.placeholder.md"] =
      "# Placeholder\n\nReview-to-fix execution was not requested. Pass --plan-fix (with --execute-reviewer) to execute once.";
    return null;
  }

  if (dryRun) {
    artefacts["review-to-fix-skipped.json"] = JSON.stringify(
      { skipped: true, reason: "Review-to-fix execution skipped because dryRun=true." },
      null,
      2
    );
    return null;
  }

  progressLogger.phaseStart("fix-planning");
  progressLogger.verbose(`fix-planning model=${config.codex.planner.model} reasoning=${config.codex.planner.reasoningEffort} sandbox=read-only`);
  await updatePhaseAndPersist("fixPlanning", { status: "unknown", startedAt: new Date().toISOString() });
  setFailedPhase("fixPlanning");
  const reviewToFixOutputLastMessagePath = path.resolve(runDir, "review-to-fix-output-last-message.md");
  progressLogger.info("[fix-planning] waiting for Codex...");
  let reviewToFixExecution!: Awaited<ReturnType<typeof executor>>;
  await runCodexPhase({
    phase: "fix-planning",
    streamCodex,
    progressLogger,
    action: async () => {
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
          streamOutput: streamCodex,
          onStdoutChunk: (chunk: string) => progressLogger.codexStdout(chunk),
          onStderrChunk: (chunk: string) => progressLogger.codexStderr(chunk)
        }
      );
    }
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

  await updatePhaseAndPersist("fixPlanning", {
    status: "executed",
    completedAt: new Date().toISOString(),
    backend: reviewToFixExecution.backend,
    artefacts: ["review-to-fix-command.json", "review-to-fix-stdout.log", "review-to-fix-stderr.log", "review-to-fix-output-last-message.md", "review-to-fix-exit.json", "review-to-fix-decision.json"]
  });
  progressLogger.phaseComplete("fix-planning", `completed in ${formatDurationMs(reviewToFixExecution.durationMs)}`);
  progressLogger.artefact("fix-planning output", path.resolve(runDir, "review-to-fix-output-last-message.md"));

  return parsedReviewToFixOutput;
}
