import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { backfillEvidenceFromRunArtefacts } from "../src/evidence/evidence-backfill.js";
import { readEvidenceManifest } from "../src/evidence/evidence-store.js";

async function createRunDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "evidence-backfill-"));
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

test("backfillEvidenceFromRunArtefacts populates manifest from existing artefacts", async () => {
  const runDir = await createRunDir();
  try {
    await writeJson(path.join(runDir, "run.json"), {
      version: 1,
      runId: "run-123",
      projectName: "MergeWright",
      stageName: "Evidence backfill",
      workspaceRoot: "/workspace/project",
      startedAt: "2026-05-21T01:00:00.000Z",
      completedAt: "2026-05-21T01:01:00.000Z",
      status: "success",
      artefacts: ["builder-output.md"],
      phases: {},
      resolvedOptions: {},
      postWriteReview: { required: false, status: "not-required", reason: "none", requiredByPhases: [], artefacts: [] },
      error: null
    });
    await writeJson(path.join(runDir, "write-audit", "builder", "summary.json"), {
      changedFilesAddedByPhase: ["src/new-file.ts"],
      post: {
        changedFiles: ["src/existing-file.ts"],
        untrackedFiles: ["scratch.md"]
      }
    });
    await writeJson(path.join(runDir, "write-audit", "fix", "summary.json"), {
      post: {
        changedFiles: ["test/new-file.test.ts"],
        untrackedFiles: []
      }
    });
    await writeJson(path.join(runDir, "checks-status.json"), {
      state: "executed"
    });
    await writeFile(
      path.join(runDir, "reviewer-output-last-message.md"),
      '```json reviewer-verdict\n{"verdict":"PASS","blockingIssues":[],"nonBlockingIssues":[{"severity":"low","summary":"Docs could be expanded","files":["README.md"]}]}\n```\n',
      "utf8"
    );

    const result = await backfillEvidenceFromRunArtefacts(runDir);

    assert.equal(result.manifest.runId, "run-123");
    assert.equal(result.manifest.status, "pass");
    assert.equal(result.manifest.projectName, "MergeWright");
    assert.equal(result.manifest.stageName, "Evidence backfill");
    assert.equal(result.manifest.workspace, "/workspace/project");
    assert.deepEqual(result.manifest.git.changedFiles, [
      "src/existing-file.ts",
      "src/new-file.ts",
      "test/new-file.test.ts"
    ]);
    assert.deepEqual(result.manifest.git.untrackedFiles, ["scratch.md"]);
    assert.equal(result.manifest.reviewer?.verdict, "PASS");
    assert.deepEqual(result.manifest.reviewer?.nonBlockingIssues, [
      { severity: "low", summary: "Docs could be expanded", files: ["README.md"] }
    ]);
    assert.deepEqual(result.manifest.checks, { status: "passed", failed: [], skipped: [] });
    assert.deepEqual(result.diagnostics.malformedArtefacts, []);
    assert.equal(result.manifest.artefacts.some((artefact) => artefact.path === "write-audit/builder/summary.json"), true);

    const saved = await readEvidenceManifest(runDir);
    assert.deepEqual(saved, result.manifest);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("backfillEvidenceFromRunArtefacts represents malformed reviewer and checks explicitly", async () => {
  const runDir = await createRunDir();
  try {
    await writeJson(path.join(runDir, "run.json"), {
      version: 1,
      runId: "run-malformed",
      projectName: "MergeWright",
      stageName: "Malformed artefacts",
      workspaceRoot: "/workspace/project",
      startedAt: "2026-05-21T01:00:00.000Z",
      completedAt: null,
      status: "failed",
      artefacts: [],
      phases: {},
      resolvedOptions: {},
      postWriteReview: { required: false, status: "not-required", reason: "none", requiredByPhases: [], artefacts: [] },
      error: null
    });
    await writeFile(path.join(runDir, "checks-status.json"), "{not-json", "utf8");
    await writeFile(path.join(runDir, "reviewer-output-last-message.md"), "reviewer did not emit structured verdict", "utf8");

    const result = await backfillEvidenceFromRunArtefacts(runDir, { write: false });

    assert.equal(result.manifest.status, "fail");
    assert.equal(result.manifest.reviewer?.verdict, "UNKNOWN");
    assert.deepEqual(result.manifest.checks, {
      status: "unknown",
      failed: ["Malformed checks-status.json"],
      skipped: []
    });
    assert.deepEqual(result.diagnostics.malformedArtefacts, [
      "checks-status.json",
      "reviewer-output-last-message.md"
    ]);
    assert.equal(
      result.manifest.risk?.reasons.includes("Malformed evidence artefact: reviewer-output-last-message.md"),
      true
    );

    await assert.rejects(() => readFile(path.join(runDir, "evidence.json"), "utf8"));
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("backfillEvidenceFromRunArtefacts uses directory name when run metadata is missing", async () => {
  const runDir = await createRunDir();
  try {
    const result = await backfillEvidenceFromRunArtefacts(runDir, { write: false });

    assert.equal(result.manifest.runId, path.basename(runDir));
    assert.equal(result.manifest.status, "unknown");
    assert.equal(result.manifest.checks?.status, "unknown");
    assert.equal(result.diagnostics.missingArtefacts.includes("run.json"), true);
    assert.equal(result.diagnostics.missingArtefacts.includes("reviewer-output-last-message.md"), true);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});
