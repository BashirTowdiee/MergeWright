import test from "node:test";
import assert from "node:assert/strict";
import { createInitialRunMetadata } from "../src/run-metadata.js";
import { ensurePhaseExecuted, ensurePhaseNotExecuted, ensurePlannerExecuted } from "../src/continue-run/phase-guards.js";

function createMetadata() {
  return createInitialRunMetadata({
    runId: "run-1",
    projectName: "Example",
    stageName: "stage-a",
    workspaceRoot: "/workspace",
    orchestratorRoot: "/orchestrator",
    configPath: "/orchestrator/config.json",
    resolvedOptions: {
      dryRun: false,
      allowWrites: false,
      executePlanner: true,
      executeBuilder: false,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false
    },
    startedAt: new Date("2026-01-01T00:00:00.000Z")
  });
}

test("ensurePlannerExecuted accepts executed planner metadata", () => {
  const metadata = createMetadata();
  metadata.phases.planner.status = "executed";

  assert.doesNotThrow(() => ensurePlannerExecuted(metadata));
});

test("ensurePlannerExecuted rejects non-executed planner metadata", () => {
  const metadata = createMetadata();

  assert.throws(() => ensurePlannerExecuted(metadata), /Continuation requires planner phase executed in run\.json/);
});

test("ensurePhaseExecuted accepts executed phase metadata", () => {
  const metadata = createMetadata();
  metadata.phases.reviewer.status = "executed";

  assert.doesNotThrow(() => ensurePhaseExecuted(metadata, "reviewer", "reviewer required"));
});

test("ensurePhaseExecuted rejects non-executed phase metadata with supplied message", () => {
  const metadata = createMetadata();

  assert.throws(() => ensurePhaseExecuted(metadata, "reviewer", "reviewer required"), /reviewer required/);
});

test("ensurePhaseNotExecuted accepts phases that have not executed", () => {
  const metadata = createMetadata();

  assert.doesNotThrow(() => ensurePhaseNotExecuted(metadata, "builder", "Builder"));
});

test("ensurePhaseNotExecuted rejects already executed phases", () => {
  const metadata = createMetadata();
  metadata.phases.builder.status = "executed";

  assert.throws(
    () => ensurePhaseNotExecuted(metadata, "builder", "Builder"),
    /Builder continuation is not allowed because the phase is already executed\./
  );
});
