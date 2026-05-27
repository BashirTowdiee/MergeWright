import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const checkedRoots = ["apps", "src/api", "src/tui", "src/web"];
const tuiRoots = ["src/tui"];
const forbiddenTuiImports = [
  "child_process",
  "node:child_process",
  "fs",
  "node:fs",
  "fs/promises",
  "node:fs/promises"
];

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

function importsForbiddenTuiApi(contents: string): boolean {
  return forbiddenTuiImports.some((moduleName) => contents.includes(`from "${moduleName}"`) || contents.includes(`from '${moduleName}'`) || contents.includes(`require("${moduleName}")`) || contents.includes(`require('${moduleName}')`));
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

test("TUI files do not import direct process or filesystem mutation APIs", async () => {
  const files = (await Promise.all(tuiRoots.map((root) => listSourceFiles(join(repoRoot, root))))).flat();
  const violations: string[] = [];

  for (const file of files) {
    const relativePath = relative(repoRoot, file).split(sep).join("/");
    const contents = await readFile(file, "utf8");

    if (importsForbiddenTuiApi(contents)) {
      violations.push(relativePath);
    }
  }

  assert.deepEqual(violations, []);
});
