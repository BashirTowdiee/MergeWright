import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export interface CodexExecutionRequest {
  prompt: string;
  role: "planner" | "builder" | "reviewer";
  model: string;
  reasoningEffort: string;
  workspaceRoot: string;
  outputLastMessagePath: string;
  dryRun: boolean;
  requireGitRepo: boolean;
  orchestratorRoot: string;
  sandboxMode?: "read-only" | "workspace-write";
}

export interface CodexExecCapabilities {
  hasModelFlag: boolean;
  hasConfigFlag: boolean;
  hasCdFlag: boolean;
  hasOutputLastMessageFlag: boolean;
  hasSandboxFlag: boolean;
  hasSkipGitRepoCheckFlag: boolean;
}

export const DEFAULT_CODEX_EXEC_CAPABILITIES: CodexExecCapabilities = {
  hasModelFlag: true,
  hasConfigFlag: true,
  hasCdFlag: true,
  hasOutputLastMessageFlag: true,
  hasSandboxFlag: true,
  hasSkipGitRepoCheckFlag: true
};

export interface CodexBuiltCommand {
  command: string;
  args: string[];
  cwd: string;
  promptStdin: string;
}

export interface CodexExecutionBackendMetadata {
  backendName: string;
  backendType: string;
  agentRole: string;
  model: string;
  reasoningEffort: string;
}

export interface CodexExecutionResult {
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
  backend?: CodexExecutionBackendMetadata;
}

export interface CodexExecutionOptions {
  streamOutput?: boolean;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
}

export type CodexExecutor = (request: CodexExecutionRequest, options?: CodexExecutionOptions) => Promise<CodexExecutionResult>;

export function parseCodexExecHelp(helpText: string): CodexExecCapabilities {
  return {
    hasModelFlag: helpText.includes("--model"),
    hasConfigFlag: helpText.includes("--config"),
    hasCdFlag: helpText.includes("--cd"),
    hasOutputLastMessageFlag: helpText.includes("--output-last-message"),
    hasSandboxFlag: helpText.includes("--sandbox"),
    hasSkipGitRepoCheckFlag: helpText.includes("--skip-git-repo-check")
  };
}

export function validateCodexExecutionRequest(
  request: CodexExecutionRequest,
  capabilities: CodexExecCapabilities
): void {
  if (!request || typeof request !== "object") {
    throw new Error("Invalid Codex execution request: request object is required.");
  }
  if (!isNonEmpty(request.prompt)) {
    throw new Error("Invalid Codex execution request: prompt must be non-empty.");
  }
  if (!isValidRole(request.role)) {
    throw new Error("Invalid Codex execution request: role must be one of planner|builder|reviewer.");
  }
  if (!isNonEmpty(request.model)) {
    throw new Error("Invalid Codex execution request: model must be non-empty.");
  }
  if (!isNonEmpty(request.reasoningEffort)) {
    throw new Error("Invalid Codex execution request: reasoningEffort must be non-empty.");
  }
  if (!isNonEmpty(request.workspaceRoot)) {
    throw new Error("Invalid Codex execution request: workspaceRoot is required.");
  }
  if (!isNonEmpty(request.orchestratorRoot)) {
    throw new Error("Invalid Codex execution request: orchestratorRoot is required.");
  }
  if (!isNonEmpty(request.outputLastMessagePath)) {
    throw new Error("Invalid Codex execution request: outputLastMessagePath is required.");
  }
  if (!path.isAbsolute(request.outputLastMessagePath)) {
    throw new Error("Invalid Codex execution request: outputLastMessagePath must be an absolute path.");
  }
  if (request.sandboxMode !== undefined && request.sandboxMode !== "read-only" && request.sandboxMode !== "workspace-write") {
    throw new Error("Invalid Codex execution request: sandboxMode must be read-only or workspace-write.");
  }

  assertRequiredCapabilities(capabilities);
}

export function buildCodexExecArgs(request: CodexExecutionRequest, capabilities: CodexExecCapabilities): CodexBuiltCommand {
  validateCodexExecutionRequest(request, capabilities);

  const outputLastMessagePath = path.resolve(request.outputLastMessagePath);
  const workspaceRoot = path.resolve(request.workspaceRoot);

  const sandboxMode = request.sandboxMode ?? "read-only";
  const args = [
    "exec",
    "-m",
    request.model,
    "-c",
    `model_reasoning_effort=\"${request.reasoningEffort}\"`,
    "-C",
    workspaceRoot,
    "-o",
    outputLastMessagePath,
    "-s",
    sandboxMode
  ];

  if (!request.requireGitRepo && capabilities.hasSkipGitRepoCheckFlag) {
    args.push("--skip-git-repo-check");
  }

  args.push("-");

  return {
    command: "codex",
    args,
    cwd: path.resolve(request.orchestratorRoot),
    promptStdin: request.prompt
  };
}

