import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const expectedExports = [
  "src/application/commands/app-command.js",
  "src/application/commands/app-command-result.js",
  "src/application/commands/default-app-command-service.js",
  "src/application/commands/evented-app-command-service.js",
  "src/application/events/app-event.js",
  "src/application/events/event-store.js",
  "src/application/use-cases/start-run-use-case.js",
  "src/application/use-cases/continue-run-use-case.js",
  "src/application/use-cases/select-task-use-case.js",
  "src/application/use-cases/update-coordination-note-use-case.js"
];

test("application package exposes command, event, and use-case boundaries", async () => {
  const entrypoint = await readFile(join(process.cwd(), "packages/application/src/index.ts"), "utf8");

  assert.equal(entrypoint.includes("Package boundary placeholder"), false);

  for (const expectedExport of expectedExports) {
    assert.equal(
      entrypoint.includes(expectedExport),
      true,
      `Expected packages/application/src/index.ts to export ${expectedExport}`
    );
  }
});
