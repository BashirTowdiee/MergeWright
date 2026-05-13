import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runStage } from "../src/runner.js";
import { continueRun } from "../src/continue-run.js";
import type { CodexExecutionRequest, CodexExecutionResult } from "../src/codex.js";
import type { RunMetadata } from "../src/run-metadata.js";

const execFileAsync = promisify(execFile);

async function initGitRepoClean(workspaceRoot: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: workspaceRoot });
  await execFileAsync("git", ["config", "user.email", "orchestrator@example.com"], { cwd: workspaceRoot });
  await execFileAsync("git", ["config", "user.name", "Orchestrator Tests"], { cwd: workspaceRoot });
  await writeFile(path.join(workspaceRoot, "README.md"), "fixture\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: workspaceRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: workspaceRoot });
  await execFileAsync("git", ["checkout", "-b", "feature/v2-acceptance"], { cwd: workspaceRoot });
}

async function makeFixture(writeSafetyEnabled = true): Promise<{ orchestratorRoot: string; configArg: string; workspaceRoot: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-v2-"));
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "target-v2-"));
  await mkdir(path.join(workspaceRoot, ".git"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "stages/acme"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "prompts"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs/acme"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await writeFile(path.join(orchestratorRoot, "stages/acme/example-stage.md"), "Stage instruction", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/planner-stage.md"), "Plan stage: {{stage_name}}", "utf8");
  await writeFile(
    path.join(orchestratorRoot, "prompts/reviewer.md"),
    "PLANNER={{planner_output}}\nBUILDER={{builder_output}}\nAUDIT={{write_audit_context}}",
    "utf8"
  );
  await writeFile(path.join(orchestratorRoot, "prompts/review-to-fix.md"), "{{review_output}}", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/final-review.md"), "{{review_output}}", "utf8");
  const configArg = "configs/acme.json";
  await writeFile(
    path.join(orchestratorRoot, configArg),
    JSON.stringify(
      {
        version: 1,
        projectName: "acme",
        workspaceRoot,
        paths: { stagesDir: "stages/acme", promptsDir: "prompts", runsDir: "runs/acme" },
        codex: {
          planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
          builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
          reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
        },
        pipeline: { finalReview: true, maxFixLoops: 1 },
        commands: { checks: [{ name: "ok", command: "echo", args: ["ok"], cwd: "workspace" }] },
        safety: {
          requireGitRepo: true,
          requireCleanStart: true,
          manualCommit: true,
          forbidAutoCommit: true,
          forbidAutoPush: true
        },
        writeSafety: {
          enabled: writeSafetyEnabled,
          requireExplicitAllowWrites: true,
          requireCleanWorkingTree: true,
          allowedBranches: ["feature/*"],
          blockedPaths: ["*.pem"],
          captureDiffBeforeAfter: true,
          requireReviewAfterWrites: true,
          autoCommit: false,
          autoPush: false
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await initGitRepoClean(workspaceRoot);
  return { orchestratorRoot, configArg, workspaceRoot };
}

function makeCodexResult(req: CodexExecutionRequest, outputLastMessage: string): CodexExecutionResult {
  return {
    command: "codex",
    args: [],
    cwd: req.workspaceRoot,
    stdout: "",
    stderr: "",
    exitCode: 0,
    signal: null,
    durationMs: 1,
    success: true,
    outputLastMessagePath: req.outputLastMessagePath,
    outputLastMessage,
    skipped: false
  };
}

const PLANNER_BUILD_OUTPUT = "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nApply minimal focused changes.";

test("V2-A: write-enabled normal run captures audit, review, checks, and success metadata", async () => {
  const fx = await makeFixture(true);
  const calls: Array<{ role: string; sandbox?: string; prompt?: string }> = [];
  let checksRan = 0;
  const result = await runStage({
    stageName: "example-stage",
    configArg: fx.configArg,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    runChecks: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (req) => {
      calls.push({ role: req.role, sandbox: req.sandboxMode, prompt: req.prompt });
      if (req.role === "builder") {
        await writeFile(path.join(fx.workspaceRoot, "builder-change.txt"), "changed\n", "utf8");
        return makeCodexResult(req, "builder output");
      }
      if (req.role === "planner") return makeCodexResult(req, PLANNER_BUILD_OUTPUT);
      return makeCodexResult(req, "reviewer output");
    },
    checkCommandExecutor: async (command) => {
      checksRan += 1;
      return { ...command, stdout: "ok", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true };
    }
  });
  assert.equal(result.writeSafetyState, "passed");
  assert.equal(result.checksState, "executed");
  assert.equal(checksRan, 1);
  assert.equal(calls.find((c) => c.role === "planner")?.sandbox, "read-only");
  assert.equal(calls.find((c) => c.role === "builder")?.sandbox, "workspace-write");
  assert.equal(calls.find((c) => c.role === "reviewer")?.sandbox, "read-only");
  await access(path.join(result.runDir, "write-safety-result.json"));
  await access(path.join(result.runDir, "write-audit/builder/summary.json"));
  await access(path.join(result.runDir, "reviewer-output-last-message.md"));
  await access(path.join(result.runDir, "checks-status.json"));
  const metadata = JSON.parse(await readFile(path.join(result.runDir, "run.json"), "utf8")) as RunMetadata;
  assert.equal(metadata.status, "success");
  assert.equal(metadata.resolvedOptions.allowWrites, true);
  assert.equal(metadata.writeSafety?.state, "passed");
  assert.equal(metadata.writeAudit?.builder.status, "captured");
  assert.equal(metadata.postWriteReview.status, "completed");
  assert.equal(metadata.phases.checks.status, "executed");
});

test("V2-B: write-enabled fix flow captures fix audit and gates checks until reviewer completes", async () => {
  const fx = await makeFixture(true);
  const calls: Array<{ role: string; sandbox?: string }> = [];
  const initial = await runStage({
    stageName: "example-stage",
    configArg: fx.configArg,
    executePlanner: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (req) => {
      calls.push({ role: req.role, sandbox: req.sandboxMode });
      if (req.outputLastMessagePath.endsWith("review-to-fix-output-last-message.md")) {
        return makeCodexResult(req, "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nNeed fix.\n\n## FINAL FIX PROMPT\nApply fix.");
      }
      if (req.role === "planner") return makeCodexResult(req, PLANNER_BUILD_OUTPUT);
      if (req.role === "reviewer") return makeCodexResult(req, "review");
      await writeFile(path.join(fx.workspaceRoot, "fix-change.txt"), "fix\n", "utf8");
      return makeCodexResult(req, "fix output");
    }
  });
  const runId = path.basename(initial.runDir);
  await rm(path.join(initial.runDir, "checks-status.json"), { force: true });
  let ranChecks = false;
  try {
    await continueRun({
      runId,
      configArg: fx.configArg,
      runChecks: true,
      dryRun: false,
      verbose: false,
      orchestratorRoot: fx.orchestratorRoot,
      checkCommandExecutor: async (command) => ({ ...command, stdout: "ok", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true })
    });
    ranChecks = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, /Checks blocked: post-write review status is "pending"/);
  }
  if (!ranChecks) {
    await continueRun({
      runId,
      configArg: fx.configArg,
      executeReviewer: true,
      runChecks: true,
      dryRun: false,
      verbose: false,
      orchestratorRoot: fx.orchestratorRoot,
      codexExecutor: async (req) => {
        calls.push({ role: req.role, sandbox: req.sandboxMode });
        return makeCodexResult(req, "review-after-fix");
      },
      checkCommandExecutor: async (command) => ({ ...command, stdout: "ok", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true })
    });
  }
  const metadata = JSON.parse(await readFile(path.join(initial.runDir, "run.json"), "utf8")) as RunMetadata;
  assert.equal(metadata.writeAudit?.fix.status, "captured");
  assert.equal(metadata.postWriteReview.status, "completed");
  assert.equal(metadata.phases.checks.status, "executed");
  assert.equal(calls.some((c) => c.role === "builder" && c.sandbox === "workspace-write"), true);
});

test("V2-C/D: write safety blocks writes and only builder/fix may use workspace-write", async () => {
  const disabled = await makeFixture(false);
  let called = 0;
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: disabled.configArg,
        executePlanner: true,
        executeBuilder: true,
        executeReviewer: true,
        allowWrites: true,
        dryRun: false,
        verbose: false,
        orchestratorRoot: disabled.orchestratorRoot,
        codexExecutor: async (req) => {
          called += 1;
          if (req.role === "planner") return makeCodexResult(req, PLANNER_BUILD_OUTPUT);
          throw new Error("should not run");
        }
      }),
    /writeSafety\.enabled is false/
  );
  assert.equal(called, 1);
  const enabled = await makeFixture(true);
  const modes: Array<{ role: string; sandbox?: string }> = [];
  await runStage({
    stageName: "example-stage",
    configArg: enabled.configArg,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: enabled.orchestratorRoot,
    codexExecutor: async (req) => {
      modes.push({ role: req.role, sandbox: req.sandboxMode });
      if (req.outputLastMessagePath.endsWith("review-to-fix-output-last-message.md")) {
        return makeCodexResult(req, "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nNeed.\n\n## FINAL FIX PROMPT\nDo");
      }
      if (req.role === "planner") return makeCodexResult(req, PLANNER_BUILD_OUTPUT);
      if (req.role === "builder") await writeFile(path.join(enabled.workspaceRoot, "b.txt"), "b", "utf8");
      return makeCodexResult(req, `${req.role} output`);
    }
  });
  assert.equal(modes.find((m) => m.role === "planner")?.sandbox, "read-only");
  assert.equal(modes.find((m) => m.role === "reviewer")?.sandbox, "read-only");
  assert.equal(modes.find((m) => m.role === "builder")?.sandbox, "workspace-write");
  assert.equal(modes.filter((m) => m.role === "builder" && m.sandbox === "workspace-write").length >= 1, true);
});

