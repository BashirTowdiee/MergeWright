import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorConfig } from "./config.js";
import type { RunMetadata, RunPhaseName, RunPhaseStatus, RunStatus } from "./run-metadata.js";

export type { RunPhaseStatus, RunStatus };

export interface RunStatuses {
  planner: RunPhaseStatus;
  builder: RunPhaseStatus;
  reviewer: RunPhaseStatus;
  fixPlanning: RunPhaseStatus;
  fixExecution: RunPhaseStatus;
  checks: RunPhaseStatus;
}

export interface RunSummary {
  runId: string;
  runDir: string;
  createdAt: Date;
  stageName: string | null;
  projectName: string | null;
  preset: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: RunStatus | "unknown";
  statuses: RunStatuses;
  warnings: string[];
}

export interface RunDetails {
  runId: string;
  runDir: string;
  stageInputPath: string;
  stageName: string | null;
  projectName: string | null;
  preset: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: RunStatus | "unknown";
  statuses: RunStatuses;
  artefacts: string[];
  keyStatusArtefacts: string[];
  errorSummary: string | null;
  warnings: string[];
}

const RUN_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

const STAGE_KEYS: Record<string, { executed: string[]; skipped: string[]; failed?: string[] }> = {
  planner: {
    executed: ["07-planner-exit.json", "06-planner-output-last-message.md", "03-planner-command.args.json"],
    skipped: ["03-planner-output.placeholder.md"]
  },
  builder: {
    executed: ["builder-exit.json", "builder-output-last-message.md", "builder-prompt.executed.md"],
    skipped: ["builder-output.placeholder.md", "05-builder-output.placeholder.md"]
  },
  reviewer: {
    executed: ["reviewer-exit.json", "reviewer-output-last-message.md"],
    skipped: ["reviewer-skipped.json", "reviewer-output.placeholder.md"]
  },
  fixPlanning: {
    executed: ["review-to-fix-decision.json", "review-to-fix-decision.proceed.json", "review-to-fix-output-last-message.md"],
    skipped: ["review-to-fix-skipped.json", "review-to-fix-output.placeholder.md"],
    failed: ["review-to-fix-parse-error.json", "review-to-fix-exit.json"]
  },
  fixExecution: {
    executed: ["fix-exit.json", "fix-output-last-message.md", "fix-prompt.executed.md"],
    skipped: ["fix-skipped.json"]
  },
  checks: {
    executed: ["checks-status.json"],
    skipped: [],
    failed: ["checks-status.json"]
  }
};

const KEY_STATUS_ARTEFACTS = [
  "planner-output-parse-error.json",
  "review-to-fix-parse-error.json",
  "review-to-fix-decision.json",
  "review-to-fix-decision.proceed.json",
  "fix-skipped.json",
  "reviewer-skipped.json",
  "review-to-fix-skipped.json",
  "checks-status.json",
  "run.json"
];

export function resolveRunsRoot(orchestratorRoot: string, config: OrchestratorConfig): string {
  const resolved = path.resolve(orchestratorRoot, config.paths.runsDir);
  assertWithinRoot(orchestratorRoot, resolved, `Invalid config: paths.runsDir must resolve inside orchestrator root ${orchestratorRoot}`);
  return resolved;
}

export function validateRunId(runId: string): void {
  if (!runId || !runId.trim()) {
    throw new Error("Invalid run id: value is empty.");
  }
  if (path.isAbsolute(runId)) {
    throw new Error(`Invalid run id: absolute paths are not allowed (${runId}).`);
  }
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`Invalid run id: only letters, numbers, dot, underscore, and hyphen are allowed (${runId}).`);
  }
  if (runId.includes("..") || runId.includes("/") || runId.includes("\\")) {
    throw new Error(`Invalid run id: path traversal and separators are not allowed (${runId}).`);
  }
}

