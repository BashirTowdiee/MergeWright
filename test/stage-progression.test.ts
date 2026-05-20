import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { StagePlan, StageStatus } from "../src/stage-plan.js";
import { continueStagesFromPlan, runStagesFromPlan } from "../src/stage-runner.js";

function makePlan(stage1: StageStatus, stage2: StageStatus, stage3: StageStatus): StagePlan {
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
        id: "stage-01-foundation",
        index: 1,
        title: "Foundation",
        goal: "Prepare",
        status: stage1,
        dependsOn: [],
        assumptions: [],
        scope: { include: ["src"], exclude: [] },
        acceptanceCriteria: ["ok"],
        checks: [],
        expectedOutputs: [],
        revision: 1
      },
      {
        id: "stage-02-contract",
        index: 2,
        title: "Contract",
        goal: "Extract contract",
        status: stage2,
        dependsOn: ["stage-01-foundation"],
        assumptions: [],
        scope: { include: ["src"], exclude: [] },
        acceptanceCriteria: ["ok"],
        checks: [],
        expectedOutputs: [],
        revision: 1
      },
      {
        id: "stage-03-cutover",
        index: 3,
        title: "Cutover",
        goal: "Switch provider",
        status: stage3,
        dependsOn: ["stage-02-contract"],
        assumptions: [],
        scope: { include: ["src"], exclude: [] },
        acceptanceCriteria: ["ok"],
        checks: [],
        expectedOutputs: [],
        revision: 1
      }
    ]
  };
}

async function writeFixtureConfig(orchestratorRoot: string): Promise<string> {
  const cfgPath = path.join(orchestratorRoot, "test-config.json");
  const cfg = {
    version: 1,
    projectName: "test-project",
    workspaceRoot: orchestratorRoot,
    paths: { stagesDir: "stages", promptsDir: "prompts", runsDir: "runs" },
    executionBackends: {
      codex: { type: "codex-cli" }
    },
    agents: {
      planner: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" },
      builder: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "medium" },
      reviewer: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" }
    },
    pipeline: { finalReview: true, maxFixLoops: 1 },
    commands: { checks: [] },
    safety: { requireGitRepo: false, requireCleanStart: false, manualCommit: true, forbidAutoCommit: true, forbidAutoPush: true },
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

test("run-stages requires stop-after-each-stage mode", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "run-stages-stop-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  await writeFile(planPath, `${JSON.stringify(makePlan("pending", "pending", "pending"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  await assert.rejects(
    () =>
      runStagesFromPlan({
        stagePlanArg: planPath,
        configArg: cfgPath,
        orchestratorRoot: root,
        allowWrites: false,
        dryRun: true,
        verbose: false,
        streamCodex: false,
        stopAfterEachStage: false
      }),
    /Only --stop-after-each-stage mode is supported/
  );
});

test("run-stages dry-run selects first pending and does not mutate plan", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "run-stages-dry-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  await writeFile(planPath, `${JSON.stringify(makePlan("accepted", "pending", "pending"), null, 2)}\n`, "utf8");
  const before = await readFile(planPath, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  const result = await runStagesFromPlan({
    stagePlanArg: planPath,
    configArg: cfgPath,
    orchestratorRoot: root,
    allowWrites: false,
    dryRun: true,
    verbose: false,
    streamCodex: false,
    stopAfterEachStage: true
  });
  assert.equal(result.stageId, "stage-02-contract");
  assert.equal(result.dryRun, true);
  assert.equal(await readFile(planPath, "utf8"), before);
  await assert.rejects(() => access(path.join(planDir, "stages/stage-02-contract")));
});

