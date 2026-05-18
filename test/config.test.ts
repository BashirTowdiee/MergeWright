import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config.js";
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
    codex: {
      planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
      builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
      reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
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

test("legacy codex config normalises execution backend and agents", () => {
  const config = validateConfig(makeBaseConfig());

  assert.deepEqual(config.executionBackends, {
    codex: {
      type: "codex-cli"
    }
  });
  assert.deepEqual(config.agents, {
    planner: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" },
    builder: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "medium" },
    reviewer: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" }
  });
});

test("new execution backend and agents config passes without codex block", () => {
  const config = makeBaseConfig();
  delete (config as { codex?: unknown }).codex;
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
  assert.deepEqual(validated.codex, {
    planner: { model: "gpt-5.5-codex", reasoningEffort: "high" },
    builder: { model: "gpt-5.5-codex", reasoningEffort: "medium" },
    reviewer: { model: "gpt-5.5-codex", reasoningEffort: "high" }
  });
});

test("new agents config rejects unknown execution backend reference", () => {
  const config = makeBaseConfig();
  delete (config as { codex?: unknown }).codex;
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
  delete (config as { codex?: unknown }).codex;
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

test("new config requires executionBackends when codex is absent", () => {
  const config = makeBaseConfig();
  delete (config as { codex?: unknown }).codex;
  (config as { agents?: unknown }).agents = {
    planner: { backend: "codex", model: "gpt-5.5-codex", reasoningEffort: "high" },
    builder: { backend: "codex", model: "gpt-5.5-codex", reasoningEffort: "medium" },
    reviewer: { backend: "codex", model: "gpt-5.5-codex", reasoningEffort: "high" }
  };

  assert.throws(() => validateConfig(config), /executionBackends is required when codex is not provided/);
});

test("new config requires agents when codex is absent", () => {
  const config = makeBaseConfig();
  delete (config as { codex?: unknown }).codex;
  (config as { executionBackends?: unknown }).executionBackends = {
    codex: {
      type: "codex-cli"
    }
  };

  assert.throws(() => validateConfig(config), /agents is required when codex is not provided/);
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
