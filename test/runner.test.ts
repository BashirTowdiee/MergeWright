import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, access, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createProgressLogger } from "../src/progress-logger.js";
import { runStage } from "../src/runner.js";
import type { CodexExecutionResult } from "../src/codex.js";

const execFileAsync = promisify(execFile);

function makeProgressCapture(verbose = false): { lines: string[]; logger: ReturnType<typeof createProgressLogger> } {
  const lines: string[] = [];
  return {
    lines,
    logger: createProgressLogger((line) => lines.push(line), { verbose })
  };
}

async function makeFixture(options?: {
  runsDir?: string;
  manualCommit?: boolean;
  workspaceRoot?: string;
  projectName?: string;
}): Promise<{ orchestratorRoot: string; configPath: string; workspaceRoot: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-"));
  const workspaceRoot = options?.workspaceRoot ?? (await mkdtemp(path.join(os.tmpdir(), "target-")));

  await mkdir(path.join(workspaceRoot, ".git"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "stages/acme"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "prompts"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs/acme"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });

  await writeFile(path.join(orchestratorRoot, "stages/acme/example-stage.md"), "Stage instruction", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/planner-stage.md"), "{{stage_name}}|{{workspace_root}}|{{run_dir}}", "utf8");
  await writeFile(
    path.join(orchestratorRoot, "prompts/reviewer.md"),
    [
      "SCOPE={{stage_e_execution_scope}}",
      "STATE={{builder_execution_state}}",
      "PLANNER={{planner_output}}",
      "EXTRACTED={{extracted_builder_prompt}}",
      "BUILDER={{builder_output}}",
      "WRITE_AUDIT={{write_audit_context}}"
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(orchestratorRoot, "prompts/review-to-fix.md"),
    [
      "PLANNER={{planner_output}}",
      "EXTRACTED={{extracted_builder_prompt}}",
      "BUILDER={{builder_output}}",
      "REVIEW={{review_output}}",
      "REVIEWER_EXIT={{reviewer_exit}}",
      "NO_EXECUTE_FIX"
    ].join("\n"),
    "utf8"
  );
  await writeFile(path.join(orchestratorRoot, "prompts/final-review.md"), "{{review_output}}", "utf8");

  const configPath = path.join(orchestratorRoot, "configs/acme.json");
  await writeFile(
    configPath,
    JSON.stringify(
      {
        version: 1,
        projectName: options?.projectName ?? "acme",
        workspaceRoot,
        paths: {
          stagesDir: "stages/acme",
          promptsDir: "prompts",
          runsDir: options?.runsDir ?? "runs/acme"
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
          manualCommit: options?.manualCommit ?? true,
          forbidAutoCommit: true,
          forbidAutoPush: true
        }
      },
      null,
      2
    ),
    "utf8"
  );

  return { orchestratorRoot, configPath, workspaceRoot };
}

async function initGitRepoClean(workspaceRoot: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: workspaceRoot });
  await execFileAsync("git", ["config", "user.email", "orchestrator@example.com"], { cwd: workspaceRoot });
  await execFileAsync("git", ["config", "user.name", "Orchestrator Tests"], { cwd: workspaceRoot });
  await writeFile(path.join(workspaceRoot, "README.md"), "fixture\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: workspaceRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: workspaceRoot });
}

test("runsDir invariant passes for projectName Acme and runs/acme", async () => {
  const { orchestratorRoot, configPath } = await makeFixture({
    projectName: "Acme",
    runsDir: "runs/acme"
  });
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    verbose: false,
    orchestratorRoot
  });
  assert.match(result.runDir, /runs\/acme\//);
});

test("runsDir invariant fails for mismatched runs dir", async () => {
  const { orchestratorRoot, configPath } = await makeFixture({
    projectName: "Acme",
    runsDir: "runs/other"
  });
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: false,
        executeBuilder: false,
        verbose: false,
        orchestratorRoot
      }),
    /paths\.runsDir must resolve to runs\/<projectName>/
  );
});

test("runsDir outside orchestrator root still fails", async () => {
  const { orchestratorRoot, configPath } = await makeFixture({ runsDir: "../runs/acme" });
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: false,
        executeBuilder: false,
        verbose: false,
        orchestratorRoot
      }),
    /paths\.runsDir must resolve inside orchestrator root/
  );
});

test("runsDir inside target workspace still fails", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const workspaceRoot = path.join(orchestratorRoot, "target-workspace");
  await mkdir(path.join(workspaceRoot, ".git"), { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify(
      {
        version: 1,
        projectName: "acme",
        workspaceRoot,
        paths: {
          stagesDir: "stages/acme",
          promptsDir: "prompts",
          runsDir: "target-workspace/runs/acme"
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
      },
      null,
      2
    ),
    "utf8"
  );
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: false,
        executeBuilder: false,
        verbose: false,
        orchestratorRoot
      }),
    /paths\.runsDir must not resolve inside target workspace/
  );
});

test("default mode still does not execute planner or builder or reviewer", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let called = 0;

  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async () => {
      called += 1;
      throw new Error("should not run");
    }
  });

  assert.equal(called, 0);
  const placeholder = await readFile(path.join(result.runDir, "03-planner-output.placeholder.md"), "utf8");
  assert.match(placeholder, /disabled/);
  const reviewerPlaceholder = await readFile(path.join(result.runDir, "reviewer-output.placeholder.md"), "utf8");
  assert.match(reviewerPlaceholder, /not requested/);
  await assert.rejects(access(path.join(result.runDir, "fix-exit.json")));
});

test("--plan-html writes plan.html visualisation", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    verbose: false,
    planHtml: true,
    orchestratorRoot
  });
  const html = await readFile(path.join(result.runDir, "plan.html"), "utf8");
  assert.match(html, /Planner Summary/);
  assert.match(html, /Phase Flow/);
  assert.match(html, /Acceptance Criteria/);
  assert.match(html, /visualisation only/i);
});

test("runner passes codex stream callbacks when --stream-codex is enabled", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const streamOptionCalls: Array<{ hasStdout: boolean; hasStderr: boolean }> = [];
  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    verbose: false,
    streamCodex: true,
    orchestratorRoot,
    codexExecutor: async (request, streamOptions) => {
      streamOptionCalls.push({
        hasStdout: typeof streamOptions?.onStdoutChunk === "function",
        hasStderr: typeof streamOptions?.onStderrChunk === "function"
      });
      streamOptions?.onStdoutChunk?.("live-out");
      streamOptions?.onStderrChunk?.("live-err");
      return {
        command: "codex",
        args: [],
        cwd: orchestratorRoot,
        stdout: "captured-out",
        stderr: "captured-err",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: request.role === "planner" ? "## DECISION\nBUILD\n## FINAL BUILDER PROMPT\nbuilder prompt" : "ok",
        skipped: false
      };
    }
  });
  assert.ok(streamOptionCalls.length >= 3);
  assert.ok(streamOptionCalls.every((call) => call.hasStdout && call.hasStderr));
});

test("executeBuilder without executePlanner fails fast before any execution or workspace writes", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  const sentinel = path.join(workspaceRoot, "unchanged.txt");
  await writeFile(sentinel, "initial", "utf8");
  let called = 0;

  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: false,
        executeBuilder: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async () => {
          called += 1;
          throw new Error("should not run");
        }
      }),
    /--execute-builder requires --execute-planner/
  );

  assert.equal(called, 0);
  const content = await readFile(sentinel, "utf8");
  assert.equal(content, "initial");
  await assert.rejects(access(path.join(workspaceRoot, "runs")));
});

