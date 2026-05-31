import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createDemoRunReadModels } from "../src/application/read-models/demo-run-read-models.js";
import { DefaultArtifactQueryService } from "../src/application/queries/artifact-query-service.js";
import { FilesystemRunReadRepository } from "../src/application/queries/filesystem-run-read-repository.js";
import { InMemoryRunReadRepository } from "../src/application/queries/in-memory-run-read-repository.js";

function createService(): DefaultArtifactQueryService {
  const demo = createDemoRunReadModels();
  const repository = new InMemoryRunReadRepository({
    runs: demo.runs,
    runDetailsById: demo.runDetailsById
  });
  return new DefaultArtifactQueryService(repository);
}

test("DefaultArtifactQueryService lists artifacts for a run", async () => {
  const service = createService();

  const artifacts = await service.listArtifacts({ runId: "20260520-000002-review-failed" });

  assert.deepEqual(
    artifacts.map((artifact) => artifact.id),
    ["planner-output", "builder-output", "reviewer-output", "run-metadata"]
  );
});

test("DefaultArtifactQueryService filters artifacts by phase", async () => {
  const service = createService();

  const artifacts = await service.listArtifacts({ runId: "20260520-000002-review-failed", phaseId: "reviewer" });

  assert.deepEqual(artifacts.map((artifact) => artifact.id), ["reviewer-output"]);
});

test("DefaultArtifactQueryService returns phase-scoped artifact groups", async () => {
  const service = createService();

  const view = await service.listPhaseArtifacts({ runId: "20260520-000002-review-failed" });

  assert.ok(view);
  assert.equal(view?.runId, "20260520-000002-review-failed");
  const reviewerPhase = view?.phases.find((phase) => phase.id === "reviewer");
  assert.ok(reviewerPhase);
  assert.deepEqual(reviewerPhase?.artifacts.map((artifact) => artifact.id), ["reviewer-output"]);
  assert.deepEqual(view?.unassignedArtifacts.map((artifact) => artifact.id), ["run-metadata"]);
});

test("DefaultArtifactQueryService returns artifact details by id", async () => {
  const service = createService();

  const artifact = await service.getArtifact({ runId: "20260520-000002-review-failed", artifactId: "run-metadata" });

  assert.equal(artifact?.title, "run.json");
  assert.equal(artifact?.kind, "json");
});

test("DefaultArtifactQueryService handles blank and missing lookups", async () => {
  const service = createService();

  assert.deepEqual(await service.listArtifacts({ runId: "" }), []);
  assert.deepEqual(await service.listArtifacts({ runId: "missing-run" }), []);
  assert.equal(await service.listPhaseArtifacts({ runId: "" }), null);
  assert.equal(await service.listPhaseArtifacts({ runId: "missing-run" }), null);
  assert.equal(await service.getArtifact({ runId: "20260520-000002-review-failed", artifactId: "" }), null);
  assert.equal(await service.getArtifact({ runId: "20260520-000002-review-failed", artifactId: "missing-artifact" }), null);
});

test("DefaultArtifactQueryService reads artifact content with deterministic truncation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mw-artifact-content-"));
  const runsRoot = path.join(root, "runs");
  const runId = "run-2026-05-31-content";
  const runDir = path.join(runsRoot, runId);

  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "run.json"), JSON.stringify({
    version: 1,
    runId,
    projectName: "mergewright",
    stageName: "content-test",
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
      reviewer: { status: "unknown" },
      fixPlanning: { status: "unknown" },
      fixExecution: { status: "unknown" },
      checks: { status: "unknown" }
    },
    artefacts: ["planner-output.md"]
  }, null, 2), "utf8");
  await writeFile(path.join(runDir, "planner-output.md"), "1234567890", "utf8");

  const repository = new FilesystemRunReadRepository({ runsRoot });
  const service = new DefaultArtifactQueryService(repository);
  const result = await service.getArtifactContent({ runId, artifactId: "planner-output.md", maxBytes: 4 });

  assert.ok(result);
  assert.equal(result?.artifact.id, "planner-output.md");
  assert.equal(result?.content, "1234");
  assert.equal(result?.truncated, true);
  assert.equal(result?.maxBytes, 4);
});
