import test from "node:test";
import assert from "node:assert/strict";
import { filterArtifactsForPhase, formatArtifactScopeLabel } from "../src/tui/phase-artifacts.js";
import type { ArtefactViewModel, PhaseNodeViewModel } from "../src/tui/view-models.js";

const artifacts: ArtefactViewModel[] = [
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

test("filterArtifactsForPhase returns all artifacts when no phase is selected", () => {
  assert.deepEqual(filterArtifactsForPhase({ artifacts }), artifacts);
});

test("filterArtifactsForPhase returns artifacts linked by id or phase id", () => {
  assert.deepEqual(filterArtifactsForPhase({ artifacts, selectedPhase: reviewerPhase }), [artifacts[1]]);
});

test("filterArtifactsForPhase returns empty list when selected phase has no artifacts", () => {
  assert.deepEqual(
    filterArtifactsForPhase({ artifacts, selectedPhase: { id: "checks", label: "Checks", status: "blocked", artefactIds: [] } }),
    []
  );
});

test("formatArtifactScopeLabel describes current scope", () => {
  assert.equal(formatArtifactScopeLabel(undefined), "Artifacts");
  assert.equal(formatArtifactScopeLabel(reviewerPhase), "Artifacts for Reviewer");
});
