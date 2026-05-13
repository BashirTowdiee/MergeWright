import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createProgressLogger } from "../src/progress-logger.js";
import { continueRun } from "../src/continue-run.js";
import type { RunMetadata } from "../src/run-metadata.js";

const execFileAsync = promisify(execFile);

function makeProgressCapture(verbose = false): { lines: string[]; logger: ReturnType<typeof createProgressLogger> } {
  const lines: string[] = [];
  return {
    lines,
    logger: createProgressLogger((line) => lines.push(line), { verbose })
  };
}

async function makeFixture(): Promise<{ orchestratorRoot: string; configArg: string; runId: string; runDir: string; workspaceRoot: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-continue-"));
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "target-continue-"));
  await mkdir(path.join(workspaceRoot, ".git"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "prompts"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs/acme"), { recursive: true });

  await writeFile(path.join(orchestratorRoot, "prompts/planner-stage.md"), "{{stage_name}}", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/reviewer.md"), "{{builder_execution_state}}\n{{planner_output}}\n{{write_audit_context}}", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/review-to-fix.md"), "{{review_output}}", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/final-review.md"), "{{review_output}}", "utf8");

  const configArg = "configs/acme.json";
  await writeFile(
    path.join(orchestratorRoot, configArg),
    JSON.stringify(
      {
        version: 1,
        projectName: "Acme",
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
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const runId = "20260513-000000-example-stage";
  const runDir = path.join(orchestratorRoot, "runs/acme", runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "01-stage-input.md"), "stage", "utf8");
  await writeFile(path.join(runDir, "02-rendered-planner-prompt.md"), "planner prompt", "utf8");
  await writeFile(path.join(runDir, "06-planner-output-last-message.md"), "planner output", "utf8");
  await writeFile(path.join(runDir, "builder-prompt.extracted.md"), "builder prompt", "utf8");

  const metadata: RunMetadata = {
    version: 1,
    runId,
    projectName: "Acme",
    stageName: "example-stage",
    workspaceRoot,
    orchestratorRoot,
    configPath: path.join(orchestratorRoot, configArg),
    startedAt: "2026-05-13T00:00:00.000Z",
    completedAt: "2026-05-13T00:00:01.000Z",
    status: "success",
    resolvedOptions: {
      dryRun: true,
      executePlanner: true,
      executeBuilder: false,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false,
      allowWrites: false
    },
    postWriteReview: {
      required: false,
      status: "not-required",
      reason: "no write-enabled builder/fix executed",
      requiredByPhases: [],
      artefacts: []
    },
    phases: {
      planner: { status: "executed" },
      builder: { status: "disabled" },
      reviewer: { status: "disabled" },
      fixPlanning: { status: "disabled" },
      fixExecution: { status: "disabled" },
      checks: { status: "disabled" }
    },
    artefacts: ["01-stage-input.md", "02-rendered-planner-prompt.md", "06-planner-output-last-message.md", "builder-prompt.extracted.md"],
    error: null
  };
  await writeFile(path.join(runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");

  return { orchestratorRoot, configArg, runId, runDir, workspaceRoot };
}

async function initGitRepoClean(workspaceRoot: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: workspaceRoot });
  await execFileAsync("git", ["config", "user.email", "orchestrator@example.com"], { cwd: workspaceRoot });
  await execFileAsync("git", ["config", "user.name", "Orchestrator Tests"], { cwd: workspaceRoot });
  await writeFile(path.join(workspaceRoot, "README.md"), "fixture\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: workspaceRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: workspaceRoot });
}

test("missing run.json fails clearly", async () => {
  const fx = await makeFixture();
  await writeFile(path.join(fx.runDir, "run.json"), "", "utf8");
  await assert.rejects(
    () => continueRun({ runId: fx.runId, configArg: fx.configArg, executeBuilder: true, dryRun: false, verbose: false, orchestratorRoot: fx.orchestratorRoot }),
    /run.json is malformed/
  );
});

test("run project mismatch fails clearly", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.projectName = "Other";
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  await assert.rejects(
    () => continueRun({ runId: fx.runId, configArg: fx.configArg, executeBuilder: true, dryRun: false, verbose: false, orchestratorRoot: fx.orchestratorRoot }),
    /Run project mismatch/
  );
});

test("builder continuation executes and updates metadata", async () => {
  const fx = await makeFixture();
  let calls = 0;
  const result = await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      calls += 1;
      return {
        command: "codex",
        args: [],
        cwd: fx.orchestratorRoot,
        stdout: "out",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "builder result",
        skipped: false
      };
    }
  });
  assert.equal(calls, 1);
  assert.deepEqual(result.selectedPhases, ["builder"]);
  const runMetadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  assert.equal(runMetadata.phases.builder.status, "executed");
  assert.equal(runMetadata.status, "success");
});

