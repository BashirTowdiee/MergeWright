import { createEvidenceManifest, type EvidenceManifest } from "../../evidence/evidence-manifest.js";
import type { ClassicRunContext } from "./run-context.js";

export function createInitialClassicRunEvidenceManifest(context: ClassicRunContext): EvidenceManifest {
  return createEvidenceManifest({
    runId: context.runId,
    projectName: context.config.projectName,
    stageName: context.variables.stage_name,
    workspace: context.targetWorkspaceRoot
  });
}
