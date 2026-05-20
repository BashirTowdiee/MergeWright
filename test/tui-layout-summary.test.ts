import test from "node:test";
import assert from "node:assert/strict";
import { buildLayoutSummary } from "../src/tui/layout-summary.js";
import type { RunDetailViewModel, RunListItemViewModel } from "../src/tui/view-models.js";

test("buildLayoutSummary summarises visible TUI counts", () => {
  const runs: RunListItemViewModel[] = [
    { id: "run-1", title: "Run 1", status: "passed", subtitle: "done", mode: "read-only", warnings: [] },
    { id: "run-2", title: "Run 2", status: "failed", subtitle: "failed", mode: "read-only", warnings: [] }
  ];
  const selectedRun: RunDetailViewModel = {
    id: "run-1",
    title: "Run 1",
    status: "passed",
    runDir: "/tmp/run-1",
    mode: "read-only",
    phases: [{ id: "planner", label: "Planner", status: "passed", artefactIds: [] }],
    safeActions: [{ id: "open-run-folder", label: "Open", enabled: true, risk: "low", requiresConfirmation: false }],
    artefacts: [{ id: "a", title: "a.md", kind: "markdown", path: "a.md" }],
    reviewerFindings: [{ severity: "low", message: "note" }],
    warnings: ["old metadata"]
  };

  assert.equal(buildLayoutSummary({ runs, selectedRun }), "2 runs · 1 phases · 1 actions · 1 artefacts · 1 findings · 1 warnings");
});
