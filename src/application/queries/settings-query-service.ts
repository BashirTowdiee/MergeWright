import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  SettingsDefaultMode,
  SettingsSnapshot,
  SettingsTheme,
  SettingsUiSnapshot,
  SettingsUpdate
} from "../read-models/settings-read-model.js";

const ALLOWED_MODES: readonly SettingsDefaultMode[] = ["preview-first", "read-only", "write-enabled"];
const ALLOWED_THEMES: readonly SettingsTheme[] = ["system", "light", "dark"];

export interface SettingsQueryService {
  getSettings(): Promise<SettingsSnapshot>;
  updateSettings(input: SettingsUpdate): Promise<SettingsSnapshot>;
}

export interface FileSettingsQueryServiceOptions {
  settingsPath: string;
  defaults: Omit<SettingsSnapshot, "updatedAt"> & { updatedAt?: string };
  now?: () => Date;
}

export class FileSettingsQueryService implements SettingsQueryService {
  private readonly settingsPath: string;
  private readonly defaults: SettingsSnapshot;
  private readonly now: () => Date;

  constructor(options: FileSettingsQueryServiceOptions) {
    this.settingsPath = path.resolve(options.settingsPath);
    this.now = options.now ?? (() => new Date());
    this.defaults = withTimestamp(options.defaults, this.now);
  }

  async getSettings(): Promise<SettingsSnapshot> {
    const loaded = await this.loadStoredSettings();
    return normalizeSettings(loaded, this.defaults);
  }

  async updateSettings(input: SettingsUpdate): Promise<SettingsSnapshot> {
    const current = await this.getSettings();
    const merged = mergeSettings(current, input);
    validateSettings(merged);
    const next: SettingsSnapshot = {
      ...merged,
      updatedAt: this.now().toISOString()
    };
    await this.persist(next);
    return next;
  }