test("executePlanner + executeBuilder + dry-run skips both executions", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let called = 0;

  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: true,
    executeBuilder: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async () => {
      called += 1;
      throw new Error("should not run");
    }
  });

  assert.equal(called, 0);
  const exitMeta = JSON.parse(await readFile(path.join(result.runDir, "07-planner-exit.json"), "utf8")) as {
    skipped: boolean;
  };
  assert.equal(exitMeta.skipped, true);
  const builderPlaceholder = await readFile(path.join(result.runDir, "builder-output.placeholder.md"), "utf8");
  assert.match(builderPlaceholder, /skipped because dryRun=true/);
  const reviewerPlaceholder = await readFile(path.join(result.runDir, "reviewer-output.placeholder.md"), "utf8");
  assert.match(reviewerPlaceholder, /skipped because dryRun=true/);
  await assert.rejects(access(path.join(result.runDir, "builder-exit.json")));
});

test("run dry-run with --stream-codex does not execute codex", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let called = 0;
  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: true,
    executeBuilder: true,
    verbose: false,
    streamCodex: true,
    orchestratorRoot,
    codexExecutor: async () => {
      called += 1;
      throw new Error("should not run");
    }
  });
  assert.equal(called, 0);
});

test("executePlanner + executeBuilder + executeReviewer + dry-run skips all executions and writes reviewer skipped artefact", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  const sentinel = path.join(workspaceRoot, "unchanged.txt");
  await writeFile(sentinel, "initial", "utf8");
  let called = 0;

  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async () => {
      called += 1;
      throw new Error("should not run");
    }
  });

  assert.equal(called, 0);
  const plannerExit = JSON.parse(await readFile(path.join(result.runDir, "07-planner-exit.json"), "utf8")) as { skipped: boolean };
  assert.equal(plannerExit.skipped, true);
  const builderPlaceholder = await readFile(path.join(result.runDir, "builder-output.placeholder.md"), "utf8");
  assert.match(builderPlaceholder, /skipped because dryRun=true/);
  const reviewerPlaceholder = await readFile(path.join(result.runDir, "reviewer-output.placeholder.md"), "utf8");
  assert.match(reviewerPlaceholder, /skipped because dryRun=true/);
  const reviewerSkipped = JSON.parse(await readFile(path.join(result.runDir, "reviewer-skipped.json"), "utf8")) as {
    skipped: boolean;
    reason: string;
  };
  assert.equal(reviewerSkipped.skipped, true);
  assert.match(reviewerSkipped.reason, /dryRun=true/);
  const content = await readFile(sentinel, "utf8");
  assert.equal(content, "initial");
  await assert.rejects(access(path.join(workspaceRoot, "runs")));
});

test("dry-run emits phase progress logs and completion summary", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const progress = makeProgressCapture();

  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    runChecks: true,
    verbose: false,
    orchestratorRoot,
    progressLogger: progress.logger
  });

  const text = progress.lines.join("\n");
  assert.match(text, /Running stage: example-stage/);
  assert.match(text, /\[planner\] skipped by dry-run/);
  assert.match(text, /\[builder\] skipped by dry-run/);
  assert.match(text, /\[reviewer\] skipped by dry-run/);
  assert.match(text, /\[fix-planning\] skipped by dry-run/);
  assert.match(text, /\[fix\] skipped by dry-run/);
  assert.match(text, /\[checks\] skipped by dry-run/);
  assert.match(text, /Run dry-run completed/);
});

test("phase logs show codex waiting and do not include codex stdout/stderr payloads", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const progress = makeProgressCapture();
  const stdoutMarker = "planner-stdout-should-not-be-printed";
  const stderrMarker = "builder-stderr-should-not-be-printed";
  let calls = 0;

  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    verbose: false,
    orchestratorRoot,
    progressLogger: progress.logger,
    codexExecutor: async (request) => {
      calls += 1;
      if (request.role === "planner") {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: stdoutMarker,
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 10,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage D builder",
          skipped: false
        };
      }
      if (request.role === "builder") {
        return {
          command: "codex",
          args: ["exec", "builder"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: stderrMarker,
          exitCode: 0,
          signal: null,
          durationMs: 10,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "builder output",
          skipped: false
        };
      }
      return {
        command: "codex",
        args: ["exec", "reviewer"],
        cwd: orchestratorRoot,
        stdout: "reviewer stdout marker",
        stderr: "reviewer stderr marker",
        exitCode: 0,
        signal: null,
        durationMs: 10,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "review output",
        skipped: false
      };
    }
  });

  assert.equal(calls, 3);
  const text = progress.lines.join("\n");
  assert.match(text, /\[planner\] waiting for Codex\.\.\./);
  assert.match(text, /\[builder\] waiting for Codex\.\.\./);
  assert.match(text, /\[reviewer\] waiting for Codex\.\.\./);
  assert.match(text, /\[planner\] completed in /);
  assert.match(text, /\[builder\] completed in /);
  assert.match(text, /\[reviewer\] completed in /);
  assert.doesNotMatch(text, new RegExp(stdoutMarker));
  assert.doesNotMatch(text, new RegExp(stderrMarker));
});

test("stream mode emits codex stream boundaries on successful run phase", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const progress = makeProgressCapture();
  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    verbose: false,
    streamCodex: true,
    orchestratorRoot,
    progressLogger: progress.logger,
    codexExecutor: async (request, streamOptions) => {
      streamOptions?.onStdoutChunk?.("planner live out\n");
      return {
        command: "codex",
        args: [],
        cwd: orchestratorRoot,
        stdout: "planner live out\n",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage D builder",
        skipped: false
      };
    }
  });
  const text = progress.lines.join("\n");
  assert.match(text, /\[planner\] Codex stream start/);
  assert.match(text, /\[planner\] Codex stream end/);
});

test("stream mode emits codex stream boundaries on failed run phase", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const progress = makeProgressCapture();
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        verbose: false,
        streamCodex: true,
        orchestratorRoot,
        progressLogger: progress.logger,
        codexExecutor: async (request, streamOptions) => {
          streamOptions?.onStderrChunk?.("planner live err\n");
          return {
            command: "codex",
            args: [],
            cwd: orchestratorRoot,
            stdout: "",
            stderr: "planner live err\n",
            exitCode: 2,
            signal: null,
            durationMs: 1,
            success: false,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "failed",
            skipped: false
          };
        }
      }),
    /Planner execution failed/
  );
  const text = progress.lines.join("\n");
  assert.match(text, /\[planner\] Codex stream start/);
  assert.match(text, /\[planner\] Codex stream end/);
});

test("verbose mode includes model and sandbox details", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const progress = makeProgressCapture(true);

  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    verbose: true,
    orchestratorRoot,
    progressLogger: progress.logger,
    codexExecutor: async (request) => ({
      command: "codex",
      args: [],
      cwd: orchestratorRoot,
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 1,
      success: true,
      outputLastMessagePath: request.outputLastMessagePath,
      outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage D builder",
      skipped: false
    })
  });

  const text = progress.lines.join("\n");
  assert.match(text, /Config: /);
  assert.match(text, /planner model=gpt-5\.3-codex reasoning=high sandbox=read-only/);
});

test("failure logs include failed phase and diagnostics path", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const progress = makeProgressCapture();

  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        verbose: false,
        orchestratorRoot,
        progressLogger: progress.logger,
        codexExecutor: async (request) => {
          if (request.role === "planner") {
            return {
              command: "codex",
              args: [],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage D builder",
              skipped: false
            };
          }
          return {
            command: "codex",
            args: [],
            cwd: orchestratorRoot,
            stdout: "",
            stderr: "",
            exitCode: 2,
            signal: null,
            durationMs: 1,
            success: false,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "builder failure",
            skipped: false
          };
        }
      }),
    /Builder execution failed/
  );

  const text = progress.lines.join("\n");
  assert.match(text, /Run failed during phase: builder/);
  assert.match(text, /Diagnostics: /);
});

