import test from "node:test";
import assert from "node:assert/strict";
import { buildPhaseDetailLines } from "../src/tui/phase-detail.js";

test("buildPhaseDetailLines handles missing phase", () => {
  assert.deepEqual(buildPhaseDetailLines(undefined), ["No phase selected."]);
});

test("buildPhaseDetailLines formats phase metadata", () => {
  assert.deepEqual(
    buildPhaseDetailLines({
      id: "reviewer",
      label: "Reviewer",
      status: "failed",
      summary: "Review failed.",
      blockedReason: "Fix required.",
      artefactIds: ["reviewer-output"]
    }),
    ["Phase: Reviewer", "Status: failed", "Summary: Review failed.", "Blocked: Fix required.", "Artefacts: 1"]
  );
});
