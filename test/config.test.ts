import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config.js";

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
