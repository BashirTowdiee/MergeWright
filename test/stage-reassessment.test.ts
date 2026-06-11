import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { StagePlan } from "../src/stage-plan.js";
import { continueStagesFromPlan, fixStageFromPlan } from "../src/stage-runner.js";
import { reassessStagePlan } from "../src/stage-reassessment.js";

function makePlan(stage2Status: StagePlan["stages"][number]["status"] = "review_required"): StagePlan {
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
        id: "stage-01-provider-contract",
        index: 1,
        title: "Provider contract",
        goal: "Extract provider contract",
        status: "accepted",
        dependsOn: [],
        assumptions: [],
        scope: { include: ["src/providers"], exclude: ["dist"] },
        acceptanceCriteria: ["provider contract extracted"],
        checks: [],
        expectedOutputs: [],
        revision: 1
      },
      {
        id: "stage-02-provider-impl",
        index: 2,
        title: "Provider implementation",
        goal: "Implement provider",
        status: stage2Status,
        dependsOn: ["stage-01-provider-contract"],
        assumptions: ["provider contract stable"],
        scope: { include: ["src/providers"], exclude: ["dist"] },
        acceptanceCriteria: ["provider implemented"],
        checks: [],
        expectedOutputs: [],
        revision: 1
      },
      {
        id: "stage-03-docs",
        index: 3,
        title: "Docs",
        goal: "Update docs",
        status: "pending",
        dependsOn: ["stage-02-provider-impl"],
        assumptions: ["workflow unchanged"],
        scope: { include: ["docs"], exclude: [] },
        acceptanceCriteria: ["docs updated"],
        checks: [],
        expectedOutputs: [],
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
    executionBackends: {
      codex: { type: "codex-cli" }
    },
    agents: {
      planner: { backend: "codex", model: "gpt-5.5", reasoningEffort: "high" },
      builder: { backend: "codex", model: "gpt-5.5", reasoningEffort: "medium" },
      reviewer: { backend: "codex", model: "gpt-5.5", reasoningEffort: "high" }
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

async function setupPlan(): Promise<{ orchestratorRoot: string; stagePlanPath: string; cfgPath: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "stage-reassess-"));
  const stagePlanDir = path.join(orchestratorRoot, ".artifacts/runs/provider-switching");
  await mkdir(stagePlanDir, { recursive: true });
  const stagePlanPath = path.join(stagePlanDir, "stage-plan.json");
  await writeFile(stagePlanPath, `${JSON.stringify(makePlan(), null, 2)}\n`, "utf8");
  const cfgPath = await writeFixtureConfig(orchestratorRoot, orchestratorRoot);
  return { orchestratorRoot, stagePlanPath, cfgPath };
}

test("reassess-stage-plan fails for unknown source stage", async () => {
  const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();
  await assert.rejects(
    () =>
      reassessStagePlan({
        stagePlanArg: stagePlanPath,
        sourceStageId: "missing-stage",
        configArg: cfgPath,
        orchestratorRoot,
        dryRun: true
      }),
    /Unknown stage id/
  );
});

test("reassess-stage-plan dry-run identifies downstream stages without mutation or artefacts", async () => {
  const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();
  const before = await readFile(stagePlanPath, "utf8");

  const result = await reassessStagePlan({
    stagePlanArg: stagePlanPath,
    sourceStageId: "stage-01-provider-contract",
    configArg: cfgPath,
    orchestratorRoot,
    dryRun: true
  });

  assert.equal(result.dryRun, true);
  assert.deepEqual(result.downstreamStageIds, ["stage-02-provider-impl", "stage-03-docs"]);
  const after = await readFile(stagePlanPath, "utf8");
  assert.equal(after, before);
  await assert.rejects(() => access(path.join(path.dirname(stagePlanPath), "reassessments")));
});