test("planner execution only extracts builder prompt, renders reviewer preview, and does not call builder/reviewer executor", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  let called = 0;

  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: false,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      called += 1;
      assert.equal(request.role, "planner");
      assert.equal(request.workspaceRoot, workspaceRoot);
      const execResult: CodexExecutionResult = {
        command: "codex",
        args: ["exec", "-"],
        cwd: orchestratorRoot,
        stdout: "planner stdout",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 12,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement X\n\nValidate Y",
        skipped: false
      };
      return execResult;
    }
  });

  assert.equal(called, 1);
  const extractedPrompt = await readFile(path.join(result.runDir, "builder-prompt.extracted.md"), "utf8");
  assert.equal(extractedPrompt, "Implement X\n\nValidate Y");
  const builderPlaceholder = await readFile(path.join(result.runDir, "builder-output.placeholder.md"), "utf8");
  assert.match(builderPlaceholder, /not requested/);
  const reviewerPromptPreview = await readFile(path.join(result.runDir, "08-reviewer-prompt.preview.md"), "utf8");
  assert.match(reviewerPromptPreview, /EXTRACTED=Implement X/);
  assert.match(reviewerPromptPreview, /STATE=Builder was not executed in Stage E/);
  const reviewerPlaceholder = await readFile(path.join(result.runDir, "reviewer-output.placeholder.md"), "utf8");
  assert.match(reviewerPlaceholder, /not requested/);
  await assert.rejects(access(path.join(result.runDir, "builder-exit.json")));
});

test("planner + builder execution calls injected executor twice with correct role and builder config", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const calls: Array<{ role: string; model: string; reasoningEffort: string; prompt: string }> = [];

  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      calls.push({
        role: request.role,
        model: request.model,
        reasoningEffort: request.reasoningEffort,
        prompt: request.prompt
      });

      if (request.role === "planner") {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "planner stdout",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 10,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage D builder",
          skipped: false
        };
      }

      return {
        command: "codex",
        args: ["exec", "builder"],
        cwd: orchestratorRoot,
        stdout: "builder stdout",
        stderr: "builder stderr",
        exitCode: 0,
        signal: null,
        durationMs: 15,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "builder final",
        skipped: false
      };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].role, "planner");
  assert.equal(calls[1].role, "builder");
  assert.equal(calls[1].model, "gpt-5.3-codex");
  assert.equal(calls[1].reasoningEffort, "medium");
  assert.equal(calls[1].prompt, "Implement Stage D builder");

  const executedPrompt = await readFile(path.join(result.runDir, "builder-prompt.executed.md"), "utf8");
  assert.equal(executedPrompt, "Implement Stage D builder");
  const builderStdout = await readFile(path.join(result.runDir, "builder-stdout.log"), "utf8");
  assert.equal(builderStdout, "builder stdout");
  const builderExit = JSON.parse(await readFile(path.join(result.runDir, "builder-exit.json"), "utf8")) as {
    success: boolean;
    code: number;
  };
  assert.equal(builderExit.success, true);
  assert.equal(builderExit.code, 0);
  const reviewerPromptPreview = await readFile(path.join(result.runDir, "08-reviewer-prompt.preview.md"), "utf8");
  assert.match(reviewerPromptPreview, /BUILDER=builder final/);
  assert.match(reviewerPromptPreview, /STATE=Builder executed/);
});

test("executeReviewer without executePlanner fails fast before any execution", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let called = 0;

  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: false,
        executeBuilder: false,
        executeReviewer: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async () => {
          called += 1;
          throw new Error("should not run");
        }
      }),
    /--execute-reviewer requires --execute-planner/
  );

  assert.equal(called, 0);
});

test("planFix true without reviewer enabled fails at runner level", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: false,
        executeReviewer: false,
        planFix: true,
        verbose: false,
        orchestratorRoot
      }),
    /--plan-fix requires --execute-reviewer/
  );
});

test("executeFix true without planFix enabled fails at runner level", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: false,
        executeReviewer: true,
        planFix: false,
        executeFix: true,
        verbose: false,
        orchestratorRoot
      }),
    /--execute-fix requires --plan-fix/
  );
});

test("planner + reviewer mode calls injected executor twice and reviewer uses reviewer model/reasoning", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const calls: Array<{ role: string; model: string; reasoningEffort: string; prompt: string }> = [];

  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: false,
    executeReviewer: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      calls.push({ role: request.role, model: request.model, reasoningEffort: request.reasoningEffort, prompt: request.prompt });
      if (request.role === "planner") {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "planner stdout",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 10,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage D builder",
          skipped: false
        };
      }
      return {
        command: "codex",
        args: ["exec", "reviewer"],
        cwd: orchestratorRoot,
        stdout: "reviewer stdout",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 11,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "reviewer final",
        skipped: false
      };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].role, "planner");
  assert.equal(calls[1].role, "reviewer");
  assert.equal(calls[1].model, "gpt-5.3-codex");
  assert.equal(calls[1].reasoningEffort, "high");
  assert.match(calls[1].prompt, /EXTRACTED=Implement Stage D builder/);
  assert.match(calls[1].prompt, /STATE=Builder was not executed in Stage E/);

  const reviewerExit = JSON.parse(await readFile(path.join(result.runDir, "reviewer-exit.json"), "utf8")) as { code: number };
  assert.equal(reviewerExit.code, 0);
  const reviewerStdout = await readFile(path.join(result.runDir, "reviewer-stdout.log"), "utf8");
  assert.equal(reviewerStdout, "reviewer stdout");
  const reviewToFixPlaceholder = await readFile(path.join(result.runDir, "review-to-fix-output.placeholder.md"), "utf8");
  assert.match(reviewToFixPlaceholder, /not requested/);
});

test("planner + builder + reviewer mode calls injected executor three times in order", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const roles: string[] = [];

  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      roles.push(request.role);
      if (request.role === "planner") {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage E builder",
          skipped: false
        };
      }
      if (request.role === "builder") {
        return {
          command: "codex",
          args: ["exec", "builder"],
          cwd: orchestratorRoot,
          stdout: "builder stdout",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "builder final output",
          skipped: false
        };
      }
      return {
        command: "codex",
        args: ["exec", "reviewer"],
        cwd: orchestratorRoot,
        stdout: "reviewer stdout",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "reviewer final output",
        skipped: false
      };
    }
  });

  assert.deepEqual(roles, ["planner", "builder", "reviewer"]);
});

test("planner + reviewer + planFix dry-run writes skipped artefact and does not call review-to-fix executor", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const roles: string[] = [];
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: true,
    executeReviewer: true,
    planFix: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      roles.push(request.role);
      throw new Error("should not run");
    }
  });
  assert.deepEqual(roles, []);
  const skipped = JSON.parse(await readFile(path.join(result.runDir, "review-to-fix-skipped.json"), "utf8")) as {
    skipped: boolean;
    reason: string;
  };
  assert.equal(skipped.skipped, true);
  assert.match(skipped.reason, /dryRun=true/);
});

