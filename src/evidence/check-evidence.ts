import { readFile } from "node:fs/promises";
import { createEvidenceChecksSummary } from "./checks-summary.js";
import { updateEvidenceManifest } from "./evidence-store.js";

export async function updateEvidenceChecksSummary(runDir: string) {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(await readFile(runDir + "/checks-status.json", "utf8")) as unknown;
  } catch {
    parsed = null;
  }
  return updateEvidenceManifest(runDir, (manifest) => ({
    ...manifest,
    checks: createEvidenceChecksSummary(parsed)
  }));
}