test("continue-run emits phase progress logs", async () => {
  const fx = await makeFixture();
  const progress = makeProgressCapture();

  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    progressLogger: progress.logger,
    codexExecutor: async (request) => ({
      command: "codex",
      args: [],
      cwd: fx.orchestratorRoot,
      stdout: "builder stdout marker",
      stderr: "builder stderr marker",
      exitCode: 0,
      signal: null,
      durationMs: 1,
      success: true,
      outputLastMessagePath: request.outputLastMessagePath,
      outputLastMessage: "builder result",
      skipped: false
    })
  });

  const text = progress.lines.join("\n");
  assert.match(text, /Continuing run: /);
  assert.match(text, /\[builder\] starting/);
  assert.match(text, /\[builder\] waiting for Codex\.\.\./);
  assert.match(text, /\[builder\] completed in /);
  assert.match(text, /Run completed successfully/);
  assert.doesNotMatch(text, /builder stdout marker/);
  assert.doesNotMatch(text, /builder stderr marker/);
});

test("continue-run failure logs include failed phase and diagnostics", async () => {
  const fx = await makeFixture();
  const progress = makeProgressCapture();

  await assert.rejects(
    () =>
      continueRun({
        runId: fx.runId,
        configArg: fx.configArg,
        executeBuilder: true,
        dryRun: false,
        verbose: false,
        orchestratorRoot: fx.orchestratorRoot,
        progressLogger: progress.logger,
        codexExecutor: async (request) => ({
          command: "codex",
          args: [],
          cwd: fx.orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 2,
          signal: null,
          durationMs: 1,
          success: false,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "builder failure",
          skipped: false
        })
      }),
    /Builder execution failed/
  );

  const text = progress.lines.join("\n");
  assert.match(text, /Run failed during phase: builder/);
  assert.match(text, /Diagnostics: /);
});

test("builder continuation fails if already executed", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.phases.builder.status = "executed";
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  await assert.rejects(
    () => continueRun({ runId: fx.runId, configArg: fx.configArg, executeBuilder: true, dryRun: false, verbose: false, orchestratorRoot: fx.orchestratorRoot }),
    /already executed/
  );
});

test("reviewer continuation works without builder and prompt states limited review", async () => {
  const fx = await makeFixture();
  let prompt = "";
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeReviewer: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      prompt = request.prompt;
      return {
        command: "codex",
        args: [],
        cwd: fx.orchestratorRoot,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "review",
        skipped: false
      };
    }
  });
  assert.match(prompt, /Limit review to planner output/);
});

test("plan-fix continuation requires reviewer executed", async () => {
  const fx = await makeFixture();
  await assert.rejects(
    () => continueRun({ runId: fx.runId, configArg: fx.configArg, planFix: true, dryRun: false, verbose: false, orchestratorRoot: fx.orchestratorRoot }),
    /requires reviewer phase executed/
  );
});

test("execute-fix with PROCEED decision skips clearly", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.phases.fixPlanning.status = "executed";
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  await writeFile(path.join(fx.runDir, "review-to-fix-decision.json"), JSON.stringify({ decision: "PROCEED" }), "utf8");

  const result = await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeFix: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async () => {
      throw new Error("should not execute");
    }
  });

  assert.equal(result.skippedFixBecauseProceed, true);
  const runMetadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  assert.equal(runMetadata.phases.fixExecution.status, "skipped");
});

