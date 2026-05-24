import test from "node:test";
import assert from "node:assert/strict";
import { ProgressPane } from "../src/tui/panes/ProgressPane.js";

test("ProgressPane is available as the typed progress events UI component", () => {
  assert.equal(typeof ProgressPane, "function");
});
