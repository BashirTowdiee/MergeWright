import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { readEvidenceManifest, writeEvidenceManifest } from "../src/evidence/evidence-store.js";
import { finaliseClassicRunFailure } from "../src/workflows/classic-run/run-failure.js";

test("finaliseClassicRunFailure refreshes git evidence", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "failure-evidence-"));
  await writeEvidenceManifest(runDir, createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" }));
  await mkdir(path.join(runDir, "write-audit", "builder"), { recursive: true });
  await writeFile(
    path.join(runDir, "write-audit", "builder", "summary.json"),
    JSON.stringify({ post: { changedFiles: ["src/a.ts"] } }),
    "utf8"
  );

  await assert.rejects(
    finaliseClassicRunFailure({
      error: new Error("boom"),
      failedPhase: "builder",
      metadata: { status: "running", phases: {}, artefacts: [] } as never,
      persistMetadata: async () => {},
      progressLogger: { phaseFailed: () => {}, info: () => {} } as never,
      runDir
    }),
    /boom/
  );

  const evidence = await readEvidenceManifest(runDir);
  assert.equal(evidence.status, "fail");
  assert.deepEqual(evidence.git.changedFiles, ["src/a.ts"]);
});
