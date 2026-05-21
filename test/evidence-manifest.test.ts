import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendEvidenceArtefact,
  appendEvidenceCommand,
  createEvidenceManifest,
  isEvidenceManifest
} from "../src/evidence/evidence-manifest.js";
import {
  EVIDENCE_MANIFEST_FILENAME,
  readEvidenceManifest,
  readEvidenceManifestIfExists,
  resolveEvidenceManifestPath,
  updateEvidenceManifest,
  writeEvidenceManifest
} from "../src/evidence/evidence-store.js";

test("createEvidenceManifest creates stable defaults", () => {
  const manifest = createEvidenceManifest({
    runId: "run-123",
    stageId: "stage-01",
    projectName: "MergeWright",
    stageName: "Stage 01",
    workspace: "/tmp/workspace",
    startedAt: "2026-05-21T00:00:00.000Z"
  });

  assert.deepEqual(manifest, {
    version: 1,
    runId: "run-123",
    stageId: "stage-01",
    projectName: "MergeWright",
    stageName: "Stage 01",
    status: "in_progress",
    workspace: "/tmp/workspace",
    startedAt: "2026-05-21T00:00:00.000Z",
    git: {
      changedFiles: [],
      untrackedFiles: [],
      unexpectedFiles: []
    },
    commands: [],
    artefacts: []
  });
  assert.equal(isEvidenceManifest(manifest), true);
});

test("createEvidenceManifest supports unknown status and null workspace", () => {
  const manifest = createEvidenceManifest({
    runId: "run-unknown",
    status: "unknown",
    startedAt: "2026-05-21T00:00:00.000Z"
  });

  assert.equal(manifest.status, "unknown");
  assert.equal(manifest.workspace, null);
  assert.equal(isEvidenceManifest(manifest), true);
});

test("appendEvidenceCommand upserts by id and keeps deterministic order", () => {
  const manifest = createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" });
  const withSecond = appendEvidenceCommand(manifest, {
    id: "check:test",
    label: "Tests",
    command: "npm test",
    cwd: "/tmp/workspace",
    startedAt: "2026-05-21T00:00:00.000Z",
    status: "passed",
    exitCode: 0
  });
  const withFirst = appendEvidenceCommand(withSecond, {
    id: "check:build",
    label: "Build",
    command: "npm run build",
    cwd: "/tmp/workspace",
    startedAt: "2026-05-21T00:00:01.000Z",
    status: "passed",
    exitCode: 0
  });
  const updated = appendEvidenceCommand(withFirst, {
    id: "check:test",
    label: "Tests",
    command: "npm test",
    cwd: "/tmp/workspace",
    startedAt: "2026-05-21T00:00:02.000Z",
    status: "failed",
    exitCode: 1
  });

  assert.deepEqual(
    updated.commands.map((command) => `${command.id}:${command.status}`),
    ["check:build:passed", "check:test:failed"]
  );
});

test("appendEvidenceArtefact normalises paths and upserts by path", () => {
  const manifest = createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" });
  const withArtefact = appendEvidenceArtefact(manifest, {
    path: "./reviewer-output.md",
    kind: "reviewer-output",
    phase: "reviewer"
  });
  const updated = appendEvidenceArtefact(withArtefact, {
    path: "reviewer-output.md",
    kind: "reviewer-output",
    phase: "reviewer",
    description: "latest reviewer output"
  });

  assert.deepEqual(updated.artefacts, [
    {
      path: "reviewer-output.md",
      kind: "reviewer-output",
      phase: "reviewer",
      description: "latest reviewer output"
    }
  ]);
});

test("evidence store writes, reads, and updates evidence.json", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "evidence-manifest-"));
  try {
    const manifest = createEvidenceManifest({
      runId: "run-123",
      workspace: "/tmp/workspace",
      startedAt: "2026-05-21T00:00:00.000Z"
    });

    await writeEvidenceManifest(runDir, manifest);
    assert.equal(resolveEvidenceManifestPath(runDir), path.join(runDir, EVIDENCE_MANIFEST_FILENAME));

    const raw = await readFile(path.join(runDir, EVIDENCE_MANIFEST_FILENAME), "utf8");
    assert.equal(raw.endsWith("\n"), true);

    const read = await readEvidenceManifest(runDir);
    assert.deepEqual(read, manifest);
    assert.deepEqual(await readEvidenceManifestIfExists(runDir), manifest);

    const updated = await updateEvidenceManifest(runDir, (current) => ({
      ...current,
      status: "pass",
      completedAt: "2026-05-21T00:01:00.000Z"
    }));

    assert.equal(updated.status, "pass");
    assert.equal(updated.completedAt, "2026-05-21T00:01:00.000Z");
    assert.deepEqual(await readEvidenceManifest(runDir), updated);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("readEvidenceManifestIfExists returns null when evidence.json is missing", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "evidence-manifest-missing-"));
  try {
    assert.equal(await readEvidenceManifestIfExists(runDir), null);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("readEvidenceManifest rejects malformed manifest content", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "evidence-manifest-invalid-"));
  try {
    await writeEvidenceManifest(runDir, createEvidenceManifest({ runId: "run-123", workspace: "/tmp/workspace" }));
    const manifestPath = path.join(runDir, EVIDENCE_MANIFEST_FILENAME);
    await import("node:fs/promises").then(({ writeFile }) => writeFile(manifestPath, "{}\n", "utf8"));

    await assert.rejects(() => readEvidenceManifest(runDir), /Invalid evidence manifest/);
    await assert.rejects(() => readEvidenceManifestIfExists(runDir), /Invalid evidence manifest/);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});

test("readEvidenceManifest rejects manifests without untrackedFiles", async () => {
  const runDir = await mkdtemp(path.join(os.tmpdir(), "evidence-manifest-invalid-git-"));
  try {
    const manifestPath = path.join(runDir, EVIDENCE_MANIFEST_FILENAME);
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        manifestPath,
        JSON.stringify({
          version: 1,
          runId: "run-123",
          status: "in_progress",
          workspace: "/tmp/workspace",
          startedAt: "2026-05-21T00:00:00.000Z",
          git: {
            changedFiles: [],
            unexpectedFiles: []
          },
          commands: [],
          artefacts: []
        }) + "\n",
        "utf8"
      )
    );

    await assert.rejects(() => readEvidenceManifest(runDir), /Invalid evidence manifest/);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
});
