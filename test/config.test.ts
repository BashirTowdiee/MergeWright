import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadAndValidateConfig,
  resolveConfigPath,
  validateConfig,
  validateWorkspaceSafety
} from "../src/config.js";
import type {
  AgentConfigMap,
  AgentRoleConfig,
  CodexCliBackendConfig,
  ConfiguredCheckCommand,
  ConfiguredCheckCommandCwd,
  ExecutionBackendConfig,
  ExecutionBackendConfigMap,
  OpenCodeCliBackendConfig,
  OrchestratorConfig
} from "../src/config.js";
import { DEFAULT_CHANGE_REPORT_POLICY } from "../src/change-report.js";

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
      codex: { type: "codex-cli" }
    },
    agents: {
      planner: { backend: "codex", model: "gpt-5.5", reasoningEffort: "high" },
      builder: { backend: "codex", model: "gpt-5.5", reasoningEffort: "medium" },
      reviewer: { backend: "codex", model: "gpt-5.5", reasoningEffort: "high" }
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

test("valid empty commands.checks passes", () => {
  const config = validateConfig(makeBaseConfig());
  assert.deepEqual(config.commands.checks, []);
});

test("valid config with executionBackends and agents passes", () => {
  const config = validateConfig(makeBaseConfig());
  assert.equal(config.executionBackends.codex?.type, "codex-cli");
  assert.equal(config.agents.planner.backend, "codex");
});

test("execution backend and agents config passes", () => {
  const config = makeBaseConfig();
  (config as { executionBackends?: unknown }).executionBackends = {
    "codex-local": {
      type: "codex-cli"
    }
  };
  (config as { agents?: unknown }).agents = {
    planner: { backend: "codex-local", model: "gpt-5.5-codex", reasoningEffort: "high" },
    builder: { backend: "codex-local", model: "gpt-5.5-codex", reasoningEffort: "medium" },
    reviewer: { backend: "codex-local", model: "gpt-5.5-codex", reasoningEffort: "high" }
  };

  const validated = validateConfig(config);

  assert.deepEqual(validated.executionBackends, {
    "codex-local": {
      type: "codex-cli"
    }
  });
  assert.deepEqual(validated.agents, {
    planner: { backend: "codex-local", model: "gpt-5.5-codex", reasoningEffort: "high" },
    builder: { backend: "codex-local", model: "gpt-5.5-codex", reasoningEffort: "medium" },
    reviewer: { backend: "codex-local", model: "gpt-5.5-codex", reasoningEffort: "high" }
  });
});

test("new agents config rejects unknown execution backend reference", () => {
  const config = makeBaseConfig();
  (config as { executionBackends?: unknown }).executionBackends = {
    codex: {
      type: "codex-cli"
    }
  };
  (config as { agents?: unknown }).agents = {
    planner: { backend: "missing", model: "gpt-5.5-codex", reasoningEffort: "high" },
    builder: { backend: "codex", model: "gpt-5.5-codex", reasoningEffort: "medium" },
    reviewer: { backend: "codex", model: "gpt-5.5-codex", reasoningEffort: "high" }
  };

  assert.throws(
    () => validateConfig(config),
    /agents\.planner\.backend references unknown execution backend "missing"\. Configured execution backends: codex/
  );
});

test("new execution backend config rejects unsupported backend type", () => {
  const config = makeBaseConfig();
  (config as { executionBackends?: unknown }).executionBackends = {
    claude: {
      type: "claude-code-cli"
    }
  };
  (config as { agents?: unknown }).agents = {
    planner: { backend: "claude", model: "x", reasoningEffort: "high" },
    builder: { backend: "claude", model: "x", reasoningEffort: "medium" },
    reviewer: { backend: "claude", model: "x", reasoningEffort: "high" }
  };

  assert.throws(() => validateConfig(config), /executionBackends\.claude\.type must be "codex-cli" or "opencode-cli"/);
});

test("config requires executionBackends", () => {
  const config = makeBaseConfig();
  delete (config as { executionBackends?: unknown }).executionBackends;
  (config as { agents?: unknown }).agents = {
    planner: { backend: "codex", model: "gpt-5.5-codex", reasoningEffort: "high" },
    builder: { backend: "codex", model: "gpt-5.5-codex", reasoningEffort: "medium" },
    reviewer: { backend: "codex", model: "gpt-5.5-codex", reasoningEffort: "high" }
  };

  assert.throws(() => validateConfig(config), /executionBackends is required/);
});

test("config requires agents", () => {
  const config = makeBaseConfig();
  delete (config as { agents?: unknown }).agents;
  (config as { executionBackends?: unknown }).executionBackends = {
    codex: {
      type: "codex-cli"
    }
  };

  assert.throws(() => validateConfig(config), /agents is required/);
});

test("legacy top-level codex config is rejected", () => {
  const config = makeBaseConfig();
  (config as { codex?: unknown }).codex = {
    planner: { model: "x", reasoningEffort: "high" },
    builder: { model: "x", reasoningEffort: "medium" },
    reviewer: { model: "x", reasoningEffort: "high" }
  };

  assert.throws(
    () => validateConfig(config),
    /legacy codex config is no longer supported\. Use executionBackends and agents\./
  );
});

test("valid command object passes", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [
    { name: "unit-tests", command: "npm", args: ["test"], cwd: "workspace" }
  ];
  const validated = validateConfig(config);
  assert.equal(validated.commands.checks.length, 1);
});

