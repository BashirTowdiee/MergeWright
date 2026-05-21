import { mergeEvidenceGitFiles } from "./evidence-git-files.js";
import { updateEvidenceManifest } from "./evidence-store.js";
import { readWriteAuditGitFiles } from "./write-audit-git-files.js";

export async function updateEvidenceWithWriteAuditFiles(runDir: string) {
  const files = await readWriteAuditGitFiles(runDir);
  return updateEvidenceManifest(runDir, (manifest) =>
    mergeEvidenceGitFiles({ manifest, changedFiles: files.changedFiles, untrackedFiles: files.untrackedFiles })
  );
}
