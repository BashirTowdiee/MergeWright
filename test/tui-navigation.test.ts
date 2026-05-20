import test from "node:test";
import assert from "node:assert/strict";
import { moveSelection } from "../src/tui/navigation.js";
import { createTuiSpikeFixture } from "../src/tui/spike-fixture.js";

test("moveSelection wraps upward", () => {
  assert.equal(moveSelection({ currentIndex: 0, itemCount: 3, direction: "up" }), 2);
});

test("moveSelection wraps downward", () => {
  assert.equal(moveSelection({ currentIndex: 2, itemCount: 3, direction: "down" }), 0);
});

test("moveSelection handles empty lists", () => {
  assert.equal(moveSelection({ currentIndex: 0, itemCount: 0, direction: "down" }), 0);
});

test("TUI spike fixture includes detail data for every listed run", () => {
  const fixture = createTuiSpikeFixture();
  for (const run of fixture.runs) {
    assert.ok(fixture.runDetailsById[run.id], `missing detail for ${run.id}`);
  }
});
