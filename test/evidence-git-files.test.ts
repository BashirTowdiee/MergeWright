import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { mergeEvidenceGitFiles } from "../src/evidence/evidence-git-files.js";

test("mergeEvidenceGitFiles dedupes and sorts git file lists", () => {
  const manifest = createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" });
  const updated = mergeEvidenceGitFiles({
    manifest: {
      ...manifest,
      git: {
        ...manifest.git,
        changedFiles: ["src/b.ts"],
        untrackedFiles: ["tmp/b.txt"],
        unexpectedFiles: ["secret.env"]
      }
    },
    changedFiles: ["src/a.ts", "src/b.ts", ""],
    untrackedFiles: ["tmp/a.txt", "tmp/b.txt"],
    unexpectedFiles: ["secret.env", "debug.log"]
  });

  assert.deepEqual(updated.git.changedFiles, ["src/a.ts", "src/b.ts"]);
  assert.deepEqual(updated.git.untrackedFiles, ["tmp/a.txt", "tmp/b.txt"]);
  assert.deepEqual(updated.git.unexpectedFiles, ["debug.log", "secret.env"]);
});
