import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderPlanHtml } from "../src/plan-html.js";

test("escapeHtml escapes unsafe characters", () => {
  assert.equal(escapeHtml(`<script>"x"&'y'</script>`), "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
});

test("renderPlanHtml includes expected sections", () => {
  const html = renderPlanHtml({
    runLabel: "20260516-example",
    stageTitle: "Example Stage",
    projectName: "acme",
    workspaceRoot: "/tmp/acme",
    plannerSummary: "summary",
    phaseFlow: ["planner: executed"],
    acceptanceCriteria: ["A"],
    risks: ["R"],
    assumptions: ["AS"],
    constraints: ["C"],
    plannedCommands: ["npm test"],
    artefactPaths: ["01-stage-input.md"]
  });
  assert.match(html, /Planner Summary/);
  assert.match(html, /Phase Flow/);
  assert.match(html, /Acceptance Criteria/);
  assert.match(html, /Risks/);
  assert.match(html, /Planned Commands/);
  assert.match(html, /Artefact Paths/);
});