  private async loadStoredSettings(): Promise<unknown | null> {
    try {
      const raw = await readFile(this.settingsPath, "utf8");
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  private async persist(snapshot: SettingsSnapshot): Promise<void> {
    await mkdir(path.dirname(this.settingsPath), { recursive: true });
    await writeFile(this.settingsPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }
}

function withTimestamp(snapshot: Omit<SettingsSnapshot, "updatedAt"> & { updatedAt?: string }, now: () => Date): SettingsSnapshot {
  return {
    version: 1,
    project: {
      defaultConfigPath: snapshot.project.defaultConfigPath,
      runsRoot: snapshot.project.runsRoot,
      defaultProvider: snapshot.project.defaultProvider,
      defaultModel: snapshot.project.defaultModel,
      defaultMode: snapshot.project.defaultMode
    },
    retention: {
      evidenceDays: snapshot.retention.evidenceDays,
      artifactDays: snapshot.retention.artifactDays
    },
    ui: normalizeUi(snapshot.ui),
    updatedAt: snapshot.updatedAt ?? now().toISOString()
  };
}

function normalizeSettings(input: unknown, defaults: SettingsSnapshot): SettingsSnapshot {
  if (!isRecord(input)) {
    return cloneSettings(defaults);
  }

  const project = isRecord(input.project) ? input.project : {};
  const retention = isRecord(input.retention) ? input.retention : {};
  const ui = isRecord(input.ui) ? input.ui : {};

  const defaultMode = isAllowedMode(project.defaultMode) ? project.defaultMode : defaults.project.defaultMode;
  const theme = isAllowedTheme(ui.theme) ? ui.theme : defaults.ui.theme;

  return {
    version: 1,
    project: {
      defaultConfigPath: nonEmptyString(project.defaultConfigPath) ?? defaults.project.defaultConfigPath,
      runsRoot: nonEmptyString(project.runsRoot) ?? defaults.project.runsRoot,
      defaultProvider: nonEmptyString(project.defaultProvider) ?? defaults.project.defaultProvider,
      defaultModel: nonEmptyString(project.defaultModel) ?? defaults.project.defaultModel,
      defaultMode
    },
    retention: {
      evidenceDays: positiveInteger(retention.evidenceDays) ?? defaults.retention.evidenceDays,
      artifactDays: positiveInteger(retention.artifactDays) ?? defaults.retention.artifactDays
    },
    ui: {
      theme,
      keyboardShortcuts:
        typeof ui.keyboardShortcuts === "boolean" ? ui.keyboardShortcuts : defaults.ui.keyboardShortcuts
    },
    updatedAt: nonEmptyString(input.updatedAt) ?? defaults.updatedAt
  };
}

function cloneSettings(snapshot: SettingsSnapshot): SettingsSnapshot {
  return {
    version: 1,
    project: { ...snapshot.project },
    retention: { ...snapshot.retention },
    ui: { ...snapshot.ui },
    updatedAt: snapshot.updatedAt
  };
}

function mergeSettings(current: SettingsSnapshot, update: SettingsUpdate): SettingsSnapshot {
  const projectUpdate = update.project ?? {};
  const retentionUpdate = update.retention ?? {};
  const uiUpdate = update.ui ?? {};

  return {
    version: 1,
    project: {
      defaultConfigPath: projectUpdate.defaultConfigPath ?? current.project.defaultConfigPath,
      runsRoot: projectUpdate.runsRoot ?? current.project.runsRoot,
      defaultProvider: projectUpdate.defaultProvider ?? current.project.defaultProvider,
      defaultModel: projectUpdate.defaultModel ?? current.project.defaultModel,
      defaultMode: projectUpdate.defaultMode ?? current.project.defaultMode
    },
    retention: {
      evidenceDays: retentionUpdate.evidenceDays ?? current.retention.evidenceDays,
      artifactDays: retentionUpdate.artifactDays ?? current.retention.artifactDays
    },
    ui: {
      theme: uiUpdate.theme ?? current.ui.theme,
      keyboardShortcuts: uiUpdate.keyboardShortcuts ?? current.ui.keyboardShortcuts
    },
    updatedAt: current.updatedAt
  };
}

function validateSettings(snapshot: SettingsSnapshot): void {
  assertNonEmpty(snapshot.project.defaultConfigPath, "project.defaultConfigPath");
  assertNonEmpty(snapshot.project.runsRoot, "project.runsRoot");
  assertNonEmpty(snapshot.project.defaultProvider, "project.defaultProvider");
  assertNonEmpty(snapshot.project.defaultModel, "project.defaultModel");

  if (!isAllowedMode(snapshot.project.defaultMode)) {
    throw new Error(`Invalid settings value: project.defaultMode=${snapshot.project.defaultMode}`);
  }
  if (!Number.isInteger(snapshot.retention.evidenceDays) || snapshot.retention.evidenceDays < 1) {
    throw new Error("Invalid settings value: retention.evidenceDays must be an integer >= 1");
  }
  if (!Number.isInteger(snapshot.retention.artifactDays) || snapshot.retention.artifactDays < 1) {
    throw new Error("Invalid settings value: retention.artifactDays must be an integer >= 1");
  }
  if (!isAllowedTheme(snapshot.ui.theme)) {
    throw new Error(`Invalid settings value: ui.theme=${snapshot.ui.theme}`);
  }
}

function normalizeUi(input: SettingsUiSnapshot): SettingsUiSnapshot {
  return {
    theme: isAllowedTheme(input.theme) ? input.theme : "system",
    keyboardShortcuts: input.keyboardShortcuts
  };
}

function isAllowedMode(value: unknown): value is SettingsDefaultMode {
  return typeof value === "string" && ALLOWED_MODES.includes(value as SettingsDefaultMode);
}

function isAllowedTheme(value: unknown): value is SettingsTheme {
  return typeof value === "string" && ALLOWED_THEMES.includes(value as SettingsTheme);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Invalid settings value: ${label} must not be empty`);
  }
}
