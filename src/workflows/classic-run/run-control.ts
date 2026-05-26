import path from "node:path";
import { addRunArtefact, updateRunPhase, type RunMetadata, type RunPhaseName } from "../../run-metadata.js";
import { checkWriteSafety, type WriteSafetyResult } from "../../write-safety.js";
import type { OrchestratorConfig } from "../../config.js";
import type { ProgressLogger } from "../../progress-logger.js";

export type ClassicRunWriteSafetyState = "not checked" | "passed" | "failed" | "skipped by dry-run";

export interface ClassicRunControl {
  persistMetadata(priorError?: unknown): Promise<void>;
  updatePhaseAndPersist(phase: RunPhaseName, update: Parameters<typeof updateRunPhase>[2]): Promise<void>;
  bestEffortUpdatePhaseAndPersistOnFailure(phase: RunPhaseName, update: Parameters<typeof updateRunPhase>[2]): Promise<void>;
  setPhaseDisabled(phase: RunPhaseName, reason: string): Promise<void>;
  setPhaseSkipped(phase: RunPhaseName, reason: string): Promise<void>;
  canRunChecks(): { ok: boolean; reason?: string };
  ensureWriteSafetyIfNeeded(): Promise<void>;
  getWriteSafetyState(): ClassicRunWriteSafetyState;
}

export async function applyDisabledPhaseStatuses(input: {
  executePlanner: boolean;
  executeBuilder: boolean;
  executeReviewer: boolean;
  planFix: boolean;
  executeFix: boolean;
  runChecks: boolean;
  setPhaseDisabled: (phase: RunPhaseName, reason: string) => Promise<void>;
  progressLogger: ProgressLogger;
}): Promise<void> {
  if (!input.executePlanner) {
    await input.setPhaseDisabled("planner", "planner execution disabled");
    input.progressLogger.phaseSkipped("planner", "disabled");
  }
  if (!input.executeBuilder) {
    await input.setPhaseDisabled("builder", "builder execution disabled");
    input.progressLogger.phaseSkipped("builder", "disabled");
  }
  if (!input.executeReviewer) {
    await input.setPhaseDisabled("reviewer", "reviewer execution disabled");
    input.progressLogger.phaseSkipped("reviewer", "disabled");
  }
  if (!input.planFix) {
    await input.setPhaseDisabled("fixPlanning", "fix planning disabled");
    input.progressLogger.phaseSkipped("fix-planning", "disabled");
  }
  if (!input.executeFix) {
    await input.setPhaseDisabled("fixExecution", "fix execution disabled");
    input.progressLogger.phaseSkipped("fix", "disabled");
  }
  if (!input.runChecks) {
    await input.setPhaseDisabled("checks", "target checks disabled");
  }
}

export function createClassicRunControl(input: {
  allowWrites: boolean;
  dryRun: boolean;
  config: OrchestratorConfig;
  targetWorkspaceRoot: string;
  progressLogger: ProgressLogger;
  metadata: RunMetadata;
  runDir: string;
  artefacts: Record<string, string>;
  metadataWriter: (runDir: string, metadata: RunMetadata) => Promise<void>;
  writeArtefacts: (runDir: string, artefacts: Record<string, string>) => Promise<string[]>;
}): ClassicRunControl {
  let writeSafetyState: ClassicRunWriteSafetyState = input.allowWrites && input.dryRun ? "skipped by dry-run" : "not checked";
  let writeSafetyResult: WriteSafetyResult | undefined;

  const syncMetadataArtefacts = (): void => {
    for (const artefact of Object.keys(input.artefacts)) {
      addRunArtefact(input.metadata, artefact);
    }
  };

  const persistMetadata = async (priorError?: unknown): Promise<void> => {
    syncMetadataArtefacts();
    try {
      await input.metadataWriter(input.runDir, input.metadata);
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
    updateRunPhase(input.metadata, phase, update);
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

  const canRunChecks = (): { ok: boolean; reason?: string } => {
    if (!input.metadata.postWriteReview.required) {
      return { ok: true };
    }
    if (input.metadata.postWriteReview.status === "completed") {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `Checks blocked: post-write review status is "${input.metadata.postWriteReview.status}". Execute reviewer first to complete post-write review.`
    };
  };

  const ensureWriteSafetyIfNeeded = async (): Promise<void> => {
    if (!input.allowWrites || input.dryRun || writeSafetyResult) {
      if (input.allowWrites && input.dryRun) {
        writeSafetyState = "skipped by dry-run";
        input.metadata.writeSafety = { state: writeSafetyState, allowWrites: input.allowWrites };
        input.progressLogger.phaseSkipped("write-safety", "skipped by dry-run");
      }
      return;
    }
    input.progressLogger.phaseStart("write-safety", "checking target workspace");
    if (!input.config.writeSafety.enabled) {
      writeSafetyState = "failed";
      input.metadata.writeSafety = { state: writeSafetyState, allowWrites: input.allowWrites };
      input.artefacts["write-safety-result.json"] = JSON.stringify(
        { ok: false, failures: ["writeSafety.enabled is false"], summary: "Write safety check failed." },
        null,
        2
      );
      await input.writeArtefacts(input.runDir, { "write-safety-result.json": input.artefacts["write-safety-result.json"] });
      input.progressLogger.artefact("write safety result", path.resolve(input.runDir, "write-safety-result.json"));
      await persistMetadata();
      input.progressLogger.phaseFailed("write-safety", "writeSafety.enabled is false");
      throw new Error("Write mode requested but writeSafety.enabled is false.");
    }
    writeSafetyResult = await checkWriteSafety({ workspaceRoot: input.targetWorkspaceRoot, config: input.config });
    writeSafetyState = writeSafetyResult.ok ? "passed" : "failed";
    input.metadata.writeSafety = { state: writeSafetyState, allowWrites: input.allowWrites };
    input.artefacts["write-safety-result.json"] = JSON.stringify(writeSafetyResult, null, 2);
    await input.writeArtefacts(input.runDir, { "write-safety-result.json": input.artefacts["write-safety-result.json"] });
    input.progressLogger.artefact("write safety result", path.resolve(input.runDir, "write-safety-result.json"));
    await persistMetadata();
    if (!writeSafetyResult.ok) {
      input.progressLogger.phaseFailed("write-safety", "checks failed");
      throw new Error("Write mode blocked: write safety checks failed. See write-safety-result.json.");
    }
    input.progressLogger.phaseComplete("write-safety", "passed");
  };

  return {
    persistMetadata,
    updatePhaseAndPersist,
    bestEffortUpdatePhaseAndPersistOnFailure,
    setPhaseDisabled,
    setPhaseSkipped,
    canRunChecks,
    ensureWriteSafetyIfNeeded,
    getWriteSafetyState: () => writeSafetyState
  };
}