export async function listRunDirectories(runsRoot: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(runsRoot, { withFileTypes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Runs directory not found or unreadable: ${runsRoot}. ${message}`);
  }

  const dirs: Array<{ id: string; mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const fullPath = path.resolve(runsRoot, entry.name);
    let mtimeMs = 0;
    try {
      const info = await stat(fullPath);
      mtimeMs = info.mtimeMs;
    } catch {
      mtimeMs = 0;
    }
    dirs.push({ id: entry.name, mtimeMs });
  }

  dirs.sort((a, b) => (b.mtimeMs !== a.mtimeMs ? b.mtimeMs - a.mtimeMs : b.id.localeCompare(a.id)));
  return dirs.map((dir) => dir.id);
}

export function resolveRunDir(runsRoot: string, runId: string): string {
  validateRunId(runId);
  const runDir = path.resolve(runsRoot, runId);
  assertWithinRoot(runsRoot, runDir, `Run id resolves outside runs directory: ${runId}`);
  return runDir;
}

export async function readRunDetails(runsRoot: string, runId: string): Promise<RunDetails> {
  const runDir = resolveRunDir(runsRoot, runId);
  await assertDirectoryExists(runDir, `Run does not exist: ${runId}`);

  const artefacts = await collectArtefactPaths(runDir);
  const relativeArtefacts = artefacts.map((filePath) => path.relative(runDir, filePath)).sort((a, b) => a.localeCompare(b));
  const keyStatusArtefacts = relativeArtefacts.filter((name) => KEY_STATUS_ARTEFACTS.includes(name));

  const metadataInfo = await readRunMetadata(runDir);
  if (metadataInfo.metadata) {
    return {
      runId,
      runDir,
      stageInputPath: path.resolve(runDir, "01-stage-input.md"),
      stageName: metadataInfo.metadata.stageName,
      projectName: metadataInfo.metadata.projectName,
      preset: metadataInfo.metadata.preset ?? null,
      startedAt: metadataInfo.metadata.startedAt,
      completedAt: metadataInfo.metadata.completedAt,
      status: metadataInfo.metadata.status,
      statuses: mapStatusesFromMetadata(metadataInfo.metadata),
      artefacts: metadataInfo.metadata.artefacts.length > 0 ? metadataInfo.metadata.artefacts : relativeArtefacts,
      keyStatusArtefacts,
      errorSummary: metadataInfo.metadata.error?.message ?? null,
      warnings: metadataInfo.warnings
    };
  }

  const statuses = await inferStatuses(runDir, relativeArtefacts);
  return {
    runId,
    runDir,
    stageInputPath: path.resolve(runDir, "01-stage-input.md"),
    stageName: inferStageName(runId),
    projectName: null,
    preset: null,
    startedAt: null,
    completedAt: null,
    status: "unknown",
    statuses,
    artefacts: relativeArtefacts,
    keyStatusArtefacts,
    errorSummary: null,
    warnings: metadataInfo.warnings
  };
}

export async function readRunSummary(runsRoot: string, runId: string): Promise<RunSummary> {
  const details = await readRunDetails(runsRoot, runId);
  const info = await stat(details.runDir);
  return {
    runId,
    runDir: details.runDir,
    createdAt: info.birthtime,
    stageName: details.stageName,
    projectName: details.projectName,
    preset: details.preset,
    startedAt: details.startedAt,
    completedAt: details.completedAt,
    status: details.status,
    statuses: details.statuses,
    warnings: details.warnings
  };
}

async function collectArtefactPaths(runDir: string): Promise<string[]> {
  const result: string[] = [];
  const queue = [runDir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.resolve(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        result.push(fullPath);
      }
    }
  }

  return result;
}

async function readRunMetadata(runDir: string): Promise<{ metadata: RunMetadata | null; warnings: string[] }> {
  const runMetadataPath = path.resolve(runDir, "run.json");
  const warnings: string[] = [];
  try {
    const raw = await readFile(runMetadataPath, "utf8");
    const parsed = JSON.parse(raw) as RunMetadata;
    if (!isValidMetadata(parsed)) {
      warnings.push("run.json is malformed; using legacy artefact inference.");
      return { metadata: null, warnings };
    }
    return { metadata: parsed, warnings };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { metadata: null, warnings };
    }
    warnings.push("run.json is malformed; using legacy artefact inference.");
    return { metadata: null, warnings };
  }
}

function isValidMetadata(value: unknown): value is RunMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Partial<RunMetadata>;
  return v.version === 1 && typeof v.runId === "string" && typeof v.stageName === "string" && typeof v.phases === "object";
}

function mapStatusesFromMetadata(metadata: RunMetadata): RunStatuses {
  return {
    planner: phaseStatusOrUnknown(metadata, "planner"),
    builder: phaseStatusOrUnknown(metadata, "builder"),
    reviewer: phaseStatusOrUnknown(metadata, "reviewer"),
    fixPlanning: phaseStatusOrUnknown(metadata, "fixPlanning"),
    fixExecution: phaseStatusOrUnknown(metadata, "fixExecution"),
    checks: phaseStatusOrUnknown(metadata, "checks")
  };
}

function phaseStatusOrUnknown(metadata: RunMetadata, phase: RunPhaseName): RunPhaseStatus {
  const status = metadata.phases?.[phase]?.status;
  if (status === "unknown" || status === "disabled" || status === "skipped" || status === "executed" || status === "failed") {
    return status;
  }
  return "unknown";
}

async function inferStatuses(runDir: string, artefacts: string[]): Promise<RunStatuses> {
  const artefactSet = new Set(artefacts);

  const planner = inferSimpleStatus(artefactSet, STAGE_KEYS.planner.executed, STAGE_KEYS.planner.skipped, STAGE_KEYS.planner.failed);
  const builder = inferSimpleStatus(artefactSet, STAGE_KEYS.builder.executed, STAGE_KEYS.builder.skipped, STAGE_KEYS.builder.failed);
  const reviewer = inferSimpleStatus(artefactSet, STAGE_KEYS.reviewer.executed, STAGE_KEYS.reviewer.skipped, STAGE_KEYS.reviewer.failed);
  const fixPlanning = inferSimpleStatus(
    artefactSet,
    STAGE_KEYS.fixPlanning.executed,
    STAGE_KEYS.fixPlanning.skipped,
    STAGE_KEYS.fixPlanning.failed
  );
  const fixExecution = inferSimpleStatus(artefactSet, STAGE_KEYS.fixExecution.executed, STAGE_KEYS.fixExecution.skipped, STAGE_KEYS.fixExecution.failed);
  const checks = await inferChecksStatus(runDir, artefactSet);

  return { planner, builder, reviewer, fixPlanning, fixExecution, checks };
}

function inferSimpleStatus(
  artefacts: Set<string>,
  executedKeys: string[],
  skippedKeys: string[],
  failedKeys?: string[]
): RunPhaseStatus {
  if (failedKeys && failedKeys.some((name) => artefacts.has(name))) {
    return "failed";
  }
  if (executedKeys.some((name) => artefacts.has(name))) {
    return "executed";
  }
  if (skippedKeys.some((name) => artefacts.has(name))) {
    return "skipped";
  }
  return "unknown";
}

async function inferChecksStatus(runDir: string, artefacts: Set<string>): Promise<RunPhaseStatus> {
  if (!artefacts.has("checks-status.json")) {
    return "unknown";
  }
  const statusPath = path.resolve(runDir, "checks-status.json");
  try {
    const raw = await readFile(statusPath, "utf8");
    const parsed = JSON.parse(raw) as { state?: string };
    if (parsed.state === "failed") {
      return "failed";
    }
    if (parsed.state === "executed") {
      return "executed";
    }
    if (typeof parsed.state === "string" && (parsed.state.includes("skipped") || parsed.state === "disabled")) {
      return "skipped";
    }
  } catch {
    return "failed";
  }
  return "unknown";
}

function inferStageName(runId: string): string | null {
  const timestampPrefix = /^\d{8}-\d{6}-(.+)$/;
  const match = runId.match(timestampPrefix);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

function assertWithinRoot(root: string, candidate: string, message: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(message);
  }
}

async function assertDirectoryExists(dirPath: string, message: string): Promise<void> {
  try {
    const info = await stat(dirPath);
    if (!info.isDirectory()) {
      throw new Error(message);
    }
  } catch {
    throw new Error(message);
  }
}