test("missing command name fails", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [{ command: "npm", args: ["test"], cwd: "workspace" }];
  assert.throws(() => validateConfig(config), /commands\.checks\[0\]\.name/);
});

test("missing executable fails", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [{ name: "unit-tests", args: ["test"], cwd: "workspace" }];
  assert.throws(() => validateConfig(config), /commands\.checks\[0\]\.command/);
});

test("args not array fails", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [
    { name: "unit-tests", command: "npm", args: "test", cwd: "workspace" }
  ];
  assert.throws(() => validateConfig(config), /commands\.checks\[0\]\.args must be an array/);
});

test("invalid cwd fails", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [
    { name: "unit-tests", command: "npm", args: ["test"], cwd: "repo" }
  ];
  assert.throws(() => validateConfig(config), /commands\.checks\[0\]\.cwd must be "workspace" or "orchestrator"/);
});

test("dangerous command git commit fails", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [
    { name: "danger", command: "git", args: ["commit"], cwd: "workspace" }
  ];
  assert.throws(() => validateConfig(config), /denied git subcommand "commit"/);
});

test("dangerous command git push fails", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [
    { name: "danger", command: "git", args: ["push"], cwd: "workspace" }
  ];
  assert.throws(() => validateConfig(config), /denied git subcommand "push"/);
});

test("dangerous command git reset fails", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [
    { name: "danger", command: "git", args: ["reset"], cwd: "workspace" }
  ];
  assert.throws(() => validateConfig(config), /denied git subcommand "reset"/);
});

test("dangerous command rm -rf fails", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [{ name: "danger", command: "rm", args: ["-rf"], cwd: "workspace" }];
  assert.throws(() => validateConfig(config), /command "rm" has dangerous recursive\/force flags/);
});

test("dangerous command sudo fails", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [{ name: "danger", command: "sudo", args: [], cwd: "workspace" }];
  assert.throws(() => validateConfig(config), /command "sudo" is denied/);
});

test("shell-like command string fails when command contains spaces", () => {
  const config = makeBaseConfig();
  (config.commands as { checks: unknown[] }).checks = [
    { name: "bad", command: "npm test", args: [], cwd: "workspace" }
  ];
  assert.throws(() => validateConfig(config), /executable name only/);
});

test("missing writeSafety loads with defaults", () => {
  const config = makeBaseConfig();
  const validated = validateConfig(config);
  assert.equal(validated.writeSafety.enabled, false);
  assert.equal(validated.writeSafety.requireExplicitAllowWrites, true);
  assert.equal(validated.writeSafety.requireCleanWorkingTree, true);
  assert.equal(validated.writeSafety.captureDiffBeforeAfter, true);
  assert.equal(validated.writeSafety.requireReviewAfterWrites, true);
  assert.equal(validated.writeSafety.autoCommit, false);
  assert.equal(validated.writeSafety.autoPush, false);
  assert.deepEqual(validated.writeSafety.allowedBranches, ["feature/*", "bugfix/*", "chore/*"]);
});

test("writeSafety.autoCommit true fails validation", () => {
  const config = makeBaseConfig();
  (config as { writeSafety?: unknown }).writeSafety = { autoCommit: true };
  assert.throws(() => validateConfig(config), /writeSafety\.autoCommit must be false/);
});

test("writeSafety.autoPush true fails validation", () => {
  const config = makeBaseConfig();
  (config as { writeSafety?: unknown }).writeSafety = { autoPush: true };
  assert.throws(() => validateConfig(config), /writeSafety\.autoPush must be false/);
});

test("invalid writeSafety.allowedBranches fails", () => {
  const config = makeBaseConfig();
  (config as { writeSafety?: unknown }).writeSafety = { allowedBranches: ["feature/*", ""] };
  assert.throws(() => validateConfig(config), /writeSafety\.allowedBranches\[1\] must be a non-empty string/);
});

