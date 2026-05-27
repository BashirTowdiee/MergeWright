import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const checkedRoots = ["apps", "src/api", "src/tui", "src/web"];
const tuiRoots = ["src/tui"];
const forbiddenTuiProcessImports = ["child_process", "node:child_process"];
const filesystemModules = ["fs", "node:fs", "fs/promises", "node:fs/promises"];
const forbiddenFileMutationMembers = [
  "appendFile",
  "chmod",
  "chown",
  "copyFile",
  "cp",
  "mkdir",
  "rename",
  "rm",
  "rmdir",
  "truncate",
  "unlink",
  "utimes",
  "writeFile"
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

function importsProcessApi(contents: string): boolean {
  return forbiddenTuiProcessImports.some((moduleName) => importsModule(contents, moduleName));
}

function importsModule(contents: string, moduleName: string): boolean {
  return contents.includes(`from "${moduleName}"`) || contents.includes(`from '${moduleName}'`) || contents.includes(`require("${moduleName}")`) || contents.includes(`require('${moduleName}')`);
}

function importsFilesystemMutationApi(contents: string): boolean {
  return filesystemModules.some((moduleName) => importsFilesystemMutationMember(contents, moduleName));
}

function importsFilesystemMutationMember(contents: string, moduleName: string): boolean {
  if (contents.includes(`import * as`) && importsModule(contents, moduleName)) {
    return true;
  }

  if (contents.includes(`import fs from "${moduleName}"`) || contents.includes(`import fs from '${moduleName}'`)) {
    return true;
  }

  const escapedModuleName = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const importPattern = new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+["']${escapedModuleName}["']`, "g");
  const matches = contents.matchAll(importPattern);

  for (const match of matches) {
    const importedMembers = match[1]
      .split(",")
      .map((member) => member.trim().split(/\s+as\s+/)[0]?.trim())
      .filter(Boolean);

    if (importedMembers.some((member) => forbiddenFileMutationMembers.includes(member))) {
      return true;
    }
  }

  return false;
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

    if (importsProcessApi(contents) || importsFilesystemMutationApi(contents)) {
      violations.push(relativePath);
    }
  }

  assert.deepEqual(violations, []);
});
