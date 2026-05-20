import type { SandboxMode } from "./execution-backends/execution-backend-types.js";

export interface AgentExecutionRequest {
  prompt: string;
  role: "planner" | "builder" | "reviewer";
  model: string;
  reasoningEffort: string;
  workspaceRoot: string;
  outputLastMessagePath: string;
  dryRun: boolean;
  requireGitRepo: boolean;
  orchestratorRoot: string;
  sandboxMode?: SandboxMode;
}

export interface AgentExecutionBackendMetadata {
  backendName: string;
  backendType: string;
  agentRole: string;
  model: string;
  reasoningEffort: string;
}

export interface AgentExecutionResult {
  command: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  success: boolean;
  outputLastMessagePath: string;
  outputLastMessage: string;
  skipped: boolean;
  backend?: AgentExecutionBackendMetadata;
}

export interface AgentExecutionOptions {
  streamOutput?: boolean;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
}

export type AgentExecutor = (
  request: AgentExecutionRequest,
  options?: AgentExecutionOptions
) => Promise<AgentExecutionResult>;

// Preferred generic executor naming.
export type AgentExecutorRequest = AgentExecutionRequest;
export type AgentExecutorResult = AgentExecutionResult;