test("run-stages runs one stage, pauses plan, and does not run second stage", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "run-stages-one-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  await writeFile(planPath, `${JSON.stringify(makePlan("accepted", "pending", "pending"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  const runDir = path.join(root, "fake-run");
  await mkdir(runDir, { recursive: true });
  let calls = 0;

  const result = await runStagesFromPlan({
    stagePlanArg: planPath,
    configArg: cfgPath,
    orchestratorRoot: root,
    allowWrites: false,
    dryRun: false,
    verbose: false,
    streamCodex: false,
    stopAfterEachStage: true,
    runHandler: async () => {
      calls += 1;
      return {
        stageName: "stage-02-contract",
        orchestratorRoot: root,
        targetWorkspaceRoot: root,
        configPath: cfgPath,
        runDir,
        artefacts: [],
        dryRun: false,
        checksState: "executed",
        allowWrites: false,
        writeSafetyState: "not checked",
        writeEnabledPhases: []
      };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.stageId, "stage-02-contract");
  assert.equal(result.stagePlanStatus, "paused");
  const after = JSON.parse(await readFile(planPath, "utf8")) as StagePlan;
  assert.equal(after.status, "paused");
  assert.notEqual(after.updatedAt, "2026-05-17T00:00:00.000Z");
  assert.equal(after.stages[1].status, "review_required");
  assert.equal(after.stages[2].status, "pending");
});

test("run-stages pre-execution failure preserves prior plan status and does not fail stage", async () => {
  for (const priorStatus of ["ready", "paused"] as const) {
    const root = await mkdtemp(path.join(os.tmpdir(), `run-stages-pre-exec-${priorStatus}-`));
    const planDir = path.join(root, ".artifacts/runs/provider-switching");
    await mkdir(planDir, { recursive: true });
    const planPath = path.join(planDir, "stage-plan.json");
    const plan = makePlan("accepted", "pending", "pending");
    plan.status = priorStatus;
    plan.updatedAt = "2026-05-17T00:01:00.000Z";
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    await assert.rejects(
      () =>
        runStagesFromPlan({
          stagePlanArg: planPath,
          configArg: "missing-config.json",
          orchestratorRoot: root,
          allowWrites: false,
          dryRun: false,
          verbose: false,
          streamCodex: false,
          stopAfterEachStage: true
        }),
      /not found|ENOENT/i
    );
    const after = JSON.parse(await readFile(planPath, "utf8")) as StagePlan;
    assert.equal(after.status, priorStatus);
    assert.equal(after.updatedAt, "2026-05-17T00:01:00.000Z");
    assert.equal(after.stages[1].status, "pending");
    assert.equal(after.stages[0].status, "accepted");
    assert.equal(after.stages[2].status, "pending");
  }
});

test("run-stages execution-started failure marks plan failed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "run-stages-started-fail-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  const plan = makePlan("accepted", "pending", "pending");
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  await assert.rejects(
    () =>
      runStagesFromPlan({
        stagePlanArg: planPath,
        configArg: cfgPath,
        orchestratorRoot: root,
        allowWrites: false,
        dryRun: false,
        verbose: false,
        streamCodex: false,
        stopAfterEachStage: true,
        runHandler: async () => {
          throw new Error("started failure");
        }
      }),
    /started failure/
  );
  const after = JSON.parse(await readFile(planPath, "utf8")) as StagePlan;
  assert.equal(after.status, "failed");
  assert.equal(after.stages[1].status, "failed");
  assert.equal(after.stages[0].status, "accepted");
  assert.equal(after.stages[2].status, "pending");
});

test("continue-stages refuses when any stage is review_required", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "continue-stages-review-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  await writeFile(planPath, `${JSON.stringify(makePlan("accepted", "review_required", "pending"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  await assert.rejects(
    () =>
      continueStagesFromPlan({
        stagePlanArg: planPath,
        configArg: cfgPath,
        orchestratorRoot: root,
        allowWrites: false,
        dryRun: true,
        verbose: false,
        streamCodex: false
      }),
    /Accept or fix it before running the next stage/
  );
});

