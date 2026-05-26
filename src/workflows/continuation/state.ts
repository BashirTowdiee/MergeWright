import path from "node:path";
import type { executeCheckCommand } from "../../commands.js";
import type { AgentExecutionBackendMetadata, AgentExecutor } from "../../agent-executor.js";
import type { captureWriteAuditPostStateAndWriteArtefacts, captureWriteAuditPreState } from "../../write-audit.js";
import {
  canRunChecksWithPostWriteReview,
  createPostWriteReviewCompleted,
  createPostWriteReviewFailed,
  createPostWriteReviewPending,
  mergeRequiredByPhases
} from "../../continue-run/post-write-review.js";
import { createContinueWriteSafetyMetadata } from "../../continue-run/write-safety-state.js";
import { checkWriteSafety } from "../../write-safety.js";
import { writeRunMetadata, updateRunPhase, type RunMetadata, type RunPhaseName, type RunPhaseStatus } from "../../run-metadata.js";
import type { ContinueOptions, ContinueResult } from "./contracts.js";
import { writeJsonArtefact } from "./artefact-io.js";

export { mergeRequiredByPhases };

export interface ContinuationContext {
  options: ContinueOptions;
  runDir: string;
  metadata: RunMetadata;
  codexExecutor: AgentExecutor;
  writeAuditPreCapture: typeof captureWriteAuditPreState;
  writeAuditPostCapture: typeof captureWriteAuditPostStateAndWriteArtefacts;
  checkCommandExecutor: typeof executeCheckCommand;
  metadataWriter: typeof writeRunMetadata;
  progressLogger: NonNullable<ContinueOptions["progressLogger"]>;
  config: Awaited<ReturnType<typeof import("../../config.js").loadAndValidateConfig>>;
  orchestratorRoot: string;
  allowWrites: boolean;
  writeEnabledPhases: Array<"builder" | "fix">;
  artefacts: string[];
}

export interface ContinuationState {
  failedPhase?: RunPhaseName;
  skippedFixBecauseProceed: boolean;
  writeSafetyState: ContinueResult["writeSafetyState"];
  writeSafetyChecked: boolean;
}

export async function updatePhaseAndPersist(
  context: ContinuationContext,
  phase: RunPhaseName,
  status: RunPhaseStatus,
  reason?: string,
  phaseArtefacts?: string[],
  backend?: AgentExecutionBackendMetadata
): Promise<void> {
  updateRunPhase(context.metadata, phase, {
    status,
    startedAt: context.metadata.phases[phase]?.startedAt ?? new Date().toISOString(),
    completedAt:
      status === "executed" || status === "skipped" || status === "failed" || status === "disabled"
        ? new Date().toISOString()
        : undefined,
    reason,
    artefacts: phaseArtefacts,
    ...(backend ? { backend } : {})
  });
  if (!context.options.dryRun) {
    await context.metadataWriter(context.runDir, context.metadata);
  }
}

export async function bestEffortPhaseFailure(
  context: ContinuationContext,
  phase: RunPhaseName,
  reason: string,
  phaseArtefacts?: string[]
): Promise<void> {
  try {
    await updatePhaseAndPersist(context, phase, "failed", reason, phaseArtefacts);
  } catch {
    // preserve primary execution error
  }
}

export function canRunChecksWithMetadata(source: RunMetadata): { ok: boolean; reason?: string } {
  return canRunChecksWithPostWriteReview(source.postWriteReview);
}

export async function persistWriteSafetyState(
  context: ContinuationContext,
  state: ContinuationState,
  reason?: string,
  writeSafetyArtefacts?: string[]
): Promise<void> {
  context.metadata.writeSafety = createContinueWriteSafetyMetadata({
    existing: context.metadata.writeSafety,
    allowWrites: context.allowWrites,
    state: state.writeSafetyState,
    reason,
    artefacts: writeSafetyArtefacts
  });
  if (!context.options.dryRun) {
    await context.metadataWriter(context.runDir, context.metadata);
  }
}

