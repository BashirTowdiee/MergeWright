import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig, type ExecutionBackendConfig } from "../src/config.js";
import { createExecutionBackendRegistryFromConfig } from "../src/execution-backends/execution-backend-registry.js";
import { OpenCodeCliBackend } from "../src/execution-backends/opencode-cli-backend.js";
import type { ExecutionBackendType } from "../src/execution-backends/execution-backend-types.js";

function makeBaseConfig(): Record<string, unknown> {
  return {
    version: 1,
    projectName: "acme",
    workspaceRoot: "/tmp/workspace",
    paths: {
      stagesDir: "stages/acme",
      promptsDir: "prompts",
      runsDir: "runs/acme"
    },
    executionBackends: {
      "opencode-reviewer": {
        type: "opencode-cli",
        command: "opencode"
      }
    },
    agents: {
      planner: { backend: "opencode-reviewer", model: "anthropic/claude-sonnet-4.5", reasoningEffort: "high" },
      builder: { backend: "opencode-reviewer", model: "anthropic/claude-sonnet-4.5", reasoningEffort: "high" },
      reviewer: { backend: "opencode-reviewer", model: "anthropic/claude-sonnet-4.5", reasoningEffort: "high" }
    },
    pipeline: { finalReview: true, maxFixLoops: 1 },
    commands: { checks: [] },
    safety: {
      requireGitRepo: true,
      requireCleanStart: true,
      manualCommit: true,
      forbidAutoCommit: true,
      forbidAutoPush: true
    }
  };
}

function executionBackends(config: Record<string, unknown>): Record<string, unknown> {
  return config.executionBackends as Record<string, unknown>;
}

function agents(config: Record<string, unknown>): Record<string, unknown> {
  return config.agents as Record<string, unknown>;
}

test("ExecutionBackendType accepts opencode-cli", () => {
  const type: ExecutionBackendType = "opencode-cli";
  assert.equal(type, "opencode-cli");
});

test("ExecutionBackendConfig accepts opencode-cli command config", () => {
  const config: ExecutionBackendConfig = {
    type: "opencode-cli",
    command: "opencode"
  };

  assert.deepEqual(config, { type: "opencode-cli", command: "opencode" });
});

test("config validation accepts opencode-cli backend references", () => {
  const validated = validateConfig(makeBaseConfig());

  assert.deepEqual(validated.executionBackends, {
    "opencode-reviewer": {
      type: "opencode-cli",
      command: "opencode"
    }
  });
  assert.deepEqual(validated.agents, {
    planner: { backend: "opencode-reviewer", model: "anthropic/claude-sonnet-4.5", reasoningEffort: "high" },
    builder: { backend: "opencode-reviewer", model: "anthropic/claude-sonnet-4.5", reasoningEffort: "high" },
    reviewer: { backend: "opencode-reviewer", model: "anthropic/claude-sonnet-4.5", reasoningEffort: "high" }
  });
});

test("opencode-cli command is optional", () => {
  const config = makeBaseConfig();
  executionBackends(config)["opencode-reviewer"] = {
    type: "opencode-cli"
  };

  const validated = validateConfig(config);

  assert.deepEqual(validated.executionBackends, {
    "opencode-reviewer": {
      type: "opencode-cli"
    }
  });
});

test("opencode-cli command rejects empty string", () => {
  const config = makeBaseConfig();
  executionBackends(config)["opencode-reviewer"] = {
    type: "opencode-cli",
    command: ""
  };

  assert.throws(() => validateConfig(config), /executionBackends\.opencode-reviewer\.command must be a non-empty string/);
});

test("opencode-cli command rejects spaces", () => {
  const config = makeBaseConfig();
  executionBackends(config)["opencode-reviewer"] = {
    type: "opencode-cli",
    command: "npx opencode"
  };

  assert.throws(() => validateConfig(config), /executionBackends\.opencode-reviewer\.command must be an executable name only/);
});

test("config validation rejects claude-code-cli", () => {
  const config = makeBaseConfig();
  executionBackends(config)["claude-reviewer"] = {
    type: "claude-code-cli"
  };
  agents(config).planner = {
    backend: "claude-reviewer",
    model: "claude-sonnet",
    reasoningEffort: "high"
  };

  assert.throws(() => validateConfig(config), /executionBackends\.claude-reviewer\.type must be "codex-cli" or "opencode-cli"/);
});

test("config validation rejects API backend types", () => {
  for (const backendType of ["openrouter-api", "anthropic-api", "openai-api"]) {
    const config = makeBaseConfig();
    executionBackends(config)["api-backend"] = {
      type: backendType
    };

    assert.throws(() => validateConfig(config), /executionBackends\.api-backend\.type must be "codex-cli" or "opencode-cli"/);
  }
});

test("registry can instantiate opencode-cli skeleton", () => {
  const registry = createExecutionBackendRegistryFromConfig({
    "opencode-reviewer": {
      type: "opencode-cli",
      command: "opencode"
    }
  });

  assert.deepEqual(registry.list(), [{ name: "opencode-reviewer", type: "opencode-cli" }]);
  assert.ok(registry.get("opencode-reviewer") instanceof OpenCodeCliBackend);
});

test("codex-cli config still validates unchanged", () => {
  const config = makeBaseConfig();
  config.executionBackends = {
    codex: {
      type: "codex-cli"
    }
  };
  config.agents = {
    planner: { backend: "codex", model: "gpt-5.5", reasoningEffort: "high" },
    builder: { backend: "codex", model: "gpt-5.5", reasoningEffort: "medium" },
    reviewer: { backend: "codex", model: "gpt-5.5", reasoningEffort: "high" }
  };

  const validated = validateConfig(config);

  assert.deepEqual(validated.executionBackends, {
    codex: {
      type: "codex-cli"
    }
  });
});