test("planner + reviewer + planFix calls injected executor in planner, reviewer, review-to-fix order", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const roles: string[] = [];
  const calls: Array<{ role: string; model: string; reasoningEffort: string }> = [];
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeReviewer: true,
    planFix: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      roles.push(request.role);
      calls.push({ role: request.role, model: request.model, reasoningEffort: request.reasoningEffort });
      if (roles.length === 1) {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage F builder prompt",
          skipped: false
        };
      }
      if (roles.length === 2) {
        return {
          command: "codex",
          args: ["exec", "reviewer"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "reviewer output",
          skipped: false
        };
      }
      return {
        command: "codex",
        args: ["exec", "planner"],
        cwd: orchestratorRoot,
        stdout: "rtf stdout",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "## DECISION\nPROCEED\n\n## RATIONALE\nNo blocking issues.",
        skipped: false
      };
    }
  });
  assert.deepEqual(roles, ["planner", "reviewer", "planner"]);
  assert.equal(calls[2].model, "gpt-5.3-codex");
  assert.equal(calls[2].reasoningEffort, "high");
  const decision = JSON.parse(await readFile(path.join(result.runDir, "review-to-fix-decision.json"), "utf8")) as {
    decision: string;
  };
  assert.equal(decision.decision, "PROCEED");
  await assert.rejects(access(path.join(result.runDir, "fix-prompt.extracted.md")));
  const fixSkipped = JSON.parse(await readFile(path.join(result.runDir, "fix-skipped.json"), "utf8")) as {
    skipped: boolean;
    reason: string;
  };
  assert.equal(fixSkipped.skipped, true);
  assert.equal(fixSkipped.reason, "review-to-fix decision was PROCEED");
});

test("planner + builder + reviewer + planFix calls injected executor in order and writes FIX_REQUIRED prompt", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const roles: string[] = [];
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      roles.push(request.role);
      if (roles.length === 1) {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
          skipped: false
        };
      }
      if (roles.length === 2) {
        return {
          command: "codex",
          args: ["exec", "builder"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "builder output",
          skipped: false
        };
      }
      if (roles.length === 3) {
        return {
          command: "codex",
          args: ["exec", "reviewer"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "reviewer output with deterministic bug",
          skipped: false
        };
      }
      return {
        command: "codex",
        args: ["exec", "planner"],
        cwd: orchestratorRoot,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage:
          "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nDeterministic defect.\n\n## FINAL FIX PROMPT\nApply minimal fix.",
        skipped: false
      };
    }
  });

  assert.deepEqual(roles, ["planner", "builder", "reviewer", "planner"]);
  const decision = JSON.parse(await readFile(path.join(result.runDir, "review-to-fix-decision.json"), "utf8")) as {
    decision: string;
  };
  assert.equal(decision.decision, "FIX_REQUIRED");
  const fixPrompt = await readFile(path.join(result.runDir, "fix-prompt.extracted.md"), "utf8");
  assert.equal(fixPrompt, "Apply minimal fix.");
  const fixSkipped = JSON.parse(await readFile(path.join(result.runDir, "fix-skipped.json"), "utf8")) as {
    skipped: boolean;
    reason: string;
  };
  assert.equal(fixSkipped.skipped, true);
  assert.equal(fixSkipped.reason, "fix execution disabled");
});

test("planner + reviewer + planFix + executeFix + proceed writes skipped artefact and does not call fix executor", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const roles: string[] = [];
  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      roles.push(request.role);
      if (roles.length === 1) {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
          skipped: false
        };
      }
      if (roles.length === 2) {
        return {
          command: "codex",
          args: ["exec", "reviewer"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "reviewer output",
          skipped: false
        };
      }
      return {
        command: "codex",
        args: ["exec", "planner"],
        cwd: orchestratorRoot,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "## DECISION\nPROCEED\n\n## RATIONALE\nShip it.",
        skipped: false
      };
    }
  });
  assert.deepEqual(roles, ["planner", "reviewer", "planner"]);
});

test("planner + reviewer + planFix + executeFix + fix_required executes fix with builder model/reasoning and writes diagnostics", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const calls: Array<{ role: string; model: string; reasoningEffort: string; prompt: string }> = [];
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      calls.push({ role: request.role, model: request.model, reasoningEffort: request.reasoningEffort, prompt: request.prompt });
      if (calls.length === 1) {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
          skipped: false
        };
      }
      if (calls.length === 2) {
        return {
          command: "codex",
          args: ["exec", "reviewer"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "reviewer output",
          skipped: false
        };
      }
      if (calls.length === 3) {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage:
            "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nFix needed.\n\n## FINAL FIX PROMPT\nApply focused fix.",
          skipped: false
        };
      }
      return {
        command: "codex",
        args: ["exec", "builder"],
        cwd: orchestratorRoot,
        stdout: "fix stdout",
        stderr: "fix stderr",
        exitCode: 0,
        signal: null,
        durationMs: 2,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "fix output final",
        skipped: false
      };
    }
  });
  assert.deepEqual(
    calls.map((call) => call.role),
    ["planner", "reviewer", "planner", "builder"]
  );
  assert.equal(calls[3].model, "gpt-5.3-codex");
  assert.equal(calls[3].reasoningEffort, "medium");
  assert.equal(calls[3].prompt, "Apply focused fix.");
  assert.equal(await readFile(path.join(result.runDir, "fix-prompt.executed.md"), "utf8"), "Apply focused fix.");
  assert.equal(await readFile(path.join(result.runDir, "fix-output-last-message.md"), "utf8"), "fix output final");
  const fixExit = JSON.parse(await readFile(path.join(result.runDir, "fix-exit.json"), "utf8")) as { success: boolean; code: number };
  assert.equal(fixExit.success, true);
  assert.equal(fixExit.code, 0);
});

test("planner + builder + reviewer + planFix + executeFix calls injected executor in order", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const roles: string[] = [];
  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      roles.push(request.role);
      if (roles.length === 1) {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
          skipped: false
        };
      }
      if (roles.length === 2) {
        return {
          command: "codex",
          args: ["exec", "builder"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "builder output",
          skipped: false
        };
      }
      if (roles.length === 3) {
        return {
          command: "codex",
          args: ["exec", "reviewer"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "reviewer output",
          skipped: false
        };
      }
      if (roles.length === 4) {
        return {
          command: "codex",
          args: ["exec", "planner"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nFix.\n\n## FINAL FIX PROMPT\nApply fix now.",
          skipped: false
        };
      }
      return {
        command: "codex",
        args: ["exec", "builder"],
        cwd: orchestratorRoot,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: "fix done",
        skipped: false
      };
    }
  });
  assert.deepEqual(roles, ["planner", "builder", "reviewer", "planner", "builder"]);
});

test("fix execution failure writes diagnostics before throwing", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  const sentinel = path.join(workspaceRoot, "unchanged.txt");
  await writeFile(sentinel, "initial", "utf8");
  let callCount = 0;
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeReviewer: true,
        planFix: true,
        executeFix: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          callCount += 1;
          if (callCount === 1) {
            return {
              command: "codex",
              args: ["exec", "planner"],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
              skipped: false
            };
          }
          if (callCount === 2) {
            return {
              command: "codex",
              args: ["exec", "reviewer"],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "reviewer output",
              skipped: false
            };
          }
          if (callCount === 3) {
            return {
              command: "codex",
              args: ["exec", "planner"],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nFix.\n\n## FINAL FIX PROMPT\nApply fix.",
              skipped: false
            };
          }
          return {
            command: "codex",
            args: ["exec", "builder"],
            cwd: orchestratorRoot,
            stdout: "fix stdout",
            stderr: "fix boom",
            exitCode: 21,
            signal: null,
            durationMs: 1,
            success: false,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "fix failed",
            skipped: false
          };
        }
      }),
    /Fix execution failed/
  );
  const runsBase = path.join(orchestratorRoot, "runs/acme");
  const dirs = await readdir(runsBase);
  const runDir = path.join(runsBase, dirs[0]);
  const command = JSON.parse(await readFile(path.join(runDir, "fix-command.json"), "utf8")) as { command: string };
  assert.equal(command.command, "codex");
  assert.equal(await readFile(path.join(runDir, "fix-stderr.log"), "utf8"), "fix boom");
  assert.equal(await readFile(path.join(runDir, "fix-stdout.log"), "utf8"), "fix stdout");
  const fixExit = JSON.parse(await readFile(path.join(runDir, "fix-exit.json"), "utf8")) as { success: boolean; code: number };
  assert.equal(fixExit.success, false);
  assert.equal(fixExit.code, 21);
  await assert.rejects(access(path.join(runDir, "review-to-fix-parse-error.json")));
  assert.equal(await readFile(sentinel, "utf8"), "initial");
});