test("checks continuation runs configured checks and updates metadata", async () => {
  const fx = await makeFixture();
  let checksCalls = 0;
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    runChecks: true,
      allowWrites: false,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    checkCommandExecutor: async () => {
      checksCalls += 1;
      return {
        name: "ok",
        command: "echo",
        args: ["ok"],
        cwd: fx.workspaceRoot,
        stdout: "ok",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true
      };
    }
  });
  assert.equal(checksCalls, 1);
  const runMetadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  assert.equal(runMetadata.phases.checks.status, "executed");
});

test("pending post-write review blocks continue-run --run-checks", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.postWriteReview = {
    required: true,
    status: "pending",
    reason: "write-enabled builder/fix executed",
    requiredByPhases: ["builder"],
    artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
  };
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  let checkCalls = 0;
  await assert.rejects(
    () =>
      continueRun({
        runId: fx.runId,
        configArg: fx.configArg,
        runChecks: true,
        dryRun: false,
        verbose: false,
        orchestratorRoot: fx.orchestratorRoot,
        checkCommandExecutor: async () => {
          checkCalls += 1;
          throw new Error("should not run");
        }
      }),
    /Checks blocked: post-write review status is "pending"/
  );
  assert.equal(checkCalls, 0);
  const blocked = JSON.parse(await readFile(path.join(fx.runDir, "checks-status.json"), "utf8")) as { state: string };
  assert.equal(blocked.state, "blocked");
});

test("continue-run --execute-reviewer --run-checks allows checks after post-write review completion", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.postWriteReview = {
    required: true,
    status: "pending",
    reason: "write-enabled builder/fix executed",
    requiredByPhases: ["builder"],
    artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
  };
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");

  let checksSawPostWriteReviewCompleted = false;
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeReviewer: true,
    runChecks: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => ({
      command: "codex",
      args: [],
      cwd: fx.orchestratorRoot,
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 1,
      success: true,
      outputLastMessagePath: request.outputLastMessagePath,
      outputLastMessage: "review",
      skipped: false
    }),
    checkCommandExecutor: async () => {
      const current = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
      checksSawPostWriteReviewCompleted = current.postWriteReview.status === "completed";
      return {
        name: "ok",
        command: "echo",
        args: ["ok"],
        cwd: fx.workspaceRoot,
        stdout: "ok",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true
      };
    }
  });
  assert.equal(checksSawPostWriteReviewCompleted, true);
});

test("continue-run reviewer failure prevents checks in same command", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.postWriteReview = {
    required: true,
    status: "pending",
    reason: "write-enabled builder/fix executed",
    requiredByPhases: ["builder"],
    artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
  };
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  let checkCalls = 0;
  await assert.rejects(
    () =>
      continueRun({
        runId: fx.runId,
        configArg: fx.configArg,
        executeReviewer: true,
        runChecks: true,
        dryRun: false,
        verbose: false,
        orchestratorRoot: fx.orchestratorRoot,
        codexExecutor: async (request) => ({
          command: "codex",
          args: [],
          cwd: fx.orchestratorRoot,
          stdout: "",
          stderr: "boom",
          exitCode: 19,
          signal: null,
          durationMs: 1,
          success: false,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "review failed",
          skipped: false
        }),
        checkCommandExecutor: async () => {
          checkCalls += 1;
          throw new Error("should not run");
        }
      }),
    /Reviewer execution failed/
  );
  assert.equal(checkCalls, 0);
});

