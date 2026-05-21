import type { EvidenceManifestStatus } from "../../evidence/evidence-manifest.js";
import { updateEvidenceManifest } from "../../evidence/evidence-store.js";

export async function finaliseClassicRunEvidence(input: {
  runDir: string;
  status: EvidenceManifestStatus;
  completedAt?: Date | string;
}): Promise<void> {
  const completedAt = toIsoString(input.completedAt ?? new Date());
  await updateEvidenceManifest(input.runDir, (manifest) => ({
    ...manifest,
    status: input.status,
    completedAt
  }));
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