test("review-to-fix failure writes diagnostics before throwing", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let callCount = 0;
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeReviewer: true,
        planFix: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          callCount += 1;
          if (callCount === 1) {
            return {
              command: "codex",
              args: ["exec", "planner"],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
              skipped: false
            };
          }
          if (callCount === 2) {
            return {
              command: "codex",
              args: ["exec", "reviewer"],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "reviewer output",
              skipped: false
            };
          }
          return {
            command: "codex",
            args: ["exec", "planner"],
            cwd: orchestratorRoot,
            stdout: "",
            stderr: "review-to-fix boom",
            exitCode: 13,
            signal: null,
            durationMs: 1,
            success: false,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "failed",
            skipped: false
          };
        }
      }),
    /Review-to-fix execution failed/
  );
  const runsBase = path.join(orchestratorRoot, "runs/acme");
  const dirs = await readdir(runsBase);
  const runDir = path.join(runsBase, dirs[0]);
  const stderr = await readFile(path.join(runDir, "review-to-fix-stderr.log"), "utf8");
  assert.equal(stderr, "review-to-fix boom");
});

test("review-to-fix parse failure writes diagnostics and parse metadata before throwing", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let callCount = 0;
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeReviewer: true,
        planFix: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          callCount += 1;
          if (callCount === 1) {
            return {
              command: "codex",
              args: ["exec", "planner"],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
              skipped: false
            };
          }
          if (callCount === 2) {
            return {
              command: "codex",
              args: ["exec", "reviewer"],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "reviewer output",
              skipped: false
            };
          }
          return {
            command: "codex",
            args: ["exec", "planner"],
            cwd: orchestratorRoot,
            stdout: "",
            stderr: "",
            exitCode: 0,
            signal: null,
            durationMs: 1,
            success: true,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "invalid review-to-fix output",
            skipped: false
          };
        }
      }),
    /Review-to-fix output parsing failed/
  );
  assert.equal(callCount, 3);
  const runsBase = path.join(orchestratorRoot, "runs/acme");
  const dirs = await readdir(runsBase);
  const runDir = path.join(runsBase, dirs[0]);
  const parseFailure = JSON.parse(await readFile(path.join(runDir, "review-to-fix-parse-error.json"), "utf8")) as {
    error: string;
  };
  assert.match(parseFailure.error, /missing required heading "## DECISION"/);
});

test("reviewer failure writes diagnostics before throwing", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();

  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: false,
        executeReviewer: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          if (request.role === "planner") {
            return {
              command: "codex",
              args: ["exec", "planner"],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 1,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage E builder",
              skipped: false
            };
          }
          return {
            command: "codex",
            args: ["exec", "reviewer"],
            cwd: orchestratorRoot,
            stdout: "reviewer stdout",
            stderr: "reviewer boom",
            exitCode: 7,
            signal: null,
            durationMs: 1,
            success: false,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "reviewer final",
            skipped: false
          };
        }
      }),
    /Reviewer execution failed/
  );

  const runsBase = path.join(orchestratorRoot, "runs/acme");
  const dirs = await readdir(runsBase);
  const runDir = path.join(runsBase, dirs[0]);
  const stderr = await readFile(path.join(runDir, "reviewer-stderr.log"), "utf8");
  assert.equal(stderr, "reviewer boom");
  const exit = JSON.parse(await readFile(path.join(runDir, "reviewer-exit.json"), "utf8")) as { code: number };
  assert.equal(exit.code, 7);
});

test("builder failure writes diagnostics before throwing", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();

  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          if (request.role === "planner") {
            return {
              command: "codex",
              args: ["exec", "planner"],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 8,
              success: true,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nImplement Stage D builder",
              skipped: false
            };
          }
          return {
            command: "codex",
            args: ["exec", "builder"],
            cwd: orchestratorRoot,
            stdout: "builder stdout",
            stderr: "builder boom",
            exitCode: 9,
            signal: null,
            durationMs: 11,
            success: false,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "builder final",
            skipped: false
          };
        }
      }),
    /Builder execution failed/
  );

  const runsBase = path.join(orchestratorRoot, "runs/acme");
  const dirs = await readdir(runsBase);
  const runDir = path.join(runsBase, dirs[0]);
  const stderr = await readFile(path.join(runDir, "builder-stderr.log"), "utf8");
  assert.equal(stderr, "builder boom");
  const exit = JSON.parse(await readFile(path.join(runDir, "builder-exit.json"), "utf8")) as { code: number };
  assert.equal(exit.code, 9);
  const reviewerPreview = await readFile(path.join(runDir, "08-reviewer-prompt.preview.md"), "utf8");
  assert.match(reviewerPreview, /EXTRACTED=Implement Stage D builder/);
  const reviewerSkipped = JSON.parse(await readFile(path.join(runDir, "reviewer-skipped.json"), "utf8")) as {
    skipped: boolean;
    reason: string;
  };
  assert.equal(reviewerSkipped.skipped, true);
  assert.match(reviewerSkipped.reason, /builder execution failed/);
});

test("failure path writes planner diagnostics before throwing", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();

  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: false,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => ({
          command: "codex",
          args: ["exec", "-"],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "boom",
          exitCode: 2,
          signal: null,
          durationMs: 7,
          success: false,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "",
          skipped: false
        })
      }),
    /Planner execution failed/
  );

  const runsBase = path.join(orchestratorRoot, "runs/acme");
  const dirs = await readdir(runsBase);
  const runDir = path.join(runsBase, dirs[0]);
  const stderr = await readFile(path.join(runDir, "05-planner-stderr.log"), "utf8");
  assert.equal(stderr, "boom");
  const reviewerPreview = await readFile(path.join(runDir, "08-reviewer-prompt.preview.md"), "utf8");
  assert.match(reviewerPreview, /PLANNER=\[not available\]/);
  const reviewerSkipped = JSON.parse(await readFile(path.join(runDir, "reviewer-skipped.json"), "utf8")) as {
    skipped: boolean;
    reason: string;
  };
  assert.equal(reviewerSkipped.skipped, true);
  assert.match(reviewerSkipped.reason, /planner execution failed/);
});

test("parse failure writes parse diagnostics before throwing", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();

  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: false,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => ({
          command: "codex",
          args: ["exec", "-"],
          cwd: orchestratorRoot,
          stdout: "planner stdout",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 3,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "invalid output",
          skipped: false
        })
      }),
    /Planner output parsing failed/
  );

  const runsBase = path.join(orchestratorRoot, "runs/acme");
  const dirs = await readdir(runsBase);
  const runDir = path.join(runsBase, dirs[0]);

  const rawOutput = await readFile(path.join(runDir, "06-planner-output-last-message.md"), "utf8");
  assert.equal(rawOutput, "invalid output");

  const parseFailure = JSON.parse(await readFile(path.join(runDir, "planner-output-parse-error.json"), "utf8")) as {
    error: string;
  };
  assert.match(parseFailure.error, /missing required heading "## DECISION"/);
});

test("no target workspace writes occur", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  const sentinel = path.join(workspaceRoot, "unchanged.txt");
  await writeFile(sentinel, "initial", "utf8");

  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    verbose: false,
    orchestratorRoot
  });

  const content = await readFile(sentinel, "utf8");
  assert.equal(content, "initial");
  await assert.rejects(access(path.join(workspaceRoot, "runs")));
});

