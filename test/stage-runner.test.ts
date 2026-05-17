import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { GitClient } from "../src/git.js";
import type { StagePlan, StageStatus } from "../src/stage-plan.js";
import { acceptStageFromPlan, fixStageFromPlan, runSingleStageFromPlan } from "../src/stage-runner.js";

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

test("accept-stage accepts review_required and passed only", async () => {
  for (const status of ["review_required", "passed"] as const) {
    const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), `accept-stage-${status}-`));
    const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
    await mkdir(stagePlanDir, { recursive: true });
    const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
    await writeFile(stagePlanPath, `${JSON.stringify(makePlan(status), null, 2)}\n`, "utf8");

    const before = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
    const oldUpdatedAt = before.updatedAt;

    const result = await acceptStageFromPlan({
      stageId: "stage-01-provider-contract",
      stagePlanArg: stagePlanPath,
      orchestratorRoot
    });
    assert.equal(result.status, "accepted");

    const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
    assert.notEqual(planAfter.updatedAt, oldUpdatedAt);
    assert.equal(planAfter.stages.find((s) => s.id === "stage-01-provider-contract")?.status, "accepted");
    assert.equal(planAfter.stages.find((s) => s.id === "stage-00-foundation")?.status, "accepted");
    await access(path.join(stagePlanDir, "stage-plan.md"));
    await access(path.join(stagePlanDir, "stages/stage-01-provider-contract/stage-report.md"));
  }
});

test("accept-stage refuses unknown stage", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "accept-stage-unknown-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("review_required"), null, 2)}\n`, "utf8");
  await assert.rejects(
    () =>
      acceptStageFromPlan({
        stageId: "unknown",
        stagePlanArg: stagePlanPath,
        orchestratorRoot
      }),
    /Unknown stage id/
  );
});

test("accept-stage refuses disallowed statuses", async () => {
  const disallowed: StageStatus[] = [
    "pending",
    "running",
    "accepted",
    "committed",
    "failed",
    "fix_required",
    "fixing",
    "needs_revision",
    "invalidated",
    "skipped"
  ];
  for (const status of disallowed) {
    const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), `accept-stage-refuse-${status}-`));
    const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
    await mkdir(stagePlanDir, { recursive: true });
    const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
    await writeFile(stagePlanPath, `${JSON.stringify(makePlan(status), null, 2)}\n`, "utf8");
    await assert.rejects(
      () =>
        acceptStageFromPlan({
          stageId: "stage-01-provider-contract",
          stagePlanArg: stagePlanPath,
          orchestratorRoot
        }),
      /cannot be accepted/
    );
  }
});

test("accept-stage --auto-commit commits accepted review_required stage and records commitSha", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "accept-stage-auto-commit-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("review_required"), null, 2)}\n`, "utf8");

  const calls: string[] = [];
  const git: GitClient = {
    assertGitAvailable: async () => {
      calls.push("assertGitAvailable");
    },
    getWorktreeStatus: async () => {
      calls.push("getWorktreeStatus");
      return { staged: ["src/providers/contract.ts"], unstaged: [], untracked: [] };
    },
    getChangedFiles: async () => {
      calls.push("getChangedFiles");
      return ["src/providers/contract.ts"];
    },
    hasDiff: async () => {
      calls.push("hasDiff");
      return true;
    },
    commitAll: async (_cwd, message) => {
      calls.push(`commitAll:${message.split("\n")[0]}`);
      return "abc123";
    },
    getHeadSha: async () => {
      calls.push("getHeadSha");
      return "abc123";
    }
  };

  const result = await acceptStageFromPlan({
    stageId: "stage-01-provider-contract",
    stagePlanArg: stagePlanPath,
    orchestratorRoot,
    autoCommit: true,
    git
  });

  assert.equal(result.status, "committed");
  assert.equal(result.commitSha, "abc123");
  assert.deepEqual(calls, [
    "assertGitAvailable",
    "getWorktreeStatus",
    "getChangedFiles",
    "hasDiff",
    "commitAll:stage(stage-01-provider-contract): Provider contract",
    "getHeadSha"
  ]);
  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const stage = planAfter.stages.find((s) => s.id === "stage-01-provider-contract");
  assert.equal(stage?.status, "committed");
  assert.equal(stage?.commitSha, "abc123");
  const report = await readFile(path.join(stagePlanDir, "stages/stage-01-provider-contract/stage-report.md"), "utf8");
  assert.match(report, /commitSha: abc123/);
});

