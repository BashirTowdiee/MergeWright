import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DEFAULT_CHANGE_REPORT_POLICY,
  formatChangeReportJson,
  formatChangeReportMarkdown,
  formatPrSummaryMarkdown,
  generateAndWriteChangeReport,
  generateAndWritePrSummary,
  generateChangeReport,
  writeChangeReport,
  writePrSummary
} from "../src/change-report.js";
import type { ChangeReport } from "../src/change-report.js";

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
  assert.equal((report.checks as { malformed?: boolean }).malformed, true);
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

test("custom high-risk policy path marks file high risk", async () => {
  const runDir = await createRunFixture({ changedFiles: ["Package.swift"], changedFilesAddedByPhase: ["Package.swift"] });
  const report = await generateChangeReport({
    runDir,
    policy: {
      ...DEFAULT_CHANGE_REPORT_POLICY,
      riskRules: {
        ...DEFAULT_CHANGE_REPORT_POLICY.riskRules,
        highRiskPaths: ["Package.swift"]
      }
    }
  });
  assert.equal(report.risk, "high");
});

test("custom medium-risk path marks file medium risk and high risk wins", async () => {
  const runDir = await createRunFixture({
    changedFiles: ["Sources/main.swift", "Package.swift"],
    changedFilesAddedByPhase: ["Sources/main.swift", "Package.swift"]
  });
  const policy = {
    ...DEFAULT_CHANGE_REPORT_POLICY,
    riskRules: {
      highRiskPaths: ["Package.swift"],
      mediumRiskPaths: ["Sources/"],
      lowRiskPaths: ["docs/"]
    }
  };
  const report = await generateChangeReport({ runDir, policy });
  assert.equal(report.risk, "high");
});

test("low-risk rules do not override high or medium matches", async () => {
  const runDir = await createRunFixture({
    changedFiles: ["docs/security-notes.md"],
    changedFilesAddedByPhase: ["docs/security-notes.md"]
  });
  const report = await generateChangeReport({
    runDir,
    policy: {
      ...DEFAULT_CHANGE_REPORT_POLICY,
      riskRules: {
        highRiskPaths: ["security"],
        mediumRiskPaths: [],
        lowRiskPaths: ["docs/"]
      }
    }
  });
  assert.equal(report.risk, "high");
});

test("risk matching is stable across path separators", async () => {
  const runDir = await createRunFixture({
    changedFiles: ["src\\server\\handler.ts"],
    changedFilesAddedByPhase: ["src\\server\\handler.ts"]
  });
  const report = await generateChangeReport({
    runDir,
    policy: {
      ...DEFAULT_CHANGE_REPORT_POLICY,
      riskRules: {
        highRiskPaths: [],
        mediumRiskPaths: ["src/server/"],
        lowRiskPaths: []
      }
    }
  });
  assert.equal(report.risk, "medium");
});

test("scope drift policy can suppress or relax drift warnings", async () => {
  const disabledRunDir = await createRunFixture({
    stageText: "## Scope\n- src/allowed.ts",
    changedFiles: ["src/outside.ts"],
    changedFilesAddedByPhase: ["src/outside.ts"]
  });
  const disabled = await generateChangeReport({
    runDir: disabledRunDir,
    policy: {
      ...DEFAULT_CHANGE_REPORT_POLICY,
      scopeDrift: { enabled: false, allowUnlistedTestFiles: false, allowUnlistedDocsFiles: false }
    }
  });
  assert.equal(disabled.scopeDriftWarnings.length, 0);

  const allowTestsRunDir = await createRunFixture({
    stageText: "## Scope\n- src/allowed.ts",
    changedFiles: ["tests/new.test.ts"],
    changedFilesAddedByPhase: ["tests/new.test.ts"]
  });
  const allowTests = await generateChangeReport({
    runDir: allowTestsRunDir,
    policy: {
      ...DEFAULT_CHANGE_REPORT_POLICY,
      scopeDrift: { enabled: true, allowUnlistedTestFiles: true, allowUnlistedDocsFiles: false }
    }
  });
  assert.equal(allowTests.scopeDriftWarnings.includes("Files changed outside explicit Scope file list in stage text."), false);

  const allowDocsRunDir = await createRunFixture({
    stageText: "## Scope\n- src/allowed.ts",
    changedFiles: ["docs/notes.md"],
    changedFilesAddedByPhase: ["docs/notes.md"]
  });
  const allowDocs = await generateChangeReport({
    runDir: allowDocsRunDir,
    policy: {
      ...DEFAULT_CHANGE_REPORT_POLICY,
      scopeDrift: { enabled: true, allowUnlistedTestFiles: false, allowUnlistedDocsFiles: true }
    }
  });
  assert.equal(allowDocs.scopeDriftWarnings.includes("Files changed outside explicit Scope file list in stage text."), false);
});

