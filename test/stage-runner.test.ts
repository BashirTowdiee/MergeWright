import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { StagePlan, StageStatus } from "../src/stage-plan.js";
import { runSingleStageFromPlan } from "../src/stage-runner.js";

function makePlan(stage2Status: StageStatus, depStatus: StageStatus = "accepted"): StagePlan {
  return {
    schemaVersion: 1,
    id: "provider-switching",
    title: "Provider Switching",
    goal: "Switch providers safely",
    source: "imported",
    status: "ready",
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    stages: [
      {
        id: "stage-00-foundation",
        index: 1,
        title: "Foundation",
        goal: "Set baseline",
        status: depStatus,
        dependsOn: [],
        assumptions: [],
        scope: { include: ["src"], exclude: [] },
        acceptanceCriteria: ["baseline exists"],
        checks: [],
        expectedOutputs: [],
        revision: 1
      },
      {
        id: "stage-01-provider-contract",
        index: 2,
        title: "Provider contract",
        goal: "Extract provider contract",
        status: stage2Status,
        dependsOn: ["stage-00-foundation"],
        assumptions: ["adapter points are stable"],
        scope: { include: ["src/providers"], exclude: ["dist"] },
        acceptanceCriteria: ["contract extracted"],
        checks: ["npm test"],
        expectedOutputs: ["contract.ts"],
        revision: 1
      }
    ]
  };
}

async function writeFixtureConfig(orchestratorRoot: string, workspaceRoot: string): Promise<string> {
  const cfgPath = path.join(orchestratorRoot, "test-config.json");
  const cfg = {
    version: 1,
    projectName: "test-project",
    workspaceRoot,
    paths: { stagesDir: "stages", promptsDir: "prompts", runsDir: "runs" },
    codex: {
      planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
      builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
      reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
    },
    pipeline: { finalReview: true, maxFixLoops: 1 },
    commands: { checks: [] },
    safety: {
      requireGitRepo: false,
      requireCleanStart: false,
      manualCommit: true,
      forbidAutoCommit: true,
      forbidAutoPush: true
    },
    writeSafety: {
      enabled: true,
      allowedBranches: ["feature/*"],
      blockedPaths: [],
      requireCleanWorkingTree: false,
      requireExplicitAllowWrites: true,
      captureDiffBeforeAfter: false,
      requireReviewAfterWrites: true,
      autoCommit: false,
      autoPush: false
    }
  };
  await writeFile(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
  return cfgPath;
}

test("run-stage fails for unknown stage id", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "run-stage-unknown-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("pending"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);

  await assert.rejects(
    () =>
      runSingleStageFromPlan({
        stageId: "missing-stage",
        stagePlanArg: stagePlanPath,
        configArg: cfgPath,
        orchestratorRoot,
        allowWrites: false,
        dryRun: true,
        verbose: false,
        streamCodex: false
      }),
    /Unknown stage id/
  );
});

test("run-stage refuses stage with unmet dependencies", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "run-stage-deps-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("pending", "pending"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);

  await assert.rejects(
    () =>
      runSingleStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        configArg: cfgPath,
        orchestratorRoot,
        allowWrites: false,
        dryRun: true,
        verbose: false,
        streamCodex: false
      }),
    /Dependencies must be accepted or committed/
  );
});

test("run-stage allows dependency status accepted and committed", async () => {
  for (const depStatus of ["accepted", "committed"] as const) {
    const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), `run-stage-deps-ok-${depStatus}-`));
    const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
    await mkdir(stagePlanDir, { recursive: true });
    const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
    await writeFile(stagePlanPath, `${JSON.stringify(makePlan("pending", depStatus), null, 2)}\n`, "utf8");
    const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);

    const result = await runSingleStageFromPlan({
      stageId: "stage-01-provider-contract",
      stagePlanArg: stagePlanPath,
      configArg: cfgPath,
      orchestratorRoot,
      allowWrites: false,
      dryRun: true,
      verbose: false,
      streamCodex: false
    });
    assert.equal(result.dryRun, true);
  }
});

