import test from "node:test";
import assert from "node:assert/strict";
import { validateStageName } from "../src/stage.js";

test("valid stage name passes", () => {
  assert.doesNotThrow(() => validateStageName("example-stage"));
});

test("invalid stage names fail", () => {
  const names = ["Example", "bad name", "bad/name", "..", "a,b"];
  for (const name of names) {
    assert.throws(() => validateStageName(name));
  }
});
