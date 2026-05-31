import type { RunArtefact, RunPhaseStatus } from "./run-read-model.js";

export interface RunPhaseArtifactsView {
  readonly runId: string;
  readonly phases: readonly RunPhaseArtifactsItem[];
  readonly unassignedArtifacts: readonly RunArtefact[];
}

export interface RunPhaseArtifactsItem {
  readonly id: string;
  readonly label: string;
  readonly status: RunPhaseStatus;
  readonly artifacts: readonly RunArtefact[];
}
