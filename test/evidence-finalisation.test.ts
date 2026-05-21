import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { readEvidenceManifest, writeEvidenceManifest } from "../src/evidence/evidence-store.js";
import { finaliseClassicRunEvidence } from "../src/workflows/classic-run/run-evidence-finalisation.js";

test("finaliseClassicRunEvidence updates manifest status and completion timestamp", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "evidence-finalisation-"));
  try {
    await writeEvidenceManifest(
      runDir,
      createEvidenceManifest({
        runId: "run-123",
        projectName: "Acme",
        stageName: "example-stage",
        workspace: "/repo/workspace",
        startedAt: "2026-05-21T00:00:00.000Z"
      })
    );

    await finaliseClassicRunEvidence({
      runDir,
      status: "pass",
      completedAt: "2026-05-21T00:01:00.000Z"
    });

    const evidence = await readEvidenceManifest(runDir);
    assert.equal(evidence.status, "pass");
    assert.equal(evidence.completedAt, "2026-05-21T00:01:00.000Z");
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("finaliseClassicRunEvidence can mark failed runs", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "evidence-finalisation-fail-"));
  try {
    await writeEvidenceManifest(
      runDir,
      createEvidenceManifest({
        runId: "run-456",
        workspace: "/repo/workspace",
        startedAt: "2026-05-21T00:00:00.000Z"
      })
    );

    await finaliseClassicRunEvidence({
      runDir,
      status: "fail",
      completedAt: "2026-05-21T00:02:00.000Z"
    });

    const evidence = await readEvidenceManifest(runDir);
    assert.equal(evidence.status, "fail");
    assert.equal(evidence.completedAt, "2026-05-21T00:02:00.000Z");
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});
