import test from "node:test";
import assert from "node:assert/strict";
import { buildFindingDetailLines } from "../src/tui/finding-detail.js";

test("buildFindingDetailLines handles missing finding", () => {
  assert.deepEqual(buildFindingDetailLines(undefined), ["No finding selected."]);
});

test("buildFindingDetailLines formats finding metadata", () => {
  assert.deepEqual(
    buildFindingDetailLines({ severity: "high", message: "Blocking issue", sourceArtefactId: "reviewer-output" }),
    ["Severity: high", "Message: Blocking issue", "Source: reviewer-output"]
  );
});
