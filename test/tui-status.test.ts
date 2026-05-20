import test from "node:test";
import assert from "node:assert/strict";
import { formatStatusLegend, getStatusLabel, getStatusLegendItems, getStatusSymbol } from "../src/tui/components/status.js";

test("status helpers return stable symbols and labels", () => {
  assert.equal(getStatusSymbol("passed"), "✓");
  assert.equal(getStatusLabel("passed"), "passed");
  assert.equal(getStatusSymbol("failed"), "!");
  assert.equal(getStatusLabel("failed"), "failed");
});

test("getStatusLegendItems returns ordered legend items", () => {
  assert.deepEqual(getStatusLegendItems(), [
    "✓ passed",
    "! failed",
    "■ blocked",
    "… running",
    "○ pending",
    "× cancelled",
    "- skipped",
    "? unknown"
  ]);
});

test("formatStatusLegend joins legend items", () => {
  assert.equal(formatStatusLegend(), "✓ passed  ! failed  ■ blocked  … running  ○ pending  × cancelled  - skipped  ? unknown");
});
