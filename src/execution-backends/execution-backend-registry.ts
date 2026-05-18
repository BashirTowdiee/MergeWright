import type { ExecutionBackendConfigMap } from "../config.js";
import { CodexCliBackend } from "./codex-cli-backend.js";
import type { ExecutionBackend, ExecutionBackendType } from "./execution-backend-types.js";

export interface ExecutionBackendRegistry {
  get(name: string): ExecutionBackend;
  list(): ReadonlyArray<{ name: string; type: ExecutionBackendType }>;
}

export type ExecutionBackendFactory = () => ExecutionBackend;

export interface ExecutionBackendDefinition {
  type: ExecutionBackendType;
  factory?: ExecutionBackendFactory;
}

export type ExecutionBackendDefinitions = Record<string, ExecutionBackendDefinition>;

export function createExecutionBackendRegistry(
  definitions: ExecutionBackendDefinitions = defaultExecutionBackendDefinitions()
): ExecutionBackendRegistry {
  const backends = new Map<string, ExecutionBackend>();

  for (const [name, definition] of Object.entries(definitions)) {
    if (!name.trim()) {
      throw new Error("Invalid execution backend registry: backend name must be non-empty.");
    }

    const backend = createExecutionBackend(definition);
    if (backend.type !== definition.type) {
      throw new Error(
        `Invalid execution backend registry: backend "${name}" factory returned type "${backend.type}" but definition expected "${definition.type}".`
      );
    }
    backends.set(name, backend);
  }

  return {
    get(name: string): ExecutionBackend {
      const backend = backends.get(name);
      if (!backend) {
        const available = [...backends.keys()].sort().join(", ") || "none";
        throw new Error(`Unknown execution backend "${name}". Configured execution backends: ${available}.`);
      }
      return backend;
    },
    list(): ReadonlyArray<{ name: string; type: ExecutionBackendType }> {
      return [...backends.entries()]
        .map(([name, backend]) => ({ name, type: backend.type }))
        .sort((left, right) => left.name.localeCompare(right.name));
    }
  };
}

export function createExecutionBackendDefinitionsFromConfig(
  executionBackends: ExecutionBackendConfigMap
): ExecutionBackendDefinitions {
  const definitions: ExecutionBackendDefinitions = {};
  for (const [name, backend] of Object.entries(executionBackends)) {
    if (!name.trim()) {
      throw new Error("Invalid execution backend config: backend name must be non-empty.");
    }
    definitions[name] = { type: backend.type };
  }
  return definitions;
}

export function createExecutionBackendRegistryFromConfig(
  executionBackends: ExecutionBackendConfigMap
): ExecutionBackendRegistry {
  return createExecutionBackendRegistry(createExecutionBackendDefinitionsFromConfig(executionBackends));
}

export function defaultExecutionBackendDefinitions(): ExecutionBackendDefinitions {
  return {
    codex: {
      type: "codex-cli"
    }
  };
}

function createExecutionBackend(definition: ExecutionBackendDefinition): ExecutionBackend {
  if (definition.factory) {
    return definition.factory();
  }

  switch (definition.type) {
    case "codex-cli":
      return new CodexCliBackend();
    case "opencode-cli":
      throw new Error('Execution backend type "opencode-cli" is recognised in config but execution is not implemented yet.');
  }
}
