import { refreshRunEvidence } from "../../evidence/run-evidence-refresh.js";

export async function refreshClassicRunEvidence(runDir: string): Promise<void> {
  await refreshRunEvidence(runDir);
}
