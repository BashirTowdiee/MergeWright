import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureWriteAuditPostStateAndWriteArtefacts, captureWriteAuditPreState } from "../src/write-audit.js";
import { createGitInspectionClient, type GitInspectionExecutor } from "../src/git-inspection.js";

test("write-audit writes expected phase artefacts and summary paths are run-relative", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "write-audit-run-"));
  const workspaceRoot = "/tmp/workspace-a";
  let call = 0;
  const executor: GitInspectionExecutor = async (_command, args) => {
    call += 1;
    const key = args.join(" ");
    if (key === "status --porcelain") return { stdout: call <= 4 ? "" : " M src/a.ts\n?? src/new-file.ts\n", stderr: "", exitCode: 0, signal: null, success: true };
    if (key === "diff --name-only") return { stdout: call <= 4 ? "" : "src/a.ts\n", stderr: "", exitCode: 0, signal: null, success: true };
    if (key === "diff --stat") return { stdout: call <= 4 ? "" : " src/a.ts | 1 +\n", stderr: "", exitCode: 0, signal: null, success: true };
    if (key === "diff --binary") return { stdout: call <= 4 ? "" : "diff --git a/src/a.ts b/src/a.ts\n", stderr: "", exitCode: 0, signal: null, success: true };
    throw new Error(`unexpected command: ${key}`);
  };

  const git = createGitInspectionClient(executor);
  const pre = await captureWriteAuditPreState({ phase: "builder", workspaceRoot, git });
  const summary = await captureWriteAuditPostStateAndWriteArtefacts({ runDir, capture: pre, git });

  assert.equal(summary.phase, "builder");
  assert.deepEqual(summary.changedFilesAddedByPhase, ["src/a.ts", "src/new-file.ts"]);
  assert.ok(summary.artefacts.includes("write-audit/builder/summary.json"));
  assert.equal(summary.post.untrackedFiles.includes("src/new-file.ts"), true);
  assert.equal(summary.post.statusOnlyFiles.includes("src/new-file.ts"), true);
  assert.match(summary.note, /tracked git diff output only/);

  const summaryJson = JSON.parse(await readFile(path.join(runDir, "write-audit/builder/summary.json"), "utf8")) as {
    pre: { diffPath: string };
    post: { changedFiles: string[]; untrackedFiles: string[] };
    trackedDiffPatchArtefact: string;
  };
  assert.equal(summaryJson.pre.diffPath, "write-audit/builder/pre-diff.patch");
  assert.equal(summaryJson.trackedDiffPatchArtefact, "write-audit/builder/post-diff.patch");
  assert.equal(summaryJson.post.changedFiles.includes("src/new-file.ts"), true);
  assert.equal(summaryJson.post.untrackedFiles.includes("src/new-file.ts"), true);
});

test("write-audit uses only allowed read-only git inspection commands", async () => {
  const calls: string[] = [];
  const executor: GitInspectionExecutor = async (_command, args) => {
    calls.push(args.join(" "));
    return { stdout: "", stderr: "", exitCode: 0, signal: null, success: true };
  };
  const git = createGitInspectionClient(executor);

  const pre = await captureWriteAuditPreState({ phase: "fix", workspaceRoot: "/tmp/workspace-b", git });
  await captureWriteAuditPostStateAndWriteArtefacts({ runDir: await mkdtemp(path.join(os.tmpdir(), "write-audit-run-")), capture: pre, git });

  const unique = Array.from(new Set(calls)).sort();
  assert.deepEqual(unique, ["diff --binary", "diff --name-only", "diff --stat", "status --porcelain"]);
});

test("write-audit failure reports git command diagnostics clearly", async () => {
  const git = createGitInspectionClient(async (_command, args) => {
    if (args.join(" ") === "diff --binary") {
      return { stdout: "", stderr: "boom", exitCode: 2, signal: null, success: false };
    }
    return { stdout: "", stderr: "", exitCode: 0, signal: null, success: true };
  });

  await assert.rejects(
    () => captureWriteAuditPreState({ phase: "builder", workspaceRoot: "/tmp/workspace-c", git }),
    /pre-builder: git diff --binary failed/
  );
});

test("write-audit includes rename/copy porcelain paths in changed files", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "write-audit-run-"));
  const git = createGitInspectionClient(async (_command, args) => {
    const key = args.join(" ");
    if (key === "status --porcelain") {
      return { stdout: "R  old/path.ts -> new/path.ts\nC  src/base.ts -> src/base-copy.ts\n", stderr: "", exitCode: 0, signal: null, success: true };
    }
    if (key === "diff --name-only") {
      return { stdout: "", stderr: "", exitCode: 0, signal: null, success: true };
    }
    if (key === "diff --stat") {
      return { stdout: "", stderr: "", exitCode: 0, signal: null, success: true };
    }
    if (key === "diff --binary") {
      return { stdout: "", stderr: "", exitCode: 0, signal: null, success: true };
    }
    throw new Error(`unexpected command: ${key}`);
  });

  const pre = await captureWriteAuditPreState({ phase: "fix", workspaceRoot: "/tmp/workspace-r", git });
  const summary = await captureWriteAuditPostStateAndWriteArtefacts({ runDir, capture: pre, git });
  assert.equal(summary.post.changedFiles.includes("old/path.ts"), true);
  assert.equal(summary.post.changedFiles.includes("new/path.ts"), true);
  assert.equal(summary.post.changedFiles.includes("src/base.ts"), true);
  assert.equal(summary.post.changedFiles.includes("src/base-copy.ts"), true);
});
