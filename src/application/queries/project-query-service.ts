import { stat } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorConfig } from "../../config/types.js";
import type { ProjectDetail, ProjectHealth, ProjectSummary } from "../read-models/project-read-model.js";

export interface ProjectQueryService {
  listProjects(): Promise<ProjectSummary[]>;
  getProject(projectId: string): Promise<ProjectDetail | null>;
  getProjectHealth(projectId: string): Promise<ProjectHealth | null>;
}

export interface StaticProjectQueryServiceOptions {
  projectId?: string;
  orchestratorRoot: string;
  configPath: string;
  runsRoot: string;
  config: OrchestratorConfig;
}

export class StaticProjectQueryService implements ProjectQueryService {
  private readonly project: ProjectDetail;

  constructor(options: StaticProjectQueryServiceOptions) {
    const projectId = (options.projectId ?? "default").trim() || "default";
    const orchestratorRoot = path.resolve(options.orchestratorRoot);
    const configPath = path.resolve(options.configPath);
    const runsRoot = path.resolve(options.runsRoot);
    const stagesRoot = path.resolve(orchestratorRoot, options.config.paths.stagesDir);
    const promptsRoot = path.resolve(orchestratorRoot, options.config.paths.promptsDir);
    const defaultProvider = options.config.agents.planner.backend;
    this.project = {
      id: projectId,
      name: options.config.projectName,
      configPath,
      workspaceRoot: options.config.workspaceRoot,
      runsRoot,
      defaultProvider,
      orchestratorRoot,
      stagesRoot,
      promptsRoot,
      providers: Object.keys(options.config.executionBackends)
    };
  }

  async listProjects(): Promise<ProjectSummary[]> {
    return [toProjectSummary(this.project)];
  }

  async getProject(projectId: string): Promise<ProjectDetail | null> {
    if (!projectId.trim() || projectId !== this.project.id) {
      return null;
    }
    return this.project;
  }

  async getProjectHealth(projectId: string): Promise<ProjectHealth | null> {
    const project = await this.getProject(projectId);
    if (!project) {
      return null;
    }

    const checks = {
      configPathExists: await exists(project.configPath),
      workspaceRootExists: await exists(project.workspaceRoot),
      runsRootExists: await exists(project.runsRoot),
      stagesRootExists: await exists(project.stagesRoot),
      promptsRootExists: await exists(project.promptsRoot)
    };

    const warnings: string[] = [];
    if (!checks.configPathExists) warnings.push("Config path is missing.");
    if (!checks.workspaceRootExists) warnings.push("Workspace root is missing.");
    if (!checks.runsRootExists) warnings.push("Runs root is missing.");
    if (!checks.stagesRootExists) warnings.push("Stages root is missing.");
    if (!checks.promptsRootExists) warnings.push("Prompts root is missing.");

    return {
      projectId: project.id,
      healthy: warnings.length === 0,
      checks,
      warnings
    };
  }
}

function toProjectSummary(project: ProjectDetail): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    configPath: project.configPath,
    workspaceRoot: project.workspaceRoot,
    runsRoot: project.runsRoot,
    defaultProvider: project.defaultProvider
  };
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}
