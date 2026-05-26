import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeClassicRunArtefacts(runDir: string, artefacts: Record<string, string>): Promise<string[]> {
  const entries = Object.entries(artefacts).sort(([a], [b]) => a.localeCompare(b));
  const written: string[] = [];
  for (const [fileName, content] of entries) {
    const filePath = path.resolve(runDir, fileName);
    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
      written.push(filePath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed writing artefact ${filePath}: ${msg}`);
    }
  }
  return written;
}
