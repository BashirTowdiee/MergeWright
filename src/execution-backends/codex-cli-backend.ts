import type { ExecutionBackend, ExecutionBackendCapabilities } from "./execution-backend-types.js";

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

export class CodexCliBackend implements Pick<ExecutionBackend, "type" | "capabilities"> {
  readonly type = "codex-cli" as const;
  readonly capabilities = CODEX_CLI_BACKEND_CAPABILITIES;
}