export async function ensureWriteSafetyIfNeeded(context: ContinuationContext, state: ContinuationState): Promise<void> {
  if (!context.allowWrites || context.options.dryRun || state.writeSafetyChecked) {
    if (context.allowWrites && context.options.dryRun) {
      state.writeSafetyState = "skipped by dry-run";
      context.progressLogger.phaseSkipped("write-safety", "skipped by dry-run");
    }
    return;
  }

  context.progressLogger.phaseStart("write-safety", "checking target workspace");
  if (!context.config.writeSafety.enabled) {
    state.writeSafetyState = "failed";
    const result = { ok: false, failures: ["writeSafety.enabled is false"], summary: "Write safety check failed." };
    await writeJsonArtefact(context.runDir, "write-safety-result.json", result, context.artefacts, true);
    context.progressLogger.artefact("write safety result", path.resolve(context.runDir, "write-safety-result.json"));
    try {
      await persistWriteSafetyState(context, state, "writeSafety.enabled is false", ["write-safety-result.json"]);
    } catch {
      // preserve original safety error
    }
    context.progressLogger.phaseFailed("write-safety", "writeSafety.enabled is false");
    throw new Error("Write mode requested but writeSafety.enabled is false.");
  }

  const result = await checkWriteSafety({ workspaceRoot: context.metadata.workspaceRoot, config: context.config });
  state.writeSafetyChecked = true;
  state.writeSafetyState = result.ok ? "passed" : "failed";
  await writeJsonArtefact(context.runDir, "write-safety-result.json", result, context.artefacts, true);
  context.progressLogger.artefact("write safety result", path.resolve(context.runDir, "write-safety-result.json"));
  if (!result.ok) {
    try {
      await persistWriteSafetyState(context, state, "write safety checks failed", ["write-safety-result.json"]);
    } catch {
      // preserve original safety error
    }
    context.progressLogger.phaseFailed("write-safety", "checks failed");
    throw new Error("Write mode blocked: write safety checks failed. See write-safety-result.json.");
  }

  await persistWriteSafetyState(context, state, undefined, ["write-safety-result.json"]);
  context.progressLogger.phaseComplete("write-safety", "passed");
}

export async function setPostWriteReviewPending(
  context: ContinuationContext,
  phases: Array<"builder" | "fixExecution">
): Promise<void> {
  context.metadata.postWriteReview = createPostWriteReviewPending(context.metadata.postWriteReview, phases);
  const requiredByPhases = context.metadata.postWriteReview.requiredByPhases;
  context.progressLogger.phaseStart("post-write-review", `pending (${requiredByPhases.join(", ")})`);
  if (!context.options.dryRun) {
    await writeJsonArtefact(
      context.runDir,
      "post-write-review-required.json",
      {
        required: true,
        status: "pending",
        reason: context.metadata.postWriteReview.reason,
        requiredByPhases
      },
      context.artefacts,
      true
    );
    await writeJsonArtefact(
      context.runDir,
      "post-write-review-status.json",
      { status: "pending", reason: context.metadata.postWriteReview.reason },
      context.artefacts,
      true
    );
    await context.metadataWriter(context.runDir, context.metadata);
  }
}

export async function setPostWriteReviewCompleted(context: ContinuationContext): Promise<void> {
  context.metadata.postWriteReview = createPostWriteReviewCompleted(context.metadata.postWriteReview);
  context.progressLogger.phaseComplete("post-write-review", "completed");
  if (!context.options.dryRun) {
    await writeJsonArtefact(
      context.runDir,
      "post-write-review-status.json",
      { status: "completed", reason: context.metadata.postWriteReview.reason },
      context.artefacts,
      true
    );
    await context.metadataWriter(context.runDir, context.metadata);
  }
}

export async function setPostWriteReviewFailed(context: ContinuationContext, reason: string): Promise<void> {
  context.metadata.postWriteReview = createPostWriteReviewFailed(context.metadata.postWriteReview, reason);
  context.progressLogger.phaseFailed("post-write-review", reason);
  if (!context.options.dryRun) {
    await writeJsonArtefact(context.runDir, "post-write-review-status.json", { status: "failed", reason }, context.artefacts, true);
    await context.metadataWriter(context.runDir, context.metadata);
  }
}
