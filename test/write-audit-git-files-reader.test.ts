import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readWriteAuditGitFiles } from "../src/evidence/write-audit-git-files.js";

test("readWriteAuditGitFiles reads builder and fix summaries from a run directory", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "audit-files-"));
  await mkdir(path.join(runDir, "write-audit", "builder"), { recursive: true });
  await mkdir(path.join(runDir, "write-audit", "fix"), { recursive: true });
  await writeFile(
    path.join(runDir, "write-audit", "builder", "summary.json"),
    JSON.stringify({ post: { changedFiles: ["src/b.ts"], untrackedFiles: ["tmp/b.txt"] } }),
    "utf8"
  );
  await writeFile(
    path.join(runDir, "write-audit", "fix", "summary.json"),
    JSON.stringify({ post: { changedFiles: ["src/a.ts"], untrackedFiles: ["tmp/a.txt"] }, changedFilesAddedByPhase: ["src/c.ts"] }),
    "utf8"
  );

  assert.deepEqual(await readWriteAuditGitFiles(runDir), {
    changedFiles: ["src/a.ts", "src/b.ts", "src/c.ts"],
    untrackedFiles: ["tmp/a.txt", "tmp/b.txt"]
  });
});

test("readWriteAuditGitFiles treats missing or malformed summaries as empty", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "audit-files-empty-"));
  await mkdir(path.join(runDir, "write-audit", "builder"), { recursive: true });
  await writeFile(path.join(runDir, "write-audit", "builder", "summary.json"), "{", "utf8");

  assert.deepEqual(await readWriteAuditGitFiles(runDir), {
    changedFiles: [],
    untrackedFiles: []
  });
});
