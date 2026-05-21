import assert from "node:assert/strict";
import test from "node:test";
import { collectWriteAuditGitFiles } from "../src/evidence/write-audit-git-files.js";

test("collectWriteAuditGitFiles dedupes changed and untracked files from summaries", () => {
  const result = collectWriteAuditGitFiles(
    {
      post: {
        changedFiles: ["src/b.ts", "src/a.ts"],
        untrackedFiles: ["tmp/b.txt"]
      },
      changedFilesAddedByPhase: ["src/c.ts", "src/a.ts"]
    },
    {
      post: {
        changedFiles: ["src/d.ts"],
        untrackedFiles: ["tmp/a.txt", "tmp/b.txt", ""]
      },
      changedFilesAddedByPhase: ["src/b.ts"]
    }
  );

  assert.deepEqual(result, {
    changedFiles: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"],
    untrackedFiles: ["tmp/a.txt", "tmp/b.txt"]
  });
});

test("collectWriteAuditGitFiles ignores malformed summaries", () => {
  const result = collectWriteAuditGitFiles(null, "bad", { post: { changedFiles: "bad", untrackedFiles: ["tmp/a.txt"] } });

  assert.deepEqual(result, {
    changedFiles: [],
    untrackedFiles: ["tmp/a.txt"]
  });
});
