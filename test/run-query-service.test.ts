import test from "node:test";
import assert from "node:assert/strict";
import { createDemoRunReadModels } from "../src/application/read-models/demo-run-read-models.js";
import { InMemoryRunReadRepository } from "../src/application/queries/in-memory-run-read-repository.js";
import { DefaultRunQueryService } from "../src/application/queries/run-query-service.js";

function createService(): DefaultRunQueryService {
  const demo = createDemoRunReadModels();
  const repository = new InMemoryRunReadRepository({
    runs: demo.runs,
    runDetailsById: demo.runDetailsById
  });
  return new DefaultRunQueryService(repository);
}

test("DefaultRunQueryService lists all runs by default", async () => {
  const service = createService();

  const runs = await service.listRuns();

  assert.deepEqual(
    runs.map((run) => run.id),
    ["20260520-000002-review-failed", "20260520-000001-product-docs", "20260519-235959-provider-config"]
  );
});

test("DefaultRunQueryService filters runs by status", async () => {
  const service = createService();

  const runs = await service.listRuns({ status: "blocked" });

  assert.deepEqual(runs.map((run) => run.id), ["20260519-235959-provider-config"]);
});

test("DefaultRunQueryService returns run details by id", async () => {
  const service = createService();

  const run = await service.getRun({ runId: "20260520-000002-review-failed" });

  assert.equal(run?.title, "docs-site build");
  assert.equal(run?.phases.some((phase) => phase.id === "reviewer" && phase.status === "failed"), true);
});

test("DefaultRunQueryService returns null for blank or missing run ids", async () => {
  const service = createService();

  assert.equal(await service.getRun({ runId: "" }), null);
  assert.equal(await service.getRun({ runId: "missing-run" }), null);
});
