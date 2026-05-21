import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { readEvidenceManifest, writeEvidenceManifest } from "../src/evidence/evidence-store.js";
import { updateEvidenceWithWriteAuditFiles } from "../src/evidence/write-audit-evidence.js";

test("updateEvidenceWithWriteAuditFiles merges write-audit files into evidence manifest", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "write-audit-evidence-"));
  await writeEvidenceManifest(runDir, {
    ...createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" }),
    git: { changedFiles: ["src/existing.ts"], untrackedFiles: [], unexpectedFiles: [] }
  });
  await mkdir(path.join(runDir, "write-audit", "builder"), { recursive: true });
  await writeFile(
    path.join(runDir, "write-audit", "builder", "summary.json"),
    JSON.stringify({ post: { changedFiles: ["src/a.ts"], untrackedFiles: ["tmp/a.txt"] }, changedFilesAddedByPhase: ["src/b.ts"] }),
    "utf8"
  );

  const updated = await updateEvidenceWithWriteAuditFiles(runDir);
  const persisted = await readEvidenceManifest(runDir);

  assert.deepEqual(updated.git.changedFiles, ["src/a.ts", "src/b.ts", "src/existing.ts"]);
  assert.deepEqual(updated.git.untrackedFiles, ["tmp/a.txt"]);
  assert.deepEqual(persisted.git.changedFiles, updated.git.changedFiles);
});