export async function executeCodex(
  request: CodexExecutionRequest,
  capabilities: CodexExecCapabilities = DEFAULT_CODEX_EXEC_CAPABILITIES,
  options: CodexExecutionOptions = {}
): Promise<CodexExecutionResult> {
  const built = buildCodexExecArgs(request, capabilities);

  if (request.dryRun) {
    return {
      command: built.command,
      args: built.args,
      cwd: built.cwd,
      stdout: "",
      stderr: "Codex execution skipped because dryRun=true.",
      exitCode: 0,
      signal: null,
      durationMs: 0,
      success: true,
      outputLastMessagePath: path.resolve(request.outputLastMessagePath),
      outputLastMessage: "",
      skipped: true
    };
  }

  const startedAt = Date.now();

  const child = spawn(built.command, built.args, {
    cwd: built.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false
  });

  let stdout = "";
  let stderr = "";
  let streamCallbackError: Error | undefined;
  let killRequested = false;
  const emitStdout =
    options.onStdoutChunk ??
    (options.streamOutput
      ? (chunk: string) => {
          process.stdout.write(chunk);
        }
      : undefined);
  const emitStderr =
    options.onStderrChunk ??
    (options.streamOutput
      ? (chunk: string) => {
          process.stderr.write(chunk);
        }
      : undefined);
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  const requestKill = (): void => {
    if (killRequested || child.killed) {
      return;
    }
    killRequested = true;
    try {
      child.kill("SIGTERM");
    } catch {
      // swallow kill race errors and rely on close event
    }
  };
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    if (streamCallbackError) {
      return;
    }
    try {
      emitStdout?.(chunk);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      streamCallbackError = new Error(`Codex stream callback failed during stdout streaming: ${message}`);
      stderr += `${stderr.endsWith("\n") || stderr.length === 0 ? "" : "\n"}${streamCallbackError.message}\n`;
      requestKill();
    }
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
    if (streamCallbackError) {
      return;
    }
    try {
      emitStderr?.(chunk);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      streamCallbackError = new Error(`Codex stream callback failed during stderr streaming: ${message}`);
      stderr += `${stderr.endsWith("\n") || stderr.length === 0 ? "" : "\n"}${streamCallbackError.message}\n`;
      requestKill();
    }
  });

  child.stdin.write(built.promptStdin);
  child.stdin.end();

  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal }));
  });

  const durationMs = Date.now() - startedAt;
  let outputLastMessage = "";
  if (!streamCallbackError) {
    try {
      outputLastMessage = await readFile(path.resolve(request.outputLastMessagePath), "utf8");
    } catch {
      throw new Error(`Codex execution completed but output-last-message file was not readable: ${request.outputLastMessagePath}`);
    }
  } else {
    try {
      outputLastMessage = await readFile(path.resolve(request.outputLastMessagePath), "utf8");
    } catch {
      outputLastMessage = "";
    }
  }

  return {
    command: built.command,
    args: built.args,
    cwd: built.cwd,
    stdout,
    stderr,
    exitCode: exit.code,
    signal: exit.signal,
    durationMs,
    success: exit.code === 0 && !streamCallbackError,
    outputLastMessagePath: path.resolve(request.outputLastMessagePath),
    outputLastMessage,
    skipped: false
  };
}

function assertRequiredCapabilities(capabilities: CodexExecCapabilities): void {
  if (!capabilities.hasSandboxFlag) {
    throw new Error("Codex exec capability missing: sandbox flag (--sandbox/-s) is required for Stage C safety.");
  }
  if (!capabilities.hasOutputLastMessageFlag) {
    throw new Error(
      "Codex exec capability missing: output-last-message flag (--output-last-message/-o) is required for Stage C safety."
    );
  }
  if (!capabilities.hasCdFlag) {
    throw new Error("Codex exec capability missing: working directory flag (--cd/-C) is required for Stage C safety.");
  }
  if (!capabilities.hasModelFlag) {
    throw new Error("Codex exec capability missing: model flag (--model/-m) is required for Stage C safety.");
  }
  if (!capabilities.hasConfigFlag) {
    throw new Error("Codex exec capability missing: config override flag (--config/-c) is required for Stage C safety.");
  }
}

function isNonEmpty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidRole(value: unknown): value is CodexExecutionRequest["role"] {
  return value === "planner" || value === "builder" || value === "reviewer";
}
