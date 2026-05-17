import test from "node:test";
import assert from "node:assert/strict";
import {
  createExecutionBackendDefinitionsFromConfig,
  createExecutionBackendRegistry,
  createExecutionBackendRegistryFromConfig,
  defaultExecutionBackendDefinitions,
  type ExecutionBackendDefinitions
} from "../src/execution-backends/execution-backend-registry.js";
import { CodexCliBackend } from "../src/execution-backends/codex-cli-backend.js";
import type { ExecutionBackend } from "../src/execution-backends/execution-backend-types.js";

test("default registry exposes the codex backend", () => {
  const registry = createExecutionBackendRegistry();
  const backend = registry.get("codex");

  assert.ok(backend instanceof CodexCliBackend);
  assert.equal(backend.type, "codex-cli");
  assert.deepEqual(registry.list(), [{ name: "codex", type: "codex-cli" }]);
});

test("default execution backend definitions stay codex-only", () => {
  assert.deepEqual(defaultExecutionBackendDefinitions(), {
    codex: {
      type: "codex-cli"
    }
  });
});

test("registry supports injected backend factories", () => {
  const backend: ExecutionBackend = new CodexCliBackend();
  const definitions: ExecutionBackendDefinitions = {
    "codex-local": {
      type: "codex-cli",
      factory: () => backend
    }
  };
  const registry = createExecutionBackendRegistry(definitions);

  assert.equal(registry.get("codex-local"), backend);
  assert.deepEqual(registry.list(), [{ name: "codex-local", type: "codex-cli" }]);
});

test("registry rejects empty backend names", () => {
  assert.throws(
    () =>
      createExecutionBackendRegistry({
        " ": {
          type: "codex-cli"
        }
      }),
    /backend name must be non-empty/
  );
});

test("registry rejects unknown backend lookup with configured names", () => {
  const registry = createExecutionBackendRegistry({
    "codex-local": {
      type: "codex-cli"
    }
  });

  assert.throws(() => registry.get("missing"), /Unknown execution backend "missing"\. Configured execution backends: codex-local\./);
});

test("registry rejects backend factory type mismatch", () => {
  const wrongTypeBackend = {
    ...new CodexCliBackend(),
    type: "wrong-type"
  } as unknown as ExecutionBackend;

  assert.throws(
    () =>
      createExecutionBackendRegistry({
        codex: {
          type: "codex-cli",
          factory: () => wrongTypeBackend
        }
      }),
    /factory returned type "wrong-type" but definition expected "codex-cli"/
  );
});

test("creates backend definitions from validated config", () => {
  const definitions = createExecutionBackendDefinitionsFromConfig({
    "codex-local": {
      type: "codex-cli"
    }
  });

  assert.deepEqual(definitions, {
    "codex-local": {
      type: "codex-cli"
    }
  });
});

test("creates backend registry from validated config", () => {
  const registry = createExecutionBackendRegistryFromConfig({
    "codex-local": {
      type: "codex-cli"
    }
  });

  assert.deepEqual(registry.list(), [{ name: "codex-local", type: "codex-cli" }]);
  assert.ok(registry.get("codex-local") instanceof CodexCliBackend);
});

test("config-backed registry rejects empty backend names defensively", () => {
  assert.throws(
    () =>
      createExecutionBackendDefinitionsFromConfig({
        " ": {
          type: "codex-cli"
        }
      }),
    /backend name must be non-empty/
  );
});
