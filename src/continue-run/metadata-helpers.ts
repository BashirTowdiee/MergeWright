import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RunMetadata, RunPhaseName, RunPhaseStatus } from "../run-metadata.js";

export const REQUIRED_CONTINUE_RUN_PHASES: readonly RunPhaseName[] = [
  "planner",
  "builder",
  "reviewer",
  "fixPlanning",
  "fixExecution",
  "checks"
];

const VALID_RUN_STATUSES = new Set<RunMetadata["status"]>(["running", "success", "failed"]);
const VALID_PHASE_STATUSES = new Set<RunPhaseStatus>(["unknown", "disabled", "skipped", "executed", "failed"]);

export async function readRequiredRunMetadata(runDir: string, runId: string): Promise<RunMetadata> {
  const runMetadataPath = path.resolve(runDir, "run.json");
  let raw: string;
  try {
    raw = await readFile(runMetadataPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`run.json is required for continue-run and was not found/readable at ${runMetadataPath}. ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`run.json is malformed for run ${runId}: ${message}`);
  }

  return validateRunMetadata(parsed, runId);
}

export function validateRunMetadata(value: unknown, expectedRunId: string): RunMetadata {
  const invalid = (message: string): never => {
    throw new Error(`Invalid run metadata: ${message}`);
  };

  if (!value || typeof value !== "object") invalid("root must be an object.");
  const v = value as Record<string, unknown>;

  if (v.version !== 1) invalid("version must be 1.");
  for (const key of ["runId", "projectName", "stageName", "workspaceRoot", "orchestratorRoot", "configPath"] as const) {
    const field = v[key];
    if (typeof field !== "string" || field.trim().length === 0) invalid(`${key} must be a non-empty string.`);
  }
  if (v.runId !== expectedRunId) invalid(`runId mismatch. Expected ${expectedRunId}, got ${String(v.runId)}.`);
  if (!VALID_RUN_STATUSES.has(v.status as RunMetadata["status"])) {
    invalid("status must be one of running, success, failed.");
  }
  if (!v.resolvedOptions || typeof v.resolvedOptions !== "object") invalid("resolvedOptions must be an object.");
  if (!v.phases || typeof v.phases !== "object") invalid("phases must be an object.");

  const phases = v.phases as Record<string, unknown>;
  for (const phase of REQUIRED_CONTINUE_RUN_PHASES) {
    const phaseValue = phases[phase];
    if (!phaseValue || typeof phaseValue !== "object") invalid(`phases.${phase} is required.`);
    const status = (phaseValue as Record<string, unknown>).status;
    if (!VALID_PHASE_STATUSES.has(status as RunPhaseStatus)) {
      invalid(`phases.${phase}.status must be one of unknown, disabled, skipped, executed, failed.`);
    }
  }

  if (v.artefacts !== undefined && !Array.isArray(v.artefacts)) invalid("artefacts must be an array when present.");
  return v as unknown as RunMetadata;
}

export function assertRunOwnership(
  metadata: RunMetadata,
  runDir: string,
  runsRoot: string,
  configuredProjectName: string
): void {
  if (metadata.runId !== path.basename(runDir)) {
    throw new Error(`run.json runId mismatch. Expected ${path.basename(runDir)}, got ${metadata.runId}.`);
  }

  const rel = path.relative(runsRoot, runDir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Run directory resolves outside configured runs root. runsRoot=${runsRoot} runDir=${runDir}`);
  }

  if (metadata.projectName.trim().toLowerCase() !== configuredProjectName.trim().toLowerCase()) {
    throw new Error(`Run project mismatch. run.json project=${metadata.projectName}, config project=${configuredProjectName}.`);
  }
}

export function snapshotStatuses(metadata: RunMetadata): Record<RunPhaseName, RunPhaseStatus> {
  return {
    planner: metadata.phases.planner?.status ?? "unknown",
    builder: metadata.phases.builder?.status ?? "unknown",
    reviewer: metadata.phases.reviewer?.status ?? "unknown",
    fixPlanning: metadata.phases.fixPlanning?.status ?? "unknown",
    fixExecution: metadata.phases.fixExecution?.status ?? "unknown",
    checks: metadata.phases.checks?.status ?? "unknown"
  };
}

export function cloneMetadata(metadata: RunMetadata): RunMetadata {
  return JSON.parse(JSON.stringify(metadata)) as RunMetadata;
}
