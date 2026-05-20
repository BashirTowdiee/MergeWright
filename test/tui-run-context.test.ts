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
    "Run dir: /tmp/runs/run-1"
  ]);
});

test("buildRunContextLines handles missing optional metadata", () => {
  assert.deepEqual(buildRunContextLines(createRun({ branch: undefined, provider: undefined, model: undefined })), [
    "Run: run-1",
    "Status: failed",
    "Mode: read-only",
    "Branch: unknown",
    "Provider: unknown",
    "Run dir: /tmp/runs/run-1"
  ]);
});
