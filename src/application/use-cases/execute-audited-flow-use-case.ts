import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FilesystemAuditedFlowAuditWriter, type AuditedFlowAuditWriter } from "../audited-flow/audit-writer.js";
import type { RunContract, RunContractStage } from "../audited-flow/contract.js";
import { validateRunContract } from "../audited-flow/contract-validation.js";
import { StageExecutorRegistry } from "../audited-flow/executor-registry.js";
import type { StageResult, StageResultStatus } from "../audited-flow/stage-executor.js";

export type AuditedFlowStatus = "passed" | "failed" | "needs-approval";

export interface AuditedFlowResult {
  runId: string;
  status: AuditedFlowStatus;
  stageResults: StageResult[];
  auditPath: string;
  artefactsDir: string;
  dryRun: boolean;
}

export interface ExecuteAuditedFlowRequest {
  contract: RunContract;
  orchestratorRoot: string;
  runsRoot?: string;
  dryRun?: boolean;
}

export interface ExecuteAuditedFlowUseCase {
  execute(request: ExecuteAuditedFlowRequest): Promise<AuditedFlowResult>;
}

export interface ExecuteAuditedFlowDependencies {
  executorRegistry: StageExecutorRegistry;
  auditWriterFactory?: (auditPath: string) => AuditedFlowAuditWriter;
  clock?: () => Date;
  runIdFactory?: (contract: RunContract, now: Date) => string;
}

export class DefaultExecuteAuditedFlowUseCase implements ExecuteAuditedFlowUseCase {
  constructor(private readonly deps: ExecuteAuditedFlowDependencies) {}

  execute(request: ExecuteAuditedFlowRequest): Promise<AuditedFlowResult> {
    return executeAuditedFlow({
      ...request,
      ...this.deps
    });
  }
}

