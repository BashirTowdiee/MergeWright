import type { EvidenceStageContract } from "../../evidence/evidence-manifest.js";
import { readEvidenceManifestIfExists, writeEvidenceManifest } from "../../evidence/evidence-store.js";
import type { Stage } from "../../stage-plan.js";

export function buildEvidenceStageContract(stage: Stage): EvidenceStageContract {
  return {
    objective: stage.goal,
    allowedPaths: dedupeSort(stage.contract?.allowedPaths ?? stage.scope.include ?? []),
    forbiddenPaths: dedupeSort(stage.contract?.forbiddenPaths ?? stage.scope.exclude ?? []),
    requiredCommands: dedupeSort(stage.contract?.requiredCommands ?? stage.checks ?? []),
    requiredEvidence: dedupeSort(stage.contract?.requiredEvidence ?? []),
    acceptanceCriteria: dedupeSort(stage.acceptanceCriteria),
    reviewChecklist: dedupeSort(stage.contract?.review?.checklist ?? [])
  };
}

export async function persistStageContractEvidence(runDir: string, stage: Stage): Promise<void> {
  const manifest = await readEvidenceManifestIfExists(runDir);
  if (!manifest) {
    return;
  }
  await writeEvidenceManifest(runDir, {
    ...manifest,
    stageContract: buildEvidenceStageContract(stage)
  });
}

function dedupeSort(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) => a.localeCompare(b));
}