test("reassess-stage-plan writes artefacts and marks downstream statuses", async () => {
  const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();
  const before = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;

  const result = await reassessStagePlan({
    stagePlanArg: stagePlanPath,
    sourceStageId: "stage-01-provider-contract",
    configArg: cfgPath,
    orchestratorRoot,
    dryRun: false,
    codexExecutor: async () =>
      ({
        command: "codex",
        args: [],
        cwd: orchestratorRoot,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 10,
        success: true,
        outputLastMessagePath: path.join(orchestratorRoot, "mock.md"),
        outputLastMessage: JSON.stringify({
          sourceStageId: "stage-01-provider-contract",
          results: [
            {
              stageId: "stage-02-provider-impl",
              classification: "needs_revision",
              reason: "Depends on old contract details."
            },
            {
              stageId: "stage-03-docs",
              classification: "unchanged",
              reason: "Docs still apply."
            }
          ]
        }),
        skipped: false
      })
  });

  assert.ok(result.reassessmentDir);
  await access(path.join(result.reassessmentDir as string, "reassessment-prompt.md"));
  await access(path.join(result.reassessmentDir as string, "reassessment-result.json"));
  await access(path.join(result.reassessmentDir as string, "reassessment-report.md"));

  const after = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
  assert.notEqual(after.updatedAt, before.updatedAt);
  assert.equal(after.status, "paused");
  assert.equal(after.stages.find((s) => s.id === "stage-01-provider-contract")?.status, "accepted");
  assert.equal(after.stages.find((s) => s.id === "stage-02-provider-impl")?.status, "needs_revision");
  assert.equal(after.stages.find((s) => s.id === "stage-03-docs")?.status, "pending");
  const stagePlanMarkdown = await readFile(path.join(path.dirname(stagePlanPath), "stage-plan.md"), "utf8");
  assert.match(stagePlanMarkdown, /stage-02-provider-impl/);
  assert.match(stagePlanMarkdown, /needs_revision/);
});

test("reassess-stage-plan fails when model output is not valid JSON", async () => {
  const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();

  await assert.rejects(
    () =>
      reassessStagePlan({
        stagePlanArg: stagePlanPath,
        sourceStageId: "stage-01-provider-contract",
        configArg: cfgPath,
        orchestratorRoot,
        dryRun: false,
        codexExecutor: async () =>
          ({
            command: "codex",
            args: [],
            cwd: orchestratorRoot,
            stdout: "",
            stderr: "",
            exitCode: 0,
            signal: null,
            durationMs: 10,
            success: true,
            outputLastMessagePath: path.join(orchestratorRoot, "mock-invalid-json.md"),
            outputLastMessage: "```json\nnot valid json\n```",
            skipped: false
          })
      }),
    /Reassessment output parse error: invalid JSON\./
  );
});

test("reassess-stage-plan returns no downstream stages without model execution or mutation", async () => {
  const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();
  const before = await readFile(stagePlanPath, "utf8");
  let modelCalled = false;

  const result = await reassessStagePlan({
    stagePlanArg: stagePlanPath,
    sourceStageId: "stage-03-docs",
    configArg: cfgPath,
    orchestratorRoot,
    dryRun: false,
    codexExecutor: async () => {
      modelCalled = true;
      throw new Error("should not execute model when there are no downstream stages");
    }
  });

  assert.equal(result.dryRun, false);
  assert.deepEqual(result.downstreamStageIds, []);
  assert.equal(result.reassessmentDir, undefined);
  assert.equal(modelCalled, false);
  const after = await readFile(stagePlanPath, "utf8");
  assert.equal(after, before);
  await assert.rejects(() => access(path.join(path.dirname(stagePlanPath), "reassessments")));
});

