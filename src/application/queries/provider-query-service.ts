import type { OrchestratorConfig } from "../../config/types.js";
import type { ProviderInventory, ProviderSummary } from "../read-models/provider-read-model.js";

export interface ProviderQueryService {
  getProviderInventory(): Promise<ProviderInventory>;
}

export interface StaticProviderQueryServiceOptions {
  config: OrchestratorConfig;
}

export class StaticProviderQueryService implements ProviderQueryService {
  private readonly config: OrchestratorConfig;

  constructor(options: StaticProviderQueryServiceOptions) {
    this.config = options.config;
  }

  async getProviderInventory(): Promise<ProviderInventory> {
    const providers: ProviderSummary[] = [];
    for (const [id, backend] of Object.entries(this.config.executionBackends)) {
      const usedByRoles = Object.entries(this.config.agents)
        .filter(([, role]) => role.backend === id)
        .map(([role]) => role);

      providers.push({
        id,
        type: backend.type,
        command: backend.type === "opencode-cli" ? backend.command ?? "opencode" : "codex",
        usedByRoles,
        supportsReadOnly: true,
        supportsWrites: true,
        supportsProbe: backend.type === "opencode-cli"
      });
    }

    providers.sort((a, b) => a.id.localeCompare(b.id));
    return {
      defaultProvider: this.config.agents.planner.backend,
      providers
    };
  }
}
