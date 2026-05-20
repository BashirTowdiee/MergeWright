import test from "node:test";
import assert from "node:assert/strict";
import { getEmptyStateMessage } from "../src/tui/empty-state.js";

test("getEmptyStateMessage returns stable copy for empty states", () => {
  assert.equal(getEmptyStateMessage("runs"), "No runs found. Start a run to populate this view.");
  assert.equal(getEmptyStateMessage("phases"), "No phase metadata recorded for this run.");
  assert.equal(getEmptyStateMessage("actions"), "No safe actions are available for this run.");
  assert.equal(getEmptyStateMessage("artefacts"), "No artefacts recorded for this run.");
  assert.equal(getEmptyStateMessage("findings"), "No reviewer findings recorded.");
});
