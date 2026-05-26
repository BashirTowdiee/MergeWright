import type { RunMetadata, RunPhaseName } from "../run-metadata.js";

export function ensurePlannerExecuted(metadata: RunMetadata): void {
  ensurePhaseExecuted(metadata, "planner", "Continuation requires planner phase executed in run.json.");
}

export function ensurePhaseExecuted(metadata: RunMetadata, phase: RunPhaseName, message: string): void {
  if (metadata.phases[phase]?.status !== "executed") {
    throw new Error(message);
  }
}

export function ensurePhaseNotExecuted(metadata: RunMetadata, phase: RunPhaseName, label: string): void {
  if (metadata.phases[phase]?.status === "executed") {
    throw new Error(`${label} continuation is not allowed because the phase is already executed.`);
  }
}
