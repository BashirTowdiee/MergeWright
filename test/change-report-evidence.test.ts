import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { writeEvidenceManifest } from "../src/evidence/evidence-store.js";
import { generateChangeReport } from "../src/change-report.js";

async function createRunFixture(): Promise<string> {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "change-report-evidence-"));
  await mkdir(path.join(runDir, "write-audit/builder"), { recursive: true });
  await writeFile(
    path.join(runDir, "run.json"),
    JSON.stringify(
      {
        version: 1,
        runId: "run-123",
        projectName: "acme",
        stageName: "stage-01-test",
        workspaceRoot: "/tmp/workspace",
        orchestratorRoot: "/tmp/orchestrator",
        configPath: "/tmp/orchestrator/config.json",
        startedAt: "2026-05-21T00:00:00.000Z",
        completedAt: "2026-05-21T00:01:00.000Z",
        status: "success",
        resolvedOptions: {
          dryRun: false,
          allowWrites: true,
          executePlanner: true,
          executeBuilder: true,
          executeReviewer: true,
          planFix: false,
          executeFix: false,
          runChecks: true
        },
        writeSafety: { state: "passed", allowWrites: true },
        postWriteReview: { required: false, status: "completed" },
        phases: {},
        artefacts: [],
        error: null
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(path.join(runDir, "01-stage-input.md"), "Implement feature", "utf8");
  await writeFile(path.join(runDir, "reviewer-output-last-message.md"), "", "utf8");
  await writeFile(path.join(runDir, "checks-status.json"), JSON.stringify({ state: "executed" }), "utf8");
  await writeFile(
    path.join(runDir, "write-audit/builder/summary.json"),
    JSON.stringify(
      {
        post: { changedFiles: ["src/from-audit.ts"], untrackedFiles: ["tmp/from-audit.txt"] },
        changedFilesAddedByPhase: ["src/from-audit.ts"]
      },
      null,
      2
    ),
    "utf8"
  );
  return runDir;
}

test("change report includes changed and untracked files from evidence manifest", async () => {
  const runDir = await createRunFixture();
  const manifest = createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" });
  await writeEvidenceManifest(runDir, {
    ...manifest,
    git: {
      ...manifest.git,
      changedFiles: ["src/from-evidence.ts", "src/from-audit.ts"],
      untrackedFiles: ["tmp/from-evidence.txt", "tmp/from-audit.txt"],
      unexpectedFiles: []
    }
  });

  const report = await generateChangeReport({ runDir });

  assert.deepEqual(report.changedFiles, ["src/from-audit.ts", "src/from-evidence.ts"]);
  assert.deepEqual(report.untrackedFiles, ["tmp/from-audit.txt", "tmp/from-evidence.txt"]);
});
