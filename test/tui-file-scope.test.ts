import test from "node:test";
import assert from "node:assert/strict";
import { formatFileScopeLabel, resolveScopedFiles, toggleFileScope } from "../src/tui/file-scope.js";
import type { ArtefactViewModel, PhaseNodeViewModel } from "../src/tui/view-models.js";

const files: ArtefactViewModel[] = [
  { id: "planner-output", title: "planner.md", kind: "markdown", path: "planner.md", phaseId: "planner" },
  { id: "reviewer-output", title: "reviewer.md", kind: "markdown", path: "reviewer.md", phaseId: "reviewer" },
  { id: "run-json", title: "run.json", kind: "json", path: "run.json" }
];

const reviewerPhase: PhaseNodeViewModel = {
  id: "reviewer",
  label: "Reviewer",
  status: "failed",
  artefactIds: ["reviewer-output"]
};

test("toggleFileScope switches between phase and all", () => {
  assert.equal(toggleFileScope("phase"), "all");
  assert.equal(toggleFileScope("all"), "phase");
});

test("resolveScopedFiles returns all files in all scope", () => {
  assert.deepEqual(resolveScopedFiles({ scope: "all", files, selectedPhase: reviewerPhase }), files);
});

test("resolveScopedFiles returns selected phase files in phase scope", () => {
  assert.deepEqual(resolveScopedFiles({ scope: "phase", files, selectedPhase: reviewerPhase }), [files[1]]);
});

test("formatFileScopeLabel describes scope", () => {
  assert.equal(formatFileScopeLabel({ scope: "all", selectedPhase: reviewerPhase }), "All files");
  assert.equal(formatFileScopeLabel({ scope: "phase", selectedPhase: reviewerPhase }), "Artifacts for Reviewer");
});
