import path from "node:path";
import type {
  AgentExecutionOptions,
  AgentExecutionRequest,
  AgentExecutionResult,
  AgentRole,
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

export interface OpenCodeExecutionRequest {
  prompt: string;
  role: AgentRole;
  model: string;
  workspaceRoot: string;
  outputLastMessagePath: string;
  orchestratorRoot: string;
  dryRun: boolean;
  command?: string;
}

export interface OpenCodeBuiltCommand {
  command: string;
  args: string[];
  cwd: string;
  promptStdin: string;
}

export function buildOpenCodeReadOnlyCommand(request: OpenCodeExecutionRequest): OpenCodeBuiltCommand {
  validateOpenCodeReadOnlyRequest(request);

  return {
    command: request.command ?? "opencode",
    args: [
      "run",
      "--model",
      request.model,
      "--cwd",
      path.resolve(request.workspaceRoot),
      "--output",
      path.resolve(request.outputLastMessagePath),
      "-"
    ],
    cwd: path.resolve(request.orchestratorRoot),
    promptStdin: request.prompt
  };
}

function validateOpenCodeReadOnlyRequest(request: OpenCodeExecutionRequest): void {
  if (!request || typeof request !== "object") {
    throw new Error("Invalid OpenCode execution request: request object is required.");
  }
  if (!isNonEmpty(request.prompt)) {
    throw new Error("Invalid OpenCode execution request: prompt must be non-empty.");
  }
  if (!isReadOnlyRole(request.role)) {
    throw new Error("Invalid OpenCode execution request: role must be one of planner|reviewer|fix-planner|reassessor.");
  }
  if (!isNonEmpty(request.model)) {
    throw new Error("Invalid OpenCode execution request: model must be non-empty.");
  }
  if (!isNonEmpty(request.workspaceRoot)) {
    throw new Error("Invalid OpenCode execution request: workspaceRoot is required.");
  }
  if (!isNonEmpty(request.orchestratorRoot)) {
    throw new Error("Invalid OpenCode execution request: orchestratorRoot is required.");
  }
  if (!isNonEmpty(request.outputLastMessagePath)) {
    throw new Error("Invalid OpenCode execution request: outputLastMessagePath is required.");
  }
  if (!path.isAbsolute(request.outputLastMessagePath)) {
    throw new Error("Invalid OpenCode execution request: outputLastMessagePath must be an absolute path.");
  }
  if (request.command !== undefined) {
    if (!isNonEmpty(request.command)) {
      throw new Error("Invalid OpenCode execution request: command must be non-empty.");
    }
    if (request.command.includes(" ")) {
      throw new Error("Invalid OpenCode execution request: command must be an executable name only.");
    }
  }
}

function isReadOnlyRole(role: AgentRole): boolean {
  return role === "planner" || role === "reviewer" || role === "fix-planner" || role === "reassessor";
}

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toOpenCodeExecutionRequest(request: AgentExecutionRequest): OpenCodeExecutionRequest {
  return {
    prompt: request.prompt,
    role: request.role,
    model: request.model,
    workspaceRoot: request.workspaceRoot,
    outputLastMessagePath: request.outputLastMessagePath,
    orchestratorRoot: request.orchestratorRoot,
    dryRun: request.dryRun
  };
}

export class OpenCodeCliBackend implements ExecutionBackend {
  readonly type = "opencode-cli" as const;
  readonly capabilities = OPENCODE_CLI_BACKEND_CAPABILITIES;

  async execute(request: AgentExecutionRequest, _options: AgentExecutionOptions = {}): Promise<AgentExecutionResult> {
    if (!request.dryRun) {
      throw new Error('Execution backend type "opencode-cli" is recognised but execution is not implemented yet.');
    }

    const built = buildOpenCodeReadOnlyCommand(toOpenCodeExecutionRequest(request));

    return {
      backendName: request.backendName,
      backendType: request.backendType,
      model: request.model,
      command: built.command,
      args: built.args,
      cwd: built.cwd,
      stdout: "",
      stderr: "OpenCode execution skipped because dryRun=true.",
      exitCode: 0,
      signal: null,
      durationMs: 0,
      success: true,
      outputLastMessagePath: request.outputLastMessagePath,
      outputLastMessage: "",
      skipped: true
    };
  }
}
