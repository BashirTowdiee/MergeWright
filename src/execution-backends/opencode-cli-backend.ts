import type {
  AgentExecutionOptions,
  AgentExecutionRequest,
  AgentExecutionResult,
  ExecutionBackend,
  ExecutionBackendCapabilities
} from "./execution-backend-types.js";

export const OPENCODE_CLI_BACKEND_CAPABILITIES: ExecutionBackendCapabilities = {
  providesHarness: true,
  supportsLocalWorkspace: true,
  supportsFileEdits: false,
  supportsShellCommands: false,
  supportsSandboxMode: false,
  supportsStreaming: false,
  supportsReasoningEffort: false,
  supportsModelSelection: true
};

export class OpenCodeCliBackend implements ExecutionBackend {
  readonly type = "opencode-cli" as const;
  readonly capabilities = OPENCODE_CLI_BACKEND_CAPABILITIES;

  async execute(_request: AgentExecutionRequest, _options: AgentExecutionOptions = {}): Promise<AgentExecutionResult> {
    throw new Error('Execution backend type "opencode-cli" is recognised but execution is not implemented yet.');
  }
}