test("run-stage refuses non-runnable statuses", async () => {
  const blocked: StageStatus[] = [
    "running",
    "review_required",
    "accepted",
    "committed",
    "needs_revision",
    "invalidated",
    "skipped",
    "fixing",
    "fix_required",
    "passed"
  ];
  for (const status of blocked) {
    const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), `run-stage-status-${status}-`));
    const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
    await mkdir(stagePlanDir, { recursive: true });
    const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
    await writeFile(stagePlanPath, `${JSON.stringify(makePlan(status), null, 2)}\n`, "utf8");
    const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);
    await assert.rejects(
      () =>
        runSingleStageFromPlan({
          stageId: "stage-01-provider-contract",
          stagePlanArg: stagePlanPath,
          configArg: cfgPath,
          orchestratorRoot,
          allowWrites: false,
          dryRun: true,
          verbose: false,
          streamCodex: false
        }),
      /not runnable/
    );
  }
});

test("dry-run validates without mutating stage-plan or creating artefacts", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "run-stage-dry-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("pending"), null, 2)}\n`, "utf8");
  const before = await readFile(stagePlanPath, "utf8");
  const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);

  await runSingleStageFromPlan({
    stageId: "stage-01-provider-contract",
    stagePlanArg: stagePlanPath,
    configArg: cfgPath,
    orchestratorRoot,
    allowWrites: false,
    dryRun: true,
    verbose: false,
    streamCodex: false
  });

  const after = await readFile(stagePlanPath, "utf8");
  assert.equal(after, before);
  await assert.rejects(() => access(path.join(stagePlanDir, "stages/stage-01-provider-contract/stage.json")));
});

test("successful run updates selected stage, regenerates markdown, and writes artefacts", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "run-stage-success-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("pending"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);
  const runDir = path.join(orchestratorRoot, "fake-run");
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "06-planner-output-last-message.md"), "planner", "utf8");
  await writeFile(path.join(runDir, "builder-output-last-message.md"), "builder", "utf8");
  await writeFile(path.join(runDir, "reviewer-output-last-message.md"), "reviewer", "utf8");
  await writeFile(path.join(runDir, "checks-status.json"), "{\"ok\":true}", "utf8");

  await runSingleStageFromPlan({
    stageId: "stage-01-provider-contract",
    stagePlanArg: stagePlanPath,
    configArg: cfgPath,
    orchestratorRoot,
    allowWrites: false,
    dryRun: false,
    verbose: false,
    streamCodex: false,
    runHandler: async () =>
      ({
        stageName: "stage-01-provider-contract",
        orchestratorRoot,
        targetWorkspaceRoot: orchestratorRoot,
        configPath: cfgPath,
        runDir,
        artefacts: [],
        dryRun: false,
        checksState: "executed",
        allowWrites: false,
        writeSafetyState: "not checked",
        writeEnabledPhases: []
      }) as Awaited<ReturnType<typeof import("../src/runner.js").runStage>>
  });

  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const selected = planAfter.stages.find((s) => s.id === "stage-01-provider-contract");
  const dep = planAfter.stages.find((s) => s.id === "stage-00-foundation");
  assert.equal(selected?.status, "review_required");
  assert.equal(dep?.status, "accepted");
  const md = await readFile(path.join(stagePlanDir, "stage-plan.md"), "utf8");
  assert.match(md, /stage-01-provider-contract/);
  assert.match(md, /review_required/);

  const artefactsDir = path.join(stagePlanDir, "stages/stage-01-provider-contract");
  await access(path.join(artefactsDir, "stage.json"));
  await access(path.join(artefactsDir, "stage-prompt.md"));
  await access(path.join(artefactsDir, "planner-output.md"));
  await access(path.join(artefactsDir, "builder-output.md"));
  await access(path.join(artefactsDir, "reviewer-output.md"));
  await access(path.join(artefactsDir, "checks-output.txt"));
  await access(path.join(artefactsDir, "stage-report.md"));
});

test("failure marks only selected stage failed when execution started", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "run-stage-fail-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("pending"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);

  await assert.rejects(
    () =>
      runSingleStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        configArg: cfgPath,
        orchestratorRoot,
        allowWrites: false,
        dryRun: false,
        verbose: false,
        streamCodex: false,
        runHandler: async () => {
          throw new Error("builder failed");
        }
      }),
    /builder failed/
  );

  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const selected = planAfter.stages.find((s) => s.id === "stage-01-provider-contract");
  const dep = planAfter.stages.find((s) => s.id === "stage-00-foundation");
  assert.equal(selected?.status, "failed");
  assert.equal(dep?.status, "accepted");
});