test("custom penalties and thresholds alter score/status but hard rules still override", async () => {
  const runDir = await createRunFixture({ reviewer: "PASS", checksState: "executed" });
  const needsReview = await generateChangeReport({
    runDir,
    policy: {
      ...DEFAULT_CHANGE_REPORT_POLICY,
      readiness: {
        ...DEFAULT_CHANGE_REPORT_POLICY.readiness,
        readyMinimumScore: 100,
        penalties: { ...DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties, mediumRiskFiles: 30 }
      }
    }
  });
  assert.equal(needsReview.score < 100, true);
  assert.equal(needsReview.status, "NEEDS_REVIEW");

  const blocked = await generateChangeReport({
    runDir: await createRunFixture({ runStatus: "failed", reviewer: "PASS", checksState: "executed" }),
    policy: {
      ...DEFAULT_CHANGE_REPORT_POLICY,
      readiness: {
        ...DEFAULT_CHANGE_REPORT_POLICY.readiness,
        readyMinimumScore: 0,
        needsReviewMinimumScore: 0,
        penalties: {
          failedRun: 0,
          reviewerFail: 0,
          checksFailed: 0,
          checksSkippedWithSourceChanges: 0,
          postWriteReviewPendingOrFailed: 0,
          highRiskFiles: 0,
          mediumRiskFiles: 0,
          scopeDriftWarning: 0,
          nonBlockingReviewerIssue: 0
        }
      }
    }
  });
  assert.equal(blocked.status, "BLOCKED");
});

test("markdown formatter includes required sections and fields", async () => {
  const runDir = await createRunFixture({
    reviewer: "FAIL",
    checksState: "failed",
    changedFiles: ["src/z.ts", "src/a.ts"],
    changedFilesAddedByPhase: ["src/a.ts", "src/z.ts"],
    untrackedFiles: ["tmp-b.txt", "tmp-a.txt"],
    autoChainFinalStatus: "MAX_FIX_ATTEMPTS_REACHED"
  });
  const report = await generateChangeReport({ runDir });
  const markdown = formatChangeReportMarkdown(report);

  assert.equal(markdown.includes("# AI Change Report"), true);
  assert.equal(markdown.includes("## Commit Readiness"), true);
  assert.equal(markdown.includes(`- Status: ${report.status}`), true);
  assert.equal(markdown.includes(`- Score: ${report.score}/100`), true);
  assert.equal(markdown.includes(`- Risk: ${report.risk}`), true);
  assert.equal(markdown.includes(`- Run ID: ${report.runId}`), true);
  assert.equal(markdown.includes(`- Project: ${report.projectName}`), true);
  assert.equal(markdown.includes(`- Stage: ${report.stageName}`), true);
  assert.equal(markdown.includes("- Planner: executed"), true);
  assert.equal(markdown.includes("- Builder: executed"), true);
  assert.equal(markdown.includes("- Reviewer: executed"), true);
  assert.equal(markdown.includes("- Fix planning: disabled"), true);
  assert.equal(markdown.includes("- Fix execution: disabled"), true);
  assert.equal(markdown.includes("- Checks: executed"), true);
  assert.equal(markdown.includes(`- Verdict: ${report.reviewer.verdict}`), true);
  assert.equal(markdown.includes("- State: failed"), true);
  assert.equal(markdown.includes("- src/a.ts"), true);
  assert.equal(markdown.includes("- src/z.ts"), true);
  assert.equal(markdown.includes("- tmp-a.txt"), true);
  assert.equal(markdown.includes("- tmp-b.txt"), true);
  assert.equal(markdown.includes("## Scope Drift"), true);
  assert.equal(markdown.includes("## Risk Signals"), true);
  assert.equal(markdown.includes("## Manual Review Checklist"), true);
  assert.equal(markdown.includes("## Suggested Commit Message"), true);
  assert.equal(markdown.includes(report.suggestedCommitMessage), true);
});

