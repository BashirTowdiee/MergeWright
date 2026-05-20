import test from "node:test";
import assert from "node:assert/strict";
import { buildRunWarningLines } from "../src/tui/run-warnings.js";

test("buildRunWarningLines handles empty warnings", () => {
  assert.deepEqual(buildRunWarningLines([]), ["No warnings recorded."]);
});

test("buildRunWarningLines prefixes warnings", () => {
  assert.deepEqual(buildRunWarningLines(["old metadata", "missing provider"]), ["WARN old metadata", "WARN missing provider"]);
});
