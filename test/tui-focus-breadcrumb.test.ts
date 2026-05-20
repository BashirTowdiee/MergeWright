import test from "node:test";
import assert from "node:assert/strict";
import { buildFocusBreadcrumb } from "../src/tui/focus-breadcrumb.js";
import type { RunDetailViewModel } from "../src/tui/view-models.js";

const run: RunDetailViewModel = {
  id: "run-1",
  title: "Run 1",
  status: "failed",
  runDir: "/tmp/run-1",
  mode: "read-only",
  phases: [],
  artefacts: [],
  safeActions: [],
  reviewerFindings: [],
  warnings: []
};

test("buildFocusBreadcrumb formats focus context", () => {
  assert.equal(
    buildFocusBreadcrumb({
      focusedPane: "artefacts",
      selectedRun: run,
      selectedPhase: { id: "reviewer", label: "Reviewer", status: "failed", artefactIds: [] },
      fileScope: "phase"
    }),
    "Focus > Files > Run run-1 > Phase Reviewer > Files phase"
  );
});

test("buildFocusBreadcrumb handles missing phase", () => {
  assert.equal(
    buildFocusBreadcrumb({ focusedPane: "runs", selectedRun: run, fileScope: "all" }),
    "Focus > Runs > Run run-1 > Phase none > Files all"
  );
});
