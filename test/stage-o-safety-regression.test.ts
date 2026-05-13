import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { buildCodexExecArgs, DEFAULT_CODEX_EXEC_CAPABILITIES, type CodexExecutionRequest } from "../src/codex.js";
import { resolvePipelinePreset, PIPELINE_PRESETS } from "../src/presets.js";
import { validateConfiguredCheckCommand } from "../src/commands.js";

const requestBase: Omit<CodexExecutionRequest, "role" | "model" | "reasoningEffort"> = {
  prompt: "prompt",
  workspaceRoot: "/tmp/workspace",
  outputLastMessagePath: "/tmp/orchestrator/runs/out.md",
  dryRun: false,
  requireGitRepo: true,
  orchestratorRoot: "/tmp/orchestrator"
};

test("Codex exec args always include read-only sandbox for planner/builder/reviewer", () => {
  const roles: Array<{ role: "planner" | "builder" | "reviewer"; model: string; reasoningEffort: string }> = [
    { role: "planner", model: "gpt-5.3-codex", reasoningEffort: "high" },
    { role: "builder", model: "gpt-5.3-codex", reasoningEffort: "medium" },
    { role: "reviewer", model: "gpt-5.3-codex", reasoningEffort: "low" }
  ];

  for (const roleCfg of roles) {
    const built = buildCodexExecArgs({ ...requestBase, ...roleCfg }, DEFAULT_CODEX_EXEC_CAPABILITIES);
    const sandboxIdx = built.args.indexOf("-s");
    assert.notEqual(sandboxIdx, -1);
    assert.equal(built.args[sandboxIdx + 1], "read-only");
  }
});

test("no supported preset introduces write-enabled execution flags", () => {
  for (const preset of PIPELINE_PRESETS) {
    const resolved = resolvePipelinePreset(preset);
    const keys = Object.keys(resolved);
    assert.deepEqual(keys.sort(), ["executeBuilder", "executeFix", "executePlanner", "executeReviewer", "planFix", "runChecks"].sort());
  }
});

test("full-readonly remains readonly phase-only preset", () => {
  const resolved = resolvePipelinePreset("full-readonly");
  assert.deepEqual(resolved, {
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    runChecks: true
  });
});

test("dangerous command regression cases are rejected", () => {
  assert.throws(
    () => validateConfiguredCheckCommand({ name: "bash", command: "/bin/bash", args: ["-lc", "echo hi"], cwd: "workspace" }),
    /denied/
  );
  assert.throws(
    () => validateConfiguredCheckCommand({ name: "git-commit", command: "/usr/bin/git", args: ["commit"], cwd: "workspace" }),
    /denied git subcommand/
  );
  assert.throws(
    () => validateConfiguredCheckCommand({ name: "env-git", command: "env", args: ["git", "commit"], cwd: "workspace" }),
    /denied/
  );
  assert.throws(
    () => validateConfiguredCheckCommand({ name: "rm-rf", command: "rm", args: ["-rf", "/tmp/x"], cwd: "workspace" }),
    /dangerous/
  );
});

test("src runtime has no auto-commit/auto-push git mutation command paths", async () => {
  const srcDir = path.resolve(process.cwd(), "src");
  const files = (await readdir(srcDir)).filter((file) => file.endsWith(".ts"));
  const runtimeFiles = files.filter((file) => !file.endsWith(".test.ts"));
  const needles = ["git commit", "git push", "\"commit\"", "\"push\""];
  const allow = new Set(["config.ts", "init-project.ts", "commands.ts", "write-safety.ts"]);

  for (const file of runtimeFiles) {
    if (allow.has(file)) continue;
    const text = await readFile(path.join(srcDir, file), "utf8");
    for (const needle of needles) {
      assert.equal(
        text.includes(needle),
        false,
        `Unexpected mutation keyword "${needle}" in src/${file}`
      );
    }
  }
});
