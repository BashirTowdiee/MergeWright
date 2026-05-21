import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEvidenceManifest } from "../src/evidence/evidence-manifest.js";
import { writeEvidenceManifest } from "../src/evidence/evidence-store.js";
import { formatChangeReportMarkdown, generateChangeReport } from "../src/change-report.js";

async function createRunFixture(): Promise<string> {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "change-report-evidence-status-"));
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
    JSON.stringify({ post: { changedFiles: [], untrackedFiles: [] }, changedFilesAddedByPhase: [] }, null, 2),
    "utf8"
  );
  return runDir;
}

test("change report exposes evidence manifest status", async () => {
  const runDir = await createRunFixture();
  await writeEvidenceManifest(runDir, {
    ...createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" }),
    status: "pass",
    completedAt: "2026-05-21T00:01:00.000Z"
  });

  const report = await generateChangeReport({ runDir });

  assert.deepEqual(report.evidence, {
    available: true,
    status: "pass",
    completedAt: "2026-05-21T00:01:00.000Z"
  });
  const markdown = formatChangeReportMarkdown(report);
  assert.equal(markdown.includes("## Evidence"), true);
  assert.equal(markdown.includes("- Available: true"), true);
  assert.equal(markdown.includes("- Status: pass"), true);
  assert.equal(markdown.includes("- Completed at: 2026-05-21T00:01:00.000Z"), true);
});

test("change report marks evidence missing when evidence.json is absent", async () => {
  const runDir = await createRunFixture();
  const report = await generateChangeReport({ runDir });

  assert.deepEqual(report.evidence, {
    available: false,
    status: "missing",
    completedAt: null
  });
});
