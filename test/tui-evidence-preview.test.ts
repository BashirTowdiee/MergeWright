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

test("buildEvidencePreview falls back to reviewer findings", () => {
  const lines = buildEvidencePreview({
    findings: [{ severity: "high", message: "blocking issue" }]
  });

  assert.deepEqual(lines, ["HIGH: blocking issue"]);
});

test("buildEvidencePreview handles empty evidence", () => {
  assert.deepEqual(buildEvidencePreview({ findings: [] }), ["No evidence selected."]);
});