test("accept-stage --auto-commit uses custom commit message", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "accept-stage-auto-msg-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("passed"), null, 2)}\n`, "utf8");

  let usedMessage = "";
  const git: GitClient = {
    assertGitAvailable: async () => {},
    getWorktreeStatus: async () => ({ staged: ["src/providers/contract.ts"], unstaged: [], untracked: [] }),
    getChangedFiles: async () => ["src/providers/contract.ts"],
    hasDiff: async () => true,
    commitAll: async (_cwd, message) => {
      usedMessage = message;
      return "def456";
    },
    getHeadSha: async () => "def456"
  };

  await acceptStageFromPlan({
    stageId: "stage-01-provider-contract",
    stagePlanArg: stagePlanPath,
    orchestratorRoot,
    autoCommit: true,
    commitMessage: "stage(provider-contract): custom",
    git
  });
  assert.equal(usedMessage, "stage(provider-contract): custom");
});

test("accept-stage --auto-commit refuses no diff and does not set commitSha", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "accept-stage-no-diff-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("review_required"), null, 2)}\n`, "utf8");

  const git: GitClient = {
    assertGitAvailable: async () => {},
    getWorktreeStatus: async () => ({ staged: [], unstaged: [], untracked: [] }),
    getChangedFiles: async () => [],
    hasDiff: async () => false,
    commitAll: async () => "x",
    getHeadSha: async () => "x"
  };

  await assert.rejects(
    () =>
      acceptStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        orchestratorRoot,
        autoCommit: true,
        git
      }),
    /non-empty git diff/
  );
  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const stage = planAfter.stages.find((s) => s.id === "stage-01-provider-contract");
  assert.equal(stage?.status, "accepted");
  assert.equal(stage?.commitSha, undefined);
});

test("accept-stage --auto-commit enforces scope include and exclude", async () => {
  let includeCommitAllCalls = 0;
  const makeScopedGit = (changedFiles: string[], onCommitAll?: () => void): GitClient => ({
    assertGitAvailable: async () => {},
    getWorktreeStatus: async () => ({ staged: [], unstaged: [], untracked: [] }),
    getChangedFiles: async () => changedFiles,
    hasDiff: async () => true,
    commitAll: async () => {
      includeCommitAllCalls += 1;
      onCommitAll?.();
      return "x";
    },
    getHeadSha: async () => "x"
  });

  const orchestratorRootA = await mkdtemp(path.join(os.tmpdir(), "accept-stage-scope-include-"));
  const stagePlanDirA = path.join(orchestratorRootA, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDirA, { recursive: true });
  const stagePlanPathA = path.join(stagePlanDirA, "stage-plan.json");
  const planA = makePlan("review_required");
  planA.stages[1].scope = { include: ["src/providers/**"], exclude: ["src/providers/generated/**"] };
  await writeFile(stagePlanPathA, `${JSON.stringify(planA, null, 2)}\n`, "utf8");

  await assert.rejects(
    () =>
      acceptStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPathA,
        orchestratorRoot: orchestratorRootA,
        autoCommit: true,
        git: makeScopedGit(["src/other/file.ts"])
      }),
    /outside stage scope\.include/
  );
  const planAfterInclude = JSON.parse(await readFile(stagePlanPathA, "utf8")) as StagePlan;
  const selectedInclude = planAfterInclude.stages.find((s) => s.id === "stage-01-provider-contract");
  assert.equal(selectedInclude?.status, "accepted");
  assert.equal(selectedInclude?.commitSha, undefined);
  assert.equal(includeCommitAllCalls, 0);
  assert.equal(planAfterInclude.stages.find((s) => s.id === "stage-00-foundation")?.status, "accepted");

  const orchestratorRootB = await mkdtemp(path.join(os.tmpdir(), "accept-stage-scope-exclude-"));
  const stagePlanDirB = path.join(orchestratorRootB, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDirB, { recursive: true });
  const stagePlanPathB = path.join(stagePlanDirB, "stage-plan.json");
  const planB = makePlan("review_required");
  planB.stages[1].scope = { include: ["src/providers/**"], exclude: ["src/providers/generated/**"] };
  await writeFile(stagePlanPathB, `${JSON.stringify(planB, null, 2)}\n`, "utf8");

  let excludeCommitAllCalls = 0;
  await assert.rejects(
    () =>
      acceptStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPathB,
        orchestratorRoot: orchestratorRootB,
        autoCommit: true,
        git: makeScopedGit(["src/providers/generated/file.ts"], () => {
          excludeCommitAllCalls += 1;
        })
      }),
    /scope\.exclude/
  );
  const planAfterExclude = JSON.parse(await readFile(stagePlanPathB, "utf8")) as StagePlan;
  const selectedExclude = planAfterExclude.stages.find((s) => s.id === "stage-01-provider-contract");
  assert.equal(selectedExclude?.status, "accepted");
  assert.equal(selectedExclude?.commitSha, undefined);
  assert.equal(excludeCommitAllCalls, 0);
  assert.equal(planAfterExclude.stages.find((s) => s.id === "stage-00-foundation")?.status, "accepted");
});