test("continue-run dry-run --execute-reviewer --run-checks validates projected ordering and writes nothing", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.postWriteReview = {
    required: true,
    status: "pending",
    reason: "write-enabled builder/fix executed",
    requiredByPhases: ["builder"],
    artefacts: ["post-write-review-required.json", "post-write-review-status.json"]
  };
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  const beforeMetadata = await readFile(path.join(fx.runDir, "run.json"), "utf8");
  const beforeFiles = await readdir(fx.runDir);
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeReviewer: true,
    runChecks: true,
    dryRun: true,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot
  });
  const afterMetadata = await readFile(path.join(fx.runDir, "run.json"), "utf8");
  const afterFiles = await readdir(fx.runDir);
  assert.equal(afterMetadata, beforeMetadata);
  assert.deepEqual(afterFiles.sort(), beforeFiles.sort());
});

test("multiple flags execute in order", async () => {
  const fx = await makeFixture();
  const roles: string[] = [];
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    executeReviewer: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      roles.push(request.role);
      return {
        command: "codex",
        args: [],
        cwd: fx.orchestratorRoot,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: request.role === "builder" ? "builder result" : "review",
        skipped: false
      };
    }
  });
  assert.deepEqual(roles, ["builder", "reviewer"]);
});

test("same-command write-enabled builder + reviewer continuation includes builder write-audit context", async () => {
  const fx = await makeFixture();
  await initGitRepoClean(fx.workspaceRoot);
  const configPath = path.join(fx.orchestratorRoot, fx.configArg);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: false,
    allowedBranches: ["*"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  const roles: string[] = [];
  let reviewerPrompt = "";
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    executeReviewer: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      roles.push(request.role);
      if (request.role === "builder") {
        await writeFile(path.join(fx.workspaceRoot, "same-command-context.txt"), "changed\n", "utf8");
        return {
          command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder result", skipped: false
        };
      }
      reviewerPrompt = request.prompt;
      return {
        command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "review", skipped: false
      };
    }
  });
  assert.deepEqual(roles, ["builder", "reviewer"]);
  assert.match(reviewerPrompt, /same-command-context\.txt/);
  assert.match(reviewerPrompt, /write-audit\/builder\/summary\.json/);
  assert.match(reviewerPrompt, /write-audit\/builder\/pre-diff-stat\.txt/);
  assert.match(reviewerPrompt, /write-audit\/builder\/post-diff-stat\.txt/);
  assert.match(reviewerPrompt, /write-audit\/builder\/pre-diff\.patch/);
  assert.match(reviewerPrompt, /write-audit\/builder\/post-diff\.patch/);
  assert.match(reviewerPrompt, /Reviewer must inspect write-enabled changes/);
});

test("dry-run validates but writes no artefacts and does not update metadata", async () => {
  const fx = await makeFixture();
  const beforeMetadata = await readFile(path.join(fx.runDir, "run.json"), "utf8");
  const beforeFiles = await readdir(fx.runDir);
  await continueRun({ runId: fx.runId, configArg: fx.configArg, executeBuilder: true, dryRun: true, verbose: false, orchestratorRoot: fx.orchestratorRoot });
  const afterMetadata = await readFile(path.join(fx.runDir, "run.json"), "utf8");
  const afterFiles = await readdir(fx.runDir);
  assert.equal(afterMetadata, beforeMetadata);
  assert.deepEqual(afterFiles.sort(), beforeFiles.sort());
});

test("dry-run --execute-reviewer --plan-fix validates using projected reviewer phase", async () => {
  const fx = await makeFixture();
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeReviewer: true,
    planFix: true,
    dryRun: true,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot
  });
});

test("dry-run --plan-fix --execute-fix validates using projected fix planning phase", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.phases.reviewer.status = "executed";
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  await writeFile(path.join(fx.runDir, "reviewer-output-last-message.md"), "review output", "utf8");
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    planFix: true,
    executeFix: true,
    dryRun: true,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot
  });
});

test("dry-run multi-phase chain writes no artefacts and does not update run.json", async () => {
  const fx = await makeFixture();
  const beforeMetadata = await readFile(path.join(fx.runDir, "run.json"), "utf8");
  const beforeFiles = await readdir(fx.runDir);
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    runChecks: true,
      allowWrites: false,
    dryRun: true,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot
  });
  const afterMetadata = await readFile(path.join(fx.runDir, "run.json"), "utf8");
  const afterFiles = await readdir(fx.runDir);
  assert.equal(afterMetadata, beforeMetadata);
  assert.deepEqual(afterFiles.sort(), beforeFiles.sort());
});

