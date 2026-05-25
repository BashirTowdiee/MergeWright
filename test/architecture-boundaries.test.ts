import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const checkedRoots = ["apps", "src/api", "src/tui", "src/web"];

async function listSourceFiles(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const entryPath = join(path, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listSourceFiles(entryPath)));
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        files.push(entryPath);
      }
    }

    return files;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function importsCliImplementation(contents: string): boolean {
  return contents.includes("../cli.js") || contents.includes("../cli/") || contents.includes("../../cli/") || contents.includes("../../../src/cli/");
}

test("web, API, and UI surfaces do not import CLI implementation files", async () => {
  const files = (await Promise.all(checkedRoots.map((root) => listSourceFiles(join(repoRoot, root))))).flat();
  const violations: string[] = [];

  for (const file of files) {
    const relativePath = relative(repoRoot, file).split(sep).join("/");
    if (relativePath.startsWith("apps/cli/")) {
      continue;
    }

    const contents = await readFile(file, "utf8");
    if (importsCliImplementation(contents)) {
      violations.push(relativePath);
    }
  }

  assert.deepEqual(violations, []);
});

test("process-level child process usage stays inside CLI presentation boundaries", async () => {
  const files = await listSourceFiles(join(repoRoot, "src"));
  const violations: string[] = [];

  for (const file of files) {
    const relativePath = relative(repoRoot, file).split(sep).join("/");
    const contents = await readFile(file, "utf8");

    if (contents.includes("node:child_process") || contents.includes("child_process")) {
      violations.push(relativePath);
    }
  }

  assert.deepEqual(violations, []);
});
