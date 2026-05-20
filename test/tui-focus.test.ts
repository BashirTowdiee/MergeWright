import test from "node:test";
import assert from "node:assert/strict";
import { getFocusedPaneTitle, moveFocus } from "../src/tui/focus.js";

test("moveFocus cycles to the next pane", () => {
  assert.equal(moveFocus({ current: "runs", direction: "next" }), "artefacts");
  assert.equal(moveFocus({ current: "artefacts", direction: "next" }), "runs");
});

test("moveFocus cycles to the previous pane", () => {
  assert.equal(moveFocus({ current: "runs", direction: "previous" }), "artefacts");
  assert.equal(moveFocus({ current: "artefacts", direction: "previous" }), "runs");
});

test("getFocusedPaneTitle marks focused pane", () => {
  assert.equal(getFocusedPaneTitle("Runs", true), "Runs *");
  assert.equal(getFocusedPaneTitle("Runs", false), "Runs");
});
