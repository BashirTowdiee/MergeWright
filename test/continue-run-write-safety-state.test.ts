import test from "node:test";
import assert from "node:assert/strict";
import { createContinueWriteSafetyMetadata, initialContinueWriteSafetyState } from "../src/continue-run/write-safety-state.js";

test("initialContinueWriteSafetyState handles write dry runs", () => {
  assert.equal(initialContinueWriteSafetyState(true, true), "skipped by dry-run");
  assert.equal(initialContinueWriteSafetyState(false, true), "not checked");
  assert.equal(initialContinueWriteSafetyState(true, false), "not checked");
});

test("createContinueWriteSafetyMetadata maps persisted statuses", () => {
  assert.deepEqual(createContinueWriteSafetyMetadata({ allowWrites: true, state: "skipped by dry-run", reason: "dryRun=true" }), {
    allowWrites: true,
    state: "skipped by dry-run",
    status: "skipped",
    reason: "dryRun=true"
  });
  assert.deepEqual(createContinueWriteSafetyMetadata({ allowWrites: true, state: "passed", artefacts: ["write-safety-result.json"] }), {
    allowWrites: true,
    state: "passed",
    status: "passed",
    artefacts: ["write-safety-result.json"]
  });
  assert.deepEqual(createContinueWriteSafetyMetadata({ allowWrites: true, state: "failed", reason: "checks failed" }), {
    allowWrites: true,
    state: "failed",
    status: "failed",
    reason: "checks failed"
  });
});

test("createContinueWriteSafetyMetadata preserves existing optional fields", () => {
  assert.deepEqual(
    createContinueWriteSafetyMetadata({
      existing: { allowWrites: true, state: "not checked", reason: "previous", artefacts: ["previous.json"] },
      allowWrites: false,
      state: "not checked"
    }),
    {
      allowWrites: false,
      state: "not checked",
      reason: "previous",
      artefacts: ["previous.json"]
    }
  );
});
