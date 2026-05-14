import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildAutoChainProjectionLines, executeAutoChainSinglePass } from "../src/auto-chain.js";
import { createProgressLogger } from "../src/progress-logger.js";
import type { RunOptions, RunResult } from "../src/runner.js";
import type { ContinueOptions, ContinueResult } from "../src/continue-run.js";

test("buildAutoChainProjectionLines(0) stops without fix execution", () => {
  const lines = buildAutoChainProjectionLines(0);
  const text = lines.join("\n");

  assert.match(text, /stop without fix execution because max fix attempts is 0/);
  assert.doesNotMatch(text, /fix attempt 1/);
  assert.doesNotMatch(text, /reviewer retry/);
});

test("buildAutoChainProjectionLines(1) includes single bounded fix attempt", () => {
  const lines = buildAutoChainProjectionLines(1);
  const text = lines.join("\n");

  assert.match(text, /fix attempt 1/);
  assert.match(text, /reviewer retry after fix attempt 1/);
  assert.doesNotMatch(text, /fix attempt 2/);
});

test("buildAutoChainProjectionLines(3) includes all bounded attempts and retries", () => {
  const lines = buildAutoChainProjectionLines(3);
  const text = lines.join("\n");

  assert.match(text, /fix attempt 1/);
  assert.match(text, /fix attempt 2/);
  assert.match(text, /fix attempt 3/);
  assert.match(text, /reviewer retry after fix attempt 1/);
  assert.match(text, /reviewer retry after fix attempt 2/);
  assert.match(text, /reviewer retry after fix attempt 3/);
  assert.doesNotMatch(text, /fix attempt 4/);
});

async function makeRunDir(
  reviewerOutput: string,
  reviewToFixDecision?: "PROCEED" | "FIX_REQUIRED"
): Promise<string> {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "auto-chain-run-"));
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "reviewer-output-last-message.md"), reviewerOutput, "utf8");
  if (reviewToFixDecision) {
    await writeFile(
      path.join(runDir, "review-to-fix-decision.json"),
      JSON.stringify({ decision: reviewToFixDecision, rationale: "ok" }),
      "utf8"
    );
  }
  return runDir;
}

function makeRunnerResult(runDir: string): RunResult {
  return {
    stageName: "example-stage",
    orchestratorRoot: "/tmp/orchestrator",
    targetWorkspaceRoot: "/tmp/workspace",
    configPath: "/tmp/orchestrator/configs/acme.json",
    runDir,
    artefacts: [],
    dryRun: false,
    checksState: "disabled",
    allowWrites: false,
    writeSafetyState: "not checked",
    writeEnabledPhases: []
  };
}

function makeContinueResult(runDir: string): ContinueResult {
  return {
    runId: path.basename(runDir),
    runDir,
    configPath: "/tmp/orchestrator/configs/acme.json",
    dryRun: false,
    selectedPhases: ["checks"],
    before: {
      planner: "executed",
      builder: "executed",
      reviewer: "executed",
      fixPlanning: "executed",
      fixExecution: "disabled",
      checks: "disabled"
    },
    after: {
      planner: "executed",
      builder: "executed",
      reviewer: "executed",
      fixPlanning: "executed",
      fixExecution: "disabled",
      checks: "executed"
    },
    artefacts: [],
    skippedFixBecauseProceed: false,
    allowWrites: false,
    writeSafetyState: "not checked",
    writeEnabledPhases: []
  };
}

