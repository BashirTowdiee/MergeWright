import test from "node:test";
import assert from "node:assert/strict";
import { buildTuiDashboardReadModel } from "../src/tui/dashboard-read-model.js";
import type { TuiSelectionContext } from "../src/tui/selection-context-read-model.js";
import type { ArtefactViewModel, RunDetailViewModel, RunListItemViewModel } from "../src/tui/view-models.js";

function runListItem(id: string): RunListItemViewModel {
  return {
    id,
    title: id,
    status: "running",
    subtitle: `Run ${id}`,
    mode: "dry-run",
    warnings: []
  };
}

function artefact(id: string): ArtefactViewModel {
  return {
    id,
    title: "Planner output",
    kind: "markdown",
    path: "planner-output.md",
    phaseId: "planner"
  };
}

function runDetail(): RunDetailViewModel {
  return {
    id: "run-1",
    title: "Stage 3 run",
    goal: "Extract read models",
    status: "running",
    workspaceRoot: "/workspace",
    runDir: "/runs/run-1",
    branch: "work/stage3-dashboard-read-model",
    mode: "dry-run",
    provider: "codex",
    model: "gpt",
    phases: [{ id: "planner", label: "Planner", status: "running", artefactIds: ["planner-output"], summary: "Planning" }],
    artefacts: [artefact("planner-output")],
    safeActions: [{ id: "continue", label: "Continue", enabled: true, risk: "low", requiresConfirmation: false }],
    reviewerFindings: [{ severity: "high", message: "Review issue", sourceArtefactId: "planner-output" }],
    warnings: ["Warning one"]
  };
}

test("buildTuiDashboardReadModel derives render lines from selection context", () => {
  const selectedRun = runDetail();
  const selectedArtefact = selectedRun.artefacts[0];
  const selectedPhase = selectedRun.phases[0];
  const selectedFinding = selectedRun.reviewerFindings[0];
  const context: TuiSelectionContext = {
    selectedRun,
    selectedPhase,
    scopedArtefacts: selectedRun.artefacts,
    selectedArtefact,
    selectedAction: selectedRun.safeActions[0],
    selectedFinding,
    navigationCounts: { runs: 1, phases: 1, actions: 1, files: 1, findings: 1 }
  };

  const model = buildTuiDashboardReadModel({
    runs: [runListItem("run-1")],
    selectionContext: context,
    evidenceSnippets: {
      "planner-output": ["Evidence line"]
    },
    focusedPane: "artefacts",
    fileScope: "phase"
  });

  assert.equal(model.layoutSummary, "1 run loaded - selected Stage 3 run");
  assert.equal(model.fileScopeLabel, "Artefacts - Planner");
  assert.deepEqual(model.focusBreadcrumb, ["Focus: Artefacts", "Run: Stage 3 run", "Phase: Planner", "Files: phase"]);
  assert.ok(model.evidenceLines.some((line) => line.includes("Evidence line")));
  assert.ok(model.findingDetailLines.some((line) => line.includes("Review issue")));
  assert.ok(model.runContextLines.some((line) => line.includes("Stage 3 run")));
  assert.ok(model.runWarningLines.some((line) => line.includes("Warning one")));
  assert.ok(model.phaseDetailLines.some((line) => line.includes("Planner")));
});
