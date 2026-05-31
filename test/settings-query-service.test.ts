import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { FileSettingsQueryService } from "../src/application/queries/settings-query-service.js";

test("FileSettingsQueryService returns defaults when no file exists", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "orchestrator-settings-"));
  const service = new FileSettingsQueryService({
    settingsPath: path.join(root, "settings.json"),
    defaults: {
      version: 1,
      project: {
        activeProjectId: "default",
        defaultConfigPath: "/tmp/config.json",
        runsRoot: "/tmp/runs",
        defaultProvider: "codex-local",
        defaultModel: "gpt-5.3-codex",
        defaultMode: "preview-first"
      },
      retention: {
        evidenceDays: 30,
        artifactDays: 30
      },
      ui: {
        theme: "system",
        keyboardShortcuts: true
      }
    },
    now: () => new Date("2026-05-31T00:00:00.000Z")
  });

  const settings = await service.getSettings();
  assert.equal(settings.project.defaultProvider, "codex-local");
  assert.equal(settings.retention.evidenceDays, 30);
  assert.equal(settings.updatedAt, "2026-05-31T00:00:00.000Z");
});

test("FileSettingsQueryService persists updates", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "orchestrator-settings-"));
  const settingsPath = path.join(root, "settings.json");
  let now = new Date("2026-05-31T00:00:00.000Z");
  const service = new FileSettingsQueryService({
    settingsPath,
    defaults: {
      version: 1,
      project: {
        activeProjectId: "default",
        defaultConfigPath: "/tmp/config.json",
        runsRoot: "/tmp/runs",
        defaultProvider: "codex-local",
        defaultModel: "gpt-5.3-codex",
        defaultMode: "preview-first"
      },
      retention: {
        evidenceDays: 30,
        artifactDays: 30
      },
      ui: {
        theme: "system",
        keyboardShortcuts: true
      }
    },
    now: () => now
  });

  now = new Date("2026-05-31T00:05:00.000Z");
  const updated = await service.updateSettings({
    project: {
      defaultProvider: "opencode-local",
      defaultMode: "read-only"
    },
    retention: {
      evidenceDays: 14
    },
    ui: {
      theme: "dark",
      keyboardShortcuts: false
    }
  });

  assert.equal(updated.project.defaultProvider, "opencode-local");
  assert.equal(updated.project.defaultMode, "read-only");
  assert.equal(updated.retention.evidenceDays, 14);
  assert.equal(updated.retention.artifactDays, 30);
  assert.equal(updated.ui.theme, "dark");
  assert.equal(updated.ui.keyboardShortcuts, false);
  assert.equal(updated.updatedAt, "2026-05-31T00:05:00.000Z");

  const stored = JSON.parse(await readFile(settingsPath, "utf8")) as { project: { defaultProvider: string } };
  assert.equal(stored.project.defaultProvider, "opencode-local");
});

test("FileSettingsQueryService rejects invalid updates", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "orchestrator-settings-"));
  const settingsPath = path.join(root, "settings.json");
  const service = new FileSettingsQueryService({
    settingsPath,
    defaults: {
      version: 1,
      project: {
        activeProjectId: "default",
        defaultConfigPath: "/tmp/config.json",
        runsRoot: "/tmp/runs",
        defaultProvider: "codex-local",
        defaultModel: "gpt-5.3-codex",
        defaultMode: "preview-first"
      },
      retention: {
        evidenceDays: 30,
        artifactDays: 30
      },
      ui: {
        theme: "system",
        keyboardShortcuts: true
      }
    },
    now: () => new Date("2026-05-31T00:00:00.000Z")
  });

  await assert.rejects(
    () =>
      service.updateSettings({
        project: {
          defaultProvider: "  ",
          defaultMode: "preview-first"
        }
      }),
    /project.defaultProvider/
  );
});

test("FileSettingsQueryService falls back when stored file is malformed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "orchestrator-settings-"));
  const settingsPath = path.join(root, "settings.json");
  await writeFile(
    settingsPath,
    JSON.stringify({
      project: {
        activeProjectId: "default",
        defaultConfigPath: "",
        runsRoot: 42,
        defaultProvider: "codex-local",
        defaultModel: "gpt-5.3-codex",
        defaultMode: "bad-mode"
      },
      retention: {
        evidenceDays: 0,
        artifactDays: -5
      },
      ui: {
        theme: "purple"
      }
    }),
    "utf8"
  );

  const service = new FileSettingsQueryService({
    settingsPath,
    defaults: {
      version: 1,
      project: {
        activeProjectId: "default",
        defaultConfigPath: "/tmp/config.json",
        runsRoot: "/tmp/runs",
        defaultProvider: "codex-local",
        defaultModel: "gpt-5.3-codex",
        defaultMode: "preview-first"
      },
      retention: {
        evidenceDays: 30,
        artifactDays: 30
      },
      ui: {
        theme: "system",
        keyboardShortcuts: true
      }
    },
    now: () => new Date("2026-05-31T00:00:00.000Z")
  });

  const snapshot = await service.getSettings();
  assert.equal(snapshot.project.defaultConfigPath, "/tmp/config.json");
  assert.equal(snapshot.project.runsRoot, "/tmp/runs");
  assert.equal(snapshot.project.defaultMode, "preview-first");
  assert.equal(snapshot.retention.evidenceDays, 30);
  assert.equal(snapshot.retention.artifactDays, 30);
  assert.equal(snapshot.ui.theme, "system");
});
