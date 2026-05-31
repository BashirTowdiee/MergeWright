import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RunArtefact, RunArtefactContent } from "../read-models/run-read-model.js";
import type { RunPhaseArtifactsView } from "../read-models/run-phase-artifacts-read-model.js";
import type { RunReadRepository } from "./run-query-service.js";

export interface ListArtifactsInput {
  runId: string;
  phaseId?: string;
}

export interface GetArtifactInput {
  runId: string;
  artifactId: string;
}

export interface GetArtifactContentInput extends GetArtifactInput {
  maxBytes?: number;
}

export interface ArtifactQueryService {
  listArtifacts(input: ListArtifactsInput): Promise<RunArtefact[]>;
  listPhaseArtifacts(input: { runId: string }): Promise<RunPhaseArtifactsView | null>;
  getArtifact(input: GetArtifactInput): Promise<RunArtefact | null>;
  getArtifactContent(input: GetArtifactContentInput): Promise<RunArtefactContent | null>;
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

  async listPhaseArtifacts(input: { runId: string }): Promise<RunPhaseArtifactsView | null> {
    if (!input.runId.trim()) {
      return null;
    }

    const run = await this.runRepository.getRun(input.runId);
    if (!run) {
      return null;
    }

    const assigned = new Set<string>();
    const phases = run.phases.map((phase) => {
      const phaseArtifacts: RunArtefact[] = [];
      const seen = new Set<string>();

      for (const artifactId of phase.artefactIds) {
        const artifact = run.artefacts.find((candidate) => candidate.id === artifactId);
        if (!artifact || seen.has(artifact.id)) {
          continue;
        }
        phaseArtifacts.push(artifact);
        seen.add(artifact.id);
        assigned.add(artifact.id);
      }

      for (const artifact of run.artefacts) {
        if (artifact.phaseId !== phase.id || seen.has(artifact.id)) {
          continue;
        }
        phaseArtifacts.push(artifact);
        seen.add(artifact.id);
        assigned.add(artifact.id);
      }

      return {
        id: phase.id,
        label: phase.label,
        status: phase.status,
        artifacts: phaseArtifacts
      };
    });

    const unassignedArtifacts = run.artefacts.filter((artifact) => !assigned.has(artifact.id));

    return {
      runId: run.id,
      phases,
      unassignedArtifacts
    };
  }

  async getArtifact(input: GetArtifactInput): Promise<RunArtefact | null> {
    if (!input.runId.trim() || !input.artifactId.trim()) {
      return null;
    }
    const artifacts = await this.listArtifacts({ runId: input.runId });
    return artifacts.find((artifact) => artifact.id === input.artifactId) ?? null;
  }

  async getArtifactContent(input: GetArtifactContentInput): Promise<RunArtefactContent | null> {
    if (!input.runId.trim() || !input.artifactId.trim()) {
      return null;
    }

    const run = await this.runRepository.getRun(input.runId);
    if (!run) {
      return null;
    }

    const artifact = run.artefacts.find((candidate) => candidate.id === input.artifactId);
    if (!artifact) {
      return null;
    }

    const runDir = path.resolve(run.runDir);
    const artifactPath = path.resolve(runDir, artifact.path);
    const relativePath = path.relative(runDir, artifactPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(`Artifact path escapes run directory: ${artifact.path}`);
    }

    const maxBytes = normalizeMaxBytes(input.maxBytes);
    const buffer = await readFile(artifactPath);
    const truncated = buffer.byteLength > maxBytes;
    const content = (truncated ? buffer.subarray(0, maxBytes) : buffer).toString("utf8");

    return {
      artifact,
      content,
      truncated,
      maxBytes
    };
  }
}

function normalizeMaxBytes(maxBytes: number | undefined): number {
  if (maxBytes === undefined) {
    return 256_000;
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    return 256_000;
  }
  return maxBytes;
}