test("invalid writeSafety.blockedPaths fails", () => {
  const config = makeBaseConfig();
  (config as { writeSafety?: unknown }).writeSafety = { blockedPaths: [".env", ""] };
  assert.throws(() => validateConfig(config), /writeSafety\.blockedPaths\[1\] must be a non-empty string/);
});

test("missing changeReport uses default policy", () => {
  const validated = validateConfig(makeBaseConfig());
  assert.deepEqual(validated.changeReport, DEFAULT_CHANGE_REPORT_POLICY);
});

test("invalid changeReport penalty fails validation", () => {
  const config = makeBaseConfig();
  (config as { changeReport?: unknown }).changeReport = {
    readiness: {
      penalties: { failedRun: -1 }
    }
  };
  assert.throws(() => validateConfig(config), /changeReport\.readiness\.penalties\.failedRun must be a number between 0 and 100/);
});

test("invalid changeReport thresholds fail validation", () => {
  const config = makeBaseConfig();
  (config as { changeReport?: unknown }).changeReport = {
    readiness: {
      readyMinimumScore: 50,
      needsReviewMinimumScore: 60
    }
  };
  assert.throws(() => validateConfig(config), /readyMinimumScore must be greater than or equal to/);
});

test("changeReport arrays must contain strings and booleans must be booleans", () => {
  const badArray = makeBaseConfig();
  (badArray as { changeReport?: unknown }).changeReport = {
    riskRules: {
      highRiskPaths: ["auth", 123]
    }
  };
  assert.throws(() => validateConfig(badArray), /changeReport\.riskRules\.highRiskPaths\[1\] must be a string/);

  const badBoolean = makeBaseConfig();
  (badBoolean as { changeReport?: unknown }).changeReport = {
    scopeDrift: {
      enabled: "yes"
    }
  };
  assert.throws(() => validateConfig(badBoolean), /changeReport\.scopeDrift\.enabled must be a boolean/);
});

test("loadAndValidateConfig fails with unreadable config file error", async () => {
  const missing = path.resolve(tmpdir(), `missing-config-${Date.now()}.json`);
  await assert.rejects(
    async () => loadAndValidateConfig(missing),
    /Config file not found or unreadable at .*\. No fallback is used\./
  );
});

test("loadAndValidateConfig fails with invalid JSON error", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "orchestrator-config-invalid-json-"));
  const configPath = path.join(dir, "bad.json");
  await writeFile(configPath, "{\n", "utf8");

  await assert.rejects(async () => loadAndValidateConfig(configPath), /Invalid config JSON at .*: /);
});

test("resolveConfigPath preserves absolute paths", () => {
  const absolute = path.resolve("/tmp", "config.json");
  assert.equal(resolveConfigPath("/workspace/root", absolute), absolute);
});

test("resolveConfigPath resolves relative paths from orchestrator root", () => {
  assert.equal(resolveConfigPath("/workspace/root", "configs/acme.json"), "/workspace/root/configs/acme.json");
});

test("validateWorkspaceSafety enforces workspace accessibility", async () => {
  const missing = path.resolve(tmpdir(), `missing-workspace-${Date.now()}`);
  await assert.rejects(
    async () => validateWorkspaceSafety(missing, false),
    /Target workspaceRoot does not exist or is not accessible: .*\./
  );
});

test("validateWorkspaceSafety enforces .git when requireGitRepo is true", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "orchestrator-workspace-no-git-"));
  await assert.rejects(
    async () => validateWorkspaceSafety(workspace, true),
    new RegExp(`Target workspaceRoot is not a git repository: missing ${workspace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/\\.git`)
  );
});

test("validateWorkspaceSafety passes without .git when requireGitRepo is false", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "orchestrator-workspace-ok-"));
  await validateWorkspaceSafety(workspace, false);
});

test("config facade exports required runtime members", async () => {
  const exported = await import("../src/config.js");
  assert.equal(typeof exported.loadAndValidateConfig, "function");
  assert.equal(typeof exported.resolveConfigPath, "function");
  assert.equal(typeof exported.validateWorkspaceSafety, "function");
  assert.equal(typeof exported.validateConfig, "function");
});

test("config facade type exports remain importable", () => {
  const ensure: {
    codexBackend: CodexCliBackendConfig;
    openCodeBackend: OpenCodeCliBackendConfig;
    backend: ExecutionBackendConfig;
    backendMap: ExecutionBackendConfigMap;
    agentRole: AgentRoleConfig;
    agentMap: AgentConfigMap;
    orchestrator: OrchestratorConfig;
    checkCwd: ConfiguredCheckCommandCwd;
    check: ConfiguredCheckCommand;
  } | null = null;
  assert.equal(ensure, null);
});
