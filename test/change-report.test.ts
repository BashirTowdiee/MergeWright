import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { generateChangeReport } from "../src/change-report.js";

function reviewerMarkdown(verdict: "PASS" | "FAIL"): string {
  const blockingIssues =
    verdict === "FAIL"
      ? [
          {
            severity: "high",
            summary: "Critical bug",
            files: ["src/server/auth.ts"]
          }
        ]
      : [];
  return `# Reviewer\n\n\
\`\`\`json reviewer-verdict
${JSON.stringify({ verdict, blockingIssues, nonBlockingIssues: [] }, null, 2)}
\`\`\``;
}

async function createRunFixture(input?: {
  runStatus?: "success" | "failed";
  stageName?: string;
  postWriteReview?: { required: boolean; status: string };
  checksState?: string;
  reviewer?: "PASS" | "FAIL" | "missing";
  changedFiles?: string[];
  changedFilesAddedByPhase?: string[];
  untrackedFiles?: string[];
  stageText?: string;
  autoChainFinalStatus?: string;
  reviewerRaw?: string;
  checksRaw?: string;
  writeAuditBuilderRaw?: string;
  writeAuditFix?: { changedFiles?: string[]; changedFilesAddedByPhase?: string[]; untrackedFiles?: string[] };
}): Promise<string> {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "change-report-"));
  await mkdir(path.join(runDir, "write-audit/builder"), { recursive: true });

  const runJson = {
    version: 1,
    runId: "run-123",
    projectName: "acme",
    stageName: input?.stageName ?? "stage-02-add-request-logging",
    workspaceRoot: "/tmp/workspace",
    orchestratorRoot: "/tmp/orchestrator",
    configPath: "/tmp/orchestrator/config.json",
    startedAt: "2026-05-14T00:00:00.000Z",
    completedAt: "2026-05-14T00:01:00.000Z",
    status: input?.runStatus ?? "success",
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
    writeSafety: { state: "passed", allowWrites: true, status: "passed" },
    writeAudit: {
      builder: { status: "captured", artefacts: ["write-audit/builder/summary.json"] },
      fix: { status: "not-applicable" }
    },
    postWriteReview: {
      required: input?.postWriteReview?.required ?? true,
      status: input?.postWriteReview?.status ?? "completed",
      reason: "done",
      requiredByPhases: ["builder"],
      artefacts: ["post-write-review-status.json"]
    },
    phases: {
      planner: { status: "executed" },
      builder: { status: "executed" },
      reviewer: { status: "executed" },
      fixPlanning: { status: "disabled" },
      fixExecution: { status: "disabled" },
      checks: { status: "executed" }
    },
    artefacts: [],
    error: null,
    ...(input?.autoChainFinalStatus
      ? {
          autoChain: {
            enabled: true,
            finalStatus: input.autoChainFinalStatus,
            attemptsUsed: 1,
            maxFixAttempts: 2
          }
        }
      : {})
  };

  await writeFile(path.join(runDir, "run.json"), `${JSON.stringify(runJson, null, 2)}\n`, "utf8");
  await writeFile(path.join(runDir, "01-stage-input.md"), input?.stageText ?? "Implement feature", "utf8");

  if ((input?.reviewer ?? "PASS") !== "missing") {
    await writeFile(
      path.join(runDir, "reviewer-output-last-message.md"),
      input?.reviewerRaw ?? reviewerMarkdown((input?.reviewer ?? "PASS") as "PASS" | "FAIL"),
      "utf8"
    );
  }

  await writeFile(
    path.join(runDir, "checks-status.json"),
    input?.checksRaw ?? JSON.stringify({ state: input?.checksState ?? "executed" }, null, 2),
    "utf8"
  );

  if (input?.writeAuditBuilderRaw != null) {
    await writeFile(path.join(runDir, "write-audit/builder/summary.json"), input.writeAuditBuilderRaw, "utf8");
  } else {
    await writeFile(
      path.join(runDir, "write-audit/builder/summary.json"),
      JSON.stringify(
        {
          post: {
            changedFiles: input?.changedFiles ?? ["src/routes/api.ts"],
            untrackedFiles: input?.untrackedFiles ?? []
          },
          changedFilesAddedByPhase: input?.changedFilesAddedByPhase ?? ["src/routes/api.ts"]
        },
        null,
        2
      ),
      "utf8"
    );
  }

  if (input?.writeAuditFix) {
    await mkdir(path.join(runDir, "write-audit/fix"), { recursive: true });
    await writeFile(
      path.join(runDir, "write-audit/fix/summary.json"),
      JSON.stringify(
        {
          post: {
            changedFiles: input.writeAuditFix.changedFiles ?? [],
            untrackedFiles: input.writeAuditFix.untrackedFiles ?? []
          },
          changedFilesAddedByPhase: input.writeAuditFix.changedFilesAddedByPhase ?? []
        },
        null,
        2
      ),
      "utf8"
    );
  }

  return runDir;
}

