import test from "node:test";
import assert from "node:assert/strict";
import { getNavigationDirection } from "../src/tui/navigation-keys.js";

test("getNavigationDirection maps keyboard shortcuts", () => {
  assert.equal(getNavigationDirection("k", {}), "up");
  assert.equal(getNavigationDirection("j", {}), "down");
});

test("getNavigationDirection maps arrow keys", () => {
  assert.equal(getNavigationDirection("", { upArrow: true }), "up");
  assert.equal(getNavigationDirection("", { downArrow: true }), "down");
});

test("getNavigationDirection ignores unrelated input", () => {
  assert.equal(getNavigationDirection("x", {}), null);
});