test("default mode does not run checks", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let called = 0;
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    runChecks: false,
    verbose: false,
    orchestratorRoot,
    checkCommandExecutor: async () => {
      called += 1;
      throw new Error("should not run");
    }
  });
  assert.equal(called, 0);
  assert.equal(result.checksState, "disabled");
  const status = JSON.parse(await readFile(path.join(result.runDir, "checks-status.json"), "utf8")) as { state: string };
  assert.equal(status.state, "disabled");
});

test("runChecks true with dryRun skips checks without calling executor", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let called = 0;
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: false,
    executeBuilder: false,
    runChecks: true,
    verbose: false,
    orchestratorRoot,
    checkCommandExecutor: async () => {
      called += 1;
      throw new Error("should not run");
    }
  });
  assert.equal(called, 0);
  assert.equal(result.checksState, "skipped by dry-run");
  const status = JSON.parse(await readFile(path.join(result.runDir, "checks-status.json"), "utf8")) as { state: string };
  assert.equal(status.state, "skipped by dry-run");
});

test("runChecks true with empty checks writes no-checks-configured artefact", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    runChecks: true,
    verbose: false,
    orchestratorRoot
  });
  const status = JSON.parse(await readFile(path.join(result.runDir, "checks-status.json"), "utf8")) as {
    noChecksConfigured?: boolean;
  };
  assert.equal(status.noChecksConfigured, true);
});

test("runChecks true writes check artefacts for passing command", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  await writeFile(
    configPath,
    JSON.stringify(
      {
        version: 1,
        projectName: "acme",
        workspaceRoot: await mkdtemp(path.join(os.tmpdir(), "target-")),
        paths: { stagesDir: "stages/acme", promptsDir: "prompts", runsDir: "runs/acme" },
        codex: {
          planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
          builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
          reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
        },
        pipeline: { finalReview: true, maxFixLoops: 1 },
        commands: { checks: [{ name: "unit-tests", command: "npm", args: ["test"], cwd: "orchestrator" }] },
        safety: {
          requireGitRepo: false,
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

  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    runChecks: true,
    verbose: false,
    orchestratorRoot,
    checkCommandExecutor: async (command) => ({
      ...command,
      stdout: "ok",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 4,
      success: true
    })
  });

  assert.equal(result.checksState, "executed");
  await access(path.join(result.runDir, "checks/01-unit-tests-stdout.log"));
  await access(path.join(result.runDir, "checks/01-unit-tests-stderr.log"));
  await access(path.join(result.runDir, "checks/01-unit-tests-exit.json"));
  await access(path.join(result.runDir, "checks/01-unit-tests-command.json"));
});

test("failing check writes diagnostics and throws; second check is not run", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await writeFile(
    configPath,
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
        commands: {
          checks: [
            { name: "first", command: "npm", args: ["test"], cwd: "workspace" },
            { name: "second", command: "npm", args: ["run", "lint"], cwd: "orchestrator" }
          ]
        },
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

  let calls = 0;
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: false,
        executeBuilder: false,
        runChecks: true,
        verbose: false,
        orchestratorRoot,
        checkCommandExecutor: async (command) => {
          calls += 1;
          return {
            ...command,
            stdout: "failed",
            stderr: "boom",
            exitCode: 1,
            signal: null,
            durationMs: 3,
            success: false
          };
        }
      }),
    /Checks failed/
  );
  assert.equal(calls, 1);
});

test("checks support workspace and orchestrator cwd", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await writeFile(
    configPath,
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
        commands: {
          checks: [
            { name: "workspace-check", command: "npm", args: ["test"], cwd: "workspace" },
            { name: "orchestrator-check", command: "npm", args: ["run", "build"], cwd: "orchestrator" }
          ]
        },
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

  const seen: string[] = [];
  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    runChecks: true,
    verbose: false,
    orchestratorRoot,
    checkCommandExecutor: async (command) => {
      seen.push(command.cwd);
      return {
        ...command,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true
      };
    }
  });
  assert.deepEqual(seen, [workspaceRoot, orchestratorRoot]);
});

test("allowWrites + dryRun reports skipped by dry-run without executing codex", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: true,
    executeBuilder: true,
    allowWrites: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async () => {
      throw new Error("should not execute");
    }
  });
  assert.equal(result.writeSafetyState, "skipped by dry-run");
  const runMetadata = JSON.parse(await readFile(path.join(result.runDir, "run.json"), "utf8")) as {
    writeSafety: { state: string; allowWrites: boolean };
  };
  assert.equal(runMetadata.writeSafety.state, "skipped by dry-run");
  assert.equal(runMetadata.writeSafety.allowWrites, true);
});

test("allowWrites fails when writeSafety.enabled is false and writes write-safety-result.json before builder", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  let calls = 0;
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        executeReviewer: true,
        allowWrites: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          calls += 1;
          return {
            command: "codex",
            args: [],
            cwd: orchestratorRoot,
            stdout: "",
            stderr: "",
            exitCode: 0,
            signal: null,
            durationMs: 1,
            success: true,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
            skipped: false
          };
        }
      }),
    /writeSafety\.enabled is false/
  );
  assert.equal(calls, 1);
  const runsRoot = path.join(orchestratorRoot, "runs/acme");
  const [runId] = await readdir(runsRoot);
  await access(path.join(runsRoot, runId, "write-safety-result.json"));
  await assert.rejects(access(path.join(runsRoot, runId, "builder-command.json")));
});

test("allowWrites safety pass uses workspace-write only for builder/fix and keeps planner/reviewer/review-to-fix read-only", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
  const config = JSON.parse(await readFile(configPath, "utf8")) as {
    writeSafety?: Record<string, unknown>;
    safety: { requireGitRepo: boolean };
  };
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
  config.safety.requireGitRepo = true;
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  const roleSandbox: Array<{ role: string; sandboxMode: string | undefined }> = [];
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    allowWrites: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      roleSandbox.push({ role: request.role, sandboxMode: request.sandboxMode });
      const outputByRole: Record<string, string> = {
        planner: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
        reviewer: "Review output",
        builder: "builder/fix output"
      };
      if (request.role === "planner" && roleSandbox.filter((r) => r.role === "planner").length > 1) {
        return {
          command: "codex",
          args: [],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "",
          exitCode: 0,
          signal: null,
          durationMs: 1,
          success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nFix needed.\n\n## FINAL FIX PROMPT\nApply fix.",
          skipped: false
        };
      }
      return {
        command: "codex",
        args: [],
        cwd: orchestratorRoot,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
        success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: outputByRole[request.role] ?? "ok",
        skipped: false
      };
    }
  });

  assert.equal(result.writeSafetyState, "passed");
  const plannerCalls = roleSandbox.filter((entry) => entry.role === "planner");
  const reviewerCalls = roleSandbox.filter((entry) => entry.role === "reviewer");
  const builderCalls = roleSandbox.filter((entry) => entry.role === "builder");
  assert.ok(plannerCalls.length >= 2);
  assert.equal(plannerCalls.every((entry) => entry.sandboxMode === "read-only"), true);
  assert.equal(reviewerCalls.every((entry) => entry.sandboxMode === "read-only"), true);
  assert.equal(builderCalls.every((entry) => entry.sandboxMode === "workspace-write"), true);
});

test("allowWrites safety failure writes write-safety-result.json and does not execute builder", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown> };
  config.writeSafety = {
    enabled: true,
    requireCleanWorkingTree: true,
    allowedBranches: ["branch-that-does-not-exist"],
    blockedPaths: [],
    requireExplicitAllowWrites: true,
    captureDiffBeforeAfter: true,
    requireReviewAfterWrites: true,
    autoCommit: false,
    autoPush: false
  };
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  const roles: string[] = [];
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        executeReviewer: true,
        allowWrites: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          roles.push(request.role);
          return {
            command: "codex",
            args: [],
            cwd: orchestratorRoot,
            stdout: "",
            stderr: "",
            exitCode: 0,
            signal: null,
            durationMs: 1,
            success: true,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nBuilder prompt",
            skipped: false
          };
        }
      }),
    /Write mode blocked: write safety checks failed/
  );
  assert.deepEqual(roles, ["planner"]);
  const runsRoot = path.join(orchestratorRoot, "runs/acme");
  const [runId] = await readdir(runsRoot);
  await access(path.join(runsRoot, runId, "write-safety-result.json"));
  await assert.rejects(access(path.join(runsRoot, runId, "builder-command.json")));
});

