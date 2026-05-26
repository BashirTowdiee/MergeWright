import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function assertArtefactsAbsent(runDir: string, fileNames: string[], phaseLabel: string): Promise<void> {
  for (const fileName of fileNames) {
    const absolute = path.resolve(runDir, fileName);
    try {
      await access(absolute);
      throw new Error(`${phaseLabel} continuation is not allowed because artefact already exists: ${fileName}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

export async function assertArtefactExists(runDir: string, relativePath: string, message: string): Promise<void> {
  const absolute = path.resolve(runDir, relativePath);
  try {
    await access(absolute);
  } catch {
    throw new Error(message);
  }
}

export async function writeText(
  runDir: string,
  relativePath: string,
  content: string,
  written: string[],
  allowOverwrite: boolean
): Promise<void> {
  const absolute = path.resolve(runDir, relativePath);
  await preventOverwriteUnlessAllowed(absolute, allowOverwrite);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
  written.push(absolute);
}

export async function writeJson(
  runDir: string,
  relativePath: string,
  value: unknown,
  written: string[],
  allowOverwrite: boolean
): Promise<void> {
  await writeText(runDir, relativePath, `${JSON.stringify(value, null, 2)}\n`, written, allowOverwrite);
}

export async function readText(filePath: string, fallback = ""): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

async function preventOverwriteUnlessAllowed(filePath: string, allowOverwrite: boolean): Promise<void> {
  try {
    await access(filePath);
    if (!allowOverwrite) {
      throw new Error(`Refusing to overwrite existing artefact: ${filePath}`);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return;
    }
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) {
      throw error;
    }
    throw error;
  }
}

export function sanitizeCheckName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}
