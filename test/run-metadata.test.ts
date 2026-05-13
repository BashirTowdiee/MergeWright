import test from "node:test";
import assert from "node:assert/strict";
import {
  addRunArtefact,
  createInitialRunMetadata,
  markRunFailure,
  markRunSuccess,
  updateRunPhase
} from "../src/run-metadata.js";

test("initial metadata includes run identity/context/options and running status", () => {
  const metadata = createInitialRunMetadata({
    runId: "20260511-123456-example-stage",
    projectName: "Acme",
    stageName: "example-stage",
    preset: "full-readonly",
    workspaceRoot: "/tmp/workspace",
    orchestratorRoot: "/tmp/orchestrator",
    configPath: "/tmp/orchestrator/configs/acme.json",
    resolvedOptions: {
      dryRun: false,
      executePlanner: true,
      executeBuilder: true,
      executeReviewer: true,
      planFix: true,
      executeFix: true,
      runChecks: true,
      allowWrites: false
    }
  });

  assert.equal(metadata.runId, "20260511-123456-example-stage");
  assert.equal(metadata.projectName, "Acme");
  assert.equal(metadata.stageName, "example-stage");
  assert.equal(metadata.status, "running");
  assert.equal(metadata.resolvedOptions.executePlanner, true);
});

test("add artefact stores relative path and de-duplicates", () => {
  const metadata = createInitialRunMetadata({
    runId: "r1",
    projectName: "Acme",
    stageName: "s",
    workspaceRoot: "/tmp/w",
    orchestratorRoot: "/tmp/o",
    configPath: "/tmp/c",
    resolvedOptions: {
      dryRun: true,
      executePlanner: false,
      executeBuilder: false,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false,
      allowWrites: false
    }
  });
  addRunArtefact(metadata, "./01-stage-input.md");
  addRunArtefact(metadata, "01-stage-input.md");
  assert.deepEqual(metadata.artefacts, ["01-stage-input.md"]);
});

test("phase update stores status/reason/artefacts", () => {
  const metadata = createInitialRunMetadata({
    runId: "r1",
    projectName: "Acme",
    stageName: "s",
    workspaceRoot: "/tmp/w",
    orchestratorRoot: "/tmp/o",
    configPath: "/tmp/c",
    resolvedOptions: {
      dryRun: true,
      executePlanner: false,
      executeBuilder: false,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false,
      allowWrites: false
    }
  });
  updateRunPhase(metadata, "planner", { status: "skipped", reason: "dryRun", artefacts: ["a.md", "a.md"] });
  assert.equal(metadata.phases.planner.status, "skipped");
  assert.equal(metadata.phases.planner.reason, "dryRun");
  assert.deepEqual(metadata.phases.planner.artefacts, ["a.md"]);
});

test("mark success sets status and completedAt", () => {
  const metadata = createInitialRunMetadata({
    runId: "r1",
    projectName: "Acme",
    stageName: "s",
    workspaceRoot: "/tmp/w",
    orchestratorRoot: "/tmp/o",
    configPath: "/tmp/c",
    resolvedOptions: {
      dryRun: true,
      executePlanner: false,
      executeBuilder: false,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false,
      allowWrites: false
    }
  });
  markRunSuccess(metadata, new Date("2026-05-11T12:35:10.000Z"));
  assert.equal(metadata.status, "success");
  assert.equal(metadata.completedAt, "2026-05-11T12:35:10.000Z");
});

test("mark failure sets failed status, completedAt, and error summary", () => {
  const metadata = createInitialRunMetadata({
    runId: "r1",
    projectName: "Acme",
    stageName: "s",
    workspaceRoot: "/tmp/w",
    orchestratorRoot: "/tmp/o",
    configPath: "/tmp/c",
    resolvedOptions: {
      dryRun: true,
      executePlanner: false,
      executeBuilder: false,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false,
      allowWrites: false
    }
  });
  markRunFailure(metadata, new Error("boom"), "builder", new Date("2026-05-11T12:35:10.000Z"));
  assert.equal(metadata.status, "failed");
  assert.equal(metadata.completedAt, "2026-05-11T12:35:10.000Z");
  assert.equal(metadata.error?.message, "boom");
  assert.equal(metadata.error?.failedPhase, "builder");
});