test("write-enabled builder captures write-audit artefacts and metadata", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
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

  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    allowWrites: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      if (request.role === "planner") {
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\ntouch stage-r.txt", skipped: false
        };
      }
      await writeFile(path.join(workspaceRoot, "stage-r.txt"), "changed\n", "utf8");
      return {
        command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder done", skipped: false
      };
    }
  });

  await access(path.join(result.runDir, "write-audit/builder/pre-status.txt"));
  await access(path.join(result.runDir, "write-audit/builder/post-status.txt"));
  const metadata = JSON.parse(await readFile(path.join(result.runDir, "run.json"), "utf8")) as {
    writeAudit: { builder: { status: string; artefacts: string[] } };
  };
  assert.equal(metadata.writeAudit.builder.status, "captured");
  assert.equal(metadata.writeAudit.builder.artefacts.includes("write-audit/builder/summary.json"), true);
});

test("read-only builder does not write write-audit artefacts", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    allowWrites: false,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => ({
      command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
      outputLastMessagePath: request.outputLastMessagePath,
      outputLastMessage: request.role === "planner" ? "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nno write mode" : "builder done",
      skipped: false
    })
  });
  await assert.rejects(access(path.join(result.runDir, "write-audit/builder/summary.json")));
});

test("write-enabled fix captures write-audit artefacts and metadata", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
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

  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    allowWrites: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      if (request.role === "planner" && request.prompt.includes("NO_EXECUTE_FIX")) {
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nFix needed.\n\n## FINAL FIX PROMPT\napply fix",
          skipped: false
        };
      }
      if (request.role === "planner") {
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nbuilder prompt", skipped: false
        };
      }
      if (request.role === "reviewer") {
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "review", skipped: false
        };
      }
      await writeFile(path.join(workspaceRoot, "fix-stage-r.txt"), "changed\n", "utf8");
      return {
        command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "fix done", skipped: false
      };
    }
  });

  await access(path.join(result.runDir, "write-audit/fix/summary.json"));
  const metadata = JSON.parse(await readFile(path.join(result.runDir, "run.json"), "utf8")) as {
    writeAudit: { fix: { status: string; artefacts: string[] } };
  };
  assert.equal(metadata.writeAudit.fix.status, "captured");
  assert.equal(metadata.writeAudit.fix.artefacts.includes("write-audit/fix/summary.json"), true);
});

test("read-only fix does not write write-audit artefacts", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    allowWrites: false,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      if (request.role === "planner" && request.prompt.includes("NO_EXECUTE_FIX")) {
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nFix needed.\n\n## FINAL FIX PROMPT\napply fix",
          skipped: false
        };
      }
      return {
        command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath,
        outputLastMessage: request.role === "planner" ? "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nbuilder prompt" : "ok",
        skipped: false
      };
    }
  });
  await assert.rejects(access(path.join(result.runDir, "write-audit/fix/summary.json")));
});

test("dry-run fix does not write write-audit artefacts", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    allowWrites: true,
    verbose: false,
    orchestratorRoot
  });
  await assert.rejects(access(path.join(result.runDir, "write-audit/fix/summary.json")));
});

test("builder post-audit failure after successful execution throws clearly and keeps diagnostics", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
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
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        executeReviewer: true,
        allowWrites: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          if (request.role === "planner") {
            return {
              command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
              outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nbuilder prompt", skipped: false
            };
          }
          await writeFile(path.join(workspaceRoot, "audit-break.txt"), "x\n", "utf8");
          await rm(path.join(workspaceRoot, ".git"), { recursive: true, force: true });
          return {
            command: "codex", args: [], cwd: orchestratorRoot, stdout: "ok", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
            outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder ok", skipped: false
          };
        }
      }),
    /Builder write-audit capture failed/
  );
  const runsRoot = path.join(orchestratorRoot, "runs/acme");
  const [runId] = await readdir(runsRoot);
  const runDir = path.join(runsRoot, runId);
  await access(path.join(runDir, "builder-exit.json"));
  const metadata = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as {
    status: string;
    writeAudit: { builder: { status: string; reason?: string } };
  };
  assert.equal(metadata.status, "failed");
  assert.equal(metadata.writeAudit.builder.status, "failed");
  assert.match(metadata.writeAudit.builder.reason ?? "", /post-builder/);
});

test("builder execution failure is preserved when post-audit also fails", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
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
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        executeReviewer: true,
        allowWrites: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          if (request.role === "planner") {
            return {
              command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
              outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nbuilder prompt", skipped: false
            };
          }
          await rm(path.join(workspaceRoot, ".git"), { recursive: true, force: true });
          return {
            command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "boom", exitCode: 9, signal: null, durationMs: 1, success: false,
            outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder failed", skipped: false
          };
        }
      }),
    /Builder execution failed with exit code 9/
  );
  const runsRoot = path.join(orchestratorRoot, "runs/acme");
  const [runId] = await readdir(runsRoot);
  const metadata = JSON.parse(await readFile(path.join(runsRoot, runId, "run.json"), "utf8")) as {
    writeAudit: { builder: { status: string; reason?: string } };
  };
  assert.equal(metadata.writeAudit.builder.status, "partial");
  assert.match(metadata.writeAudit.builder.reason ?? "", /post-builder/);
});

test("write-enabled builder pre-capture failure is attributed to builder and prevents builder execution", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
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

  const roles: string[] = [];
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        executeReviewer: true,
        allowWrites: true,
        verbose: false,
        orchestratorRoot,
        writeAuditPreCapture: async ({ phase }) => {
          if (phase === "builder") {
            throw new Error("simulated pre-capture boom");
          }
          throw new Error("unexpected phase");
        },
        codexExecutor: async (request) => {
          roles.push(request.role);
          return {
            command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: request.role === "planner" ? "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nbuilder prompt" : "builder output",
            skipped: false
          };
        }
      }),
    /Builder write-audit pre-capture failed: simulated pre-capture boom/
  );
  assert.deepEqual(roles, ["planner"]);
  const runsRoot = path.join(orchestratorRoot, "runs/acme");
  const [runId] = await readdir(runsRoot);
  const metadata = JSON.parse(await readFile(path.join(runsRoot, runId, "run.json"), "utf8")) as {
    phases: { builder: { status: string } };
    writeAudit: { builder: { status: string; reason?: string } };
    error: { failedPhase?: string } | null;
  };
  assert.equal(metadata.phases.builder.status, "failed");
  assert.equal(metadata.writeAudit.builder.status, "failed");
  assert.match(metadata.writeAudit.builder.reason ?? "", /pre-capture failed/);
  assert.equal(metadata.error?.failedPhase, "builder");
});

test("normal run fails closed when allow-writes builder is selected without reviewer", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        allowWrites: true,
        verbose: false,
        orchestratorRoot
      }),
    /--allow-writes requires --execute-reviewer for post-write review/
  );
});

test("dry-run allow-writes without reviewer does not fail and records post-write review as not-required", async () => {
  const { orchestratorRoot, configPath } = await makeFixture();
  const result = await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: true,
    executePlanner: true,
    executeBuilder: true,
    allowWrites: true,
    verbose: false,
    orchestratorRoot
  });
  const metadata = JSON.parse(await readFile(path.join(result.runDir, "run.json"), "utf8")) as {
    postWriteReview: { status: string };
  };
  assert.equal(metadata.postWriteReview.status, "not-required");
});

