import type { ProgressLogger } from "../../progress-logger.js";
import { markRunFailure, type RunMetadata, type RunPhaseName } from "../../run-metadata.js";
import { finaliseClassicRunEvidence } from "./run-evidence-finalisation.js";

export async function finaliseClassicRunFailure(input: {
  error: unknown;
  failedPhase: RunPhaseName | undefined;
  metadata: RunMetadata;
  persistMetadata: (priorError?: unknown) => Promise<void>;
  progressLogger: ProgressLogger;
  runDir: string;
}): Promise<never> {
  markRunFailure(input.metadata, input.error, input.failedPhase);
  try {
    await finaliseClassicRunEvidence({ runDir: input.runDir, status: "fail" });
  } catch {
    // Preserve the original run failure as the primary failure.
  }
  await input.persistMetadata(input.error);
  if (input.failedPhase) {
    input.progressLogger.phaseFailed(input.failedPhase, input.error);
    input.progressLogger.info(`Run failed during phase: ${input.failedPhase}`);
  } else {
    input.progressLogger.phaseFailed("run", input.error);
  }
  input.progressLogger.info(`Diagnostics: ${input.runDir}`);
  throw input.error;
}