test("V2-E: dry-run with allow-writes executes nothing and preserves continuation metadata", async () => {
  const fx = await makeFixture(true);
  let codexCalls = 0;
  const runResult = await runStage({
    stageName: "example-stage",
    configArg: fx.configArg,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    runChecks: true,
    allowWrites: true,
    dryRun: true,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async () => {
      codexCalls += 1;
      throw new Error("should not run");
    }
  });
  assert.equal(codexCalls, 0);
  assert.equal(runResult.writeSafetyState, "skipped by dry-run");
  await assert.rejects(access(path.join(runResult.runDir, "write-audit/builder/summary.json")));
  const baseline = await runStage({
    stageName: "example-stage",
    configArg: fx.configArg,
    executePlanner: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (req) => makeCodexResult(req, PLANNER_BUILD_OUTPUT)
  });
  const before = await readFile(path.join(baseline.runDir, "run.json"), "utf8");
  await continueRun({
    runId: path.basename(baseline.runDir),
    configArg: fx.configArg,
    executeBuilder: true,
    allowWrites: true,
    dryRun: true,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot
  });
  const after = await readFile(path.join(baseline.runDir, "run.json"), "utf8");
  assert.equal(after, before);
});

test("V2-F: continuation workflow transitions planner -> builder(write) -> reviewer -> checks without overwriting phases", async () => {
  const fx = await makeFixture(true);
  const first = await runStage({
    stageName: "example-stage",
    configArg: fx.configArg,
    executePlanner: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (req) => makeCodexResult(req, PLANNER_BUILD_OUTPUT)
  });
  const runId = path.basename(first.runDir);
  await continueRun({
    runId,
    configArg: fx.configArg,
    executeBuilder: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (req) => {
      await writeFile(path.join(fx.workspaceRoot, "cont-builder.txt"), "x", "utf8");
      return makeCodexResult(req, "builder");
    }
  });
  const mid = JSON.parse(await readFile(path.join(first.runDir, "run.json"), "utf8")) as RunMetadata;
  assert.equal(mid.phases.planner.status, "executed");
  assert.equal(mid.phases.builder.status, "executed");
  assert.equal(mid.postWriteReview.status, "pending");
  await rm(path.join(first.runDir, "checks-status.json"), { force: true });
  await continueRun({
    runId,
    configArg: fx.configArg,
    executeReviewer: true,
    runChecks: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (req) => makeCodexResult(req, "review"),
    checkCommandExecutor: async (command) => ({ ...command, stdout: "ok", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true })
  });
  const done = JSON.parse(await readFile(path.join(first.runDir, "run.json"), "utf8")) as RunMetadata;
  assert.equal(done.phases.planner.status, "executed");
  assert.equal(done.phases.builder.status, "executed");
  assert.equal(done.phases.reviewer.status, "executed");
  assert.equal(done.phases.checks.status, "executed");
  assert.equal(done.postWriteReview.status, "completed");
  assert.deepEqual(done.postWriteReview.requiredByPhases, ["builder"]);
});
