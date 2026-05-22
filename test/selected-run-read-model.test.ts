import test from "node:test";
import assert from "node:assert/strict";
import { resolveSelectedRunForTui } from "../src/tui/selected-run-read-model.js";
import type { RunDetailViewModel, RunListItemViewModel } from "../src/tui/view-models.js";

function runListItem(id: string): RunListItemViewModel {
  return {
    id,
    title: id,
    status: "unknown",
    subtitle: id,
    mode: "unknown",
    warnings: []
  };
}

function runDetail(id: string): RunDetailViewModel {
  return {
    id,
    title: id,
    status: "unknown",
    runDir: `/tmp/${id}`,
    mode: "unknown",
    phases: [],
    artefacts: [],
    reviewerFindings: [],
    safeActions: [],
    warnings: []
  };
}

test("resolveSelectedRunForTui returns matching run detail", () => {
  const fallbackRun = runDetail("fallback");
  const selectedRun = runDetail("run-2");

  assert.equal(
    resolveSelectedRunForTui({
      runs: [runListItem("run-1"), runListItem("run-2")],
      runDetailsById: { "run-2": selectedRun },
      fallbackRun,
      selectedRunIndex: 1
    }),
    selectedRun
  );
});

test("resolveSelectedRunForTui falls back when detail is missing", () => {
  const fallbackRun = runDetail("fallback");

  assert.equal(
    resolveSelectedRunForTui({
      runs: [runListItem("run-1")],
      runDetailsById: {},
      fallbackRun,
      selectedRunIndex: 0
    }),
    fallbackRun
  );
});

test("resolveSelectedRunForTui falls back when selection is out of range", () => {
  const fallbackRun = runDetail("fallback");

  assert.equal(
    resolveSelectedRunForTui({
      runs: [runListItem("run-1")],
      runDetailsById: { "run-1": runDetail("run-1") },
      fallbackRun,
      selectedRunIndex: 5
    }),
    fallbackRun
  );
});
