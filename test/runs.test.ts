import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  listRunDirectories,
  readRunDetails,
  readRunSummary,
  resolveRunDir,
  resolveRunsRoot,
  validateRunId,
  type RunStatuses
} from "../src/runs.js";
import type { OrchestratorConfig } from "../src/config.js";

function fixtureConfig(runsDir = "runs/acme"): OrchestratorConfig {
  return {
    version: 1,
    projectName: "acme",
    workspaceRoot: "/tmp/workspace",
    paths: { stagesDir: "stages/acme", promptsDir: "prompts", runsDir },
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
    },
    writeSafety: {
      enabled: false,
      allowedBranches: ["feature/*", "bugfix/*", "chore/*"],
      blockedPaths: [".git/", ".env", ".env.*", "*.p12", "*.mobileprovision", "fastlane/", "DistributionKit/"],
      requireCleanWorkingTree: true,
      requireExplicitAllowWrites: true,
      captureDiffBeforeAfter: true,
      requireReviewAfterWrites: true,
      autoCommit: false,
      autoPush: false
    }
  };
}

test("validateRunId accepts simple folder names", () => {
  assert.doesNotThrow(() => validateRunId("20260513-000000-example-stage"));
  assert.doesNotThrow(() => validateRunId("run_1.2-abc"));
});

test("validateRunId rejects traversal and separators", () => {
  assert.throws(() => validateRunId("../bad"), /Invalid run id/);
  assert.throws(() => validateRunId("bad/name"), /Invalid run id/);
  assert.throws(() => validateRunId("bad\\name"), /Invalid run id/);
});

test("validateRunId rejects absolute paths", () => {
  assert.throws(() => validateRunId("/tmp/evil"), /absolute paths are not allowed/);
});

test("resolveRunDir stays under runs root", () => {
  const runDir = resolveRunDir("/tmp/orchestrator/runs/acme", "20260513-000000-example");
  assert.equal(runDir, "/tmp/orchestrator/runs/acme/20260513-000000-example");
});

test("resolveRunsRoot resolves from config and enforces orchestrator root containment", () => {
  const root = resolveRunsRoot("/tmp/orchestrator", fixtureConfig());
  assert.equal(root, "/tmp/orchestrator/runs/acme");
  assert.throws(() => resolveRunsRoot("/tmp/orchestrator", fixtureConfig("../runs/acme")), /must resolve inside orchestrator root/);
});

test("listRunDirectories returns empty for empty runs directory", async () => {
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), "runs-empty-"));
  const runIds = await listRunDirectories(runsRoot);
  assert.deepEqual(runIds, []);
});

test("listRunDirectories sorts newest first", async () => {
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), "runs-sort-"));
  const oldRun = path.join(runsRoot, "20260513-000000-old");
  const newRun = path.join(runsRoot, "20260513-000001-new");
  await mkdir(oldRun, { recursive: true });
  await mkdir(newRun, { recursive: true });

  const oldDate = new Date("2026-05-12T00:00:00.000Z");
  const newDate = new Date("2026-05-13T00:00:00.000Z");
  await utimes(oldRun, oldDate, oldDate);
  await utimes(newRun, newDate, newDate);

  const runIds = await listRunDirectories(runsRoot);
  assert.deepEqual(runIds, ["20260513-000001-new", "20260513-000000-old"]);
});

test("readRunDetails fails clearly for missing run", async () => {
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), "runs-missing-"));
  await assert.rejects(() => readRunDetails(runsRoot, "20260513-000000-missing"), /Run does not exist/);
});

test("readRunDetails uses run.json when present", async () => {
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), "runs-meta-"));
  const runId = "20260513-000000-example-stage";
  const runDir = path.join(runsRoot, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "01-stage-input.md"), "stage", "utf8");
  await writeFile(
    path.join(runDir, "run.json"),
    JSON.stringify(
      {
        version: 1,
        runId,
        projectName: "Acme",
        stageName: "example-stage",
        preset: "full-readonly",
        workspaceRoot: "/tmp/workspace",
        orchestratorRoot: "/tmp/orchestrator",
        configPath: "/tmp/orchestrator/configs/acme.json",
        startedAt: "2026-05-11T12:34:56.000Z",
        completedAt: "2026-05-11T12:35:10.000Z",
        status: "failed",
        resolvedOptions: {},
        phases: {
          planner: { status: "executed" },
          builder: { status: "failed" },
          reviewer: { status: "skipped" },
          fixPlanning: { status: "disabled" },
          fixExecution: { status: "disabled" },
          checks: { status: "unknown" }
        },
        artefacts: ["01-stage-input.md", "builder-exit.json"],
        error: { message: "Builder failed", failedPhase: "builder" }
      },
      null,
      2
    ),
    "utf8"
  );

  const details = await readRunDetails(runsRoot, runId);
  assert.equal(details.status, "failed");
  assert.equal(details.projectName, "Acme");
  assert.equal(details.preset, "full-readonly");
  assert.equal(details.statuses.builder, "failed");
  assert.equal(details.errorSummary, "Builder failed");
  assert.deepEqual(details.artefacts, ["01-stage-input.md", "builder-exit.json"]);
});

test("older run without run.json still works through fallback", async () => {
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), "runs-status-"));
  const runId = "20260513-000000-example-stage";
  const runDir = path.join(runsRoot, runId);
  await mkdir(path.join(runDir, "checks"), { recursive: true });
  await writeFile(path.join(runDir, "01-stage-input.md"), "stage", "utf8");
  await writeFile(path.join(runDir, "07-planner-exit.json"), "{}", "utf8");
  await writeFile(path.join(runDir, "builder-output.placeholder.md"), "skipped", "utf8");
  await writeFile(path.join(runDir, "reviewer-exit.json"), "{}", "utf8");
  await writeFile(path.join(runDir, "review-to-fix-skipped.json"), "{}", "utf8");
  await writeFile(path.join(runDir, "checks-status.json"), JSON.stringify({ state: "skipped by dry-run" }), "utf8");

  const details = await readRunDetails(runsRoot, runId);
  const statuses: RunStatuses = details.statuses;
  assert.equal(statuses.planner, "executed");
  assert.equal(statuses.builder, "skipped");
  assert.equal(statuses.reviewer, "executed");
  assert.equal(statuses.fixPlanning, "skipped");
  assert.equal(statuses.fixExecution, "unknown");
  assert.equal(statuses.checks, "skipped");
  assert.equal(details.status, "unknown");
});

test("malformed run.json does not break summary/details", async () => {
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), "runs-bad-meta-"));
  const runId = "20260513-000000-example-stage";
  const runDir = path.join(runsRoot, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "run.json"), "{not-json", "utf8");
  await writeFile(path.join(runDir, "01-stage-input.md"), "stage", "utf8");

  const summary = await readRunSummary(runsRoot, runId);
  assert.equal(summary.status, "unknown");
  assert.equal(summary.warnings.length > 0, true);

  const details = await readRunDetails(runsRoot, runId);
  assert.equal(details.warnings.length > 0, true);
});
