import test from "node:test";
import assert from "node:assert/strict";
import { getFocusedPaneTitle, moveFocus } from "../src/tui/focus.js";

test("moveFocus cycles forward through panes", () => {
  assert.equal(moveFocus({ current: "runs", direction: "next" }), "actions");
  assert.equal(moveFocus({ current: "actions", direction: "next" }), "artefacts");
  assert.equal(moveFocus({ current: "artefacts", direction: "next" }), "runs");
});

test("moveFocus cycles backward through panes", () => {
  assert.equal(moveFocus({ current: "runs", direction: "previous" }), "artefacts");
  assert.equal(moveFocus({ current: "artefacts", direction: "previous" }), "actions");
  assert.equal(moveFocus({ current: "actions", direction: "previous" }), "runs");
});

test("getFocusedPaneTitle marks focused pane", () => {
  assert.equal(getFocusedPaneTitle("Runs", true), "Runs *");
  assert.equal(getFocusedPaneTitle("Runs", false), "Runs");
});
