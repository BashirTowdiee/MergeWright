import test from "node:test";
import assert from "node:assert/strict";
import { createInitialRunMetadata } from "../src/run-metadata.js";
import { assertRunOwnership, snapshotStatuses, validateRunMetadata } from "../src/workflows/continuation/metadata.js";

function buildMetadata() {
  return createInitialRunMetadata({
    runId: "run-abc",
    projectName: "Acme",
    stageName: "S1",
    workspaceRoot: "/tmp/workspace",
    orchestratorRoot: "/tmp/orchestrator",
    configPath: "/tmp/orchestrator/config.json",
    resolvedOptions: {
      dryRun: false,
      allowWrites: false,
      executePlanner: true,
      executeBuilder: true,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false
    }
  });
}

test("validateRunMetadata accepts valid metadata", () => {
  const metadata = buildMetadata();
  const parsed = validateRunMetadata(metadata, metadata.runId);
  assert.equal(parsed.runId, metadata.runId);
});

test("validateRunMetadata rejects missing workspaceRoot", () => {
  const metadata = buildMetadata() as unknown as Record<string, unknown>;
  delete metadata.workspaceRoot;
  assert.throws(() => validateRunMetadata(metadata, "run-abc"), {
    message: /Invalid run metadata: workspaceRoot must be a non-empty string\./
  });
});

test("assertRunOwnership rejects run id mismatch", () => {
  const metadata = buildMetadata();
  assert.throws(() => assertRunOwnership(metadata, "/tmp/orchestrator/runs/acme/other-run", "/tmp/orchestrator/runs/acme", "Acme"), {
    message: /run\.json runId mismatch/
  });
});

test("snapshotStatuses reports fallback unknown values", () => {
  const metadata = buildMetadata();
  metadata.phases.builder = undefined as unknown as never;
  const snapshot = snapshotStatuses(metadata);
  assert.equal(snapshot.builder, "unknown");
  assert.equal(snapshot.planner, "unknown");
});