test("accept-stage --auto-commit commit failure does not set commitSha or committed status", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "accept-stage-commit-fail-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("review_required"), null, 2)}\n`, "utf8");

  const git: GitClient = {
    assertGitAvailable: async () => {},
    getWorktreeStatus: async () => ({ staged: ["src/providers/contract.ts"], unstaged: [], untracked: [] }),
    getChangedFiles: async () => ["src/providers/contract.ts"],
    hasDiff: async () => true,
    commitAll: async () => {
      throw new Error("commit failed");
    },
    getHeadSha: async () => "never"
  };

  await assert.rejects(
    () =>
      acceptStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        orchestratorRoot,
        autoCommit: true,
        git
      }),
    /commit failed/
  );
  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const stage = planAfter.stages.find((s) => s.id === "stage-01-provider-contract");
  assert.equal(stage?.status, "accepted");
  assert.equal(stage?.commitSha, undefined);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-00-foundation")?.status, "accepted");
});

test("accept-stage --auto-commit getHeadSha failure after commit does not mark committed", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "accept-stage-headsha-fail-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("review_required"), null, 2)}\n`, "utf8");

  let commitAllCalls = 0;
  const git: GitClient = {
    assertGitAvailable: async () => {},
    getWorktreeStatus: async () => ({ staged: ["src/providers/contract.ts"], unstaged: [], untracked: [] }),
    getChangedFiles: async () => ["src/providers/contract.ts"],
    hasDiff: async () => true,
    commitAll: async () => {
      commitAllCalls += 1;
      return "abc123";
    },
    getHeadSha: async () => {
      throw new Error("HEAD sha unavailable");
    }
  };

  await assert.rejects(
    () =>
      acceptStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        orchestratorRoot,
        autoCommit: true,
        git
      }),
    /HEAD sha unavailable/
  );
  assert.equal(commitAllCalls, 1);
  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const selected = planAfter.stages.find((s) => s.id === "stage-01-provider-contract");
  assert.equal(selected?.status, "accepted");
  assert.equal(selected?.commitSha, undefined);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-00-foundation")?.status, "accepted");
  const markdown = await readFile(path.join(stagePlanDir, "stage-plan.md"), "utf8");
  assert.match(markdown, /accepted/);
  assert.doesNotMatch(markdown, /commitSha:\s*\S+/);
});