test("write-enabled builder plus reviewer completes post-write review and includes write-audit context", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
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

  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    allowWrites: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      if (request.role === "planner") {
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\ntouch stage-s.txt", skipped: false
        };
      }
      if (request.role === "builder") {
        await writeFile(path.join(workspaceRoot, "stage-s.txt"), "changed\n", "utf8");
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder done", skipped: false
        };
      }
      return {
        command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "review done", skipped: false
      };
    }
  });
  const runsRoot = path.join(orchestratorRoot, "runs/acme");
  const [runId] = await readdir(runsRoot);
  const reviewerPrompt = await readFile(path.join(runsRoot, runId, "08-reviewer-prompt.preview.md"), "utf8");
  assert.match(reviewerPrompt, /Write-enabled phases executed: builder/);
  assert.match(reviewerPrompt, /stage-s\.txt/);
  assert.match(reviewerPrompt, /write-audit\/builder\/summary\.json/);
  assert.match(reviewerPrompt, /write-audit\/builder\/pre-diff-stat\.txt/);
  assert.match(reviewerPrompt, /write-audit\/builder\/post-diff-stat\.txt/);
  assert.match(reviewerPrompt, /write-audit\/builder\/pre-diff\.patch/);
  assert.match(reviewerPrompt, /write-audit\/builder\/post-diff\.patch/);
  assert.match(reviewerPrompt, /Reviewer must inspect write-enabled changes/);
  const metadata = JSON.parse(await readFile(path.join(runsRoot, runId, "run.json"), "utf8")) as {
    postWriteReview: { status: string };
  };
  assert.equal(metadata.postWriteReview.status, "completed");
});

test("write-enabled builder + reviewer + runChecks runs checks after reviewer completion", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown>; commands: { checks: unknown[] } };
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
  config.commands.checks = [{ name: "ok", command: "echo", args: ["ok"], cwd: "workspace" }];
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  let checksSawPostWriteReviewCompleted = false;
  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    runChecks: true,
    allowWrites: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      if (request.role === "planner") {
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\ntouch stage-t.txt", skipped: false
        };
      }
      if (request.role === "builder") {
        await writeFile(path.join(workspaceRoot, "stage-t.txt"), "changed\n", "utf8");
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder done", skipped: false
        };
      }
      return {
        command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "review done", skipped: false
      };
    },
    checkCommandExecutor: async (command) => {
      const runsRoot = path.join(orchestratorRoot, "runs/acme");
      const [runId] = await readdir(runsRoot);
      const metadata = JSON.parse(await readFile(path.join(runsRoot, runId, "run.json"), "utf8")) as { postWriteReview: { status: string } };
      checksSawPostWriteReviewCompleted = metadata.postWriteReview.status === "completed";
      return { ...command, stdout: "ok", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true };
    }
  });
  assert.equal(checksSawPostWriteReviewCompleted, true);
});

test("write-enabled reviewer failure marks post-write review failed and preserves required phases", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
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
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        executeReviewer: true,
        allowWrites: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          if (request.role === "planner") {
            return {
              command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
              outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\ntouch fail-review.txt", skipped: false
            };
          }
          if (request.role === "builder") {
            await writeFile(path.join(workspaceRoot, "fail-review.txt"), "changed\n", "utf8");
            return {
              command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
              outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder done", skipped: false
            };
          }
          return {
            command: "codex", args: [], cwd: orchestratorRoot, stdout: "reviewer stdout", stderr: "reviewer fail", exitCode: 17, signal: null, durationMs: 1, success: false,
            outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "reviewer output", skipped: false
          };
        }
      }),
    /Reviewer execution failed with exit code 17/
  );

  const runsRoot = path.join(orchestratorRoot, "runs/acme");
  const [runId] = await readdir(runsRoot);
  const runDir = path.join(runsRoot, runId);
  await access(path.join(runDir, "reviewer-exit.json"));
  const metadata = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as {
    postWriteReview: { status: string; requiredByPhases: string[] };
  };
  assert.equal(metadata.postWriteReview.status, "failed");
  assert.deepEqual(metadata.postWriteReview.requiredByPhases, ["builder"]);
});

test("write-enabled reviewer failure blocks checks when --run-checks is set", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown>; commands: { checks: unknown[] } };
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
  config.commands.checks = [{ name: "ok", command: "echo", args: ["ok"], cwd: "workspace" }];
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  let checkCalls = 0;
  await assert.rejects(
    () =>
      runStage({
        stageName: "example-stage",
        configArg: path.relative(orchestratorRoot, configPath),
        dryRun: false,
        executePlanner: true,
        executeBuilder: true,
        executeReviewer: true,
        runChecks: true,
        allowWrites: true,
        verbose: false,
        orchestratorRoot,
        codexExecutor: async (request) => {
          if (request.role === "planner") {
            return {
              command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
              outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\ntouch fail-stage-t.txt", skipped: false
            };
          }
          if (request.role === "builder") {
            await writeFile(path.join(workspaceRoot, "fail-stage-t.txt"), "changed\n", "utf8");
            return {
              command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
              outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder done", skipped: false
            };
          }
          return {
            command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "reviewer fail", exitCode: 23, signal: null, durationMs: 1, success: false,
            outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "review failed", skipped: false
          };
        },
        checkCommandExecutor: async () => {
          checkCalls += 1;
          throw new Error("should not run");
        }
      }),
    /Reviewer execution failed with exit code 23/
  );
  assert.equal(checkCalls, 0);
});

test("write-enabled fix + reviewer + runChecks executes checks after post-write review completion", async () => {
  const { orchestratorRoot, configPath, workspaceRoot } = await makeFixture();
  await initGitRepoClean(workspaceRoot);
  const config = JSON.parse(await readFile(configPath, "utf8")) as { writeSafety?: Record<string, unknown>; commands: { checks: unknown[] } };
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
  config.commands.checks = [{ name: "ok", command: "echo", args: ["ok"], cwd: "workspace" }];
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  let checksSawCompleted = false;
  await runStage({
    stageName: "example-stage",
    configArg: path.relative(orchestratorRoot, configPath),
    dryRun: false,
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    runChecks: true,
    allowWrites: true,
    verbose: false,
    orchestratorRoot,
    codexExecutor: async (request) => {
      if (request.role === "planner") {
        if (request.prompt.includes("NO_EXECUTE_FIX")) {
          return {
            command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
            outputLastMessagePath: request.outputLastMessagePath,
            outputLastMessage: "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nNeed a fix.\n\n## FINAL FIX PROMPT\ntouch stage-t-fix.txt",
            skipped: false
          };
        }
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\necho plan", skipped: false
        };
      }
      if (request.role === "builder") {
        await writeFile(path.join(workspaceRoot, "stage-t-fix.txt"), "changed\n", "utf8");
        return {
          command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
          outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "builder/fix done", skipped: false
        };
      }
      return {
        command: "codex", args: [], cwd: orchestratorRoot, stdout: "", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true,
        outputLastMessagePath: request.outputLastMessagePath, outputLastMessage: "review done", skipped: false
      };
    },
    checkCommandExecutor: async (command) => {
      const runsRoot = path.join(orchestratorRoot, "runs/acme");
      const [runId] = await readdir(runsRoot);
      const metadata = JSON.parse(await readFile(path.join(runsRoot, runId, "run.json"), "utf8")) as { postWriteReview: { status: string } };
      checksSawCompleted = metadata.postWriteReview.status === "completed";
      return { ...command, stdout: "ok", stderr: "", exitCode: 0, signal: null, durationMs: 1, success: true };
    }
  });
  assert.equal(checksSawCompleted, true);
});
