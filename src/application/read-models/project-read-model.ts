export interface ProjectSummary {
  id: string;
  name: string;
  configPath: string;
  workspaceRoot: string;
  runsRoot: string;
  defaultProvider: string;
}

export interface ProjectDetail extends ProjectSummary {
  orchestratorRoot: string;
  stagesRoot: string;
  promptsRoot: string;
  providers: string[];
}

export interface ProjectHealth {
  projectId: string;
  healthy: boolean;
  checks: {
    configPathExists: boolean;
    workspaceRootExists: boolean;
    runsRootExists: boolean;
    stagesRootExists: boolean;
    promptsRootExists: boolean;
  };
  warnings: string[];
}