test("accept-stage --auto-commit fails when git is unavailable and does not attempt commit", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "accept-stage-git-unavailable-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("passed"), null, 2)}\n`, "utf8");

  let commitAllCalled = false;
  let getHeadShaCalled = false;
  const git: GitClient = {
    assertGitAvailable: async () => {
      throw new Error("git unavailable");
    },
    getWorktreeStatus: async () => ({ staged: [], unstaged: [], untracked: [] }),
    getChangedFiles: async () => [],
    hasDiff: async () => false,
    commitAll: async () => {
      commitAllCalled = true;
      return "x";
    },
    getHeadSha: async () => {
      getHeadShaCalled = true;
      return "x";
    }
  };

  await assert.rejects(
    () =>
      acceptStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        orchestratorRoot,
        autoCommit: true,
        git
      }),
    /git unavailable/
  );
  assert.equal(commitAllCalled, false);
  assert.equal(getHeadShaCalled, false);
  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const selected = planAfter.stages.find((s) => s.id === "stage-01-provider-contract");
  assert.equal(selected?.status, "accepted");
  assert.equal(selected?.commitSha, undefined);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-00-foundation")?.status, "accepted");
});

test("fix-stage validates status and feedback gates", async () => {
  const cfgStatuses: Array<{ status: StageStatus; allowed: boolean }> = [
    { status: "review_required", allowed: true },
    { status: "failed", allowed: true },
    { status: "fix_required", allowed: true },
    { status: "accepted", allowed: true },
    { status: "pending", allowed: false },
    { status: "invalidated", allowed: false },
    { status: "skipped", allowed: false },
    { status: "committed", allowed: false }
  ];

  for (const { status, allowed } of cfgStatuses) {
    const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), `fix-stage-gate-${status}-`));
    const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
    await mkdir(stagePlanDir, { recursive: true });
    const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
    await writeFile(stagePlanPath, `${JSON.stringify(makePlan(status), null, 2)}\n`, "utf8");
    const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);

    const runner = async () =>
      ({
        stageName: "stage-01-provider-contract",
        orchestratorRoot,
        targetWorkspaceRoot: orchestratorRoot,
        configPath: cfgPath,
        runDir: orchestratorRoot,
        artefacts: [],
        dryRun: false,
        checksState: "executed",
        allowWrites: false,
        writeSafetyState: "not checked",
        writeEnabledPhases: []
      }) as Awaited<ReturnType<typeof import("../src/runner.js").runStage>>;

    if (allowed) {
      await fixStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        configArg: cfgPath,
        feedback: "Please make it provider-neutral.",
        orchestratorRoot,
        allowWrites: false,
        verbose: false,
        streamCodex: false,
        runHandler: runner
      });
    } else {
      await assert.rejects(
        () =>
          fixStageFromPlan({
            stageId: "stage-01-provider-contract",
            stagePlanArg: stagePlanPath,
            configArg: cfgPath,
            feedback: "Please make it provider-neutral.",
            orchestratorRoot,
            allowWrites: false,
            verbose: false,
            streamCodex: false,
            runHandler: runner
          }),
        /cannot be fixed|Cannot fix committed stage/
      );
    }
  }
});

test("fix-stage refuses unknown stage, empty feedback, and commitSha", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "fix-stage-validation-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const plan = makePlan("review_required");
  plan.stages[1].commitSha = "abc123";
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);

  await assert.rejects(
    () =>
      fixStageFromPlan({
        stageId: "missing",
        stagePlanArg: stagePlanPath,
        configArg: cfgPath,
        feedback: "x",
        orchestratorRoot,
        allowWrites: false,
        verbose: false,
        streamCodex: false
      }),
    /Unknown stage id/
  );
  await assert.rejects(
    () =>
      fixStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        configArg: cfgPath,
        feedback: "   ",
        orchestratorRoot,
        allowWrites: false,
        verbose: false,
        streamCodex: false
      }),
    /non-empty --feedback/
  );
  await assert.rejects(
    () =>
      fixStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        configArg: cfgPath,
        feedback: "x",
        orchestratorRoot,
        allowWrites: false,
        verbose: false,
        streamCodex: false
      }),
    /Cannot fix committed stage/
  );
});

