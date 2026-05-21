import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { readEvidenceManifest, writeEvidenceManifest } from "../src/evidence/evidence-store.js";
import { updateEvidenceChecksSummary } from "../src/evidence/check-evidence.js";

test("updateEvidenceChecksSummary persists checks summary from checks-status", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "check-evidence-"));
  await writeEvidenceManifest(runDir, createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" }));
  await writeFile(path.join(runDir, "checks-status.json"), JSON.stringify({ state: "failed", failedChecks: ["npm test"] }), "utf8");

  const updated = await updateEvidenceChecksSummary(runDir);
  const persisted = await readEvidenceManifest(runDir);

  assert.deepEqual(updated.checks, { status: "failed", failed: ["npm test"], skipped: [] });
  assert.deepEqual(persisted.checks, updated.checks);
});

test("updateEvidenceChecksSummary records unknown when checks-status is missing", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "check-evidence-missing-"));
  await writeEvidenceManifest(runDir, createEvidenceManifest({ runId: "run-456", workspace: "/tmp/workspace" }));

  const updated = await updateEvidenceChecksSummary(runDir);

  assert.deepEqual(updated.checks, { status: "unknown", failed: [], skipped: [] });
});
