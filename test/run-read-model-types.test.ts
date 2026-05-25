import test from "node:test";
import assert from "node:assert/strict";
import type { RunDetail, RunSummary } from "../src/application/read-models/run-read-model.js";
import type { RunDetailViewModel, RunListItemViewModel } from "../src/tui/view-models.js";

const summary: RunSummary = {
  id: "run-1",
  title: "run one",
  status: "blocked",
  subtitle: "reviewer failed",
  mode: "read-only",
  warnings: ["needs fix"]
};

const tuiSummary: RunListItemViewModel = summary;

const detail: RunDetail = {
  id: "run-1",
  title: "run one",
  status: "blocked",
  runDir: "/tmp/MergeWright/runs/run-1",
  mode: "read-only",
  phases: [
    {
      id: "reviewer",
      label: "Reviewer",
      status: "failed",
      artefactIds: ["reviewer-output"]
    }
  ],
  artefacts: [
    {
      id: "reviewer-output",
      title: "reviewer-output-last-message.md",
      kind: "markdown",
      path: "reviewer-output-last-message.md",
      phaseId: "reviewer"
    }
  ],
  safeActions: [
    {
      id: "request-fix",
      label: "Request fix",
      enabled: true,
      risk: "medium",
      requiresConfirmation: false
    }
  ],
  reviewerFindings: [
    {
      severity: "high",
      message: "Reviewer failed."
    }
  ],
  warnings: []
};

const tuiDetail: RunDetailViewModel = detail;

test("shared run read models remain assignable to legacy TUI view model aliases", () => {
  assert.equal(tuiSummary.status, "blocked");
  assert.equal(tuiDetail.phases[0]?.status, "failed");
});