test("continue-stages runs next pending when previous stage accepted or committed", async () => {
  for (const priorStatus of ["accepted", "committed"] as const) {
    const root = await mkdtemp(path.join(os.tmpdir(), `continue-stages-next-${priorStatus}-`));
    const planDir = path.join(root, ".artifacts/runs/provider-switching");
    await mkdir(planDir, { recursive: true });
    const planPath = path.join(planDir, "stage-plan.json");
    await writeFile(planPath, `${JSON.stringify(makePlan(priorStatus, "pending", "pending"), null, 2)}\n`, "utf8");
    const cfgPath = await writeFixtureConfig(root);
    const runDir = path.join(root, "fake-run");
    await mkdir(runDir, { recursive: true });
    const result = await continueStagesFromPlan({
      stagePlanArg: planPath,
      configArg: cfgPath,
      orchestratorRoot: root,
      allowWrites: false,
      dryRun: false,
      verbose: false,
      streamCodex: false,
      runHandler: async () => ({
        stageName: "stage-02-contract",
        orchestratorRoot: root,
        targetWorkspaceRoot: root,
        configPath: cfgPath,
        runDir,
        artefacts: [],
        dryRun: false,
        checksState: "executed",
        allowWrites: false,
        writeSafetyState: "not checked",
        writeEnabledPhases: []
      })
    });
    assert.equal(result.stageId, "stage-02-contract");
    assert.equal(result.stagePlanStatus, "paused");
    const after = JSON.parse(await readFile(planPath, "utf8")) as StagePlan;
    assert.notEqual(after.updatedAt, "2026-05-17T00:00:00.000Z");
  }
});

test("continue-stages refuses needs_revision and invalidated candidate", async () => {
  for (const blockedStatus of ["needs_revision", "invalidated"] as const) {
    const root = await mkdtemp(path.join(os.tmpdir(), `continue-stages-${blockedStatus}-`));
    const planDir = path.join(root, ".artifacts/runs/provider-switching");
    await mkdir(planDir, { recursive: true });
    const planPath = path.join(planDir, "stage-plan.json");
    await writeFile(planPath, `${JSON.stringify(makePlan("accepted", blockedStatus, "pending"), null, 2)}\n`, "utf8");
    const cfgPath = await writeFixtureConfig(root);
    await assert.rejects(
      () =>
        continueStagesFromPlan({
          stagePlanArg: planPath,
          configArg: cfgPath,
          orchestratorRoot: root,
          allowWrites: false,
          dryRun: false,
          verbose: false,
          streamCodex: false
        }),
      /Resolve it before running the next stage/
    );
  }
});

test("continue-stages dry-run identifies next stage without mutation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "continue-stages-dry-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  await writeFile(planPath, `${JSON.stringify(makePlan("accepted", "pending", "pending"), null, 2)}\n`, "utf8");
  const before = await readFile(planPath, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  const result = await continueStagesFromPlan({
    stagePlanArg: planPath,
    configArg: cfgPath,
    orchestratorRoot: root,
    allowWrites: false,
    dryRun: true,
    verbose: false,
    streamCodex: false
  });
  assert.equal(result.stageId, "stage-02-contract");
  assert.equal(await readFile(planPath, "utf8"), before);
  await assert.rejects(() => access(path.join(planDir, "stages/stage-02-contract")));
});

test("continue-stages sets plan failed when started stage execution fails", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "continue-stages-fail-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  await writeFile(planPath, `${JSON.stringify(makePlan("accepted", "pending", "pending"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  await assert.rejects(
    () =>
      continueStagesFromPlan({
        stagePlanArg: planPath,
        configArg: cfgPath,
        orchestratorRoot: root,
        allowWrites: false,
        dryRun: false,
        verbose: false,
        streamCodex: false,
        runHandler: async () => {
          throw new Error("boom");
        }
      }),
    /boom/
  );
  const after = JSON.parse(await readFile(planPath, "utf8")) as StagePlan;
  assert.equal(after.status, "failed");
  assert.notEqual(after.updatedAt, "2026-05-17T00:00:00.000Z");
  assert.equal(after.stages[1].status, "failed");
  assert.equal(after.stages[0].status, "accepted");
  assert.equal(after.stages[2].status, "pending");
});