async function makeAutoChainFixture(): Promise<{ orchestratorRoot: string; configArg: string; workspaceRoot: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "auto-chain-orch-"));
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "auto-chain-workspace-"));
  await mkdir(path.join(workspaceRoot, ".git"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "prompts"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await writeFile(path.join(orchestratorRoot, "prompts/reviewer.md"), "{{builder_output}}\n{{builder_execution_state}}", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/planner-stage.md"), "x", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/review-to-fix.md"), "x", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/final-review.md"), "x", "utf8");
  const configArg = "configs/acme.json";
  await writeFile(
    path.join(orchestratorRoot, configArg),
    JSON.stringify(
      {
        version: 1,
        projectName: "Acme",
        workspaceRoot,
        paths: { stagesDir: "stages", promptsDir: "prompts", runsDir: "runs" },
        codex: {
          planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
          builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
          reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
        },
        pipeline: { finalReview: true, maxFixLoops: 1 },
        commands: { checks: [] },
        safety: { requireGitRepo: true, requireCleanStart: true, manualCommit: true, forbidAutoCommit: true, forbidAutoPush: true },
        writeSafety: { enabled: true, blockedPaths: [] }
      },
      null,
      2
    ),
    "utf8"
  );
  return { orchestratorRoot, configArg, workspaceRoot };
}

test("auto-chain single-pass PASS runs checks", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```");
  let checksCalled = false;
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      checksCalled = true;
      return makeContinueResult(runDir);
    }
  });
  assert.equal(checksCalled, true);
  assert.equal(summary.finalStatus, "PASS");
  assert.equal(summary.checks, "executed");
  assert.equal(summary.attemptsUsed, 0);
});

test("auto-chain single-pass sets executeFix=false and runChecks=false; checks only via continueRun", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```");
  let capturedRunStage: RunOptions | undefined;
  let continueCalls = 0;
  await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    runStageHandler: async (options) => {
      capturedRunStage = options;
      return makeRunnerResult(runDir);
    },
    continueRunHandler: async () => {
      continueCalls += 1;
      return makeContinueResult(runDir);
    }
  });
  assert.equal(capturedRunStage?.executeFix, false);
  assert.equal(capturedRunStage?.runChecks, false);
  assert.equal(continueCalls, 1);
});

test("auto-chain single-pass PROCEED runs checks", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "PROCEED");
  let checksCalled = false;
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      checksCalled = true;
      return makeContinueResult(runDir);
    }
  });
  assert.equal(checksCalled, true);
  assert.equal(summary.finalStatus, "PASS");
  assert.equal(summary.fixDecision, "PROCEED");
});

test("auto-chain FIX_REQUIRED without allowWrites returns NEEDS_FIX_WRITE_DISABLED", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  let checksCalled = false;
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      checksCalled = true;
      return makeContinueResult(runDir);
    }
  });
  assert.equal(checksCalled, false);
  assert.equal(summary.finalStatus, "NEEDS_FIX_WRITE_DISABLED");
  assert.equal(summary.checks, "skipped");
});

test("auto-chain FIX_REQUIRED does not call continue-run when writes disabled", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  let continueCalls = 0;
  await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      continueCalls += 1;
      return makeContinueResult(runDir);
    }
  });
  assert.equal(continueCalls, 0);
});

test("auto-chain FIX_REQUIRED with maxFixAttempts=0 returns MAX_FIX_ATTEMPTS_REACHED", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  let continueCalls = 0;
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: true,
    streamCodex: false,
    maxFixAttempts: 0,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      continueCalls += 1;
      return makeContinueResult(runDir);
    }
  });
  assert.equal(summary.finalStatus, "MAX_FIX_ATTEMPTS_REACHED");
  assert.equal(continueCalls, 0);
});

test("auto-chain checks failure returns CHECKS_FAILED", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```");
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      throw new Error('Checks failed. Diagnostics written to /tmp. Check "lint" failed');
    }
  });
  assert.equal(summary.finalStatus, "CHECKS_FAILED");
  assert.equal(summary.checks, "failed");
});

test("auto-chain forwards allowWrites and streamCodex safely to runStage", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```");
  let captured: RunOptions | undefined;
  await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: true,
    streamCodex: true,
    maxFixAttempts: 1,
    verbose: false,
    runStageHandler: async (options) => {
      captured = options;
      return makeRunnerResult(runDir);
    },
    continueRunHandler: async () => makeContinueResult(runDir)
  });
  assert.equal(captured?.allowWrites, true);
  assert.equal(captured?.streamCodex, true);
  assert.equal(captured?.executeFix, false);
  assert.equal(captured?.runChecks, false);
});

