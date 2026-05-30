import test from "node:test";
import assert from "node:assert/strict";
import { buildRunContextLines } from "../src/tui/run-context.js";
import type { RunDetailViewModel } from "../src/tui/view-models.js";

function createRun(patch: Partial<RunDetailViewModel> = {}): RunDetailViewModel {
  return {
    id: "run-1",
    title: "Test run",
    status: "failed",
    runDir: "/tmp/runs/run-1",
    mode: "read-only",
    branch: "main",
    provider: "codex",
    model: "gpt-5.5",
    phases: [],
    artefacts: [],
    safeActions: [],
    reviewerFindings: [],
    readiness: {
      source: "report",
      status: "NEEDS_FIX",
      score: 42,
      risk: "high",
      checksState: "failed",
      reviewerVerdict: "FAIL",
      changedFileCount: 3,
      missingEvidenceWarnings: ["Reviewer output unavailable or unparsable."]
    },
    warnings: [],
    ...patch
  };
}

test("buildRunContextLines formats run context", () => {
  assert.deepEqual(buildRunContextLines(createRun()), [
    "Run: run-1",
    "Status: failed",
    "Mode: read-only",
    "Branch: main",
    "Provider: codex / gpt-5.5",
    "Readiness: NEEDS_FIX (report)",
    "Score/Risk: 42/100 · high",
    "Checks: failed",
    "Reviewer verdict: FAIL",
    "Changed files: 3",
    "Missing evidence warnings: 1",
    "Run dir: /tmp/runs/run-1"
  ]);
});

test("buildRunContextLines handles missing optional metadata", () => {
  assert.deepEqual(buildRunContextLines(createRun({ branch: undefined, provider: undefined, model: undefined, readiness: undefined })), [
    "Run: run-1",
    "Status: failed",
    "Mode: read-only",
    "Branch: unknown",
    "Provider: unknown",
    "Readiness: unknown (fallback)",
    "Score/Risk: unknown/100 · unknown",
    "Checks: unknown",
    "Reviewer verdict: UNKNOWN",
    "Changed files: unknown",
    "Missing evidence warnings: 0",
    "Run dir: /tmp/runs/run-1"
  ]);
});
