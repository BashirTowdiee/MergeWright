import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isEvidenceManifest, type EvidenceManifest } from "./evidence-manifest.js";

export const EVIDENCE_MANIFEST_FILENAME = "evidence.json";

export function resolveEvidenceManifestPath(runDir: string): string {
  return path.resolve(runDir, EVIDENCE_MANIFEST_FILENAME);
}

export async function readEvidenceManifest(runDir: string): Promise<EvidenceManifest> {
  const manifestPath = resolveEvidenceManifestPath(runDir);
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isEvidenceManifest(parsed)) {
    throw new Error("Invalid evidence manifest: " + manifestPath);
  }
  return parsed;
}

export async function readEvidenceManifestIfExists(runDir: string): Promise<EvidenceManifest | null> {
  try {
    return await readEvidenceManifest(runDir);
  } catch (error) {
    if (isMissingEvidenceManifestError(error)) {
      return null;
    }
    throw error;
  }
}

export async function writeEvidenceManifest(runDir: string, manifest: EvidenceManifest): Promise<void> {
  const manifestPath = resolveEvidenceManifestPath(runDir);
  const temporaryPath = manifestPath + ".tmp";
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(temporaryPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  await rename(temporaryPath, manifestPath);
}

export async function updateEvidenceManifest(
  runDir: string,
  update: (manifest: EvidenceManifest) => EvidenceManifest | void
): Promise<EvidenceManifest> {
  const current = await readEvidenceManifest(runDir);
  const updated = update(current) ?? current;
  await writeEvidenceManifest(runDir, updated);
  return updated;
}

function isMissingEvidenceManifestError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
