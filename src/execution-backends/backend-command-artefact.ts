import type { AgentExecutionBackendMetadata } from "../agent-executor.js";

export interface BackendCommandArtefactInput {
  command: string;
  args: string[];
  cwd: string;
  outputLastMessagePath: string;
  promptViaStdin: boolean;
  sandboxMode?: "read-only" | "workspace-write";
  backend?: AgentExecutionBackendMetadata;
}

export interface BackendCommandArtefact {
  command: string;
  args: string[];
  cwd: string;
  outputLastMessagePath: string;
  promptViaStdin: boolean;
  sandboxMode?: "read-only" | "workspace-write";
  backend?: AgentExecutionBackendMetadata;
}

export function buildBackendCommandArtefact(input: BackendCommandArtefactInput): BackendCommandArtefact {
  return {
    command: input.command,
    args: input.args,
    cwd: input.cwd,
    outputLastMessagePath: input.outputLastMessagePath,
    promptViaStdin: input.promptViaStdin,
    ...(input.sandboxMode ? { sandboxMode: input.sandboxMode } : {}),
    ...(input.backend ? { backend: input.backend } : {})
  };
}

export function serialiseBackendCommandArtefact(input: BackendCommandArtefactInput): string {
  return JSON.stringify(buildBackendCommandArtefact(input), null, 2);
}
