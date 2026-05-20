import type { ChangeReportPolicy } from "../change-report.js";

export interface CodexRoleConfig {
  model: string;
  reasoningEffort: string;
}

export interface CodexCliBackendConfig {
  type: "codex-cli";
}

export interface OpenCodeCliBackendConfig {
  type: "opencode-cli";
  command?: string;
}

export type ExecutionBackendConfig = CodexCliBackendConfig | OpenCodeCliBackendConfig;

export type ExecutionBackendConfigMap = Record<string, ExecutionBackendConfig>;

export interface AgentRoleConfig {
  backend: string;
  model: string;
  reasoningEffort: string;
}

export interface AgentConfigMap {
  planner: AgentRoleConfig;
  builder: AgentRoleConfig;
  reviewer: AgentRoleConfig;
}

export type ConfiguredCheckCommandCwd = "workspace" | "orchestrator";

export interface ConfiguredCheckCommand {
  name: string;
  command: string;
  args: string[];
  cwd: ConfiguredCheckCommandCwd;
}

export interface OrchestratorConfig {
  version: number;
  projectName: string;
  workspaceRoot: string;
  paths: {
    stagesDir: string;
    promptsDir: string;
    runsDir: string;
  };
  codex: {
    planner: CodexRoleConfig;
    builder: CodexRoleConfig;
    reviewer: CodexRoleConfig;
  };
  executionBackends: ExecutionBackendConfigMap;
  agents: AgentConfigMap;
  pipeline: {
    finalReview: boolean;
    maxFixLoops: number;
  };
  commands: {
    checks: ConfiguredCheckCommand[];
  };
  safety: {
    requireGitRepo: boolean;
    requireCleanStart: boolean;
    manualCommit: true;
    forbidAutoCommit: true;
    forbidAutoPush: true;
  };
  writeSafety: {
    enabled: boolean;
    allowedBranches: string[];
    blockedPaths: string[];
    requireCleanWorkingTree: boolean;
    requireExplicitAllowWrites: boolean;
    captureDiffBeforeAfter: boolean;
    requireReviewAfterWrites: boolean;
    autoCommit: false;
    autoPush: false;
  };
  changeReport?: ChangeReportPolicy;
}
