import { assertObject, assertString } from "../validation.js";
import type { ExecutionBackendType } from "../execution-backends/execution-backend-types.js";
import type { ExecutionBackendConfig, ExecutionBackendConfigMap } from "./types.js";

export function parseExecutionBackends(
  value: unknown
): ExecutionBackendConfigMap {
  if (value == null) {
    throw new Error("Invalid config: executionBackends is required");
  }

  const raw = assertObject(value, "executionBackends");
  const entries = Object.entries(raw);
  if (entries.length === 0) {
    throw new Error("Invalid config: executionBackends must contain at least one backend");
  }

  const parsed: ExecutionBackendConfigMap = {};
  for (const [name, definition] of entries) {
    if (!name.trim()) {
      throw new Error("Invalid config: executionBackends backend name must be non-empty");
    }
    const backend = assertObject(definition, `executionBackends.${name}`);
    const type = assertExecutionBackendType(backend.type, `executionBackends.${name}.type`);
    parsed[name] = parseExecutionBackendDefinition(type, backend, `executionBackends.${name}`);
  }
  return parsed;
}

function assertExecutionBackendType(value: unknown, field: string): ExecutionBackendType {
  const type = assertString(value, field);
  if (type !== "codex-cli" && type !== "opencode-cli") {
    throw new Error(`Invalid config: ${field} must be "codex-cli" or "opencode-cli"`);
  }
  return type;
}

function parseExecutionBackendDefinition(
  type: ExecutionBackendType,
  raw: Record<string, unknown>,
  field: string
): ExecutionBackendConfig {
  switch (type) {
    case "codex-cli":
      return { type };
    case "opencode-cli": {
      if (raw.command == null) {
        return { type };
      }
      const command = assertString(raw.command, `${field}.command`);
      if (!command.trim()) {
        throw new Error(`Invalid config: ${field}.command must be a non-empty executable name`);
      }
      if (command.includes(" ")) {
        throw new Error(`Invalid config: ${field}.command must be an executable name only`);
      }
      return { type, command };
    }
  }
}
