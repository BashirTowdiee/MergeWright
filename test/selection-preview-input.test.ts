import test from "node:test";
import assert from "node:assert/strict";
import { buildTuiSelectionPreviewInput } from "../src/tui/selection-preview-input.js";
import type { TuiSelectionContext } from "../src/tui/selection-context-read-model.js";

const context: TuiSelectionContext = {
  selectedRun: {
    id: "run-1",
    title: "Run 1",
    status: "unknown",
    runDir: "/tmp/run-1",
    mode: "unknown",
    phases: [],
    artefacts: [],
    reviewerFindings: [{ severity: "high", message: "Review issue" }],
    safeActions: [],
    warnings: []
  },
  selectedPhase: undefined,
  scopedArtefacts: [
    {
      id: "artefact-1",
      title: "Artefact 1",
      kind: "markdown",
      path: "artefact-1.md"
    }
  ],
  selectedArtefact: {
    id: "artefact-1",
    title: "Artefact 1",
    kind: "markdown",
    path: "artefact-1.md"
  },
  selectedAction: undefined,
  selectedFinding: undefined,
  navigationCounts: {
    runs: 1,
    phases: 0,
    actions: 0,
    files: 1,
    findings: 1
  }
};

test("buildTuiSelectionPreviewInput exposes selected artefact and findings", () => {
  assert.deepEqual(buildTuiSelectionPreviewInput(context), {
    artefact: context.selectedArtefact,
    findings: context.selectedRun.reviewerFindings
  });
});

test("buildTuiSelectionPreviewInput preserves missing selected artefact", () => {
  assert.equal(
    buildTuiSelectionPreviewInput({
      ...context,
      selectedArtefact: undefined,
      scopedArtefacts: []
    }).artefact,
    undefined
  );
});
