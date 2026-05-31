export interface ProviderSummary {
  id: string;
  type: "codex-cli" | "opencode-cli";
  command: string;
  usedByRoles: string[];
  supportsReadOnly: boolean;
  supportsWrites: boolean;
  supportsProbe: boolean;
}

export interface ProviderInventory {
  defaultProvider: string;
  providers: ProviderSummary[];
}
