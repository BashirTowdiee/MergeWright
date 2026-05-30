import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectRunForTui, listRunsForTui, readArtefactForTui, getAvailableActionsForTui } from "../src/tui/read-model.js";
import type { RunMetadata } from "../src/run-metadata.js";

async function createRunsRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "tui-read-model-"));
}

async function createRun(input: {
  runsRoot: string;
  runId: string;
  metadata?: Partial<RunMetadata>;
  files?: Record<string, string>;
}): Promise<string> {
  const runDir = path.join(input.runsRoot, input.runId);
  await mkdir(runDir, { recursive: true });
  const metadata = input.metadata;
  if (metadata) {
    await writeFile(path.join(runDir, "run.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  }
  for (const [relativePath, content] of Object.entries(input.files ?? {})) {
    const filePath = path.join(runDir, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }
  return runDir;
}

function baseMetadata(runId: string, patch: Partial<RunMetadata> = {}): RunMetadata {
  return {
    version: 1,
    runId,
    projectName: "MergeWright",
    stageName: "docs-site-build",
    preset: "full-readonly",
    workspaceRoot: "/tmp/workspace",
    orchestratorRoot: "/tmp/orchestrator",
    configPath: "configs/test.json",
    startedAt: "2026-05-20T00:00:00.000Z",
    completedAt: "2026-05-20T00:01:00.000Z",
    status: "success",
    resolvedOptions: {
      dryRun: false,
      allowWrites: false,
      executePlanner: true,
      executeBuilder: true,
      executeReviewer: true,
      planFix: false,
      executeFix: false,
      runChecks: true
    },
    postWriteReview: {
      required: false,
      status: "not-required",
      reason: "no writes",
      requiredByPhases: [],
      artefacts: []
    },
    phases: {
      planner: { status: "executed", artefacts: ["06-planner-output-last-message.md"] },
      builder: { status: "executed", artefacts: ["builder-output-last-message.md"] },
      reviewer: { status: "executed", artefacts: ["reviewer-output-last-message.md"] },
      fixPlanning: { status: "skipped" },
      fixExecution: { status: "skipped" },
      checks: { status: "executed", artefacts: ["checks-status.json"] }
    },
    artefacts: [
      "06-planner-output-last-message.md",
      "builder-output-last-message.md",
      "reviewer-output-last-message.md",
      "checks-status.json"
    ],
    error: null,
    ...patch
  };
}

test("listRunsForTui maps run summaries into sorted TUI list items", async () => {
  const runsRoot = await createRunsRoot();
  await createRun({
    runsRoot,
    runId: "20260520-000000-first",
    metadata: baseMetadata("20260520-000000-first"),
    files: { "reviewer-output-last-message.md": "PASS" }
  });
  await createRun({
    runsRoot,
    runId: "20260520-000001-second",
    metadata: baseMetadata("20260520-000001-second", {
      status: "failed",
      error: { message: "Reviewer failed", failedPhase: "reviewer" },
      phases: {
        ...baseMetadata("x").phases,
        reviewer: { status: "failed", artefacts: ["reviewer-output-last-message.md"] }
      }
    }),
    files: { "reviewer-output-last-message.md": "- High: issue" }
  });

  const runs = await listRunsForTui({ runsRoot });
  assert.equal(runs.length, 2);
  assert.equal(runs[0]?.id, "20260520-000001-second");
  assert.equal(runs[0]?.status, "failed");
  assert.equal(runs[0]?.mode, "read-only");

  const failedRuns = await listRunsForTui({ runsRoot, filter: "failed" });
  assert.deepEqual(
    failedRuns.map((run) => run.id),
    ["20260520-000001-second"]
  );
});

test("inspectRunForTui maps phases, artefacts, findings, and safe actions", async () => {
  const runsRoot = await createRunsRoot();
  const runId = "20260520-000002-review-failed";
  await createRun({
    runsRoot,
    runId,
    metadata: baseMetadata(runId, {
      status: "failed",
      error: { message: "Reviewer found blocking issue", failedPhase: "reviewer" },
      phases: {
        ...baseMetadata("x").phases,
        reviewer: { status: "failed", artefacts: ["reviewer-output-last-message.md"] },
        checks: { status: "unknown" }
      },
      artefacts: ["06-planner-output-last-message.md", "reviewer-output-last-message.md", "run.json"]
    }),
    files: {
      "06-planner-output-last-message.md": "# Plan",
      "reviewer-output-last-message.md": "- High: route assumes optional metadata exists\n- Low: docs wording"
    }
  });

  const detail = await inspectRunForTui({ runsRoot, runId });
  assert.equal(detail.id, runId);
  assert.equal(detail.status, "failed");
  assert.equal(detail.blockedReason, "Reviewer found blocking issue");
  assert.equal(detail.phases.find((phase) => phase.id === "reviewer")?.status, "failed");
  assert.equal(detail.artefacts.find((artefact) => artefact.path === "reviewer-output-last-message.md")?.kind, "markdown");
  assert.equal(detail.reviewerFindings.length, 2);
  assert.equal(detail.reviewerFindings[0]?.severity, "high");
  assert.equal(detail.safeActions.find((action) => action.id === "request-fix")?.enabled, true);
  assert.equal(detail.safeActions.find((action) => action.id === "generate-report")?.enabled, true);
});

test("readArtefactForTui returns kind-specific renderable artefacts", async () => {
  const runsRoot = await createRunsRoot();
  const runId = "20260520-000003-artefacts";
  await createRun({
    runsRoot,
    runId,
    files: {
      "notes.md": "# Notes\n",
      "metadata.json": "{\"ok\":true}\n",
      "stdout.log": "one\ntwo\n",
      "change.patch": "diff --git a/a b/a\n"
    }
  });

  const markdown = await readArtefactForTui({ runsRoot, runId, artefactId: "notes.md" });
  assert.equal(markdown.kind, "markdown");
  assert.equal(markdown.content, "# Notes\n");

  const json = await readArtefactForTui({ runsRoot, runId, artefactId: "metadata.json" });
  assert.equal(json.kind, "json");
  assert.deepEqual(json.value, { ok: true });

  const log = await readArtefactForTui({ runsRoot, runId, artefactId: "stdout.log" });
  assert.equal(log.kind, "log");
  assert.deepEqual(log.lines.slice(0, 2), ["one", "two"]);

  const diff = await readArtefactForTui({ runsRoot, runId, artefactId: "change.patch" });
  assert.equal(diff.kind, "diff");
});

test("readArtefactForTui rejects path traversal", async () => {
  const runsRoot = await createRunsRoot();
  const runId = "20260520-000004-safe-path";
  await createRun({ runsRoot, runId, files: { "notes.md": "safe" } });

  await assert.rejects(() => readArtefactForTui({ runsRoot, runId, artefactId: "../outside.md" }), /Invalid artefact path/);
});

test("getAvailableActionsForTui explains blocked actions for completed runs", async () => {
  const runsRoot = await createRunsRoot();
  const runId = "20260520-000005-complete";
  await createRun({ runsRoot, runId, metadata: baseMetadata(runId), files: { "reviewer-output-last-message.md": "PASS" } });

  const actions = await getAvailableActionsForTui({ runsRoot, runId });
  assert.equal(actions.find((action) => action.id === "open-run-folder")?.enabled, true);
  assert.equal(actions.find((action) => action.id === "request-fix")?.enabled, false);
  assert.match(actions.find((action) => action.id === "request-fix")?.blockedReason ?? "", /Reviewer or fix planning/);
});

test("inspectRunForTui surfaces readiness snapshot from run report", async () => {
  const runsRoot = await createRunsRoot();
  const runId = "20260520-000006-report-readiness";
  await createRun({
    runsRoot,
    runId,
    metadata: baseMetadata(runId),
    files: {
      "reviewer-output-last-message.md": "PASS",
      "run-report.json": JSON.stringify(
        {
          status: "NEEDS_REVIEW",
          score: 73,
          risk: "medium",
          changedFiles: ["src/a.ts", "docs/b.md"],
          checks: { state: "unknown" },
          reviewer: { verdict: "unavailable" },
          riskSignals: ["Reviewer output unavailable or unparsable.", "Low-priority note."],
          evidence: { available: false }
        },
        null,
        2
      )
    }
  });

  const detail = await inspectRunForTui({ runsRoot, runId });
  assert.equal(detail.readiness?.source, "report");
  assert.equal(detail.readiness?.status, "NEEDS_REVIEW");
  assert.equal(detail.readiness?.score, 73);
  assert.equal(detail.readiness?.risk, "medium");
  assert.equal(detail.readiness?.checksState, "unknown");
  assert.equal(detail.readiness?.reviewerVerdict, "unavailable");
  assert.equal(detail.readiness?.changedFileCount, 2);
  assert.equal(detail.readiness?.missingEvidenceWarnings.includes("Reviewer output unavailable or unparsable."), true);
  assert.equal(
    detail.readiness?.missingEvidenceWarnings.includes("Evidence manifest unavailable; report was collected from fallback artefacts."),
    true
  );
  assert.equal(detail.warnings.some((warning) => warning.startsWith("evidence: ")), true);
});

test("inspectRunForTui falls back to evidence manifest readiness when run report is absent", async () => {
  const runsRoot = await createRunsRoot();
  const runId = "20260520-000007-evidence-readiness";
  await createRun({
    runsRoot,
    runId,
    metadata: baseMetadata(runId),
    files: {
      "reviewer-output-last-message.md": "PASS",
      "evidence.json": JSON.stringify(
        {
          version: 1,
          runId,
          status: "needs_review",
          workspace: "/tmp/workspace",
          startedAt: "2026-05-20T00:00:00.000Z",
          git: {
            changedFiles: ["src/tui/read-model.ts"],
            untrackedFiles: [],
            unexpectedFiles: []
          },
          commands: [],
          artefacts: [],
          checks: { status: "passed", failed: [], skipped: [] },
          reviewer: { verdict: "PASS" },
          readiness: { verdict: "FAIL", score: 67, blockers: [], warnings: ["Acceptance evidence missing."] },
          risk: { level: "high", reasons: [] }
        },
        null,
        2
      )
    }
  });

  const detail = await inspectRunForTui({ runsRoot, runId });
  assert.equal(detail.readiness?.source, "evidence");
  assert.equal(detail.readiness?.status, "NEEDS_FIX");
  assert.equal(detail.readiness?.score, 67);
  assert.equal(detail.readiness?.risk, "high");
  assert.equal(detail.readiness?.checksState, "passed");
  assert.equal(detail.readiness?.reviewerVerdict, "PASS");
  assert.equal(detail.readiness?.changedFileCount, 1);
  assert.equal(detail.readiness?.missingEvidenceWarnings.includes("Acceptance evidence missing."), true);
});

test("inspectRunForTui reports fallback readiness when no report or evidence manifest exists", async () => {
  const runsRoot = await createRunsRoot();
  const runId = "20260520-000008-no-readiness-artefacts";
  await createRun({
    runsRoot,
    runId,
    metadata: baseMetadata(runId),
    files: { "reviewer-output-last-message.md": "PASS" }
  });

  const detail = await inspectRunForTui({ runsRoot, runId });
  assert.equal(detail.readiness?.source, "fallback");
  assert.equal(detail.readiness?.status, "unknown");
  assert.equal(detail.readiness?.checksState, "unknown");
  assert.equal(detail.readiness?.reviewerVerdict, "UNKNOWN");
  assert.equal(detail.readiness?.missingEvidenceWarnings.length, 2);
});
