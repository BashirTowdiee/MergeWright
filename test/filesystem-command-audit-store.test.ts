import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { FilesystemCommandAuditStore, toAuditRecordFilename } from "../src/application/commands/filesystem-command-audit-store.js";
import type { CommandAuditRecord } from "../src/application/commands/command-audit-record.js";

const record: CommandAuditRecord = {
  id: "cmd-1:2026-05-23T00:01:00.000Z",
  commandId: "cmd-1",
  type: "add-task-comment",
  source: "tui",
  actor: { id: "tester", displayName: "Tester" },
  risk: "low",
  confirmation: { status: "not_required" },
  requestedAt: "2026-05-23T00:00:00.000Z",
  recordedAt: "2026-05-23T00:01:00.000Z",
  inputSummary: "Add a comment to task-1.",
  result: {
    ok: true,
    commandId: "cmd-1",
    type: "add-task-comment",
    message: "Comment accepted.",
    changedFiles: ["plans/coordination.md"],
    artefacts: ["runs/run-1/reviewer-output.md"]
  },
  changedFiles: ["plans/coordination.md"],
  artefacts: ["runs/run-1/reviewer-output.md"]
};

test("FilesystemCommandAuditStore creates the audit directory and appends a JSON record", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mergewright-audit-"));

  try {
    const auditDirectory = path.join(root, "nested", "audit");
    const store = new FilesystemCommandAuditStore({ auditDirectory });

    await store.append({ record });

    const output = await readFile(path.join(auditDirectory, `${toAuditRecordFilename(record.id)}.json`), "utf8");
    assert.deepEqual(JSON.parse(output), record);
    assert.equal(output.endsWith("\n"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FilesystemCommandAuditStore does not overwrite an existing audit record", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mergewright-audit-"));

  try {
    const store = new FilesystemCommandAuditStore({ auditDirectory: root });

    await store.append({ record });
    await assert.rejects(() => store.append({ record }), { code: "EEXIST" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("toAuditRecordFilename sanitises unsafe record IDs", () => {
  assert.equal(toAuditRecordFilename(" cmd 1:2026-05-23T00:01:00.000Z "), "cmd-1-2026-05-23T00-01-00.000Z");
  assert.equal(toAuditRecordFilename("   "), "audit-record");
});
