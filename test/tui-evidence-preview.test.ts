import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidencePreview } from "../src/tui/evidence-preview.js";

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

test("buildEvidencePreview falls back to reviewer findings", () => {
  const lines = buildEvidencePreview({
    findings: [{ severity: "high", message: "blocking issue" }]
  });

  assert.deepEqual(lines, ["HIGH: blocking issue"]);
});

test("buildEvidencePreview handles empty evidence", () => {
  assert.deepEqual(buildEvidencePreview({ findings: [] }), ["No evidence selected."]);
});
