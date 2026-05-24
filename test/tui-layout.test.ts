import test from "node:test";
import assert from "node:assert/strict";
import { resolveTuiPaneLayout } from "../src/tui/layout.js";

test("resolveTuiPaneLayout keeps multi-pane rows on wide terminals", () => {
  const layout = resolveTuiPaneLayout(180);
  assert.equal(layout.topRowDirection, "row");
  assert.equal(layout.bottomRowDirection, "row");
  assert.equal(layout.runListWidth, 30);
  assert.equal(layout.evidenceWidth, 80);
  assert.equal(layout.rowPaneMarginRight, 1);
});

test("resolveTuiPaneLayout stacks panes on narrow terminals", () => {
  const layout = resolveTuiPaneLayout(110);
  assert.equal(layout.topRowDirection, "column");
  assert.equal(layout.bottomRowDirection, "column");
  assert.equal(layout.runListWidth, "100%");
  assert.equal(layout.currentRunWidth, "100%");
  assert.equal(layout.safeActionWidth, "100%");
  assert.equal(layout.rowPaneMarginRight, 0);
});

