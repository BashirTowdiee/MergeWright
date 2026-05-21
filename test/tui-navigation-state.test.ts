import test from "node:test";
import assert from "node:assert/strict";
import { moveSelectionForFocusedPane } from "../src/tui/navigation-state.js";

const counts = { runs: 3, phases: 3, actions: 4, files: 5, findings: 6 };
const selection = { runIndex: 0, phaseIndex: 1, actionIndex: 2, fileIndex: 3, findingIndex: 4 };

test("run pane movement resets dependent indexes", () => {
  assert.deepEqual(moveSelectionForFocusedPane({ focusedPane: "runs", selection, counts, direction: "down" }), {
    runIndex: 1,
    phaseIndex: 0,
    actionIndex: 0,
    fileIndex: 0,
    findingIndex: 0
  });
});

test("phase pane movement resets file index", () => {
  assert.deepEqual(moveSelectionForFocusedPane({ focusedPane: "phases", selection, counts, direction: "down" }).fileIndex, 0);
});

test("leaf pane movement preserves unrelated indexes", () => {
  assert.equal(moveSelectionForFocusedPane({ focusedPane: "actions", selection, counts, direction: "down" }).actionIndex, 3);
  assert.equal(moveSelectionForFocusedPane({ focusedPane: "artefacts", selection, counts, direction: "down" }).fileIndex, 4);
  assert.equal(moveSelectionForFocusedPane({ focusedPane: "findings", selection, counts, direction: "down" }).findingIndex, 5);
});
