import { readFile } from "node:fs/promises";
import { updateEvidenceManifest } from "./evidence-store.js";
import { createEvidenceReviewerSummary } from "./reviewer-summary.js";

export async function updateEvidenceReviewSummary(runDir: string) {
  const artefactPath = "reviewer-output-last-message.md";
  let markdown = "";
  try {
    markdown = await readFile(runDir + "/" + artefactPath, "utf8");
  } catch {
    markdown = "";
  }
  return updateEvidenceManifest(runDir, (manifest) => ({
    ...manifest,
    reviewer: createEvidenceReviewerSummary({ markdown, artefactPath })
  }));
}
