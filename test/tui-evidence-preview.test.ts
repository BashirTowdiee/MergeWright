import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidencePreview, createEvidenceSnippet } from "../src/tui/evidence-preview.js";

test("buildEvidencePreview summarises selected artefact", () => {
  const lines = buildEvidencePreview({
    artefact: {
      id: "reviewer-output",
      title: "reviewer-output-last-message.md",
      kind: "markdown",
      path: "reviewer-output-last-message.md",
      phaseId: "reviewer",
      sizeBytes: 42
    },
    findings: []
  });

  assert.deepEqual(lines, [
    "Artefact: reviewer-output-last-message.md",
    "Kind: markdown",
    "Path: reviewer-output-last-message.md",
    "Phase: reviewer",
    "Size: 42 bytes"
  ]);
});

test("buildEvidencePreview includes snippet when available", () => {
  const lines = buildEvidencePreview({
    artefact: {
      id: "reviewer-output",
      title: "reviewer-output-last-message.md",
      kind: "markdown",
      path: "reviewer-output-last-message.md",
      phaseId: "reviewer",
      sizeBytes: 42
    },
    findings: [],
    snippets: {
      "reviewer-output": { artefactId: "reviewer-output", lines: ["Verdict: FAIL", "High: route mismatch"] }
    }
  });

  assert.deepEqual(lines, [
    "Artefact: reviewer-output-last-message.md",
    "Kind: markdown",
    "Path: reviewer-output-last-message.md",
    "Phase: reviewer",
    "Size: 42 bytes",
    "",
    "Snippet:",
    "Verdict: FAIL",
    "High: route mismatch"
  ]);
});

test("createEvidenceSnippet limits line count and line length", () => {
  const snippet = createEvidenceSnippet({ artefactId: "a", content: "1234567890\nsecond\nthird", maxLines: 2, maxLineLength: 6 });
  assert.deepEqual(snippet, { artefactId: "a", lines: ["12345…", "second"] });
});

test("createEvidenceSnippet summarises evidence manifest JSON", () => {
  const snippet = createEvidenceSnippet({
    artefactId: "evidence-json",
    content: JSON.stringify(
      {
        version: 1,
        runId: "run-123",
        status: "pass",
        stageName: "stage-01-test",
        workspace: "/tmp/workspace",
        startedAt: "2026-05-21T00:00:00.000Z",
        completedAt: "2026-05-21T00:01:00.000Z",
        git: { changedFiles: [], untrackedFiles: [], unexpectedFiles: [] },
        commands: [{ id: "checks" }],
        artefacts: [{ path: "run-report.md" }, { path: "run-report.json" }]
      },
      null,
      2
    )
  });

  assert.deepEqual(snippet, {
    artefactId: "evidence-json",
    lines: [
      "Evidence status: pass",
      "Completed at: 2026-05-21T00:01:00.000Z",
      "Run: run-123",
      "Stage: stage-01-test",
      "Workspace: /tmp/workspace",
      "Commands: 1",
      "Artefacts: 2"
    ]
  });
});

test("buildEvidencePreview falls back to reviewer findings", () => {
  const lines = buildEvidencePreview({
    findings: [{ severity: "high", message: "blocking issue" }]
  });

  assert.deepEqual(lines, ["HIGH: blocking issue"]);
});

test("buildEvidencePreview handles empty evidence", () => {
  assert.deepEqual(buildEvidencePreview({ findings: [] }), ["No evidence selected."]);
});
