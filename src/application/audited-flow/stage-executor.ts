import type { AuditedFlowStageKind, RunContract, RunContractStage } from "./contract.js";

export type StageResultStatus = "passed" | "failed" | "skipped" | "needs-approval";

export interface StageArtefact {
  kind: string;
  path: string;
}

export interface StageInput {
  runId: string;
  stage: RunContractStage;
  contract: RunContract;
  workspace: string;
  artefactsDir: string;
  previousResults: StageResult[];
  dryRun?: boolean;
  onCommandStarted?: (command: {
    stageId: string;
    name: string;
    command: string;
    args: string[];
    cwd: string;
  }) => Promise<void> | void;
  onCommandCompleted?: (command: {
    stageId: string;
    name: string;
    command: string;
    args: string[];
    cwd: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    success: boolean;
    durationMs: number;
    stdoutPath?: string;
    stderrPath?: string;
  }) => Promise<void> | void;
}

export interface StageResult {
  stageId: string;
  kind: AuditedFlowStageKind;
  executor: string;
  status: StageResultStatus;
  summary: string;
  artefacts?: StageArtefact[];
  changedFiles?: string[];
  metadata?: Record<string, unknown>;
}

export interface StageExecutor {
  id: string;
  capabilities: {
    stageKinds: AuditedFlowStageKind[];
    writesWorkspace: boolean;
    streamsOutput?: boolean;
  };
  run(input: StageInput): Promise<StageResult>;
}