test("ready report with reviewer PASS and checks passed", async () => {
  const runDir = await createRunFixture();
  const report = await generateChangeReport({ runDir });
  assert.equal(report.status, "READY");
  assert.equal(report.reviewer.verdict, "PASS");
  assert.equal(report.checks.state, "passed");
  assert.equal(report.suggestedCommitMessage, "Add request logging");
});

test("reviewer FAIL returns NEEDS_FIX", async () => {
  const runDir = await createRunFixture({ reviewer: "FAIL" });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.status, "NEEDS_FIX");
});

test("failed run returns BLOCKED", async () => {
  const runDir = await createRunFixture({ runStatus: "failed" });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.status, "BLOCKED");
});

test("pending post-write review returns BLOCKED", async () => {
  const runDir = await createRunFixture({ postWriteReview: { required: true, status: "pending" } });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.status, "BLOCKED");
});

test("checks failed returns NEEDS_FIX", async () => {
  const runDir = await createRunFixture({ checksState: "failed" });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.status, "NEEDS_FIX");
  assert.equal(report.checks.state, "failed");
});

test("missing reviewer output returns NEEDS_REVIEW with risk signal", async () => {
  const runDir = await createRunFixture({ reviewer: "missing" });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.status, "NEEDS_REVIEW");
  assert.equal(report.reviewer.verdict, "unavailable");
  assert.equal(report.riskSignals.includes("Reviewer output unavailable or unparsable."), true);
});

test("write audit changed files are collected and sorted", async () => {
  const runDir = await createRunFixture({
    changedFiles: ["z.ts", "a.ts"],
    changedFilesAddedByPhase: ["m.ts", "a.ts"]
  });
  const report = await generateChangeReport({ runDir });
  assert.deepEqual(report.changedFiles, ["a.ts", "m.ts", "z.ts"]);
});

test("dependency drift warning when package.json changed and stage says no dependencies", async () => {
  const runDir = await createRunFixture({
    changedFiles: ["package.json", "src/app.ts"],
    stageText: "No dependencies should be changed in this stage."
  });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.scopeDriftWarnings.some((w) => w.includes("Dependency files changed")), true);
});

test("auto-chain final status MAX_FIX_ATTEMPTS_REACHED returns NEEDS_FIX", async () => {
  const runDir = await createRunFixture({
    reviewer: "PASS",
    checksState: "executed",
    autoChainFinalStatus: "MAX_FIX_ATTEMPTS_REACHED"
  });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.status, "NEEDS_FIX");
});

test("score is clamped between 0 and 100", async () => {
  const lowRunDir = await createRunFixture({
    runStatus: "failed",
    reviewer: "FAIL",
    checksState: "failed",
    postWriteReview: { required: true, status: "failed" },
    changedFiles: ["package.json", "src/server/auth.ts"],
    changedFilesAddedByPhase: ["package.json", "src/server/auth.ts"],
    untrackedFiles: ["tmp.txt"],
    stageText: "No dependencies.\n\n## Scope\n- docs/readme.md"
  });
  const low = await generateChangeReport({ runDir: lowRunDir });
  assert.equal(low.score, 0);

  const highRunDir = await createRunFixture({
    reviewer: "PASS",
    checksState: "executed",
    changedFiles: ["docs/readme.md"],
    changedFilesAddedByPhase: ["docs/readme.md"],
    stageText: "Docs only"
  });
  const high = await generateChangeReport({ runDir: highRunDir });
  assert.equal(high.score, 100);
});

