import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CodexExecutionBackendMetadata } from "./codex.js";

export type RunPhaseName = "planner" | "builder" | "reviewer" | "fixPlanning" | "fixExecution" | "checks";
export type RunPhaseStatus = "unknown" | "disabled" | "skipped" | "executed" | "failed";
export type RunStatus = "running" | "success" | "failed";
export type PostWriteReviewStatus = "not-required" | "pending" | "completed" | "failed";

export interface ResolvedRunOptions {
  dryRun: boolean;
  allowWrites: boolean;
  executePlanner: boolean;
  executeBuilder: boolean;
  executeReviewer: boolean;
  planFix: boolean;
  executeFix: boolean;
  runChecks: boolean;
}

export interface RunMetadataPhase {
  status: RunPhaseStatus;
  startedAt?: string;
  completedAt?: string;
  reason?: string;
  artefacts?: string[];
  backend?: CodexExecutionBackendMetadata;
}

export interface RunMetadata {
  version: 1;
  runId: string;
  projectName: string;
  stageName: string;
  preset?: string;
  workspaceRoot: string;
  orchestratorRoot: string;
  configPath: string;
  startedAt: string;
  completedAt: string | null;
  status: RunStatus;
  resolvedOptions: ResolvedRunOptions;
  writeSafety?: {
    state: "not checked" | "passed" | "failed" | "skipped by dry-run";
    allowWrites: boolean;
    status?: "passed" | "failed" | "skipped";
    reason?: string;
    artefacts?: string[];
  };
  writeAudit?: {
    builder: {
      status: "not-applicable" | "captured" | "partial" | "failed";
      artefacts?: string[];
      changedFiles?: string[];
      reason?: string;
    };
    fix: {
      status: "not-applicable" | "captured" | "partial" | "failed";
      artefacts?: string[];
      changedFiles?: string[];
      reason?: string;
    };
  };
  postWriteReview: {
    required: boolean;
    status: PostWriteReviewStatus;
    reason: string;
    requiredByPhases: Array<"builder" | "fixExecution">;
    artefacts: string[];
  };
  phases: Record<RunPhaseName, RunMetadataPhase>;
  artefacts: string[];
  error: { message: string; failedPhase?: RunPhaseName } | null;
}

export function createInitialRunMetadata(input: {
  runId: string;
  projectName: string;
  stageName: string;
  preset?: string;
  workspaceRoot: string;
  orchestratorRoot: string;
  configPath: string;
  resolvedOptions: ResolvedRunOptions;
  startedAt?: Date;
}): RunMetadata {
  const startedAt = (input.startedAt ?? new Date()).toISOString();
  return {
    version: 1,
    runId: input.runId,
    projectName: input.projectName,
    stageName: input.stageName,
    preset: input.preset,
    workspaceRoot: input.workspaceRoot,
    orchestratorRoot: input.orchestratorRoot,
    configPath: input.configPath,
    startedAt,
    completedAt: null,
    status: "running",
    resolvedOptions: { ...input.resolvedOptions },
    writeSafety: { state: "not checked", allowWrites: input.resolvedOptions.allowWrites },
    writeAudit: {
      builder: { status: "not-applicable" },
      fix: { status: "not-applicable" }
    },
    postWriteReview: {
      required: false,
      status: "not-required",
      reason: "no write-enabled builder/fix executed",
      requiredByPhases: [],
      artefacts: []
    },
    phases: {
      planner: { status: "unknown" },
      builder: { status: "unknown" },
      reviewer: { status: "unknown" },
      fixPlanning: { status: "unknown" },
      fixExecution: { status: "unknown" },
      checks: { status: "unknown" }
    },
    artefacts: [],
    error: null
  };
}

export async function writeRunMetadata(runDir: string, metadata: RunMetadata): Promise<void> {
  const destination = path.resolve(runDir, "run.json");
  const tmp = `${destination}.tmp`;
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await rename(tmp, destination);
}

export function addRunArtefact(metadata: RunMetadata, relativePath: string): void {
  const normalized = normalizeRelativePath(relativePath);
  if (!metadata.artefacts.includes(normalized)) {
    metadata.artefacts.push(normalized);
    metadata.artefacts.sort((a, b) => a.localeCompare(b));
  }
}

export function updateRunPhase(
  metadata: RunMetadata,
  phaseName: RunPhaseName,
  patch: Partial<RunMetadataPhase> & Pick<RunMetadataPhase, "status">
): void {
  const current = metadata.phases[phaseName] ?? { status: "unknown" as RunPhaseStatus };
  const next: RunMetadataPhase = {
    ...current,
    ...patch
  };
  if (patch.artefacts) {
    next.artefacts = dedupeSorted(patch.artefacts.map(normalizeRelativePath));
  }
  metadata.phases[phaseName] = next;
}

export function markRunSuccess(metadata: RunMetadata, completedAt = new Date()): void {
  metadata.status = "success";
  metadata.completedAt = completedAt.toISOString();
  metadata.error = null;
}

export function markRunFailure(
  metadata: RunMetadata,
  error: unknown,
  failedPhase?: RunPhaseName,
  completedAt = new Date()
): void {
  metadata.status = "failed";
  metadata.completedAt = completedAt.toISOString();
  metadata.error = {
    message: error instanceof Error ? error.message : String(error),
    failedPhase
  };
}

export function toRunRelativePath(runDir: string, absolutePath: string): string {
  const relative = path.relative(runDir, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return path.basename(absolutePath);
  }
  return normalizeRelativePath(relative);
}

function normalizeRelativePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\.\//, "");
}

function dedupeSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