test("malformed run.json missing workspaceRoot fails with Invalid run metadata", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as Record<string, unknown>;
  delete metadata.workspaceRoot;
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  await assert.rejects(
    () => continueRun({ runId: fx.runId, configArg: fx.configArg, executeBuilder: true, dryRun: true, verbose: false, orchestratorRoot: fx.orchestratorRoot }),
    /Invalid run metadata: workspaceRoot must be a non-empty string/
  );
});

test("malformed run.json with invalid phase status fails clearly", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as Record<string, unknown>;
  const phases = metadata.phases as Record<string, { status: string }>;
  phases.builder = { ...phases.builder, status: "bad-status" };
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  await assert.rejects(
    () => continueRun({ runId: fx.runId, configArg: fx.configArg, executeBuilder: true, dryRun: true, verbose: false, orchestratorRoot: fx.orchestratorRoot }),
    /Invalid run metadata: phases\.builder\.status must be one of unknown, disabled, skipped, executed, failed/
  );
});

test("malformed run.json missing required phase key fails clearly", async () => {
  const fx = await makeFixture();
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as Record<string, unknown>;
  const phases = { ...(metadata.phases as Record<string, unknown>) };
  delete phases.reviewer;
  metadata.phases = phases;
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  await assert.rejects(
    () => continueRun({ runId: fx.runId, configArg: fx.configArg, executeBuilder: true, dryRun: true, verbose: false, orchestratorRoot: fx.orchestratorRoot }),
    /Invalid run metadata: phases\.reviewer is required/
  );
});

test("failure path preserves original execution error if metadata persistence fails", async () => {
  const fx = await makeFixture();
  let injected = false;
  await assert.rejects(
    () =>
      continueRun({
        runId: fx.runId,
        configArg: fx.configArg,
        executeBuilder: true,
        dryRun: false,
        verbose: false,
        orchestratorRoot: fx.orchestratorRoot,
        codexExecutor: async (request) => ({
          command: "codex",
          args: [],
          cwd: fx.orchestratorRoot,
          stdout: "",
          stderr: "err",
          exitCode: 2,
          signal: null,
          durationMs: 1,
          success: false,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "",
          skipped: false
        }),
        metadataWriter: async (_runDir, metadata) => {
          if (metadata.phases.builder.status === "failed" && !injected) {
            injected = true;
            throw new Error("metadata write failure (injected)");
          }
          await writeFile(path.join(_runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
        }
      }),
    /Builder execution failed/
  );
});

test("continue-run allowWrites + dryRun reports skipped by dry-run and writes no artefacts", async () => {
  const fx = await makeFixture();
  const beforeFiles = await readdir(fx.runDir);
  const result = await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    allowWrites: true,
    dryRun: true,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot
  });
  const afterFiles = await readdir(fx.runDir);
  assert.equal(result.writeSafetyState, "skipped by dry-run");
  assert.deepEqual(afterFiles.sort(), beforeFiles.sort());
});

test("continue-run allowWrites with writeSafety.enabled=false writes write-safety-result and metadata before throw", async () => {
  const fx = await makeFixture();
  await assert.rejects(
    () =>
      continueRun({
        runId: fx.runId,
        configArg: fx.configArg,
        executeBuilder: true,
        allowWrites: true,
        dryRun: false,
        verbose: false,
        orchestratorRoot: fx.orchestratorRoot
      }),
    /writeSafety\.enabled is false/
  );
  const writeSafety = JSON.parse(await readFile(path.join(fx.runDir, "write-safety-result.json"), "utf8")) as { ok: boolean };
  assert.equal(writeSafety.ok, false);
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as {
    writeSafety: { state: string; status: string; reason: string; artefacts: string[]; allowWrites: boolean };
  };
  assert.equal(metadata.writeSafety.allowWrites, true);
  assert.equal(metadata.writeSafety.state, "failed");
  assert.equal(metadata.writeSafety.status, "failed");
  assert.equal(metadata.writeSafety.reason, "writeSafety.enabled is false");
  assert.equal(metadata.writeSafety.artefacts.includes("write-safety-result.json"), true);
});

