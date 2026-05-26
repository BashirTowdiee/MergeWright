import path from "node:path";
import { resolveCheckCommandCwd } from "../../commands.js";
import { serialiseBackendCommandArtefact } from "../../execution-backends/backend-command-artefact.js";
import { formatDurationMs } from "../../progress-logger.js";
import { parseReviewToFixOutput } from "../../review-to-fix-output.js";
import type { RunMetadata } from "../../run-metadata.js";
import { assertArtefactExists, assertArtefactsAbsent, readFixDecision, readText, sanitizeCheckName, writeJsonArtefact, writeTextArtefact } from "./artefact-io.js";
import { renderReviewToFixPromptForContinuation, renderReviewerPromptForContinuation } from "./prompt-builders.js";
import {
  bestEffortPhaseFailure,
  canRunChecksWithMetadata,
  ensureWriteSafetyIfNeeded,
  mergeRequiredByPhases,
  setPostWriteReviewCompleted,
  setPostWriteReviewFailed,
  setPostWriteReviewPending,
  type ContinuationContext,
  type ContinuationState,
  updatePhaseAndPersist
} from "./state.js";
import { ensurePhaseExecuted, ensurePhaseNotExecuted, ensurePlannerExecuted } from "./metadata.js";

type TemplateMap = Awaited<ReturnType<typeof import("../../prompts.js").loadPromptTemplates>>;

interface ContinuationPhaseInput {
  context: ContinuationContext;
  state: ContinuationState;
  projectedMetadata: RunMetadata;
  templates?: TemplateMap;
  runCodexPhase: (phase: "builder" | "reviewer" | "fix-planning" | "fix", action: () => Promise<void>) => Promise<void>;
}