export async function executeAuditedFlow(
  input: ExecuteAuditedFlowRequest & ExecuteAuditedFlowDependencies
): Promise<AuditedFlowResult> {
  const validationErrors = validateRunContract(input.contract);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(" "));
  }

  for (const stage of input.contract.stages) {
    const executor = input.executorRegistry.resolve(stage.executor);
    if (!executor.capabilities.stageKinds.includes(stage.kind)) {
      throw new Error(`Stage executor ${stage.executor} does not support stage kind ${stage.kind}.`);
    }
  }

  const now = input.clock?.() ?? new Date();
  const runId = input.contract.id?.trim() || (input.runIdFactory ?? defaultRunIdFactory)(input.contract, now);
  const baseRunsRoot = input.runsRoot?.trim()
    ? path.resolve(input.runsRoot)
    : path.resolve(input.orchestratorRoot, ".artifacts", "runs", "audited-flow");
  const artefactsDir = path.resolve(baseRunsRoot, runId);
  const auditPath = path.join(artefactsDir, "audit.ndjson");
  const auditWriter = (input.auditWriterFactory ?? ((value) => new FilesystemAuditedFlowAuditWriter(value)))(auditPath);

  await mkdir(path.dirname(artefactsDir), { recursive: true });
  await mkdir(artefactsDir, { recursive: false });
  await writeJsonFile(path.join(artefactsDir, "run-contract.json"), input.contract);

  const stageResults: StageResult[] = [];
  await auditWriter.append({
    type: "run.created",
    runId,
    occurredAt: now.toISOString(),
    payload: {
      contract: input.contract,
      dryRun: input.dryRun ?? false
    }
  });
  await auditWriter.append({
    type: "flow.selected",
    runId,
    occurredAt: now.toISOString(),
    payload: {
      flow: input.contract.flow,
      stages: input.contract.stages.map((stage) => ({
        id: stage.id,
        kind: stage.kind,
        executor: stage.executor,
        required: stage.required !== false
      }))
    }
  });

  for (const stage of input.contract.stages) {
    const stageDir = path.join(artefactsDir, "stages", toSafePathSegment(stage.id));
    await mkdir(stageDir, { recursive: true });

    const gate = evaluateStageGate(stage, stageResults);
    if (!gate.allowed) {
      const skippedStatus: StageResultStatus = stage.required === false ? "skipped" : "failed";
      const skippedResult: StageResult = {
        stageId: stage.id,
        kind: stage.kind,
        executor: stage.executor,
        status: skippedStatus,
        summary:
          skippedStatus === "skipped"
            ? `Skipped optional stage ${stage.id}: ${gate.reason}`
            : `Required stage ${stage.id} could not start: ${gate.reason}`
      };
      stageResults.push(skippedResult);
      await auditWriter.append({
        type: "stage.completed",
        runId,
        stageId: stage.id,
        occurredAt: timestamp(input.clock),
        payload: {
          status: skippedResult.status,
          summary: skippedResult.summary
        }
      });
      if (skippedResult.status === "failed") {
        return finalizeAuditedFlow({
          runId,
          status: "failed",
          stageResults,
          artefactsDir,
          auditPath,
          auditWriter,
          payload: { failedStageId: stage.id, reason: skippedResult.summary },
          dryRun: input.dryRun ?? false
        });
      }
      continue;
    }

    const promptPath = path.join(stageDir, "prompt.md");
    const promptRelativePath = path.relative(artefactsDir, promptPath).replace(/\\/g, "/");
    const prompt = renderStagePrompt(runId, input.contract, stage);
    await writeFile(promptPath, `${prompt}\n`, "utf8");

    await auditWriter.append({
      type: "stage.started",
      runId,
      stageId: stage.id,
      occurredAt: timestamp(input.clock),
      payload: {
        kind: stage.kind,
        required: stage.required !== false
      }
    });
    await auditWriter.append({
      type: "prompt.generated",
      runId,
      stageId: stage.id,
      occurredAt: timestamp(input.clock),
      payload: {
        path: promptRelativePath
      }
    });

    const executor = input.executorRegistry.resolve(stage.executor);
    await auditWriter.append({
      type: "executor.invoked",
      runId,
      stageId: stage.id,
      executorId: executor.id,
      occurredAt: timestamp(input.clock),
      payload: {
        kind: stage.kind,
        model: stage.model,
        capabilities: executor.capabilities
      }
    });

    const stageResult = await runStageExecutor({
      runId,
      contract: input.contract,
      stage,
      stageDir,
      dryRun: input.dryRun ?? false,
      previousResults: stageResults,
      executor,
      auditWriter,
      clock: input.clock
    });
    stageResults.push(stageResult);

    await auditWriter.append({
      type: "executor.completed",
      runId,
      stageId: stage.id,
      executorId: executor.id,
      occurredAt: timestamp(input.clock),
      payload: {
        status: stageResult.status,
        summary: stageResult.summary,
        artefacts: stageResult.artefacts ?? []
      }
    });
    if ((stageResult.changedFiles?.length ?? 0) > 0) {
      await auditWriter.append({
        type: "files.changed",
        runId,
        stageId: stage.id,
        occurredAt: timestamp(input.clock),
        payload: {
          changedFiles: stageResult.changedFiles
        }
      });
    }
    await auditWriter.append({
      type: "stage.completed",
      runId,
      stageId: stage.id,
      occurredAt: timestamp(input.clock),
      payload: {
        status: stageResult.status,
        summary: stageResult.summary
      }
    });

    if (stageResult.status === "failed") {
      return finalizeAuditedFlow({
        runId,
        status: "failed",
        stageResults,
        artefactsDir,
        auditPath,
        auditWriter,
        payload: {
          failedStageId: stage.id,
          reason: stageResult.summary
        },
        dryRun: input.dryRun ?? false
      });
    }
    if (stageResult.status === "needs-approval") {
      return finalizeAuditedFlow({
        runId,
        status: "needs-approval",
        stageResults,
        artefactsDir,
        auditPath,
        auditWriter,
        payload: {
          blockingStageId: stage.id
        },
        dryRun: input.dryRun ?? false
      });
    }
  }

  return finalizeAuditedFlow({
    runId,
    status: "passed",
    stageResults,
    artefactsDir,
    auditPath,
    auditWriter,
    payload: {
      completedStages: stageResults.length
    },
    dryRun: input.dryRun ?? false
  });
}

