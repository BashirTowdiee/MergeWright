import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig, type ExecutionBackendConfig } from "../src/config.js";
import { createExecutionBackendRegistryFromConfig } from "../src/execution-backends/execution-backend-registry.js";
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
  (config.executionBackends as Record<string, unknown>)["opencode-reviewer"] = {
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
  (config.executionBackends as Record<string, unknown>)["opencode-reviewer"] = {
    type: "opencode-cli",
    command: ""
  };

  assert.throws(() => validateConfig(config), /executionBackends\.opencode-reviewer\.command must be a non-empty executable name/);
});

test("opencode-cli command rejects spaces", () => {
  const config = makeBaseConfig();
  (config.executionBackends as Record<string, unknown>)["opencode-reviewer"] = {
    type: "opencode-cli",
    command: "npx opencode"
  };

  assert.throws(() => validateConfig(config), /executionBackends\.opencode-reviewer\.command must be an executable name only/);
});

test("config validation rejects claude-code-cli", () => {
  const config = makeBaseConfig();
  (config.executionBackends as Record<string, unknown>)["claude-reviewer"] = {
    type: "claude-code-cli"
  };
  (config.agents as Record<string, unknown>).planner = {
    backend: "claude-reviewer",
    model: "claude-sonnet",
    reasoningEffort: "high"
  };

  assert.throws(() => validateConfig(config), /executionBackends\.claude-reviewer\.type must be "codex-cli" or "opencode-cli"/);
});

test("config validation rejects API backend types", () => {
  for (const backendType of ["openrouter-api", "anthropic-api", "openai-api"]) {
    const config = makeBaseConfig();
    (config.executionBackends as Record<string, unknown>)["api-backend"] = {
      type: backendType
    };

    assert.throws(() => validateConfig(config), /executionBackends\.api-backend\.type must be "codex-cli" or "opencode-cli"/);
  }
});

test("registry fails clearly if opencode-cli execution is attempted", () => {
  assert.throws(
    () =>
      createExecutionBackendRegistryFromConfig({
        "opencode-reviewer": {
          type: "opencode-cli",
          command: "opencode"
        }
      }),
    /Execution backend type "opencode-cli" is recognised in config but execution is not implemented yet\./
  );
});

test("codex-cli config still validates unchanged", () => {
  const config = makeBaseConfig();
  (config.executionBackends as Record<string, unknown>) = {
    codex: {
      type: "codex-cli"
    }
  };
  (config.agents as Record<string, unknown>) = {
    planner: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" },
    builder: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "medium" },
    reviewer: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" }
  };

  const validated = validateConfig(config);

  assert.deepEqual(validated.executionBackends, {
    codex: {
      type: "codex-cli"
    }
  });
});
