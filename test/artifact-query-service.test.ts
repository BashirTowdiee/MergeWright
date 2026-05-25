import test from "node:test";
import assert from "node:assert/strict";
import { createDemoRunReadModels } from "../src/application/read-models/demo-run-read-models.js";
import { DefaultArtifactQueryService } from "../src/application/queries/artifact-query-service.js";
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
  assert.equal(await service.getArtifact({ runId: "20260520-000002-review-failed", artifactId: "" }), null);
  assert.equal(await service.getArtifact({ runId: "20260520-000002-review-failed", artifactId: "missing-artifact" }), null);
});
