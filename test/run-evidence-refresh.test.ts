import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { readEvidenceManifest, writeEvidenceManifest } from "../src/evidence/evidence-store.js";
import { refreshRunEvidence } from "../src/evidence/run-evidence-refresh.js";

function reviewerMarkdown(json: object): string {
  return ["Review result", "```json reviewer-verdict", JSON.stringify(json), "```"].join("\n");
}

test("refreshRunEvidence updates write-audit, reviewer, and checks sections", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "run-evidence-refresh-"));
  await writeEvidenceManifest(runDir, createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" }));
  await mkdir(path.join(runDir, "write-audit", "builder"), { recursive: true });
  await writeFile(
    path.join(runDir, "write-audit", "builder", "summary.json"),
    JSON.stringify({ post: { changedFiles: ["src/a.ts"], untrackedFiles: ["tmp/a.txt"] } }),
    "utf8"
  );
  await writeFile(
    path.join(runDir, "reviewer-output-last-message.md"),
    reviewerMarkdown({ verdict: "PASS", blockingIssues: [], nonBlockingIssues: [] }),
    "utf8"
  );
  await writeFile(path.join(runDir, "checks-status.json"), JSON.stringify({ state: "executed" }), "utf8");

  await refreshRunEvidence(runDir);
  const evidence = await readEvidenceManifest(runDir);

  assert.deepEqual(evidence.git.changedFiles, ["src/a.ts"]);
  assert.deepEqual(evidence.git.untrackedFiles, ["tmp/a.txt"]);
  assert.equal(evidence.reviewer?.verdict, "PASS");
  assert.deepEqual(evidence.checks, { status: "passed", failed: [], skipped: [] });
});