test("continue-run allowWrites safety pass persists metadata and uses workspace-write for builder", async () => {
  const fx = await makeFixture();
  await initGitRepoClean(fx.workspaceRoot);
  const configPath = path.join(fx.orchestratorRoot, fx.configArg);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: false,
    allowedBranches: ["*"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  let sandboxMode = "";
  const result = await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      sandboxMode = request.sandboxMode ?? "";
      return {
        command: "codex",
        args: [],
        cwd: fx.orchestratorRoot,
        stdout: "out",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "builder result",
        skipped: false
      };
    }
  });
  assert.equal(result.writeSafetyState, "passed");
  assert.equal(sandboxMode, "workspace-write");
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as {
    writeSafety: { state: string; status: string; artefacts: string[]; allowWrites: boolean };
  };
  assert.equal(metadata.writeSafety.allowWrites, true);
  assert.equal(metadata.writeSafety.state, "passed");
  assert.equal(metadata.writeSafety.status, "passed");
  assert.equal(metadata.writeSafety.artefacts.includes("write-safety-result.json"), true);
});

test("continue-run write-enabled builder captures write-audit artefacts", async () => {
  const fx = await makeFixture();
  await initGitRepoClean(fx.workspaceRoot);
  const configPath = path.join(fx.orchestratorRoot, fx.configArg);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: false,
    allowedBranches: ["*"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      await writeFile(path.join(fx.workspaceRoot, "cont-stage-r.txt"), "changed\n", "utf8");
      return {
        command: "codex",
        args: [],
        cwd: fx.orchestratorRoot,
        stdout: "out",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "builder result",
        skipped: false
      };
    }
  });
  await access(path.join(fx.runDir, "write-audit/builder/summary.json"));
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as {
    writeAudit: { builder: { status: string } };
  };
  assert.equal(metadata.writeAudit.builder.status, "captured");
});

test("continue-run write-enabled builder without reviewer leaves post-write review pending", async () => {
  const fx = await makeFixture();
  await initGitRepoClean(fx.workspaceRoot);
  const configPath = path.join(fx.orchestratorRoot, fx.configArg);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: true,
    allowedBranches: ["*"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      await writeFile(path.join(fx.workspaceRoot, "pending-review.txt"), "changed\n", "utf8");
      return {
        command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder result", skipped: false
      };
    }
  });
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as {
    postWriteReview: { required: boolean; status: string };
  };
  assert.equal(metadata.postWriteReview.required, true);
  assert.equal(metadata.postWriteReview.status, "pending");
  await access(path.join(fx.runDir, "post-write-review-required.json"));
  await access(path.join(fx.runDir, "post-write-review-status.json"));
});

test("later reviewer continuation completes pending post-write review and receives write-audit context", async () => {
  const fx = await makeFixture();
  await initGitRepoClean(fx.workspaceRoot);
  const configPath = path.join(fx.orchestratorRoot, fx.configArg);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: true,
    allowedBranches: ["*"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      await writeFile(path.join(fx.workspaceRoot, "review-context.txt"), "changed\n", "utf8");
      return {
        command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder result", skipped: false
      };
    }
  });

  let reviewerPrompt = "";
  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeReviewer: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      reviewerPrompt = request.prompt;
      return {
        command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "review", skipped: false
      };
    }
  });
  assert.match(reviewerPrompt, /Write-enabled phases executed: builder/);
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as {
    postWriteReview: { status: string };
  };
  assert.equal(metadata.postWriteReview.status, "completed");
});

