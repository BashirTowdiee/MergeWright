import test from "node:test";
import assert from "node:assert/strict";
import { resolvePipelinePreset } from "../src/presets.js";

test("plan resolves to planner only", () => {
  const resolved = resolvePipelinePreset("plan");
  assert.deepEqual(resolved, {
    executePlanner: true,
    executeBuilder: false,
    executeReviewer: false,
    planFix: false,
    executeFix: false,
    runChecks: false
  });
});

test("build resolves to planner + builder", () => {
  const resolved = resolvePipelinePreset("build");
  assert.equal(resolved.executePlanner, true);
  assert.equal(resolved.executeBuilder, true);
  assert.equal(resolved.executeReviewer, false);
});

test("review resolves to planner + builder + reviewer", () => {
  const resolved = resolvePipelinePreset("review");
  assert.equal(resolved.executePlanner, true);
  assert.equal(resolved.executeBuilder, true);
  assert.equal(resolved.executeReviewer, true);
});

test("fix-plan resolves to planner + reviewer + planFix", () => {
  const resolved = resolvePipelinePreset("fix-plan");
  assert.equal(resolved.executePlanner, true);
  assert.equal(resolved.executeBuilder, false);
  assert.equal(resolved.executeReviewer, true);
  assert.equal(resolved.planFix, true);
});

test("full-readonly resolves to all readonly stages and checks", () => {
  const resolved = resolvePipelinePreset("full-readonly");
  assert.equal(resolved.executePlanner, true);
  assert.equal(resolved.executeBuilder, true);
  assert.equal(resolved.executeReviewer, true);
  assert.equal(resolved.planFix, true);
  assert.equal(resolved.executeFix, true);
  assert.equal(resolved.runChecks, true);
});

test("unknown preset fails clearly", () => {
  assert.throws(() => resolvePipelinePreset("unknown"), /Unknown preset/);
});
