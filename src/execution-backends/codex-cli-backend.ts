import { DEFAULT_CODEX_EXEC_CAPABILITIES, executeCodex } from "../codex.js";
import type { CodexExecCapabilities, CodexExecutionOptions, CodexExecutionRequest } from "../codex.js";
import type {
  AgentExecutionOptions,
  AgentExecutionRequest,
  AgentExecutionResult,
  ExecutionBackend,
  ExecutionBackendCapabilities
} from "./execution-backend-types.js";

export const CODEX_CLI_BACKEND_CAPABILITIES: ExecutionBackendCapabilities = {
  providesHarness: true,
  supportsLocalWorkspace: true,
  supportsFileEdits: true,
  supportsShellCommands: true,
  supportsSandboxMode: true,
  supportsStreaming: true,
  supportsReasoningEffort: true,
  supportsModelSelection: true
};

export class CodexCliBackend implements ExecutionBackend {
  readonly type = "codex-cli" as const;
  readonly capabilities = CODEX_CLI_BACKEND_CAPABILITIES;

  constructor(private readonly codexCapabilities: CodexExecCapabilities = DEFAULT_CODEX_EXEC_CAPABILITIES) {}

  async execute(request: AgentExecutionRequest, options: AgentExecutionOptions = {}): Promise<AgentExecutionResult> {
    const result = await executeCodex(
      toCodexExecutionRequest(request),
      this.codexCapabilities,
      toCodexExecutionOptions(options)
    );

    return {
      backendName: request.backendName,
      backendType: request.backendType,
      model: request.model,
      command: result.command,
      args: result.args,
      cwd: result.cwd,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      signal: result.signal,
      durationMs: result.durationMs,
      success: result.success,
      outputLastMessagePath: result.outputLastMessagePath,
      outputLastMessage: result.outputLastMessage,
      skipped: result.skipped
    };
  }
}

function toCodexExecutionRequest(request: AgentExecutionRequest): CodexExecutionRequest {
  if (request.role !== "planner" && request.role !== "builder" && request.role !== "reviewer") {
    throw new Error("Invalid Codex execution request: role must be one of planner|builder|reviewer.");
  }

  return {
    prompt: request.prompt,
    role: request.role,
    model: request.model,
    reasoningEffort: request.reasoningEffort ?? "",
    workspaceRoot: request.workspaceRoot,
    outputLastMessagePath: request.outputLastMessagePath,
    dryRun: request.dryRun,
    requireGitRepo: request.requireGitRepo,
    orchestratorRoot: request.orchestratorRoot,
    sandboxMode: request.sandboxMode
  };
}

function toCodexExecutionOptions(options: AgentExecutionOptions): CodexExecutionOptions {
  return {
    streamOutput: options.streamOutput,
    onStdoutChunk: options.onStdoutChunk,
    onStderrChunk: options.onStderrChunk
  };
}