test("post-write review requiredByPhases accumulates across builder then fix continuations", async () => {
  const fx = await makeFixture();
  await initGitRepoClean(fx.workspaceRoot);
  const configPath = path.join(fx.orchestratorRoot, fx.configArg);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: false,
    allowedBranches: ["*"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeBuilder: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      await writeFile(path.join(fx.workspaceRoot, "phase-builder.txt"), "changed\n", "utf8");
      return {
        command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder result", skipped: false
      };
    }
  });

  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.phases.fixPlanning.status = "executed";
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  await writeFile(path.join(fx.runDir, "review-to-fix-decision.json"), JSON.stringify({ decision: "FIX_REQUIRED" }), "utf8");
  await writeFile(path.join(fx.runDir, "fix-prompt.extracted.md"), "apply fix", "utf8");

  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeFix: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      await writeFile(path.join(fx.workspaceRoot, "phase-fix.txt"), "changed\n", "utf8");
      return {
        command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "fix result", skipped: false
      };
    }
  });

  const updated = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as {
    postWriteReview: { status: string; requiredByPhases: string[] };
  };
  assert.equal(updated.postWriteReview.status, "pending");
  assert.deepEqual(updated.postWriteReview.requiredByPhases, ["builder", "fixExecution"]);
});

test("continue-run write-enabled fix captures write-audit artefacts", async () => {
  const fx = await makeFixture();
  await initGitRepoClean(fx.workspaceRoot);
  const configPath = path.join(fx.orchestratorRoot, fx.configArg);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: true,
    allowedBranches: ["*"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as RunMetadata;
  metadata.phases.fixPlanning.status = "executed";
  await writeFile(path.join(fx.runDir, "run.json"), JSON.stringify(metadata, null, 2), "utf8");
  await writeFile(path.join(fx.runDir, "review-to-fix-decision.json"), JSON.stringify({ decision: "FIX_REQUIRED" }), "utf8");
  await writeFile(path.join(fx.runDir, "fix-prompt.extracted.md"), "apply fix", "utf8");

  await continueRun({
    runId: fx.runId,
    configArg: fx.configArg,
    executeFix: true,
    allowWrites: true,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fx.orchestratorRoot,
    codexExecutor: async (request) => {
      await writeFile(path.join(fx.workspaceRoot, "continue-fix.txt"), "changed\n", "utf8");
      return {
        command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "fix result", skipped: false
      };
    }
  });
  await access(path.join(fx.runDir, "write-audit/fix/summary.json"));
  const updated = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as { writeAudit: { fix: { status: string } } };
  assert.equal(updated.writeAudit.fix.status, "captured");
});

test("continue-run read-only or dry-run fix does not capture write-audit", async () => {
  const fxReadOnly = await makeFixture();
  const m1 = JSON.parse(await readFile(path.join(fxReadOnly.runDir, "run.json"), "utf8")) as RunMetadata;
  m1.phases.fixPlanning.status = "executed";
  await writeFile(path.join(fxReadOnly.runDir, "run.json"), JSON.stringify(m1, null, 2), "utf8");
  await writeFile(path.join(fxReadOnly.runDir, "review-to-fix-decision.json"), JSON.stringify({ decision: "FIX_REQUIRED" }), "utf8");
  await writeFile(path.join(fxReadOnly.runDir, "fix-prompt.extracted.md"), "apply fix", "utf8");
  await continueRun({
    runId: fxReadOnly.runId,
    configArg: fxReadOnly.configArg,
    executeFix: true,
    allowWrites: false,
    dryRun: false,
    verbose: false,
    orchestratorRoot: fxReadOnly.orchestratorRoot,
    codexExecutor: async (request) => ({
      command: "codex", args: [], cwd: fxReadOnly.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
      outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "fix result", skipped: false
    })
  });
  await assert.rejects(access(path.join(fxReadOnly.runDir, "write-audit/fix/summary.json")));

  const fxDryRun = await makeFixture();
  const m2 = JSON.parse(await readFile(path.join(fxDryRun.runDir, "run.json"), "utf8")) as RunMetadata;
  m2.phases.fixPlanning.status = "executed";
  await writeFile(path.join(fxDryRun.runDir, "run.json"), JSON.stringify(m2, null, 2), "utf8");
  await writeFile(path.join(fxDryRun.runDir, "review-to-fix-decision.json"), JSON.stringify({ decision: "PROCEED" }), "utf8");
  await continueRun({
    runId: fxDryRun.runId,
    configArg: fxDryRun.configArg,
    executeFix: true,
    allowWrites: true,
    dryRun: true,
    verbose: false,
    orchestratorRoot: fxDryRun.orchestratorRoot
  });
  await assert.rejects(access(path.join(fxDryRun.runDir, "write-audit/fix/summary.json")));
});

test("continue-run builder audit failure path preserves execution failure and records audit state", async () => {
  const fx = await makeFixture();
  await initGitRepoClean(fx.workspaceRoot);
  const configPath = path.join(fx.orchestratorRoot, fx.configArg);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: true,
    allowedBranches: ["*"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  await assert.rejects(
    () =>
      continueRun({
        runId: fx.runId,
        configArg: fx.configArg,
        executeBuilder: true,
        allowWrites: true,
        dryRun: false,
        verbose: false,
        orchestratorRoot: fx.orchestratorRoot,
        codexExecutor: async (request) => {
          await rm(path.join(fx.workspaceRoot, ".git"), { recursive: true, force: true });
          return {
            command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "boom", exitCode: 7, signal: null, durationMs: 1, success: false,
            outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder failed", skipped: false
          };
        }
      }),
    /Builder execution failed with exit code 7/
  );
  const updated = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as {
    status: string;
    writeAudit: { builder: { status: string; reason?: string } };
  };
  assert.equal(updated.status, "failed");
  assert.equal(updated.writeAudit.builder.status, "partial");
  assert.match(updated.writeAudit.builder.reason ?? "", /post-builder/);
});

test("continue-run write-enabled builder pre-capture failure is attributed to builder and skips builder execution", async () => {
  const fx = await makeFixture();
  await initGitRepoClean(fx.workspaceRoot);
  const configPath = path.join(fx.orchestratorRoot, fx.configArg);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: true,
    allowedBranches: ["*"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  let calls = 0;
  await assert.rejects(
    () =>
      continueRun({
        runId: fx.runId,
        configArg: fx.configArg,
        executeBuilder: true,
        allowWrites: true,
        dryRun: false,
        verbose: false,
        orchestratorRoot: fx.orchestratorRoot,
        writeAuditPreCapture: async ({ phase }) => {
          if (phase === "builder") {
            throw new Error("simulated pre-capture boom");
          }
          throw new Error("unexpected phase");
        },
        codexExecutor: async (request) => {
          calls += 1;
          return {
            command: "codex", args: [], cwd: fx.orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
            outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder result", skipped: false
          };
        }
      }),
    /Builder write-audit pre-capture failed: simulated pre-capture boom/
  );
  assert.equal(calls, 0);
  const metadata = JSON.parse(await readFile(path.join(fx.runDir, "run.json"), "utf8")) as {
    phases: { builder: { status: string } };
    writeAudit: { builder: { status: string; reason?: string } };
    error: { failedPhase?: string } | null;
  };
  assert.equal(metadata.phases.builder.status, "failed");
  assert.equal(metadata.writeAudit.builder.status, "failed");
  assert.match(metadata.writeAudit.builder.reason ?? "", /pre-capture failed/);
  assert.equal(metadata.error?.failedPhase, "builder");
});

test("continue-run reviewer-only rejects allowWrites clearly", async () => {
  const fx = await makeFixture();
  await assert.rejects(
    () =>
      continueRun({
        runId: fx.runId,
        configArg: fx.configArg,
        executeReviewer: true,
        allowWrites: true,
        dryRun: false,
        verbose: false,
        orchestratorRoot: fx.orchestratorRoot
      }),
    /--allow-writes requires at least one write-eligible continuation phase/
  );
});