test("continue-stages reports no pending when all stages accepted/committed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "continue-stages-none-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  await writeFile(planPath, `${JSON.stringify(makePlan("accepted", "committed", "accepted"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  const result = await continueStagesFromPlan({
    stagePlanArg: planPath,
    configArg: cfgPath,
    orchestratorRoot: root,
    allowWrites: false,
    dryRun: false,
    verbose: false,
    streamCodex: false,
    runHandler: async () => {
      throw new Error("should not execute");
    }
  });
  assert.equal(result.noPendingStages, true);
  assert.equal(await readFile(planPath, "utf8"), `${JSON.stringify(makePlan("accepted", "committed", "accepted"), null, 2)}\n`);
});

test("run-stages reports no pending when all stages accepted/committed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "run-stages-none-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  const plan = makePlan("accepted", "committed", "accepted");
  plan.status = "paused";
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const before = await readFile(planPath, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  const result = await runStagesFromPlan({
    stagePlanArg: planPath,
    configArg: cfgPath,
    orchestratorRoot: root,
    allowWrites: false,
    dryRun: false,
    verbose: false,
    streamCodex: false,
    stopAfterEachStage: true,
    runHandler: async () => {
      throw new Error("should not execute");
    }
  });
  assert.equal(result.noPendingStages, true);
  assert.equal(await readFile(planPath, "utf8"), before);
});

test("run-stages refuses unmet dependency and does not mutate", async () => {
  const blockedStatuses: StageStatus[] = ["review_required", "fix_required", "fixing", "passed", "running", "skipped"];
  for (const blocked of blockedStatuses) {
    const root = await mkdtemp(path.join(os.tmpdir(), `run-stages-dep-${blocked}-`));
    const planDir = path.join(root, ".artifacts/runs/provider-switching");
    await mkdir(planDir, { recursive: true });
    const planPath = path.join(planDir, "stage-plan.json");
    const plan = makePlan(blocked, "pending", "pending");
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    const before = await readFile(planPath, "utf8");
    const cfgPath = await writeFixtureConfig(root);
    await assert.rejects(
      () =>
        runStagesFromPlan({
          stagePlanArg: planPath,
          configArg: cfgPath,
          orchestratorRoot: root,
          allowWrites: false,
          dryRun: false,
          verbose: false,
          streamCodex: false,
          stopAfterEachStage: true
        }),
      /blocked by earlier stage|requires review/
    );
    assert.equal(await readFile(planPath, "utf8"), before);
  }
});

test("continue-stages blocks when earlier stage is not accepted/committed and does not mutate", async () => {
  for (const earlyStatus of ["fix_required", "fixing", "passed", "running", "skipped"] as const) {
    const root = await mkdtemp(path.join(os.tmpdir(), `continue-stages-block-${earlyStatus}-`));
    const planDir = path.join(root, ".artifacts/runs/provider-switching");
    await mkdir(planDir, { recursive: true });
    const planPath = path.join(planDir, "stage-plan.json");
    const plan = makePlan(earlyStatus, "pending", "pending");
    plan.status = "paused";
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    const before = await readFile(planPath, "utf8");
    const cfgPath = await writeFixtureConfig(root);
    await assert.rejects(
      () =>
        continueStagesFromPlan({
          stagePlanArg: planPath,
          configArg: cfgPath,
          orchestratorRoot: root,
          allowWrites: false,
          dryRun: false,
          verbose: false,
          streamCodex: false
        }),
      /blocked by earlier stage/
    );
    assert.equal(await readFile(planPath, "utf8"), before);
  }
});

test("linear progression does not skip blocked earlier candidate", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "run-stages-linear-no-skip-"));
  const planDir = path.join(root, ".artifacts/runs/provider-switching");
  await mkdir(planDir, { recursive: true });
  const planPath = path.join(planDir, "stage-plan.json");
  const plan = makePlan("fix_required", "accepted", "pending");
  plan.stages[2].dependsOn = [];
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const before = await readFile(planPath, "utf8");
  const cfgPath = await writeFixtureConfig(root);
  await assert.rejects(
    () =>
      runStagesFromPlan({
        stagePlanArg: planPath,
        configArg: cfgPath,
        orchestratorRoot: root,
        allowWrites: false,
        dryRun: false,
        verbose: false,
        streamCodex: false,
        stopAfterEachStage: true
      }),
    /blocked by earlier stage/
  );
  assert.equal(await readFile(planPath, "utf8"), before);
});