test("checklist includes untracked guidance only when untracked files exist", async () => {
  const withUntrackedDir = await createRunFixture({ untrackedFiles: ["tmp-a.txt"] });
  const withUntracked = await generateChangeReport({ runDir: withUntrackedDir });
  assert.equal(
    withUntracked.manualReviewChecklist.includes(
      "Inspect untracked files and decide whether they should be committed or removed."
    ),
    true
  );

  const withoutUntrackedDir = await createRunFixture({ untrackedFiles: [] });
  const withoutUntracked = await generateChangeReport({ runDir: withoutUntrackedDir });
  assert.equal(
    withoutUntracked.manualReviewChecklist.includes(
      "Inspect untracked files and decide whether they should be committed or removed."
    ),
    false
  );
});

test("scope parser ignores fenced code blocks and still parses real bullets", async () => {
  const runDir = await createRunFixture({
    stageText: `## Scope
\`\`\`md
- fake/in-fence.ts
- src/fence-only.ts
\`\`\`
- src/allowed.ts`,
    changedFiles: ["src/allowed.ts", "src/fence-only.ts"],
    changedFilesAddedByPhase: ["src/allowed.ts", "src/fence-only.ts"]
  });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.scopeDriftWarnings.includes("Files changed outside explicit Scope file list in stage text."), true);
});

test("malformed reviewer output becomes unavailable without crashing", async () => {
  const runDir = await createRunFixture({ reviewerRaw: "# bad reviewer output" });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.reviewer.verdict, "unavailable");
  assert.equal(report.riskSignals.includes("Reviewer output unavailable or unparsable."), true);
});

test("malformed checks-status.json becomes unknown with malformed signal", async () => {
  const runDir = await createRunFixture({ checksRaw: "{not-json" });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.checks.state, "unknown");
  assert.equal(report.riskSignals.includes("Checks status artefact is malformed."), true);
});

test("missing run.json yields soft-unknown report", async () => {
  const runDir = await createRunFixture();
  await rm(path.join(runDir, "run.json"));
  const report = await generateChangeReport({ runDir });
  assert.equal(report.runId, path.basename(runDir));
  assert.equal(report.projectName, null);
  assert.equal(report.stageName, null);
  assert.deepEqual(report.phases, {});
});

test("malformed write-audit summary does not crash and uses valid summary", async () => {
  const runDir = await createRunFixture({
    writeAuditBuilderRaw: "{bad-json",
    writeAuditFix: {
      changedFiles: ["src/routes/fix.ts"],
      changedFilesAddedByPhase: ["src/routes/fix.ts"]
    }
  });
  const report = await generateChangeReport({ runDir });
  assert.deepEqual(report.changedFiles, ["src/routes/fix.ts"]);
  assert.equal(report.riskSignals.includes("Write-audit summary artefact is malformed."), true);
});

test("untracked files aggregate from builder and fix summaries deduped and sorted", async () => {
  const runDir = await createRunFixture({
    untrackedFiles: ["z.tmp", "a.tmp"],
    writeAuditFix: { untrackedFiles: ["a.tmp", "m.tmp"] }
  });
  const report = await generateChangeReport({ runDir });
  assert.deepEqual(report.untrackedFiles, ["a.tmp", "m.tmp", "z.tmp"]);
  assert.equal(
    report.manualReviewChecklist.includes("Inspect untracked files and decide whether they should be committed or removed."),
    true
  );
});

test("high-risk changed file prevents READY and returns NEEDS_REVIEW when no blocking rules apply", async () => {
  const runDir = await createRunFixture({
    reviewer: "PASS",
    checksState: "executed",
    changedFiles: ["package.json"],
    changedFilesAddedByPhase: ["package.json"],
    stageText: "Update metadata"
  });
  const report = await generateChangeReport({ runDir });
  assert.notEqual(report.status, "READY");
  assert.equal(report.status, "NEEDS_REVIEW");
});

test("explicit Scope drift warning prevents READY", async () => {
  const runDir = await createRunFixture({
    reviewer: "PASS",
    checksState: "executed",
    stageText: "## Scope\n- src/allowed.ts",
    changedFiles: ["src/allowed.ts", "src/outside.ts"],
    changedFilesAddedByPhase: ["src/allowed.ts", "src/outside.ts"]
  });
  const report = await generateChangeReport({ runDir });
  assert.equal(report.scopeDriftWarnings.includes("Files changed outside explicit Scope file list in stage text."), true);
  assert.notEqual(report.status, "READY");
});

test("missing run directory throws clear error", async () => {
  const missingDir = path.join(os.tmpdir(), "change-report-missing-dir-does-not-exist");
  await assert.rejects(() => generateChangeReport({ runDir: missingDir }), /Run directory not found or unreadable:/);
});
