import test from "node:test";
import assert from "node:assert/strict";
import { createDemoRunReadModels } from "../src/application/read-models/demo-run-read-models.js";
import { createTuiSpikeFixture } from "../src/tui/spike-fixture.js";

test("createDemoRunReadModels provides reusable run summaries and details", () => {
  const demo = createDemoRunReadModels();

  assert.equal(demo.selectedRun.id, "20260520-000002-review-failed");
  assert.equal(demo.runs.length, 3);
  assert.equal(demo.runDetailsById[demo.selectedRun.id], demo.selectedRun);
  assert.ok(demo.selectedRun.phases.some((phase) => phase.id === "reviewer" && phase.status === "failed"));
});

test("createTuiSpikeFixture remains a compatibility wrapper over demo run read models", () => {
  const demo = createDemoRunReadModels();
  const fixture = createTuiSpikeFixture();

  assert.deepEqual(fixture.runs, demo.runs);
  assert.deepEqual(fixture.selectedRun, demo.selectedRun);
  assert.deepEqual(fixture.runDetailsById, demo.runDetailsById);
});
