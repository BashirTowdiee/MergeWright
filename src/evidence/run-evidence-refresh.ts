import { updateEvidenceChecksSummary } from "./check-evidence.js";
import { updateEvidenceReviewSummary } from "./review-evidence.js";
import { updateEvidenceWithWriteAuditFiles } from "./write-audit-evidence.js";

export async function refreshRunEvidence(runDir: string): Promise<void> {
  await updateEvidenceWithWriteAuditFiles(runDir);
  await updateEvidenceReviewSummary(runDir);
  await updateEvidenceChecksSummary(runDir);
}
