import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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

test("auto-chain single-pass PASS runs checks", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"PASS\",\"blockingIssues\":[],\"nonBlockingIssues\":[]}\n```");
  let checksCalled = false;
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
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

test("auto-chain FAIL plus FIX_REQUIRED skips checks and returns NEEDS_FIX", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  let checksCalled = false;
  const summary = await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      checksCalled = true;
      return makeContinueResult(runDir);
    }
  });
  assert.equal(checksCalled, false);
  assert.equal(summary.finalStatus, "NEEDS_FIX");
  assert.equal(summary.checks, "skipped");
});

test("auto-chain does not run continueRun checks when FAIL plus FIX_REQUIRED", async () => {
  const runDir = await makeRunDir("```json reviewer-verdict\n{\"verdict\":\"FAIL\",\"blockingIssues\":[{\"severity\":\"high\",\"summary\":\"x\",\"files\":[\"a.ts\"]}],\"nonBlockingIssues\":[]}\n```", "FIX_REQUIRED");
  let continueCalls = 0;
  await executeAutoChainSinglePass({
    stageName: "example-stage",
    configArg: "configs/acme.json",
    orchestratorRoot: "/tmp/orchestrator",
    allowWrites: false,
    streamCodex: false,
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => {
      continueCalls += 1;
      return makeContinueResult(runDir);
    }
  });
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
    verbose: false,
    runStageHandler: async () => makeRunnerResult(runDir),
    continueRunHandler: async () => makeContinueResult(runDir)
  });
  assert.equal(summary.fixDecision, "unavailable");
  assert.equal(summary.finalStatus, "PASS");
});