export async function executeBuilderContinuation(input: ContinuationPhaseInput): Promise<void> {
  const { context, state, projectedMetadata, runCodexPhase } = input;
  const { runDir, metadata, progressLogger, options, artefacts, allowWrites } = context;

  progressLogger.phaseStart("builder");
  ensurePlannerExecuted(projectedMetadata);
  ensurePhaseNotExecuted(projectedMetadata, "builder", "Builder");
  await assertArtefactExists(runDir, "builder-prompt.extracted.md", "Builder continuation requires extracted builder prompt artefact.");
  await assertArtefactsAbsent(
    runDir,
    ["builder-command.json", "builder-stdout.log", "builder-stderr.log", "builder-output-last-message.md", "builder-exit.json", "builder-prompt.executed.md"],
    "Builder"
  );

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
    return;
  }

  if (allowWrites) {
    await ensureWriteSafetyIfNeeded(context, state);
  }
  progressLogger.verbose(
    `builder model=${context.config.agents.builder.model} reasoning=${context.config.agents.builder.reasoningEffort} sandbox=${allowWrites ? "workspace-write" : "read-only"}`
  );
  state.failedPhase = "builder";

  let builderAudit: Awaited<ReturnType<typeof context.writeAuditPreCapture>> | undefined;
  if (allowWrites) {
    try {
      progressLogger.phaseStart("write-audit:builder", "capturing pre-write state");
      builderAudit = await context.writeAuditPreCapture({ phase: "builder", workspaceRoot: metadata.workspaceRoot });
      progressLogger.phaseComplete("write-audit:builder", "pre-write captured");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const preCaptureError = new Error(`Builder write-audit pre-capture failed: ${message}`);
      metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
      metadata.writeAudit.builder = { status: "failed", reason: `pre-capture failed: ${message}` };
      await bestEffortPhaseFailure(context, "builder", "builder write-audit pre-capture failed");
      progressLogger.phaseFailed("write-audit:builder", preCaptureError);
      progressLogger.phaseFailed("builder", preCaptureError);
      throw preCaptureError;
    }
  }

  let builderAuditError: Error | undefined;
  let builderExecutionError: Error | undefined;

  await updatePhaseAndPersist(context, "builder", "unknown");
  const prompt = await readText(path.resolve(runDir, "builder-prompt.extracted.md"));
  const outputPath = path.resolve(runDir, "builder-output-last-message.md");
  progressLogger.info("[builder] waiting for Codex...");
  let result!: Awaited<ReturnType<typeof context.codexExecutor>>;
  await runCodexPhase("builder", async () => {
    result = await context.codexExecutor(
      {
        prompt,
        role: "builder",
        model: context.config.agents.builder.model,
        reasoningEffort: context.config.agents.builder.reasoningEffort,
        workspaceRoot: metadata.workspaceRoot,
        outputLastMessagePath: outputPath,
        dryRun: false,
        requireGitRepo: context.config.safety.requireGitRepo,
        orchestratorRoot: context.orchestratorRoot,
        sandboxMode: allowWrites ? "workspace-write" : "read-only"
      },
      {
        streamOutput: options.streamCodex,
        onStdoutChunk: (chunk) => progressLogger.codexStdout(chunk),
        onStderrChunk: (chunk) => progressLogger.codexStderr(chunk)
      }
    );
  });

  await writeTextArtefact(
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
  await writeTextArtefact(runDir, "builder-prompt.executed.md", prompt, artefacts, false);
  await writeTextArtefact(runDir, "builder-stdout.log", result.stdout, artefacts, false);
  await writeTextArtefact(runDir, "builder-stderr.log", result.stderr, artefacts, false);
  await writeTextArtefact(runDir, "builder-output-last-message.md", result.outputLastMessage, artefacts, false);
  await writeJsonArtefact(
    runDir,
    "builder-exit.json",
    { success: result.success, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false },
    artefacts,
    false
  );

  if (builderAudit) {
    try {
      progressLogger.phaseStart("write-audit:builder", "capturing post-write state");
      const summary = await context.writeAuditPostCapture({ runDir, capture: builderAudit });
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
    builderExecutionError = new Error(
      `Builder execution failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}. Diagnostics written to ${runDir}`
    );
  }
  if (builderAuditError) {
    await bestEffortPhaseFailure(context, "builder", "builder write-audit capture failed", ["builder-exit.json"]);
    progressLogger.phaseFailed("write-audit:builder", builderAuditError);
    progressLogger.phaseFailed("builder", builderExecutionError ?? builderAuditError);
    throw builderExecutionError ?? builderAuditError;
  }
  if (builderExecutionError) {
    await bestEffortPhaseFailure(context, "builder", "builder execution failed", ["builder-exit.json"]);
    progressLogger.phaseFailed("builder", builderExecutionError);
    throw builderExecutionError;
  }

  await updatePhaseAndPersist(
    context,
    "builder",
    "executed",
    undefined,
    ["builder-command.json", "builder-prompt.executed.md", "builder-stdout.log", "builder-stderr.log", "builder-output-last-message.md", "builder-exit.json"],
    result.backend
  );
  if (allowWrites) {
    await setPostWriteReviewPending(context, ["builder"]);
  }
  progressLogger.phaseComplete("builder", `completed in ${formatDurationMs(result.durationMs)}`);
  progressLogger.artefact("builder output", path.resolve(runDir, "builder-output-last-message.md"));
}

export async function executeReviewerContinuation(input: ContinuationPhaseInput): Promise<void> {
  const { context, state, projectedMetadata, templates, runCodexPhase } = input;
  const { runDir, metadata, progressLogger, options, artefacts } = context;

  progressLogger.phaseStart("reviewer");
  ensurePlannerExecuted(projectedMetadata);
  ensurePhaseNotExecuted(projectedMetadata, "reviewer", "Reviewer");
  await assertArtefactsAbsent(runDir, ["reviewer-command.json", "reviewer-stdout.log", "reviewer-stderr.log", "reviewer-output-last-message.md", "reviewer-exit.json"], "Reviewer");

  const reviewerPrompt = await renderReviewerPromptForContinuation(templates?.["reviewer.md"] ?? "", options.dryRun ? projectedMetadata : metadata, runDir);
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
    return;
  }

  state.failedPhase = "reviewer";
  progressLogger.verbose(`reviewer model=${context.config.agents.reviewer.model} reasoning=${context.config.agents.reviewer.reasoningEffort} sandbox=read-only`);
  await updatePhaseAndPersist(context, "reviewer", "unknown");
  const outputPath = path.resolve(runDir, "reviewer-output-last-message.md");
  progressLogger.info("[reviewer] waiting for Codex...");
  let result!: Awaited<ReturnType<typeof context.codexExecutor>>;
  await runCodexPhase("reviewer", async () => {
    result = await context.codexExecutor(
      {
        prompt: reviewerPrompt,
        role: "reviewer",
        model: context.config.agents.reviewer.model,
        reasoningEffort: context.config.agents.reviewer.reasoningEffort,
        workspaceRoot: metadata.workspaceRoot,
        outputLastMessagePath: outputPath,
        dryRun: false,
        requireGitRepo: context.config.safety.requireGitRepo,
        orchestratorRoot: context.orchestratorRoot,
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
    await writeJsonArtefact(runDir, "reviewer-exit.json", { success: false, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);
    if (metadata.postWriteReview.required && metadata.postWriteReview.status === "pending") {
      await setPostWriteReviewFailed(context, "reviewer execution failed");
    }
    await bestEffortPhaseFailure(context, "reviewer", "reviewer execution failed", ["reviewer-exit.json"]);
    const reviewerError = new Error(
      `Reviewer execution failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}. Diagnostics written to ${runDir}`
    );
    progressLogger.phaseFailed("reviewer", reviewerError);
    throw reviewerError;
  }

  await writeTextArtefact(runDir, "08-reviewer-prompt.preview.md", reviewerPrompt, artefacts, true);
  await writeTextArtefact(
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
  await writeTextArtefact(runDir, "reviewer-stdout.log", result.stdout, artefacts, false);
  await writeTextArtefact(runDir, "reviewer-stderr.log", result.stderr, artefacts, false);
  await writeTextArtefact(runDir, "reviewer-output-last-message.md", result.outputLastMessage, artefacts, false);
  await writeJsonArtefact(runDir, "reviewer-exit.json", { success: true, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);

  await updatePhaseAndPersist(
    context,
    "reviewer",
    "executed",
    undefined,
    ["reviewer-command.json", "reviewer-stdout.log", "reviewer-stderr.log", "reviewer-output-last-message.md", "reviewer-exit.json"],
    result.backend
  );
  if (metadata.postWriteReview.required && metadata.postWriteReview.status === "pending") {
    await setPostWriteReviewCompleted(context);
    progressLogger.phaseComplete("post-write-review", "completed");
  }
  progressLogger.phaseComplete("reviewer", `completed in ${formatDurationMs(result.durationMs)}`);
  progressLogger.artefact("reviewer output", path.resolve(runDir, "reviewer-output-last-message.md"));
}

export async function executeFixPlanningContinuation(input: ContinuationPhaseInput): Promise<void> {
  const { context, state, projectedMetadata, templates, runCodexPhase } = input;
  const { runDir, progressLogger, options, artefacts } = context;

  progressLogger.phaseStart("fix-planning");
  ensurePhaseExecuted(projectedMetadata, "reviewer", "--plan-fix requires reviewer phase executed.");
  ensurePhaseNotExecuted(projectedMetadata, "fixPlanning", "Fix planning");
  const reviewerProjectedInThisDryRun = options.dryRun && context.metadata.phases.reviewer?.status !== "executed" && projectedMetadata.phases.reviewer?.status === "executed";
  if (!reviewerProjectedInThisDryRun) {
    await assertArtefactExists(runDir, "reviewer-output-last-message.md", "Fix planning requires reviewer output artefact.");
  }
  await assertArtefactsAbsent(
    runDir,
    [
      "review-to-fix-command.json",
      "review-to-fix-stdout.log",
      "review-to-fix-stderr.log",
      "review-to-fix-output-last-message.md",
      "review-to-fix-exit.json",
      "review-to-fix-decision.json",
      "fix-prompt.extracted.md",
      "review-to-fix-decision.proceed.json"
    ],
    "Fix planning"
  );

  const reviewToFixPrompt = await renderReviewToFixPromptForContinuation(templates?.["review-to-fix.md"] ?? "", projectedMetadata, runDir);
  if (options.dryRun) {
    progressLogger.phaseSkipped("fix-planning", "skipped by dry-run");
    projectedMetadata.phases.fixPlanning = { ...projectedMetadata.phases.fixPlanning, status: "executed" };
    return;
  }

  state.failedPhase = "fixPlanning";
  progressLogger.verbose(`fix-planning model=${context.config.agents.planner.model} reasoning=${context.config.agents.planner.reasoningEffort} sandbox=read-only`);
  await updatePhaseAndPersist(context, "fixPlanning", "unknown");
  const outputPath = path.resolve(runDir, "review-to-fix-output-last-message.md");
  progressLogger.info("[fix-planning] waiting for Codex...");
  let result!: Awaited<ReturnType<typeof context.codexExecutor>>;
  await runCodexPhase("fix-planning", async () => {
    result = await context.codexExecutor(
      {
        prompt: reviewToFixPrompt,
        role: "planner",
        model: context.config.agents.planner.model,
        reasoningEffort: context.config.agents.planner.reasoningEffort,
        workspaceRoot: context.metadata.workspaceRoot,
        outputLastMessagePath: outputPath,
        dryRun: false,
        requireGitRepo: context.config.safety.requireGitRepo,
        orchestratorRoot: context.orchestratorRoot,
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
    await writeJsonArtefact(runDir, "review-to-fix-exit.json", { success: false, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);
    await bestEffortPhaseFailure(context, "fixPlanning", "review-to-fix execution failed", ["review-to-fix-exit.json"]);
    const fixPlanError = new Error(
      `Review-to-fix execution failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}. Diagnostics written to ${runDir}`
    );
    progressLogger.phaseFailed("fix-planning", fixPlanError);
    throw fixPlanError;
  }

  await writeTextArtefact(runDir, "09-review-to-fix-prompt.preview.md", reviewToFixPrompt, artefacts, true);
  await writeTextArtefact(
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
  await writeTextArtefact(runDir, "review-to-fix-stdout.log", result.stdout, artefacts, false);
  await writeTextArtefact(runDir, "review-to-fix-stderr.log", result.stderr, artefacts, false);
  await writeTextArtefact(runDir, "review-to-fix-output-last-message.md", result.outputLastMessage, artefacts, false);
  await writeJsonArtefact(runDir, "review-to-fix-exit.json", { success: true, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);

  const parsed = parseReviewToFixOutput(result.outputLastMessage);
  await writeJsonArtefact(runDir, "review-to-fix-decision.json", { decision: parsed.decision, rationale: parsed.rationale }, artefacts, false);
  if (parsed.decision === "FIX_REQUIRED") {
    await writeTextArtefact(runDir, "fix-prompt.extracted.md", parsed.finalFixPrompt ?? "", artefacts, false);
    progressLogger.artefact("extracted fix prompt", path.resolve(runDir, "fix-prompt.extracted.md"));
  } else {
    await writeJsonArtefact(runDir, "review-to-fix-decision.proceed.json", { proceed: true }, artefacts, false);
  }

  await updatePhaseAndPersist(
    context,
    "fixPlanning",
    "executed",
    undefined,
    ["review-to-fix-command.json", "review-to-fix-stdout.log", "review-to-fix-stderr.log", "review-to-fix-output-last-message.md", "review-to-fix-exit.json", "review-to-fix-decision.json"],
    result.backend
  );
  progressLogger.phaseComplete("fix-planning", `completed in ${formatDurationMs(result.durationMs)}`);
  progressLogger.artefact("fix-planning output", path.resolve(runDir, "review-to-fix-output-last-message.md"));
}

export async function executeFixExecutionContinuation(input: ContinuationPhaseInput): Promise<void> {
  const { context, state, projectedMetadata, runCodexPhase } = input;
  const { runDir, metadata, progressLogger, options, artefacts, allowWrites } = context;

  progressLogger.phaseStart("fix");
  ensurePhaseExecuted(projectedMetadata, "fixPlanning", "--execute-fix requires fixPlanning phase executed.");
  ensurePhaseNotExecuted(projectedMetadata, "fixExecution", "Fix execution");
  const fixPlanningProjectedInThisDryRun = options.dryRun && metadata.phases.fixPlanning?.status !== "executed" && projectedMetadata.phases.fixPlanning?.status === "executed";
  const decision = await readFixDecision(runDir, options.dryRun && fixPlanningProjectedInThisDryRun);

  if (options.dryRun) {
    if (decision === "PROCEED") {
      state.skippedFixBecauseProceed = true;
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
    return;
  }

  if (decision === "PROCEED") {
    state.skippedFixBecauseProceed = true;
    await updatePhaseAndPersist(context, "fixExecution", "skipped", "fix execution skipped because review-to-fix decision was PROCEED");
    await writeJsonArtefact(runDir, "fix-skipped.json", { skipped: true, reason: "review-to-fix decision was PROCEED" }, artefacts, false);
    progressLogger.phaseSkipped("fix", "skipped because proceed");
    return;
  }
  if (allowWrites) {
    await ensureWriteSafetyIfNeeded(context, state);
  }
  progressLogger.verbose(`fix model=${context.config.agents.builder.model} reasoning=${context.config.agents.builder.reasoningEffort} sandbox=${allowWrites ? "workspace-write" : "read-only"}`);
  state.failedPhase = "fixExecution";

  let fixAudit: Awaited<ReturnType<typeof context.writeAuditPreCapture>> | undefined;
  if (allowWrites) {
    try {
      progressLogger.phaseStart("write-audit:fix", "capturing pre-write state");
      fixAudit = await context.writeAuditPreCapture({ phase: "fix", workspaceRoot: metadata.workspaceRoot });
      progressLogger.phaseComplete("write-audit:fix", "pre-write captured");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const preCaptureError = new Error(`Fix write-audit pre-capture failed: ${message}`);
      metadata.writeAudit = metadata.writeAudit ?? { builder: { status: "not-applicable" }, fix: { status: "not-applicable" } };
      metadata.writeAudit.fix = { status: "failed", reason: `pre-capture failed: ${message}` };
      await bestEffortPhaseFailure(context, "fixExecution", "fix write-audit pre-capture failed");
      progressLogger.phaseFailed("write-audit:fix", preCaptureError);
      progressLogger.phaseFailed("fix", preCaptureError);
      throw preCaptureError;
    }
  }

  let fixAuditError: Error | undefined;
  let fixExecutionError: Error | undefined;

  await assertArtefactExists(runDir, "fix-prompt.extracted.md", "Fix execution requires extracted fix prompt artefact.");
  await assertArtefactsAbsent(runDir, ["fix-command.json", "fix-stdout.log", "fix-stderr.log", "fix-output-last-message.md", "fix-exit.json", "fix-prompt.executed.md"], "Fix execution");

  await updatePhaseAndPersist(context, "fixExecution", "unknown");
  const prompt = await readText(path.resolve(runDir, "fix-prompt.extracted.md"));
  const outputPath = path.resolve(runDir, "fix-output-last-message.md");
  progressLogger.info("[fix] waiting for Codex...");
  let result!: Awaited<ReturnType<typeof context.codexExecutor>>;
  await runCodexPhase("fix", async () => {
    result = await context.codexExecutor(
      {
        prompt,
        role: "builder",
        model: context.config.agents.builder.model,
        reasoningEffort: context.config.agents.builder.reasoningEffort,
        workspaceRoot: metadata.workspaceRoot,
        outputLastMessagePath: outputPath,
        dryRun: false,
        requireGitRepo: context.config.safety.requireGitRepo,
        orchestratorRoot: context.orchestratorRoot,
        sandboxMode: allowWrites ? "workspace-write" : "read-only"
      },
      {
        streamOutput: options.streamCodex,
        onStdoutChunk: (chunk) => progressLogger.codexStdout(chunk),
        onStderrChunk: (chunk) => progressLogger.codexStderr(chunk)
      }
    );
  });

  await writeTextArtefact(
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
  await writeTextArtefact(runDir, "fix-prompt.executed.md", prompt, artefacts, false);
  await writeTextArtefact(runDir, "fix-stdout.log", result.stdout, artefacts, false);
  await writeTextArtefact(runDir, "fix-stderr.log", result.stderr, artefacts, false);
  await writeTextArtefact(runDir, "fix-output-last-message.md", result.outputLastMessage, artefacts, false);
  await writeJsonArtefact(runDir, "fix-exit.json", { success: result.success, code: result.exitCode, signal: result.signal, durationMs: result.durationMs, skipped: false }, artefacts, false);

  if (fixAudit) {
    try {
      progressLogger.phaseStart("write-audit:fix", "capturing post-write state");
      const summary = await context.writeAuditPostCapture({ runDir, capture: fixAudit });
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
    await bestEffortPhaseFailure(context, "fixExecution", "fix write-audit capture failed", ["fix-exit.json"]);
    progressLogger.phaseFailed("write-audit:fix", fixAuditError);
    progressLogger.phaseFailed("fix", fixExecutionError ?? fixAuditError);
    throw fixExecutionError ?? fixAuditError;
  }
  if (fixExecutionError) {
    await bestEffortPhaseFailure(context, "fixExecution", "fix execution failed", ["fix-exit.json"]);
    progressLogger.phaseFailed("fix", fixExecutionError);
    throw fixExecutionError;
  }

  await updatePhaseAndPersist(
    context,
    "fixExecution",
    "executed",
    undefined,
    ["fix-command.json", "fix-prompt.executed.md", "fix-stdout.log", "fix-stderr.log", "fix-output-last-message.md", "fix-exit.json"],
    result.backend
  );
  if (allowWrites) {
    await setPostWriteReviewPending(context, ["fixExecution"]);
  }
  progressLogger.phaseComplete("fix", `completed in ${formatDurationMs(result.durationMs)}`);
  progressLogger.artefact("fix output", path.resolve(runDir, "fix-output-last-message.md"));
}

export async function executeChecksContinuation(input: ContinuationPhaseInput): Promise<void> {
  const { context, state, projectedMetadata } = input;
  const { runDir, progressLogger, options, artefacts } = context;

  progressLogger.phaseStart("checks");
  ensurePhaseNotExecuted(projectedMetadata, "checks", "Checks");
  const checksGate = canRunChecksWithMetadata(options.dryRun ? projectedMetadata : context.metadata);
  if (!checksGate.ok) {
    if (options.dryRun) {
      progressLogger.phaseFailed("checks", checksGate.reason ?? "checks blocked");
      throw new Error(checksGate.reason);
    }
    await writeJsonArtefact(
      runDir,
      "checks-status.json",
      { state: "blocked", reason: checksGate.reason, postWriteReviewStatus: context.metadata.postWriteReview.status },
      artefacts,
      false
    );
    await bestEffortPhaseFailure(context, "checks", checksGate.reason ?? "checks blocked", ["checks-status.json"]);
    progressLogger.phaseFailed("checks", checksGate.reason ?? "checks blocked");
    throw new Error(checksGate.reason);
  }

  if (options.dryRun) {
    progressLogger.phaseSkipped("checks", "skipped by dry-run");
    projectedMetadata.phases.checks = { ...projectedMetadata.phases.checks, status: "executed" };
    return;
  }

  state.failedPhase = "checks";
  await updatePhaseAndPersist(context, "checks", "unknown");
  let completed = 0;
  for (let i = 0; i < context.config.commands.checks.length; i += 1) {
    const check = context.config.commands.checks[i];
    progressLogger.info(`[checks] running: ${check.name}`);
    progressLogger.verbose(`[checks] command: ${check.command} ${check.args.join(" ")}`);
    const cwd = resolveCheckCommandCwd(check, context.orchestratorRoot, context.metadata.workspaceRoot);
    const result = await context.checkCommandExecutor({ name: check.name, command: check.command, args: check.args, cwd });
    const base = `checks/${String(i + 1).padStart(2, "0")}-${sanitizeCheckName(check.name)}`;
    await writeJsonArtefact(runDir, `${base}-command.json`, { name: result.name, command: result.command, args: result.args, cwd: result.cwd }, artefacts, false);
    await writeTextArtefact(runDir, `${base}-stdout.log`, result.stdout, artefacts, false);
    await writeTextArtefact(runDir, `${base}-stderr.log`, result.stderr, artefacts, false);
    await writeJsonArtefact(runDir, `${base}-exit.json`, { success: result.success, code: result.exitCode, signal: result.signal, durationMs: result.durationMs }, artefacts, false);
    completed += 1;

    if (!result.success) {
      await writeJsonArtefact(
        runDir,
        "checks-status.json",
        { state: "failed", total: context.config.commands.checks.length, completed, error: `Check \"${check.name}\" failed` },
        artefacts,
        false
      );
      await bestEffortPhaseFailure(context, "checks", `check failed: ${check.name}`, ["checks-status.json"]);
      progressLogger.phaseFailed("checks", `check failed: ${check.name}`);
      throw new Error(`Checks failed. Diagnostics written to ${runDir}. Check \"${check.name}\" failed.`);
    }
  }

  await writeJsonArtefact(runDir, "checks-status.json", { state: "executed", total: context.config.commands.checks.length, completed }, artefacts, false);
  await updatePhaseAndPersist(
    context,
    "checks",
    "executed",
    context.config.commands.checks.length === 0 ? "no checks configured" : undefined,
    ["checks-status.json"]
  );
  progressLogger.phaseComplete("checks", "completed");
}
