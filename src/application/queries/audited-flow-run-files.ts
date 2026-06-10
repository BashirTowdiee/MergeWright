import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AuditedFlowAuditEvent } from "../audited-flow/audit-events.js";
import type { RunContract } from "../audited-flow/contract.js";
import type { AuditedFlowResult } from "../use-cases/execute-audited-flow-use-case.js";

export interface AuditedFlowRunFiles {
  runId: string;
  runsRoot: string;
  artefactsDir: string;
  resultPath: string;
  contractPath: string;
  auditPath: string;
  result: AuditedFlowResult;
  contract: RunContract;
  events: AuditedFlowAuditEvent[];
}

export interface AuditedFlowRunEvents {
  runId: string;
  auditPath: string;
  events: AuditedFlowAuditEvent[];
}

export interface AuditedFlowRunFilesQueryService {
  getRun(input: { runId: string; orchestratorRoot: string; runsRoot?: string }): Promise<AuditedFlowRunFiles>;
  getEvents(input: { runId: string; orchestratorRoot: string; runsRoot?: string; limit?: number }): Promise<AuditedFlowRunEvents>;
}

export class DefaultAuditedFlowRunFilesQueryService implements AuditedFlowRunFilesQueryService {
  async getRun(input: { runId: string; orchestratorRoot: string; runsRoot?: string }): Promise<AuditedFlowRunFiles> {
    const paths = resolveRunPaths(input);

    const [contract, result, events] = await Promise.all([
      readRequiredJson<RunContract>(paths.contractPath, `Audited flow contract not found for run ${paths.runId}.`),
      readRequiredJson<AuditedFlowResult>(paths.resultPath, `Audited flow result not found for run ${paths.runId}.`),
      readAuditEvents(paths.auditPath, paths.runId)
    ]);

    return {
      ...paths,
      contract,
      result,
      events
    };
  }

  async getEvents(input: { runId: string; orchestratorRoot: string; runsRoot?: string; limit?: number }): Promise<AuditedFlowRunEvents> {
    const paths = resolveRunPaths(input);
    const events = await readAuditEvents(paths.auditPath, paths.runId);
    return {
      runId: paths.runId,
      auditPath: paths.auditPath,
      events: applyEventLimit(events, input.limit)
    };
  }
}

export function resolveAuditedFlowRunsRoot(input: { orchestratorRoot: string; runsRoot?: string }): string {
  if (input.runsRoot?.trim()) {
    return path.resolve(input.runsRoot);
  }
  return path.resolve(input.orchestratorRoot, ".artifacts", "runs", "audited-flow");
}

function resolveRunPaths(input: { runId: string; orchestratorRoot: string; runsRoot?: string }) {
  const runId = input.runId.trim();
  if (!runId) {
    throw new Error("Audited flow run id is required.");
  }

  const runsRoot = resolveAuditedFlowRunsRoot(input);
  const artefactsDir = path.resolve(runsRoot, runId);
  return {
    runId,
    runsRoot,
    artefactsDir,
    resultPath: path.join(artefactsDir, "result.json"),
    contractPath: path.join(artefactsDir, "run-contract.json"),
    auditPath: path.join(artefactsDir, "audit.ndjson")
  };
}

async function readRequiredJson<T>(filePath: string, errorMessage: string): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(errorMessage);
    }
    throw error;
  }

  return JSON.parse(raw) as T;
}

async function readAuditEvents(auditPath: string, runId: string): Promise<AuditedFlowAuditEvent[]> {
  let raw: string;
  try {
    raw = await readFile(auditPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Audited flow audit log not found for run ${runId}.`);
    }
    throw error;
  }

  const events: AuditedFlowAuditEvent[] = [];
  for (const [index, line] of raw.split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      events.push(JSON.parse(trimmed) as AuditedFlowAuditEvent);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid audited flow audit event at line ${index + 1}: ${reason}`);
    }
  }
  return events;
}

function applyEventLimit(events: AuditedFlowAuditEvent[], limit?: number): AuditedFlowAuditEvent[] {
  if (limit == null || limit >= events.length) {
    return events;
  }
  return events.slice(-limit);
}
