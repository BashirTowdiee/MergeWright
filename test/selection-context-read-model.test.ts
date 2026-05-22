import test from "node:test";
import assert from "node:assert/strict";
import { buildTuiSelectionContext } from "../src/tui/selection-context-read-model.js";
import type { TuiSelectionState } from "../src/tui/selection-state.js";
import type { RunDetailViewModel, RunListItemViewModel } from "../src/tui/view-models.js";

function selection(patch: Partial<TuiSelectionState> = {}): TuiSelectionState {
  return {
    runIndex: 0,
    phaseIndex: 0,
    actionIndex: 0,
    fileIndex: 0,
    findingIndex: 0,
    ...patch
  };
}

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
    phases: [
      { id: "planner", label: "Planner", status: "passed" },
      { id: "reviewer", label: "Reviewer", status: "failed" }
    ],
    artefacts: [],
    reviewerFindings: [{ severity: "high", message: "Review failed" }],
    safeActions: [{ id: "continue", label: "Continue", enabled: true, risk: "medium", requiresConfirmation: false }],
    warnings: []
  };
}

test("buildTuiSelectionContext resolves selected run and selected child items", () => {
  const fallbackRun = runDetail("fallback");
  const selectedRun = runDetail("run-2");
  const context = buildTuiSelectionContext({
    runs: [runListItem("run-1"), runListItem("run-2")],
    runDetailsById: { "run-2": selectedRun },
    fallbackRun,
    selection: selection({ runIndex: 1, phaseIndex: 1, actionIndex: 0, findingIndex: 0 }),
    fileCount: 3
  });

  assert.equal(context.selectedRun, selectedRun);
  assert.equal(context.selectedPhase?.id, "reviewer");
  assert.equal(context.selectedAction?.id, "continue");
  assert.equal(context.selectedFinding?.message, "Review failed");
  assert.deepEqual(context.navigationCounts, {
    runs: 2,
    phases: 2,
    actions: 1,
    files: 3,
    findings: 1
  });
});

test("buildTuiSelectionContext falls back when selected run is unavailable", () => {
  const fallbackRun = runDetail("fallback");
  const context = buildTuiSelectionContext({
    runs: [runListItem("missing")],
    runDetailsById: {},
    fallbackRun,
    selection: selection(),
    fileCount: 0
  });

  assert.equal(context.selectedRun, fallbackRun);
  assert.equal(context.navigationCounts.runs, 1);
});

test("buildTuiSelectionContext exposes undefined child selections when out of range", () => {
  const fallbackRun = runDetail("fallback");
  const context = buildTuiSelectionContext({
    runs: [runListItem("fallback")],
    runDetailsById: { fallback: fallbackRun },
    fallbackRun,
    selection: selection({ phaseIndex: 99, actionIndex: 99, findingIndex: 99 }),
    fileCount: 0
  });

  assert.equal(context.selectedPhase, undefined);
  assert.equal(context.selectedAction, undefined);
  assert.equal(context.selectedFinding, undefined);
});