async function finalizeAuditedFlow(input: {
  runId: string;
  status: AuditedFlowStatus;
  stageResults: StageResult[];
  artefactsDir: string;
  auditPath: string;
  auditWriter: AuditedFlowAuditWriter;
  payload: Record<string, unknown>;
  dryRun: boolean;
}): Promise<AuditedFlowResult> {
  await input.auditWriter.append({
    type: input.status === "failed" ? "run.failed" : "run.completed",
    runId: input.runId,
    occurredAt: new Date().toISOString(),
    payload: {
      status: input.status,
      ...input.payload
    }
  });

  const result: AuditedFlowResult = {
    runId: input.runId,
    status: input.status,
    stageResults: input.stageResults,
    auditPath: input.auditPath,
    artefactsDir: input.artefactsDir,
    dryRun: input.dryRun
  };
  await writeJsonFile(path.join(input.artefactsDir, "result.json"), result);
  return result;
}

async function runStageExecutor(input: {
  runId: string;
  contract: RunContract;
  stage: RunContractStage;
  stageDir: string;
  dryRun: boolean;
  previousResults: StageResult[];
  executor: ReturnType<StageExecutorRegistry["resolve"]>;
  auditWriter: AuditedFlowAuditWriter;
  clock?: () => Date;
}): Promise<StageResult> {
  try {
    const result = await input.executor.run({
      runId: input.runId,
      stage: input.stage,
      contract: input.contract,
      workspace: input.contract.workspace,
      artefactsDir: input.stageDir,
      previousResults: input.previousResults,
      dryRun: input.dryRun,
      onCommandStarted: async (command) => {
        await input.auditWriter.append({
          type: "command.started",
          runId: input.runId,
          stageId: command.stageId,
          executorId: input.executor.id,
          occurredAt: timestamp(input.clock),
          payload: {
            name: command.name,
            command: command.command,
            args: command.args,
            cwd: command.cwd
          }
        });
      },
      onCommandCompleted: async (command) => {
        await input.auditWriter.append({
          type: "command.completed",
          runId: input.runId,
          stageId: command.stageId,
          executorId: input.executor.id,
          occurredAt: timestamp(input.clock),
          payload: {
            name: command.name,
            command: command.command,
            args: command.args,
            cwd: command.cwd,
            exitCode: command.exitCode,
            signal: command.signal,
            success: command.success,
            durationMs: command.durationMs,
            stdoutPath: command.stdoutPath,
            stderrPath: command.stderrPath
          }
        });
      }
    });
    return result;
  } catch (error) {
    return {
      stageId: input.stage.id,
      kind: input.stage.kind,
      executor: input.executor.id,
      status: "failed",
      summary: error instanceof Error ? error.message : String(error)
    };
  }
}

function evaluateStageGate(stage: RunContractStage, previousResults: StageResult[]): { allowed: true } | { allowed: false; reason: string } {
  const conditions = stage.onlyIf ?? [];
  if (conditions.length === 0) {
    return { allowed: true };
  }

  for (const condition of conditions) {
    const match = /^stage:([^:]+):(passed|failed|skipped|needs-approval)$/.exec(condition);
    if (!match) {
      return { allowed: false, reason: `Unsupported onlyIf condition: ${condition}` };
    }

    const [, stageId, expectedStatus] = match;
    const previous = previousResults.find((result) => result.stageId === stageId);
    if (!previous || previous.status !== expectedStatus) {
      return {
        allowed: false,
        reason: `Condition not met: ${condition}`
      };
    }
  }

  return { allowed: true };
}

function renderStagePrompt(runId: string, contract: RunContract, stage: RunContractStage): string {
  return [
    `Run ID: ${runId}`,
    `Goal: ${contract.goal}`,
    `Workspace: ${contract.workspace}`,
    `Flow: ${contract.flow}`,
    `Stage: ${stage.id} (${stage.kind})`,
    `Executor: ${stage.executor}`,
    `Model: ${stage.model ?? "not specified"}`,
    `Dry run: deterministic stage execution`
  ].join("\n");
}

function defaultRunIdFactory(contract: RunContract, now: Date): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `audited-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${toSafePathSegment(contract.flow)}`;
}

function toSafePathSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "value";
}

function timestamp(clock?: () => Date): string {
  return (clock?.() ?? new Date()).toISOString();
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