test("reassessment prompt includes source-stage context and classification-only guardrails", async () => {
  const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();
  const stageArtefactsDir = path.join(path.dirname(stagePlanPath), "stages", "stage-01-provider-contract");
  await mkdir(stageArtefactsDir, { recursive: true });
  await writeFile(path.join(stageArtefactsDir, "stage-report.md"), "Stage report says contract changed.", "utf8");
  await writeFile(path.join(stageArtefactsDir, "reviewer-output.md"), "Reviewer says adjust assumptions.", "utf8");
  await writeFile(path.join(stageArtefactsDir, "builder-output.md"), "Builder replaced legacy types.", "utf8");

  let capturedPrompt = "";
  await reassessStagePlan({
    stagePlanArg: stagePlanPath,
    sourceStageId: "stage-01-provider-contract",
    configArg: cfgPath,
    orchestratorRoot,
    dryRun: false,
    codexExecutor: async (request) => {
      capturedPrompt = request.prompt;
      return {
        command: "codex",
        args: [],
        cwd: orchestratorRoot,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 10,
        success: true,
        outputLastMessagePath: path.join(orchestratorRoot, "prompt-capture.md"),
        outputLastMessage: JSON.stringify({
          sourceStageId: "stage-01-provider-contract",
          results: [
            {
              stageId: "stage-02-provider-impl",
              classification: "unchanged",
              reason: "No downstream behavioral change."
            },
            {
              stageId: "stage-03-docs",
              classification: "unchanged",
              reason: "Docs still match assumptions."
            }
          ]
        }),
        skipped: false
      };
    }
  });

  assert.match(capturedPrompt, /## Source Stage/);
  assert.match(capturedPrompt, /- id: stage-01-provider-contract/);
  assert.match(capturedPrompt, /- title: Provider contract/);
  assert.match(capturedPrompt, /- status: accepted/);
  assert.match(capturedPrompt, /- revision: 1/);
  assert.match(capturedPrompt, /## Source Stage Change Context/);
  assert.match(capturedPrompt, /stage-report\.md/);
  assert.match(capturedPrompt, /reviewer-output\.md/);
  assert.match(capturedPrompt, /builder-output\.md/);
  assert.match(capturedPrompt, /Do not implement code\./);
  assert.match(capturedPrompt, /Do not rewrite downstream stage definitions\./);
  assert.match(capturedPrompt, /Return only structured JSON\./);
});

test("reassess-stage-plan rejects invalid reassessment JSON shapes", async () => {
  const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();

  const badOutputs = [
    {
      label: "missing downstream result",
      output: { sourceStageId: "stage-01-provider-contract", results: [] },
      pattern: /missing downstream result/
    },
    {
      label: "duplicate downstream result",
      output: {
        sourceStageId: "stage-01-provider-contract",
        results: [
          { stageId: "stage-02-provider-impl", classification: "unchanged", reason: "x" },
          { stageId: "stage-02-provider-impl", classification: "needs_revision", reason: "y" },
          { stageId: "stage-03-docs", classification: "unchanged", reason: "z" }
        ]
      },
      pattern: /duplicate stageId/
    },
    {
      label: "non-downstream result",
      output: {
        sourceStageId: "stage-01-provider-contract",
        results: [
          { stageId: "stage-01-provider-contract", classification: "unchanged", reason: "x" },
          { stageId: "stage-03-docs", classification: "unchanged", reason: "z" }
        ]
      },
      pattern: /not downstream/
    },
    {
      label: "unknown nonexistent stage id",
      output: {
        sourceStageId: "stage-01-provider-contract",
        results: [
          { stageId: "stage-02-provider-impl", classification: "unchanged", reason: "x" },
          { stageId: "stage-999-missing", classification: "unchanged", reason: "z" }
        ]
      },
      pattern: /unknown result stageId/
    },
    {
      label: "invalid classification",
      output: {
        sourceStageId: "stage-01-provider-contract",
        results: [
          { stageId: "stage-02-provider-impl", classification: "maybe", reason: "x" },
          { stageId: "stage-03-docs", classification: "unchanged", reason: "z" }
        ]
      },
      pattern: /classification must be one of/
    },
    {
      label: "empty reason",
      output: {
        sourceStageId: "stage-01-provider-contract",
        results: [
          { stageId: "stage-02-provider-impl", classification: "needs_revision", reason: "   " },
          { stageId: "stage-03-docs", classification: "unchanged", reason: "z" }
        ]
      },
      pattern: /reason must be non-empty/
    }
  ] as const;

  for (const specimen of badOutputs) {
    await assert.rejects(
      () =>
        reassessStagePlan({
          stagePlanArg: stagePlanPath,
          sourceStageId: "stage-01-provider-contract",
          configArg: cfgPath,
          orchestratorRoot,
          dryRun: false,
          codexExecutor: async () =>
            ({
              command: "codex",
              args: [],
              cwd: orchestratorRoot,
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              durationMs: 10,
              success: true,
              outputLastMessagePath: path.join(orchestratorRoot, `mock-${specimen.label}.md`),
              outputLastMessage: JSON.stringify(specimen.output),
              skipped: false
            })
        }),
      specimen.pattern
    );
  }
});

test("fix-stage --reassess-downstream triggers reassessment after successful fix and uses incremented revision", async () => {
  const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();
  const runDir = path.join(orchestratorRoot, "fake-fix-run");
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "06-planner-output-last-message.md"), "planner", "utf8");
  await writeFile(path.join(runDir, "builder-output-last-message.md"), "builder", "utf8");
  await writeFile(path.join(runDir, "reviewer-output-last-message.md"), "reviewer", "utf8");

  let reassessCalls = 0;
  let observedRevision = 0;

  const result = await fixStageFromPlan({
    stageId: "stage-01-provider-contract",
    stagePlanArg: stagePlanPath,
    configArg: cfgPath,
    feedback: "Provider abstraction changed.",
    orchestratorRoot,
    allowWrites: false,
    verbose: false,
    streamCodex: false,
    reassessDownstream: true,
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
      }) as Awaited<ReturnType<typeof import("../src/runner.js").runStage>>,
    reassessHandler: async () => {
      reassessCalls += 1;
      const plan = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
      observedRevision = plan.stages.find((s) => s.id === "stage-01-provider-contract")?.revision ?? 0;
      plan.stages.find((s) => s.id === "stage-02-provider-impl")!.status = "needs_revision";
      plan.status = "paused";
      plan.updatedAt = new Date().toISOString();
      await writeFile(stagePlanPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
      return {
        sourceStageId: "stage-01-provider-contract",
        sourceRevision: observedRevision,
        dryRun: false,
        stagePlanPath,
        reassessmentDir: path.join(path.dirname(stagePlanPath), "reassessments/stage-01-provider-contract/revision-2"),
        downstreamStageIds: ["stage-02-provider-impl", "stage-03-docs"],
        changedStatuses: [{ stageId: "stage-02-provider-impl", from: "review_required", to: "needs_revision" }],
        stagePlanStatusChanged: true
      };
    }
  });

  assert.equal(result.revision, 2);
  assert.equal(reassessCalls, 1);
  assert.equal(observedRevision, 2);
  assert.ok(result.reassessment);
});