test("auto-chain emits progress logs", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```");
  const lines: string[] = [];
  const logger = createProgressLogger((line) => lines.push(line), { verbose: false });
  await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    progressLogger: logger,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => makeContinueResult(runDir)
  });
  const text = lines.join("\n");
  assert.match(text, /\[auto-chain\] starting/);
  assert.match(text, /\[auto-chain\] parsing reviewer verdict/);
  assert.match(text, /\[auto-chain\] reviewer verdict: PASS/);
  assert.match(text, /\[auto-chain\] running checks/);
  assert.match(text, /\[auto-chain\] final status: PASS/);
});

test("auto-chain reviewer parser failure throws controlled error", async () => {
  const runDir = await makeRunDir("invalid reviewer output");
  await assert.rejects(
    () =>
      executeAutoChainSinglePass({
        stageName: "example-stage",
        configArg: "configs/acme.json",
        orchestratorRoot: "/tmp/orchestrator",
        allowWrites: false,
        streamCodex: false,
        maxFixAttempts: 1,
        verbose: false,
        runStageHandler: async () => makeRunnerResult(runDir),
        continueRunHandler: async (_options: ContinueOptions) => makeContinueResult(runDir)
      }),
    /Reviewer output parse error/
  );
});

test("auto-chain missing reviewer output artefact throws controlled error", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```");
  await rm(path.join(runDir, "reviewer-output-last-message.md"));
  await assert.rejects(
    () =>
      executeAutoChainSinglePass({
        stageName: "example-stage",
        configArg: "configs/acme.json",
        orchestratorRoot: "/tmp/orchestrator",
        allowWrites: false,
        streamCodex: false,
        maxFixAttempts: 1,
        verbose: false,
        runStageHandler: async () => makeRunnerResult(runDir),
        continueRunHandler: async (_options: ContinueOptions) => makeContinueResult(runDir)
      }),
    /missing reviewer artefact "reviewer-output-last-message\.md"[\s\S]*run directory[\s\S]*Remediation: ensure reviewer executed successfully and rerun auto-chain\./
  );
});