test("markdown formatter renders None for empty lists and is deterministic", () => {
  const report: ChangeReport = {
    version: 1,
    runId: "run-1",
    projectName: "acme",
    stageName: "stage-01-test",
    status: "READY",
    score: 100,
    risk: "low",
    summary: "READY (100/100) - low risk",
    phases: { planner: "executed", builder: "executed", reviewer: "executed", fixPlanning: "disabled", fixExecution: "disabled", checks: "executed" },
    changedFiles: ["z.ts", "a.ts"],
    untrackedFiles: ["tmp-z", "tmp-a"],
    reviewer: { verdict: "PASS", blockingIssues: [], nonBlockingIssues: [] },
    checks: { state: "passed", failedChecks: [] },
    writeSafety: { state: "passed" },
    postWriteReview: { required: false, status: "completed" },
    scopeDriftWarnings: [],
    riskSignals: [],
    manualReviewChecklist: [],
    suggestedCommitMessage: "Test change"
  };

  const markdownA = formatChangeReportMarkdown(report);
  const markdownB = formatChangeReportMarkdown(report);
  assert.equal(markdownA, markdownB);
  assert.equal(markdownA.includes("## Scope Drift\n- None"), true);
  assert.equal(markdownA.indexOf("- a.ts") < markdownA.indexOf("- z.ts"), true);
  assert.equal(markdownA.indexOf("- tmp-a") < markdownA.indexOf("- tmp-z"), true);
});

test("json formatter returns valid json with trailing newline and does not mutate input", () => {
  const report: ChangeReport = {
    version: 1,
    runId: "run-1",
    projectName: "acme",
    stageName: "stage-01-test",
    status: "READY",
    score: 100,
    risk: "low",
    summary: "READY (100/100) - low risk",
    phases: {},
    changedFiles: ["b.ts", "a.ts"],
    untrackedFiles: [],
    reviewer: { verdict: "PASS", blockingIssues: [], nonBlockingIssues: [] },
    checks: { state: "passed", failedChecks: [] },
    writeSafety: { state: "passed" },
    postWriteReview: { required: false, status: "completed" },
    scopeDriftWarnings: [],
    riskSignals: [],
    manualReviewChecklist: [],
    suggestedCommitMessage: "Test change"
  };
  const before = JSON.stringify(report);
  const json = formatChangeReportJson(report);
  const parsed = JSON.parse(json);
  assert.equal(json.endsWith("\n"), true);
  assert.deepEqual(parsed, report);
  assert.equal(JSON.stringify(report), before);
});

test("writeChangeReport writes markdown and json inside run directory", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "change-report-write-"));
  const report = await generateChangeReport({ runDir: await createRunFixture() });
  const { markdownPath, jsonPath } = await writeChangeReport({ runDir, report });

  assert.equal(markdownPath, path.resolve(runDir, "run-report.md"));
  assert.equal(jsonPath, path.resolve(runDir, "run-report.json"));

  const markdownRaw = await readFile(markdownPath, "utf8");
  const jsonRaw = await readFile(jsonPath, "utf8");
  assert.equal(markdownRaw.includes("# AI Change Report"), true);
  assert.deepEqual(JSON.parse(jsonRaw), report);

  const markdownRelative = path.relative(runDir, markdownPath);
  const jsonRelative = path.relative(runDir, jsonPath);
  assert.equal(markdownRelative.startsWith(".."), false);
  assert.equal(jsonRelative.startsWith(".."), false);
});

test("generateAndWriteChangeReport writes artefacts and returns generated report", async () => {
  const runDir = await createRunFixture();
  const expected = await generateChangeReport({ runDir });
  const result = await generateAndWriteChangeReport({ runDir });
  assert.deepEqual(result.report, expected);
  assert.equal(result.markdownPath, path.resolve(runDir, "run-report.md"));
  assert.equal(result.jsonPath, path.resolve(runDir, "run-report.json"));
});