test("fix-stage failed or pre-execution failure does not trigger reassessment", async () => {
  const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();
  let calls = 0;

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
        streamCodex: false,
        reassessDownstream: true,
        runHandler: async () => {
          throw new Error("fix failed");
        },
        reassessHandler: async () => {
          calls += 1;
          throw new Error("should not run");
        }
      }),
    /fix failed/
  );

  await assert.rejects(
    () =>
      fixStageFromPlan({
        stageId: "stage-01-provider-contract",
        stagePlanArg: stagePlanPath,
        configArg: "missing-config.json",
        feedback: "x",
        orchestratorRoot,
        allowWrites: false,
        verbose: false,
        streamCodex: false,
        reassessDownstream: true,
        reassessHandler: async () => {
          calls += 1;
          throw new Error("should not run");
        }
      }),
    /not found|ENOENT/i
  );

  assert.equal(calls, 0);
});

test("downstream needs_revision and invalidated block continue-stages after reassessment", async () => {
  for (const blockedStatus of ["needs_revision", "invalidated"] as const) {
    const { orchestratorRoot, stagePlanPath, cfgPath } = await setupPlan();
    const plan = JSON.parse(await readFile(stagePlanPath, "utf8")) as StagePlan;
    plan.stages.find((s) => s.id === "stage-02-provider-impl")!.status = blockedStatus;
    plan.updatedAt = new Date().toISOString();
    await writeFile(stagePlanPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

    await assert.rejects(
      () =>
        continueStagesFromPlan({
          stagePlanArg: stagePlanPath,
          configArg: cfgPath,
          orchestratorRoot,
          allowWrites: false,
          dryRun: true,
          verbose: false,
          streamCodex: false
        }),
      new RegExp(`status ${blockedStatus}`)
    );
  }
});
