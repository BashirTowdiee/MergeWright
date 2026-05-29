import { readFile } from "node:fs/promises";
import { updateEvidenceManifest } from "./evidence-store.js";
import { createEvidenceAcceptanceSummary, createEvidenceReviewerSummary } from "./reviewer-summary.js";

export async function updateEvidenceReviewSummary(runDir: string) {
  const artefactPath = "reviewer-output-last-message.md";
  let markdown = "";
  try {
    markdown = await readFile(runDir + "/" + artefactPath, "utf8");
  } catch {
    markdown = "";
  }
  const acceptance = createEvidenceAcceptanceSummary({ markdown });
  return updateEvidenceManifest(runDir, (manifest) => ({
    ...manifest,
    reviewer: createEvidenceReviewerSummary({ markdown, artefactPath }),
    acceptance
  }));
}
