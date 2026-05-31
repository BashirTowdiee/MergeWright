import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DefaultRunInsightsQueryService } from "../src/application/queries/run-insights-query-service.js";
import type { RunQueryService } from "../src/application/queries/run-query-service.js";
import type { RunDetail } from "../src/application/read-models/run-read-model.js";

const baseRun: RunDetail = {
  id: "run-1",
  title: "Run one",
  status: "blocked",
  runDir: "",
  mode: "read-only",
  phases: [],
  artefacts: [],
  safeActions: [
    {
      id: "continue",
      label: "Continue run",
      enabled: true,
      risk: "medium",
      requiresConfirmation: false
    }
  ],
  blockedReason: "Needs reviewer fix.",
  reviewerFindings: [
    {
      severity: "high",
      message: "Acceptance evidence missing."
    },
    {
      severity: "low",
      message: "Refactor helper naming."
    }
  ],
  readiness: {
    source: "report",
    status: "NEEDS_FIX",
    score: 66,
    risk: "high",
    checksState: "failed",
    reviewerVerdict: "FAIL",
    changedFileCount: 3,
    missingEvidenceWarnings: ["Acceptance evidence missing."]
  },
  warnings: []
};

class StubRunQueryService implements RunQueryService {
  constructor(private readonly run: RunDetail | null) {}

  async listRuns() {
    return [];
  }

  async getRun(input: { runId: string }) {
    if (!this.run || input.runId !== this.run.id) {
      return null;
    }
    return this.run;
  }
}

test("run insights maps readiness and review with evidence metadata", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "run-insights-"));
  const runDir = path.join(tempRoot, "run-1");
  await mkdir(runDir, { recursive: true });
  await writeFile(
    path.join(runDir, "evidence.json"),
    JSON.stringify(
      {
        version: 1,
        runId: "run-1",
        status: "needs_fix",
        workspace: "/tmp/workspace",
        startedAt: "2026-05-31T00:00:00.000Z",
        git: {
          changedFiles: ["src/a.ts"],
          untrackedFiles: [],
          unexpectedFiles: []
        },
        commands: [],
        artefacts: [],
        reviewer: {
          verdict: "FAIL",
          recommendedFixPrompt: "Add acceptance evidence and rerun checks.",
          testsObserved: [{ test: "npm test", outcome: "fail" }]
        },
        acceptance: {
          status: "fail",
          criteria: [{ criterion: "criterion-1", status: "fail" }]
        },
        checks: {
          status: "failed",
          failed: ["npm test"],
          skipped: []
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const run = { ...baseRun, runDir };
  const service = new DefaultRunInsightsQueryService({
    runQueryService: new StubRunQueryService(run)
  });

  const readiness = await service.getRunReadiness("run-1");
  assert.ok(readiness);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.status, "NEEDS_FIX");
  assert.equal(readiness.nextAction, "continue");

  const review = await service.getRunReview("run-1");
  assert.ok(review);
  assert.equal(review.verdict, "FAIL");
  assert.equal(review.blockingFindings.length, 1);
  assert.equal(review.nonBlockingFindings.length, 1);
  assert.equal(review.recommendedFixPrompt, "Add acceptance evidence and rerun checks.");
  assert.equal(review.testsObservedCount, 1);
  assert.equal(review.acceptanceCriteriaCount, 1);

  const evidence = await service.getRunEvidence("run-1");
  assert.ok(evidence);
  assert.equal(evidence.available, true);
  assert.equal(evidence.items.length >= 6, true);
  assert.equal(evidence.items.some((item) => item.id === "checks" && item.status === "fail"), true);
});

test("run insights handles missing run and missing evidence manifest", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "run-insights-"));
  const runDir = path.join(tempRoot, "run-1");
  await mkdir(runDir, { recursive: true });

  const run = { ...baseRun, runDir };
  const service = new DefaultRunInsightsQueryService({
    runQueryService: new StubRunQueryService(run)
  });

  const evidence = await service.getRunEvidence("run-1");
  assert.ok(evidence);
  assert.equal(evidence.available, false);
  assert.equal(evidence.items.length, 1);
  assert.equal(evidence.items[0]?.status, "missing");

  const missingService = new DefaultRunInsightsQueryService({
    runQueryService: new StubRunQueryService(null)
  });
  assert.equal(await missingService.getRunReadiness("run-1"), null);
  assert.equal(await missingService.getRunReview("run-1"), null);
  assert.equal(await missingService.getRunEvidence("run-1"), null);
});
