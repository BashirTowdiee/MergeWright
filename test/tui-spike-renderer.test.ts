import test from "node:test";
import assert from "node:assert/strict";
import { createTuiSpikeFixture } from "../src/tui/spike-fixture.js";
import { renderTuiSpikeFixture } from "../src/tui/spike-renderer.js";

test("createTuiSpikeFixture provides realistic run cockpit data", () => {
  const fixture = createTuiSpikeFixture();

  assert.equal(fixture.runs.length, 3);
  assert.equal(fixture.selectedRun.status, "failed");
  assert.equal(fixture.selectedRun.phases.find((phase) => phase.id === "reviewer")?.status, "failed");
  assert.equal(fixture.selectedRun.safeActions.find((action) => action.id === "request-fix")?.enabled, true);
  assert.equal(fixture.selectedRun.artefacts.find((artefact) => artefact.id === "reviewer-output")?.kind, "markdown");
});

test("renderTuiSpikeFixture renders runs, phase flow, actions, artefacts, and findings", () => {
  const output = renderTuiSpikeFixture(createTuiSpikeFixture());

  assert.match(output, /MergeWright TUI spike/);
  assert.match(output, /Runs/);
  assert.match(output, /docs-site build/);
  assert.match(output, /Phase flow/);
  assert.match(output, /Reviewer/);
  assert.match(output, /Safe action/);
  assert.match(output, /Generate fix prompt/);
  assert.match(output, /Artefacts/);
  assert.match(output, /reviewer-output-last-message.md/);
  assert.match(output, /Review findings/);
  assert.match(output, /HIGH: docs-site route assumes optional order metadata exists/);
});
