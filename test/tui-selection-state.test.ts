import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialSelectionState,
  resetFileSelection,
  selectAction,
  selectFile,
  selectFinding,
  selectPhase,
  selectRun
} from "../src/tui/selection-state.js";

test("createInitialSelectionState returns default selected indexes", () => {
  assert.deepEqual(createInitialSelectionState(), { runIndex: 0, phaseIndex: 0, actionIndex: 0, fileIndex: 0, findingIndex: 0 });
});

test("selectRun updates run index and resets dependent selections", () => {
  assert.deepEqual(
    selectRun({ runIndex: 0, phaseIndex: 2, actionIndex: 3, fileIndex: 4, findingIndex: 5 }, 1),
    { runIndex: 1, phaseIndex: 0, actionIndex: 0, fileIndex: 0, findingIndex: 0 }
  );
});

test("selectPhase updates phase index and resets file selection", () => {
  assert.deepEqual(
    selectPhase({ runIndex: 1, phaseIndex: 0, actionIndex: 3, fileIndex: 4, findingIndex: 5 }, 2),
    { runIndex: 1, phaseIndex: 2, actionIndex: 3, fileIndex: 0, findingIndex: 5 }
  );
});

test("leaf selection helpers update only their index", () => {
  const state = { runIndex: 1, phaseIndex: 2, actionIndex: 3, fileIndex: 4, findingIndex: 5 };
  assert.deepEqual(selectAction(state, 9), { ...state, actionIndex: 9 });
  assert.deepEqual(selectFile(state, 8), { ...state, fileIndex: 8 });
  assert.deepEqual(selectFinding(state, 7), { ...state, findingIndex: 7 });
});

test("resetFileSelection resets file index only", () => {
  assert.deepEqual(
    resetFileSelection({ runIndex: 1, phaseIndex: 2, actionIndex: 3, fileIndex: 4, findingIndex: 5 }),
    { runIndex: 1, phaseIndex: 2, actionIndex: 3, fileIndex: 0, findingIndex: 5 }
  );
});
