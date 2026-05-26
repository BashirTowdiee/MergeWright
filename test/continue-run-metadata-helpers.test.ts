import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createInitialRunMetadata } from "../src/run-metadata.js";
import {
  assertRunOwnership,
  cloneMetadata,
  readRequiredRunMetadata,
  snapshotStatuses,
  validateRunMetadata
} from "../src/continue-run/metadata-helpers.js";

function createMetadata(overrides: Partial<ReturnType<typeof createInitialRunMetadata>> = {}) {
  return {
    ...createInitialRunMetadata({
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
    }),
    ...overrides
  };
}

test("validateRunMetadata accepts complete run metadata", () => {
  const metadata = createMetadata();

  assert.equal(validateRunMetadata(metadata, "run-1").runId, "run-1");
});

test("validateRunMetadata rejects run id mismatch", () => {
  const metadata = createMetadata();

  assert.throws(() => validateRunMetadata(metadata, "other-run"), /runId mismatch/);
});

test("validateRunMetadata rejects missing required phase metadata", () => {
  const metadata = createMetadata();
  delete (metadata.phases as Partial<typeof metadata.phases>).checks;

  assert.throws(() => validateRunMetadata(metadata, "run-1"), /phases.checks is required/);
});

test("readRequiredRunMetadata reads and validates run.json", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "continue-run-metadata-"));
  try {
    const runDir = path.join(root, "run-1");
    const metadata = createMetadata();
    await writeFile(path.join(runDir, "run.json"), JSON.stringify(metadata), "utf8").catch(async () => {
      await import("node:fs/promises").then(({ mkdir }) => mkdir(runDir, { recursive: true }));
      await writeFile(path.join(runDir, "run.json"), JSON.stringify(metadata), "utf8");
    });

    assert.equal((await readRequiredRunMetadata(runDir, "run-1")).runId, "run-1");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("assertRunOwnership validates run directory containment and project", () => {
  const metadata = createMetadata();
  const runsRoot = path.resolve("/tmp/runs");
  const runDir = path.join(runsRoot, "run-1");

  assert.doesNotThrow(() => assertRunOwnership(metadata, runDir, runsRoot, "example"));
  assert.throws(() => assertRunOwnership(metadata, path.join(runsRoot, "run-2"), runsRoot, "example"), /runId mismatch/);
  assert.throws(() => assertRunOwnership(metadata, path.resolve("/tmp/outside/run-1"), runsRoot, "example"), /outside configured runs root/);
  assert.throws(() => assertRunOwnership(metadata, runDir, runsRoot, "other"), /Run project mismatch/);
});

test("snapshotStatuses produces a stable phase status map", () => {
  const metadata = createMetadata();
  metadata.phases.planner.status = "executed";
  metadata.phases.builder.status = "failed";

  assert.deepEqual(snapshotStatuses(metadata), {
    planner: "executed",
    builder: "failed",
    reviewer: "unknown",
    fixPlanning: "unknown",
    fixExecution: "unknown",
    checks: "unknown"
  });
});

test("cloneMetadata returns a deep copy", () => {
  const metadata = createMetadata();
  const clone = cloneMetadata(metadata);

  clone.phases.planner.status = "executed";

  assert.equal(metadata.phases.planner.status, "unknown");
  assert.equal(clone.phases.planner.status, "executed");
});
