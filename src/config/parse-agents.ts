import { assertObject, assertString } from "../validation.js";
import { codexFromAgents, parseCodexConfig } from "./parse-codex-config.js";
import type { AgentConfigMap, AgentRoleConfig, ExecutionBackendConfigMap } from "./types.js";

export function parseAgents(
  value: unknown,
  codexRaw: Record<string, unknown> | undefined,
  executionBackends: ExecutionBackendConfigMap
): AgentConfigMap {
  if (value == null) {
    if (codexRaw == null) {
      throw new Error("Invalid config: agents is required when codex is not provided");
    }
    const codex = parseCodexConfig(codexRaw);
    return {
      planner: { backend: "codex", ...codex.planner },
      builder: { backend: "codex", ...codex.builder },
      reviewer: { backend: "codex", ...codex.reviewer }
    };
  }

  const raw = assertObject(value, "agents");
  return {
    planner: parseAgentRole(raw.planner, "agents.planner", executionBackends),
    builder: parseAgentRole(raw.builder, "agents.builder", executionBackends),
    reviewer: parseAgentRole(raw.reviewer, "agents.reviewer", executionBackends)
  };
}

function parseAgentRole(value: unknown, field: string, executionBackends: ExecutionBackendConfigMap): AgentRoleConfig {
  const raw = assertObject(value, field);
  const backend = assertString(raw.backend, `${field}.backend`);
  if (!executionBackends[backend]) {
    const configured = Object.keys(executionBackends).sort().join(", ") || "none";
    throw new Error(
      `Invalid config: ${field}.backend references unknown execution backend "${backend}". Configured execution backends: ${configured}`
    );
  }
  return {
    backend,
    model: assertString(raw.model, `${field}.model`),
    reasoningEffort: assertString(raw.reasoningEffort, `${field}.reasoningEffort`)
  };
}

export { codexFromAgents };
