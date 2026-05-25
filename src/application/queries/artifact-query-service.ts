import type { RunArtefact } from "../read-models/run-read-model.js";
import type { RunReadRepository } from "./run-query-service.js";

export interface ListArtifactsInput {
  runId: string;
  phaseId?: string;
}

export interface GetArtifactInput {
  runId: string;
  artifactId: string;
}

export interface ArtifactQueryService {
  listArtifacts(input: ListArtifactsInput): Promise<RunArtefact[]>;
  getArtifact(input: GetArtifactInput): Promise<RunArtefact | null>;
}

export class DefaultArtifactQueryService implements ArtifactQueryService {
  constructor(private readonly runRepository: RunReadRepository) {}

  async listArtifacts(input: ListArtifactsInput): Promise<RunArtefact[]> {
    if (!input.runId.trim()) {
      return [];
    }
    const run = await this.runRepository.getRun(input.runId);
    if (!run) {
      return [];
    }
    if (!input.phaseId) {
      return [...run.artefacts];
    }
    return run.artefacts.filter((artifact) => artifact.phaseId === input.phaseId);
  }

  async getArtifact(input: GetArtifactInput): Promise<RunArtefact | null> {
    if (!input.runId.trim() || !input.artifactId.trim()) {
      return null;
    }
    const artifacts = await this.listArtifacts({ runId: input.runId });
    return artifacts.find((artifact) => artifact.id === input.artifactId) ?? null;
  }
}
