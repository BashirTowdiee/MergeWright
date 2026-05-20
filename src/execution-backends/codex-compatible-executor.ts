import type { CodexExecutor } from "../codex.js";
import { createAgentExecutor, type AgentExecutorOptions } from "./agent-executor.js";

export type CodexCompatibleExecutorOptions = AgentExecutorOptions & {
  overrideCodexExecutor?: CodexExecutor;
};

export function createCodexCompatibleExecutor(
  config: Parameters<typeof createAgentExecutor>[0],
  options: CodexCompatibleExecutorOptions = {}
): ReturnType<typeof createAgentExecutor> {
  return createAgentExecutor(config, {
    ...options,
    overrideAgentExecutor: options.overrideCodexExecutor ?? options.overrideAgentExecutor
  });
}
