import type { OrchestratorConfig } from "../config.js";
import type { AgentExecutionResult as BackendExecutionResult, AgentRole } from "./execution-backend-types.js";
import { validateBackendCapabilitiesForRoleExecution } from "./execution-backend-capabilities.js";
import { createExecutionBackendRegistryFromConfig, type ExecutionBackendRegistry } from "./execution-backend-registry.js";
import type { AgentExecutionResult, AgentExecutor } from "../agent-executor.js";

export interface AgentExecutorOptions {
  overrideAgentExecutor?: AgentExecutor;
  registry?: ExecutionBackendRegistry;
}

export function createAgentExecutor(
  config: OrchestratorConfig,
  options: AgentExecutorOptions = {}
): AgentExecutor {
  if (options.overrideAgentExecutor) {
    return options.overrideAgentExecutor;
  }

  const registry = options.registry ?? createExecutionBackendRegistryFromConfig(config.executionBackends);

  return async (request, executionOptions) => {
    const agentConfig = config.agents[request.role];
    const backendConfig = config.executionBackends[agentConfig.backend];
    if (!backendConfig) {
      const configured = Object.keys(config.executionBackends).sort().join(", ") || "none";
      throw new Error(
        `Invalid execution backend config: agent "${request.role}" references unknown execution backend "${agentConfig.backend}". Configured execution backends: ${configured}.`
      );
    }

    const backend = registry.get(agentConfig.backend);
    validateBackendCapabilitiesForRoleExecution({
      backendName: agentConfig.backend,
      backend,
      role: request.role satisfies AgentRole,
      dryRun: request.dryRun
    });

    const result = await backend.execute(
      {
        prompt: request.prompt,
        role: request.role satisfies AgentRole,
        backendName: agentConfig.backend,
        backendType: backendConfig.type,
        model: agentConfig.model,
        reasoningEffort: agentConfig.reasoningEffort,
        workspaceRoot: request.workspaceRoot,
        outputLastMessagePath: request.outputLastMessagePath,
        dryRun: request.dryRun,
        requireGitRepo: request.requireGitRepo,
        orchestratorRoot: request.orchestratorRoot,
        sandboxMode: request.sandboxMode
      },
      executionOptions
    );

    return toAgentExecutionResult(result, {
      backendName: agentConfig.backend,
      backendType: backendConfig.type,
      agentRole: request.role,
      model: agentConfig.model,
      reasoningEffort: agentConfig.reasoningEffort
    });
  };
}

function toAgentExecutionResult(
  result: BackendExecutionResult,
  backend: NonNullable<AgentExecutionResult["backend"]>
): AgentExecutionResult {
  return {
    command: result.command ?? "",
    args: result.args ?? [],
    cwd: result.cwd ?? "",
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    signal: result.signal,
    durationMs: result.durationMs,
    success: result.success,
    outputLastMessagePath: result.outputLastMessagePath,
    outputLastMessage: result.outputLastMessage,
    skipped: result.skipped,
    backend
  };
}