test("fix-stage success increments revision, restores review_required, and preserves unrelated stages", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "fix-stage-success-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("review_required"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);
  const runDir = path.join(orchestratorRoot, "fake-fix-run");
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "06-planner-output-last-message.md"), "planner", "utf8");
  await writeFile(path.join(runDir, "builder-output-last-message.md"), "builder", "utf8");
  await writeFile(path.join(runDir, "reviewer-output-last-message.md"), "reviewer", "utf8");
  await writeFile(path.join(runDir, "checks-status.json"), "{\"ok\":true}", "utf8");

  const before = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const oldUpdatedAt = before.updatedAt;

  let observedFixingStatus: StageStatus | undefined;
  const result = await fixStageFromPlan({
    stageId: "stage-01-provider-contract",
    stagePlanArg: stagePlanPath,
    configArg: cfgPath,
    feedback: "Tighten provider abstraction.",
    orchestratorRoot,
    allowWrites: false,
    verbose: false,
    streamCodex: false,
    runHandler: async () => {
      const planDuring = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
      observedFixingStatus = planDuring.stages.find((s) => s.id === "stage-01-provider-contract")?.status;
      return {
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
      } as Awaited<ReturnType<typeof import("../src/runner.js").runStage>>;
    }
  });

  assert.equal(observedFixingStatus, "fixing");
  assert.equal(result.status, "review_required");
  assert.equal(result.revision, 2);
  await access(result.feedbackPath);
  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  assert.notEqual(planAfter.updatedAt, oldUpdatedAt);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-01-provider-contract")?.status, "review_required");
  assert.equal(planAfter.stages.find((s) => s.id === "stage-01-provider-contract")?.revision, 2);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-00-foundation")?.status, "accepted");
  await access(path.join(stagePlanDir, "stage-plan.md"));
  await access(path.join(stagePlanDir, "stages/stage-01-provider-contract/stage-report.md"));
});

test("fix-stage failure preserves feedback artefact, sets failed, and does not increment revision", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "fix-stage-failure-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("review_required"), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);

  const before = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const oldUpdatedAt = before.updatedAt;

  await assert.rejects(
    () =>
      fixStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        configArg: cfgPath,
        feedback: "fix it",
        orchestratorRoot,
        allowWrites: false,
        verbose: false,
        streamCodex: false,
        runHandler: async () => {
          throw new Error("fix failed");
        }
      }),
    /fix failed/
  );

  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  assert.notEqual(planAfter.updatedAt, oldUpdatedAt);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-01-provider-contract")?.status, "failed");
  assert.equal(planAfter.stages.find((s) => s.id === "stage-01-provider-contract")?.revision, 1);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-00-foundation")?.status, "accepted");
  await access(path.join(stagePlanDir, "stages/stage-01-provider-contract/feedback-revision-2.md"));
});

test("fix-stage pre-execution failure does not mutate stage plan and still records feedback artefact", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "fix-stage-pre-execution-failure-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan("review_required"), null, 2)}\n`, "utf8");

  const before = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  const oldUpdatedAt = before.updatedAt;
  const oldSelectedStatus = before.stages.find((s) => s.id === "stage-01-provider-contract")?.status;
  const oldSelectedRevision = before.stages.find((s) => s.id === "stage-01-provider-contract")?.revision;
  const oldDepStatus = before.stages.find((s) => s.id === "stage-00-foundation")?.status;

  await assert.rejects(
    () =>
      fixStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        configArg: "missing-config.json",
        feedback: "Fix before execution starts.",
        orchestratorRoot,
        allowWrites: false,
        verbose: false,
        streamCodex: false
      }),
    /not found|ENOENT/i
  );

  const planAfter = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  assert.equal(planAfter.updatedAt, oldUpdatedAt);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-01-provider-contract")?.status, oldSelectedStatus);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-01-provider-contract")?.revision, oldSelectedRevision);
  assert.equal(planAfter.stages.find((s) => s.id === "stage-00-foundation")?.status, oldDepStatus);
  assert.notEqual(planAfter.stages.find((s) => s.id === "stage-01-provider-contract")?.status, "failed");

  await access(path.join(stagePlanDir, "stages/stage-01-provider-contract/feedback-revision-2.md"));
});