test("auto-chain invalid review-to-fix decision JSON falls back to unavailable", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```");
  await writeFile(path.join(runDir, "review-to-fix-decision.json"), "{ invalid json", "utf8");
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => makeContinueResult(runDir)
  });
  assert.equal(summary.fixDecision, "unavailable");
  assert.equal(summary.finalStatus, "PASS");
});

test("auto-chain FIX_REQUIRED with allowWrites executes one fix attempt and then checks on post-fix PASS", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-prompt.executed.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-stdout.log"), "fix stdout", "utf8");
  await writeFile(path.join(runDir, "fix-stderr.log"), "", "utf8");
  await writeFile(path.join(runDir, "fix-output-last-message.md"), "fixed", "utf8");
  await writeFile(path.join(runDir, "fix-exit.json"), "{\"success\":true}", "utf8");

  const phaseCalls: ContinueOptions[] = [];
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg,
    orchestratorRoot,
    allowWrites: true,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async (opts) => {
      phaseCalls.push(opts);
      return makeContinueResult(runDir);
    },
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
      outputLastMessage: "```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```",
      skipped: false
    })
  });
  assert.equal(summary.finalStatus, "PASS");
  assert.equal(summary.attemptsUsed, 1);
  assert.equal(phaseCalls.length, 2);
  assert.equal(phaseCalls[0].executeFix, true);
  assert.equal(phaseCalls[0].allowWrites, true);
  assert.equal(phaseCalls[1].runChecks, true);
  const runJson = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as { autoChain: { attemptsUsed: number; finalStatus: string } };
  assert.equal(runJson.autoChain.attemptsUsed, 1);
  assert.equal(runJson.autoChain.finalStatus, "PASS");
  await access(path.join(runDir, "auto-chain/attempt-01/fix-output-last-message.md"));
  await access(path.join(runDir, "auto-chain/attempt-01/reviewer-verdict.json"));
  const firstPassReviewer = await readFile(path.join(runDir, "reviewer-output-last-message.md"), "utf8");
  const attemptReviewer = await readFile(path.join(runDir, "auto-chain/attempt-01/reviewer-output-last-message.md"), "utf8");
  assert.notEqual(attemptReviewer, firstPassReviewer);
  assert.match(attemptReviewer, /"verdict":"PASS"/);
  assert.equal(phaseCalls.filter((call) => call.executeFix).length, 1);
  assert.equal(phaseCalls.filter((call) => call.runChecks).length, 1);
});

test("auto-chain uses two attempts then PASS when bounded retries succeed", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir(
    "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
    "FIX_REQUIRED"
  );
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "fix attempt 1", "utf8");
  let fixCalls = 0;
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg,
    orchestratorRoot,
    allowWrites: true,
    streamCodex: false,
    maxFixAttempts: 3,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async (opts) => {
      if (opts.executeFix) {
        fixCalls += 1;
        await writeFile(path.join(runDir, "fix-prompt.executed.md"), `apply fix ${fixCalls}`, "utf8");
        await writeFile(path.join(runDir, "fix-stdout.log"), `stdout ${fixCalls}`, "utf8");
        await writeFile(path.join(runDir, "fix-stderr.log"), "", "utf8");
        await writeFile(path.join(runDir, "fix-output-last-message.md"), `fixed ${fixCalls}`, "utf8");
        await writeFile(path.join(runDir, "fix-exit.json"), "{\"success\":true}", "utf8");
      }
      return makeContinueResult(runDir);
    },
    codexExecutor: async (request) => {
      if (request.outputLastMessagePath.endsWith("attempt-01/reviewer-output-last-message.md")) {
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
          outputLastMessage:
            "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"retry\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
          skipped: false
        };
      }
      if (request.outputLastMessagePath.endsWith("attempt-01/review-to-fix-output-last-message.md")) {
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
          outputLastMessage:
            "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nneeds second attempt\n\n## FINAL FIX PROMPT\nfix attempt 2",
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
        outputLastMessage: "```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```",
        skipped: false
      };
    }
  });
  assert.equal(summary.finalStatus, "PASS");
  assert.equal(summary.attemptsUsed, 2);
  await access(path.join(runDir, "auto-chain/attempt-01/fix-output-last-message.md"));
  await access(path.join(runDir, "auto-chain/attempt-02/fix-output-last-message.md"));
  const runJson = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as {
    autoChain: { attemptsUsed: number; finalStatus: string; attempts: Array<{ attempt: number; reviewToFixDecisionForNextAttempt?: string }> };
  };
  assert.equal(runJson.autoChain.attemptsUsed, 2);
  assert.equal(runJson.autoChain.finalStatus, "PASS");
  assert.equal(runJson.autoChain.attempts[0].reviewToFixDecisionForNextAttempt, "FIX_REQUIRED");
});

test("auto-chain reaches max attempts without PASS", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir(
    "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
    "FIX_REQUIRED"
  );
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "fix 1", "utf8");
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg,
    orchestratorRoot,
    allowWrites: true,
    streamCodex: false,
    maxFixAttempts: 2,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      await writeFile(path.join(runDir, "fix-prompt.executed.md"), "apply", "utf8");
      await writeFile(path.join(runDir, "fix-stdout.log"), "x", "utf8");
      await writeFile(path.join(runDir, "fix-stderr.log"), "", "utf8");
      await writeFile(path.join(runDir, "fix-output-last-message.md"), "x", "utf8");
      await writeFile(path.join(runDir, "fix-exit.json"), "{\"success\":true}", "utf8");
      return makeContinueResult(runDir);
    },
    codexExecutor: async (request) => {
      if (request.outputLastMessagePath.endsWith("review-to-fix-output-last-message.md")) {
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
          outputLastMessage: "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nretry\n\n## FINAL FIX PROMPT\nretry fix",
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
        outputLastMessage:
          "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
        skipped: false
      };
    }
  });
  assert.equal(summary.finalStatus, "MAX_FIX_ATTEMPTS_REACHED");
  assert.equal(summary.attemptsUsed, 2);
});

test("auto-chain fix execution failure writes FAILED metadata", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir(
    "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
    "FIX_REQUIRED"
  );
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "apply", "utf8");
  await assert.rejects(
    () =>
      executeAutoChainSinglePass({
        stageName: "example-stage",
        configArg,
        orchestratorRoot,
        allowWrites: true,
        streamCodex: false,
        maxFixAttempts: 1,
        verbose: false,
        runStageHandler: async () => makeRunnerResult(runDir),
        continueRunHandler: async () => {
          throw new Error("fix failed");
        }
      }),
    /fix failed/
  );
  const runJson = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as { autoChain: { finalStatus: string } };
  assert.equal(runJson.autoChain.finalStatus, "FAILED");
});

test("auto-chain attempt artefacts are isolated and non-colliding", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir(
    "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
    "FIX_REQUIRED"
  );
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "fix 1", "utf8");
  let fixCount = 0;
  await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg,
    orchestratorRoot,
    allowWrites: true,
    streamCodex: false,
    maxFixAttempts: 2,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async (opts) => {
      if (opts.executeFix) {
        fixCount += 1;
        await writeFile(path.join(runDir, "fix-prompt.executed.md"), `attempt ${fixCount}`, "utf8");
        await writeFile(path.join(runDir, "fix-stdout.log"), `stdout ${fixCount}`, "utf8");
        await writeFile(path.join(runDir, "fix-stderr.log"), "", "utf8");
        await writeFile(path.join(runDir, "fix-output-last-message.md"), `fixed ${fixCount}`, "utf8");
        await writeFile(path.join(runDir, "fix-exit.json"), "{\"success\":true}", "utf8");
      }
      return makeContinueResult(runDir);
    },
    codexExecutor: async (request) => {
      if (request.outputLastMessagePath.endsWith("attempt-01/review-to-fix-output-last-message.md")) {
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
          outputLastMessage: "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nretry\n\n## FINAL FIX PROMPT\nfix 2",
          skipped: false
        };
      }
      if (request.outputLastMessagePath.endsWith("attempt-02/reviewer-output-last-message.md")) {
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
          outputLastMessage: "```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```",
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
        outputLastMessage:
          "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
        skipped: false
      };
    }
  });
  const attempt1 = await readFile(path.join(runDir, "auto-chain/attempt-01/fix-output-last-message.md"), "utf8");
  const attempt2 = await readFile(path.join(runDir, "auto-chain/attempt-02/fix-output-last-message.md"), "utf8");
  assert.equal(attempt1.trim(), "fixed 1");
  assert.equal(attempt2.trim(), "fixed 2");
});

test("auto-chain logs bounded attempt progress", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir(
    "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
    "FIX_REQUIRED"
  );
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "apply", "utf8");
  const lines: string[] = [];
  const logger = createProgressLogger((line) => lines.push(line), { verbose: false });
  await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg,
    orchestratorRoot,
    allowWrites: true,
    streamCodex: false,
    maxFixAttempts: 1,
    verbose: false,
    progressLogger: logger,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      await writeFile(path.join(runDir, "fix-prompt.executed.md"), "apply", "utf8");
      await writeFile(path.join(runDir, "fix-stdout.log"), "x", "utf8");
      await writeFile(path.join(runDir, "fix-stderr.log"), "", "utf8");
      await writeFile(path.join(runDir, "fix-output-last-message.md"), "x", "utf8");
      await writeFile(path.join(runDir, "fix-exit.json"), "{\"success\":true}", "utf8");
      return makeContinueResult(runDir);
    },
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
      outputLastMessage: "```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```",
      skipped: false
    })
  });
  const text = lines.join("\n");
  assert.match(text, /\[auto-chain\] attempt 1\/1 fix required/);
  assert.match(text, /\[auto-chain\] attempt 1\/1 fix completed/);
  assert.match(text, /\[auto-chain\] attempt 1\/1 reviewer verdict: PASS/);
});

test("auto-chain writes FAILED metadata when fix prompt is missing", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await assert.rejects(
    () =>
      executeAutoChainSinglePass({
        stageName: "example-stage",
        configArg,
        orchestratorRoot,
        allowWrites: true,
        streamCodex: false,
        maxFixAttempts: 1,
        verbose: false,
        runStageHandler: async () => makeRunnerResult(runDir),
        continueRunHandler: async () => makeContinueResult(runDir)
      }),
    /missing fix prompt artefact/
  );
  const runJson = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as { autoChain: { finalStatus: string; attemptsUsed: number } };
  assert.equal(runJson.autoChain.finalStatus, "FAILED");
  assert.equal(runJson.autoChain.attemptsUsed, 1);
});

test("auto-chain writes FAILED metadata when fix prompt is empty", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "   \n", "utf8");
  await assert.rejects(
    () =>
      executeAutoChainSinglePass({
        stageName: "example-stage",
        configArg,
        orchestratorRoot,
        allowWrites: true,
        streamCodex: false,
        maxFixAttempts: 1,
        verbose: false,
        runStageHandler: async () => makeRunnerResult(runDir),
        continueRunHandler: async () => makeContinueResult(runDir)
      }),
    /fix-prompt\.extracted\.md is empty/
  );
  const runJson = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as { autoChain: { finalStatus: string; attemptsUsed: number } };
  assert.equal(runJson.autoChain.finalStatus, "FAILED");
  assert.equal(runJson.autoChain.attemptsUsed, 1);
});

test("auto-chain writes FAILED metadata when post-fix reviewer execution fails", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-prompt.executed.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-stdout.log"), "fix stdout", "utf8");
  await writeFile(path.join(runDir, "fix-stderr.log"), "", "utf8");
  await writeFile(path.join(runDir, "fix-output-last-message.md"), "fixed", "utf8");
  await writeFile(path.join(runDir, "fix-exit.json"), "{\"success\":true}", "utf8");
  await assert.rejects(
    () =>
      executeAutoChainSinglePass({
        stageName: "example-stage",
        configArg,
        orchestratorRoot,
        allowWrites: true,
        streamCodex: false,
        maxFixAttempts: 1,
        verbose: false,
        runStageHandler: async () => makeRunnerResult(runDir),
        continueRunHandler: async () => makeContinueResult(runDir),
        codexExecutor: async (request) => ({
          command: "codex",
          args: [],
          cwd: orchestratorRoot,
          stdout: "",
          stderr: "boom",
          exitCode: 2,
          signal: null,
          durationMs: 1,
          success: false,
          outputLastMessagePath: request.outputLastMessagePath,
          outputLastMessage: "",
          skipped: false
        })
      }),
    /Post-fix reviewer execution failed/
  );
  const runJson = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as { autoChain: { finalStatus: string; attemptsUsed: number } };
  assert.equal(runJson.autoChain.finalStatus, "FAILED");
  assert.equal(runJson.autoChain.attemptsUsed, 1);
});

test("auto-chain writes FAILED metadata when post-fix reviewer output parse fails", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-prompt.executed.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-stdout.log"), "fix stdout", "utf8");
  await writeFile(path.join(runDir, "fix-stderr.log"), "", "utf8");
  await writeFile(path.join(runDir, "fix-output-last-message.md"), "fixed", "utf8");
  await writeFile(path.join(runDir, "fix-exit.json"), "{\"success\":true}", "utf8");
  await assert.rejects(
    () =>
      executeAutoChainSinglePass({
        stageName: "example-stage",
        configArg,
        orchestratorRoot,
        allowWrites: true,
        streamCodex: false,
        maxFixAttempts: 1,
        verbose: false,
        runStageHandler: async () => makeRunnerResult(runDir),
        continueRunHandler: async () => makeContinueResult(runDir),
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
          outputLastMessage: "not a reviewer verdict block",
          skipped: false
        })
      }),
    /Reviewer output parse error/
  );
  const runJson = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as {
    autoChain: { finalStatus: string; attemptsUsed: number; attempts: Array<{ artefacts: string[] }> };
  };
  assert.equal(runJson.autoChain.finalStatus, "FAILED");
  assert.equal(runJson.autoChain.attemptsUsed, 1);
  assert.ok(runJson.autoChain.attempts[0].artefacts.includes("auto-chain/attempt-01/reviewer-prompt.md"));
  assert.ok(runJson.autoChain.attempts[0].artefacts.includes("auto-chain/attempt-01/reviewer-output-last-message.md"));
});

test("auto-chain writes FAILED metadata when post-fix review-to-fix execution fails", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir(
    "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
    "FIX_REQUIRED"
  );
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-prompt.executed.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-stdout.log"), "fix stdout", "utf8");
  await writeFile(path.join(runDir, "fix-stderr.log"), "", "utf8");
  await writeFile(path.join(runDir, "fix-output-last-message.md"), "fixed", "utf8");
  await writeFile(path.join(runDir, "fix-exit.json"), "{\"success\":true}", "utf8");
  await assert.rejects(
    () =>
      executeAutoChainSinglePass({
        stageName: "example-stage",
        configArg,
        orchestratorRoot,
        allowWrites: true,
        streamCodex: false,
        maxFixAttempts: 2,
        verbose: false,
        runStageHandler: async () => makeRunnerResult(runDir),
        continueRunHandler: async () => makeContinueResult(runDir),
        codexExecutor: async (request) => {
          if (request.outputLastMessagePath.endsWith("review-to-fix-output-last-message.md")) {
            return {
              command: "codex",
              args: [],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "boom",
              exitCode: 3,
              signal: null,
              durationMs: 1,
              success: false,
              outputLastMessagePath: request.outputLastMessagePath,
              outputLastMessage: "",
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
            outputLastMessage:
              "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"still failing\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
            skipped: false
          };
        }
      }),
    /Post-fix review-to-fix execution failed/
  );
  const runJson = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as {
    autoChain: { finalStatus: string; attemptsUsed: number; attempts: Array<{ artefacts: string[] }> };
  };
  assert.equal(runJson.autoChain.finalStatus, "FAILED");
  assert.equal(runJson.autoChain.attemptsUsed, 1);
  assert.ok(runJson.autoChain.attempts[0].artefacts.includes("auto-chain/attempt-01/review-to-fix-stdout.log"));
  assert.ok(runJson.autoChain.attempts[0].artefacts.includes("auto-chain/attempt-01/review-to-fix-exit.json"));
});

test("auto-chain writes FAILED metadata when post-fix review-to-fix parse fails", async () => {
  const { orchestratorRoot, configArg } = await makeAutoChainFixture();
  const runDir = await makeRunDir(
    "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
    "FIX_REQUIRED"
  );
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({ runId: path.basename(runDir) }), "utf8");
  await writeFile(path.join(runDir, "fix-prompt.extracted.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-prompt.executed.md"), "apply fix", "utf8");
  await writeFile(path.join(runDir, "fix-stdout.log"), "fix stdout", "utf8");
  await writeFile(path.join(runDir, "fix-stderr.log"), "", "utf8");
  await writeFile(path.join(runDir, "fix-output-last-message.md"), "fixed", "utf8");
  await writeFile(path.join(runDir, "fix-exit.json"), "{\"success\":true}", "utf8");
  await assert.rejects(
    () =>
      executeAutoChainSinglePass({
        stageName: "example-stage",
        configArg,
        orchestratorRoot,
        allowWrites: true,
        streamCodex: false,
        maxFixAttempts: 2,
        verbose: false,
        runStageHandler: async () => makeRunnerResult(runDir),
        continueRunHandler: async () => makeContinueResult(runDir),
        codexExecutor: async (request) => {
          if (request.outputLastMessagePath.endsWith("review-to-fix-output-last-message.md")) {
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
              outputLastMessage: "not valid review-to-fix output",
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
            outputLastMessage:
              "```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"still failing\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```",
            skipped: false
          };
        }
      }),
    /Review-to-fix output parse error/
  );
  const runJson = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8")) as {
    autoChain: { finalStatus: string; attemptsUsed: number; attempts: Array<{ artefacts: string[] }> };
  };
  assert.equal(runJson.autoChain.finalStatus, "FAILED");
  assert.equal(runJson.autoChain.attemptsUsed, 1);
  assert.ok(runJson.autoChain.attempts[0].artefacts.includes("auto-chain/attempt-01/review-to-fix-prompt.md"));
  assert.ok(runJson.autoChain.attempts[0].artefacts.includes("auto-chain/attempt-01/review-to-fix-output-last-message.md"));
});
