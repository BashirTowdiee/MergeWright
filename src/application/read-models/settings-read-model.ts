export type SettingsDefaultMode = "preview-first" | "read-only" | "write-enabled";
export type SettingsTheme = "system" | "light" | "dark";

export interface SettingsProjectSnapshot {
  activeProjectId: string;
  defaultConfigPath: string;
  runsRoot: string;
  defaultProvider: string;
  defaultModel: string;
  defaultMode: SettingsDefaultMode;
}

export interface SettingsRetentionSnapshot {
  evidenceDays: number;
  artifactDays: number;
}

export interface SettingsUiSnapshot {
  theme: SettingsTheme;
  keyboardShortcuts: boolean;
}

export interface SettingsSnapshot {
  version: 1;
  project: SettingsProjectSnapshot;
  retention: SettingsRetentionSnapshot;
  ui: SettingsUiSnapshot;
  updatedAt: string;
}

export interface SettingsUpdate {
  project?: Partial<SettingsProjectSnapshot>;
  retention?: Partial<SettingsRetentionSnapshot>;
  ui?: Partial<SettingsUiSnapshot>;
}
