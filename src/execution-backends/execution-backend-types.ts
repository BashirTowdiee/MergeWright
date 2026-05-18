export type AgentRole =
  | "planner"
  | "builder"
  | "reviewer"
  | "fix-planner"
  | "fixer"
  | "reassessor";

export type SandboxMode = "read-only" | "workspace-write";

export type ExecutionBackendType = "codex-cli" | "opencode-cli";

export interface AgentExecutionRequest {
  prompt: string;
  role: AgentRole;
  backendName: string;
  backendType: ExecutionBackendType;
  model: string;
  reasoningEffort?: string;
  workspaceRoot: string;
  outputLastMessagePath: string;
  dryRun: boolean;
  requireGitRepo: boolean;
  orchestratorRoot: string;
  sandboxMode?: SandboxMode;
}

export interface AgentExecutionResult {
  backendName: string;
  backendType: ExecutionBackendType;
  model: string;
  command?: string;
  args?: string[];
  cwd?: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  success: boolean;
  outputLastMessagePath: string;
  outputLastMessage: string;
  skipped: boolean;
}

export interface AgentExecutionOptions {
  streamOutput?: boolean;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
}

export interface ExecutionBackendCapabilities {
  providesHarness: true;
  supportsLocalWorkspace: boolean;
  supportsFileEdits: boolean;
  supportsShellCommands: boolean;
  supportsSandboxMode: boolean;
  supportsStreaming: boolean;
  supportsReasoningEffort: boolean;
  supportsModelSelection: boolean;
}

export interface ExecutionBackend {
  readonly type: ExecutionBackendType;
  readonly capabilities: ExecutionBackendCapabilities;

  execute(request: AgentExecutionRequest, options?: AgentExecutionOptions): Promise<AgentExecutionResult>;
}
