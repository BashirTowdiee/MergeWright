import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceChecksSummary } from "../src/evidence/checks-summary.js";

test("createEvidenceChecksSummary maps executed checks to passed", () => {
  assert.deepEqual(createEvidenceChecksSummary({ state: "executed" }), {
    status: "passed",
    failed: [],
    skipped: []
  });
});

test("createEvidenceChecksSummary maps failed checks", () => {
  assert.deepEqual(createEvidenceChecksSummary({ state: "failed", failedChecks: ["npm test"], error: "lint failed" }), {
    status: "failed",
    failed: ["lint failed", "npm test"],
    skipped: []
  });
});

test("createEvidenceChecksSummary maps disabled and malformed input", () => {
  assert.deepEqual(createEvidenceChecksSummary({ state: "disabled" }), {
    status: "skipped",
    failed: [],
    skipped: ["disabled"]
  });
  assert.deepEqual(createEvidenceChecksSummary(null), {
    status: "unknown",
    failed: [],
    skipped: []
  });
});
