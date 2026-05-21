import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { readEvidenceManifest, writeEvidenceManifest } from "../src/evidence/evidence-store.js";
import { refreshClassicRunEvidence } from "../src/workflows/classic-run/run-evidence-refresh.js";

test("refreshClassicRunEvidence refreshes write-audit git file evidence", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "classic-evidence-refresh-"));
  await writeEvidenceManifest(runDir, createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" }));
  await mkdir(path.join(runDir, "write-audit", "builder"), { recursive: true });
  await writeFile(
    path.join(runDir, "write-audit", "builder", "summary.json"),
    JSON.stringify({ post: { changedFiles: ["src/a.ts"], untrackedFiles: ["tmp/a.txt"] } }),
    "utf8"
  );

  await refreshClassicRunEvidence(runDir);
  const evidence = await readEvidenceManifest(runDir);

  assert.deepEqual(evidence.git.changedFiles, ["src/a.ts"]);
  assert.deepEqual(evidence.git.untrackedFiles, ["tmp/a.txt"]);
});
