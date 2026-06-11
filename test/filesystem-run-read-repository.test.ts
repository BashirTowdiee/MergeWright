import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { FilesystemRunReadRepository } from "../src/application/queries/filesystem-run-read-repository.js";

async function createRunFixture(): Promise<{ runsRoot: string; runId: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mw-run-read-"));
  const runsRoot = path.join(root, "runs");
  const runId = "run-2026-05-31-demo";
  const runDir = path.join(runsRoot, runId);

  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "01-stage-input.md"), "# stage\n", "utf8");
  await writeFile(path.join(runDir, "reviewer-output-last-message.md"), "- high: docs drift\n- low: cleanup", "utf8");
  await writeFile(
    path.join(runDir, "run.json"),
    JSON.stringify(
      {
        version: 1,
        runId,
        projectName: "mergewright",
        stageName: "demo",
        workspaceRoot: "/tmp/workspace",
        orchestratorRoot: root,
        configPath: "/tmp/config.json",
        startedAt: "2026-05-31T00:00:00.000Z",
        completedAt: null,
        status: "running",
        resolvedOptions: {
          dryRun: true,
          allowWrites: false,
          executePlanner: true,
          executeBuilder: false,
          executeReviewer: false,
          planFix: false,
          executeFix: false,
          runChecks: false
        },
        postWriteReview: {
          required: false,
          status: "not-required",
          reason: "none",
          requiredByPhases: [],
          artefacts: []
        },
        phases: {
          planner: { status: "executed" },
          builder: { status: "unknown" },
          reviewer: { status: "failed" },
          fixPlanning: { status: "unknown" },
          fixExecution: { status: "unknown" },
          checks: { status: "unknown" }
        },
        artefacts: ["01-stage-input.md", "reviewer-output-last-message.md"],
        error: { message: "review failed", failedPhase: "reviewer" }
      },
      null,
      2
    ),
    "utf8"
  );

  await writeFile(
    path.join(runDir, "run-report.json"),
    JSON.stringify(
      {
        runId,
        status: "NEEDS_FIX",
        score: 61,
        risk: "medium",
        checks: { state: "failed" },
        reviewer: { verdict: "FAIL" },
        changedFiles: ["docs/roadmap/delivery-harness.md"]
      },
      null,
      2
    ),
    "utf8"
  );

  return { runsRoot, runId };
}

async function createAuditedFlowFixture(): Promise<{ runsRoot: string; runId: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mw-audited-run-read-"));
  const runsRoot = path.join(root, "runs");
  const runId = "audited-20260609-feature-standard";
  const runDir = path.join(runsRoot, runId);

  await mkdir(path.join(runDir, "stages", "checks"), { recursive: true });
  await writeFile(
    path.join(runDir, "run-contract.json"),
    JSON.stringify(
      {
        goal: "Run audited flow checks",
        workspace: "/tmp/audited-workspace",
        flow: "feature-standard",
        stages: [{ id: "checks", kind: "check", executor: "shell-check", model: "gpt-5.5" }]
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(runDir, "result.json"),
    JSON.stringify(
      {
        runId,
        status: "failed",
        dryRun: false,
        auditPath: path.join(runDir, "audit.ndjson"),
        artefactsDir: runDir,
        stageResults: [
          {
            stageId: "checks",
            kind: "check",
            executor: "shell-check",
            status: "failed",
            summary: 'Check "unit" failed with exit code 2',
            artefacts: [{ kind: "json", path: "checks-status.json" }]
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(path.join(runDir, "audit.ndjson"), '{"type":"run.failed"}\n', "utf8");
  await writeFile(path.join(runDir, "stages", "checks", "checks-status.json"), '{ "state": "failed" }\n', "utf8");

  return { runsRoot, runId };
}

test("FilesystemRunReadRepository lists run summaries", async () => {
  const fixture = await createRunFixture();
  const repository = new FilesystemRunReadRepository({ runsRoot: fixture.runsRoot });

  const runs = await repository.listRuns();

  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.id, fixture.runId);
  assert.equal(runs[0]?.title, "demo");
  assert.equal(runs[0]?.status, "running");
});

test("FilesystemRunReadRepository returns detailed run models", async () => {
  const fixture = await createRunFixture();
  const repository = new FilesystemRunReadRepository({ runsRoot: fixture.runsRoot });

  const run = await repository.getRun(fixture.runId);

  assert.ok(run);
  assert.equal(run?.id, fixture.runId);
  assert.equal(run?.workspaceRoot, "/tmp/workspace");
  assert.equal(run?.readiness?.status, "NEEDS_FIX");
  assert.equal(run?.reviewerFindings.length, 2);
  assert.equal(run?.safeActions.some((action) => action.id === "continue"), true);
});

test("FilesystemRunReadRepository detects audited flow runs from contract and result artefacts", async () => {
  const fixture = await createAuditedFlowFixture();
  const repository = new FilesystemRunReadRepository({ runsRoot: fixture.runsRoot });

  const runs = await repository.listRuns();
  const run = await repository.getRun(fixture.runId);

  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.id, fixture.runId);
  assert.equal(runs[0]?.title, "Run audited flow checks");
  assert.equal(runs[0]?.status, "failed");
  assert.ok(run);
  assert.equal(run?.workspaceRoot, "/tmp/audited-workspace");
  assert.equal(run?.provider, "shell-check");
  assert.equal(run?.readiness?.checksState, "failed");
  assert.match(run?.blockedReason ?? "", /Check "unit" failed with exit code 2/);
  assert.equal(run?.artefacts.some((artifact) => artifact.path === "stages/checks/checks-status.json"), true);
});