test("pr summary formatter includes required sections and deterministic sorted output", async () => {
  const runDir = await createRunFixture({
    reviewer: "FAIL",
    checksState: "failed",
    changedFiles: ["src/z.ts", "src/a.ts"],
    changedFilesAddedByPhase: ["src/a.ts", "src/z.ts"],
    untrackedFiles: ["tmp-b.txt", "tmp-a.txt"],
    stageText: "## Scope\n- src/a.ts"
  });
  const report = await generateChangeReport({ runDir });
  const before = JSON.stringify(report);
  const markdownA = formatPrSummaryMarkdown(report);
  const markdownB = formatPrSummaryMarkdown(report);

  assert.equal(markdownA, markdownB);
  assert.equal(JSON.stringify(report), before);
  assert.equal(markdownA.includes(`# ${report.suggestedCommitMessage}`), true);
  assert.equal(markdownA.includes("## Summary"), true);
  assert.equal(markdownA.includes("## Changes"), true);
  assert.equal(markdownA.includes("- src/a.ts"), true);
  assert.equal(markdownA.includes("- src/z.ts"), true);
  assert.equal(markdownA.includes("## Testing"), true);
  assert.equal(markdownA.includes("- Checks state: failed"), true);
  assert.equal(markdownA.includes("## Risk"), true);
  assert.equal(markdownA.includes(`- Risk level: ${report.risk}`), true);
  assert.equal(markdownA.includes("## Review Notes"), true);
  assert.equal(markdownA.includes("- Reviewer verdict: FAIL"), true);
  assert.equal(markdownA.includes("## Manual Checklist"), true);
  assert.equal(markdownA.includes("- [ ] "), true);
  assert.equal(markdownA.includes("## Rollback"), true);
});

test("pr summary formatter renders None for empty lists and non-ready status note", () => {
  const report: ChangeReport = {
    version: 1,
    runId: "run-1",
    projectName: "acme",
    stageName: "stage-01-test",
    status: "NEEDS_REVIEW",
    score: 70,
    risk: "low",
    summary: "",
    phases: {},
    changedFiles: [],
    untrackedFiles: [],
    reviewer: { verdict: "PASS", blockingIssues: [], nonBlockingIssues: [] },
    checks: { state: "skipped", failedChecks: [] },
    writeSafety: { state: "passed" },
    postWriteReview: { required: false, status: "completed" },
    scopeDriftWarnings: [],
    riskSignals: [],
    manualReviewChecklist: [],
    suggestedCommitMessage: "Test change"
  };
  const markdown = formatPrSummaryMarkdown(report);
  assert.equal(markdown.includes("## Summary\nNone"), true);
  assert.equal(markdown.includes("## Changes\n- None"), true);
  assert.equal(markdown.includes("- Risk signals:\n- None"), true);
  assert.equal(markdown.includes("- Scope drift warnings:\n- None"), true);
  assert.equal(markdown.includes("- Blocking issues:\n- None"), true);
  assert.equal(markdown.includes("- Non-blocking issues:\n- None"), true);
  assert.equal(markdown.includes("- [ ] None"), true);
  assert.equal(markdown.includes("- Commit readiness: NEEDS_REVIEW (not ready for direct merge)"), true);
});

test("writePrSummary writes pr-summary.md inside run directory and returns absolute path", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "change-report-pr-summary-"));
  const report = await generateChangeReport({ runDir: await createRunFixture() });
  const { markdownPath } = await writePrSummary({ runDir, report });
  assert.equal(markdownPath, path.resolve(runDir, "pr-summary.md"));
  const markdown = await readFile(markdownPath, "utf8");
  assert.equal(markdown.includes("## Summary"), true);
  assert.equal(path.relative(runDir, markdownPath).startsWith(".."), false);
});

test("generateAndWritePrSummary writes pr-summary.md and returns report", async () => {
  const runDir = await createRunFixture();
  const expected = await generateChangeReport({ runDir });
  const result = await generateAndWritePrSummary({ runDir });
  assert.deepEqual(result.report, expected);
  assert.equal(result.markdownPath, path.resolve(runDir, "pr-summary.md"));
  await readFile(result.markdownPath, "utf8");
});

test("writePrSummary propagates write errors", async () => {
  const parentDir = await mkdtemp(path.join(os.tmpdir(), "change-report-pr-summary-error-"));
  const runDir = path.join(parentDir, "run-dir-is-a-file");
  await writeFile(runDir, "not-a-directory", "utf8");
  const report = await generateChangeReport({ runDir: await createRunFixture() });
  await assert.rejects(() => writePrSummary({ runDir, report }));
});
