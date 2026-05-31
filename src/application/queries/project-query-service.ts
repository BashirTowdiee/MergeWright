import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadAndValidateConfig } from "../../config.js";
import type { OrchestratorConfig } from "../../config/types.js";
import type { ProjectDetail, ProjectHealth, ProjectSummary } from "../read-models/project-read-model.js";

export interface ProjectCreateInput {
  name: string;
  configPath: string;
}

export interface ProjectUpdateInput {
  name?: string;
  configPath?: string;
}

export interface ProjectQueryService {
  listProjects(): Promise<ProjectSummary[]>;
  getProject(projectId: string): Promise<ProjectDetail | null>;
  getProjectHealth(projectId: string): Promise<ProjectHealth | null>;
  createProject(input: ProjectCreateInput): Promise<ProjectDetail>;
  updateProject(projectId: string, input: ProjectUpdateInput): Promise<ProjectDetail | null>;
  deleteProject(projectId: string): Promise<{ ok: true } | { ok: false; code: "PROJECT_NOT_EMPTY"; reason: string } | null>;
  resolveProjectContext(projectId: string): Promise<ProjectContext | null>;
}

export interface ProjectContext {
  project: ProjectDetail;
  config: OrchestratorConfig;
  configPath: string;
  runsRoot: string;
}

interface StoredProject {
  id: string;
  name: string;
  configPath: string;
}

interface StoredCatalog {
  version: 1;
  projects: StoredProject[];
}

export interface FileProjectCatalogQueryServiceOptions {
  orchestratorRoot: string;
  catalogPath: string;
  initialProject?: {
    id: string;
    name: string;
    configPath: string;
  };
}

export class FileProjectCatalogQueryService implements ProjectQueryService {
  private readonly orchestratorRoot: string;
  private readonly catalogPath: string;
  private readonly initialProject?: { id: string; name: string; configPath: string };

  constructor(options: FileProjectCatalogQueryServiceOptions) {
    this.orchestratorRoot = path.resolve(options.orchestratorRoot);
    this.catalogPath = path.resolve(options.catalogPath);
    this.initialProject = options.initialProject
      ? {
          id: sanitizeId(options.initialProject.id),
          name: options.initialProject.name.trim(),
          configPath: options.initialProject.configPath
        }
      : undefined;
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const entries = await this.readCatalog();
    const summaries = await Promise.all(entries.projects.map(async (project) => this.toProjectSummary(project)));
    return summaries.filter((summary): summary is ProjectSummary => summary !== null);
  }

  async getProject(projectId: string): Promise<ProjectDetail | null> {
    const context = await this.resolveProjectContext(projectId);
    return context?.project ?? null;
  }

  async getProjectHealth(projectId: string): Promise<ProjectHealth | null> {
    const detail = await this.getProject(projectId);
    if (!detail) {
      return null;
    }

    const checks = {
      configPathExists: await exists(detail.configPath),
      workspaceRootExists: await exists(detail.workspaceRoot),
      runsRootExists: await exists(detail.runsRoot),
      stagesRootExists: await exists(detail.stagesRoot),
      promptsRootExists: await exists(detail.promptsRoot)
    };

    const warnings: string[] = [];
    if (!checks.configPathExists) warnings.push("Config path is missing.");
    if (!checks.workspaceRootExists) warnings.push("Workspace root is missing.");
    if (!checks.runsRootExists) warnings.push("Runs root is missing.");
    if (!checks.stagesRootExists) warnings.push("Stages root is missing.");
    if (!checks.promptsRootExists) warnings.push("Prompts root is missing.");

    return {
      projectId: detail.id,
      healthy: warnings.length === 0,
      checks,
      warnings
    };
  }

  async createProject(input: ProjectCreateInput): Promise<ProjectDetail> {
    const name = input.name.trim();
    const configPath = this.resolveCatalogPath(input.configPath);
    if (!name) {
      throw new Error("Project name is required.");
    }

    const catalog = await this.readCatalog();
    const id = uniqueSlug(slugify(name), new Set(catalog.projects.map((project) => project.id)));
    const created: StoredProject = { id, name, configPath };
    catalog.projects.push(created);
    await this.writeCatalog(catalog);

    const context = await this.resolveProjectContext(id);
    if (!context) {
      throw new Error("Failed to resolve newly created project.");
    }
    return context.project;
  }

  async updateProject(projectId: string, input: ProjectUpdateInput): Promise<ProjectDetail | null> {
    const id = sanitizeId(projectId);
    if (!id) {
      return null;
    }

    const catalog = await this.readCatalog();
    const index = catalog.projects.findIndex((project) => project.id === id);
    if (index < 0) {
      return null;
    }

    const current = catalog.projects[index];
    const name = input.name?.trim();
    const next: StoredProject = {
      id: current.id,
      name: name && name.length > 0 ? name : current.name,
      configPath: input.configPath ? this.resolveCatalogPath(input.configPath) : current.configPath
    };

    catalog.projects[index] = next;
    await this.writeCatalog(catalog);

    const context = await this.resolveProjectContext(id);
    if (!context) {
      throw new Error("Failed to resolve updated project.");
    }
    return context.project;
  }

  async deleteProject(projectId: string): Promise<{ ok: true } | { ok: false; code: "PROJECT_NOT_EMPTY"; reason: string } | null> {
    const id = sanitizeId(projectId);
    if (!id) {
      return null;
    }

    const context = await this.resolveProjectContext(id);
    if (!context) {
      return null;
    }

    const [runCount, stagePlanCount] = await Promise.all([
      countDirectories(context.runsRoot),
      countStagePlanFiles(this.orchestratorRoot, context.config)
    ]);

    if (runCount > 0 || stagePlanCount > 0) {
      return {
        ok: false,
        code: "PROJECT_NOT_EMPTY",
        reason: `Project has data (runs=${runCount}, stagePlans=${stagePlanCount}).`
      };
    }

    const catalog = await this.readCatalog();
    catalog.projects = catalog.projects.filter((project) => project.id !== id);
    await this.writeCatalog(catalog);

    return { ok: true };
  }

  async resolveProjectContext(projectId: string): Promise<ProjectContext | null> {
    const id = sanitizeId(projectId);
    if (!id) {
      return null;
    }

    const catalog = await this.readCatalog();
    const entry = catalog.projects.find((project) => project.id === id);
    if (!entry) {
      return null;
    }

    const configPath = this.resolveCatalogPath(entry.configPath);
    const config = await loadAndValidateConfig(configPath);
    const runsRoot = path.resolve(this.orchestratorRoot, config.paths.runsDir);
    const project = toProjectDetail(this.orchestratorRoot, id, entry.name, configPath, runsRoot, config);

    return {
      project,
      config,
      configPath,
      runsRoot
    };
  }

  private async readCatalog(): Promise<StoredCatalog> {
    const defaults = this.initialProject
      ? [
          {
            id: sanitizeId(this.initialProject.id),
            name: this.initialProject.name,
            configPath: this.resolveCatalogPath(this.initialProject.configPath)
          }
        ]
      : [];

    try {
      const raw = await readFile(this.catalogPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoredCatalog>;
      if (parsed?.version === 1 && Array.isArray(parsed.projects)) {
        return {
          version: 1,
          projects: parsed.projects
            .map((project) => sanitizeStoredProject(project))
            .filter((project): project is StoredProject => project !== null)
        };
      }
    } catch {
      // fall through
    }

    const seed: StoredCatalog = {
      version: 1,
      projects: defaults
    };
    await this.writeCatalog(seed);
    return seed;
  }

  private async writeCatalog(catalog: StoredCatalog): Promise<void> {
    await mkdir(path.dirname(this.catalogPath), { recursive: true });
    await writeFile(this.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  }

  private resolveCatalogPath(candidate: string): string {
    const resolved = path.resolve(this.orchestratorRoot, candidate);
    const relative = path.relative(this.orchestratorRoot, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Project config path resolves outside orchestrator root: ${candidate}`);
    }
    return resolved;
  }

  private async toProjectSummary(project: StoredProject): Promise<ProjectSummary | null> {
    try {
      const context = await this.resolveProjectContext(project.id);
      if (!context) {
        return null;
      }
      const { project: detail } = context;
      return {
        id: detail.id,
        name: detail.name,
        configPath: detail.configPath,
        workspaceRoot: detail.workspaceRoot,
        runsRoot: detail.runsRoot,
        defaultProvider: detail.defaultProvider
      };
    } catch {
      return null;
    }
  }
}

function sanitizeStoredProject(input: unknown): StoredProject | null {
  if (!isRecord(input)) {
    return null;
  }

  const id = sanitizeId(input.id);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const configPath = typeof input.configPath === "string" ? input.configPath.trim() : "";
  if (!id || !name || !configPath) {
    return null;
  }

  return { id, name, configPath };
}

function toProjectDetail(
  orchestratorRoot: string,
  projectId: string,
  name: string,
  configPath: string,
  runsRoot: string,
  config: OrchestratorConfig
): ProjectDetail {
  const stagesRoot = path.resolve(orchestratorRoot, config.paths.stagesDir);
  const promptsRoot = path.resolve(orchestratorRoot, config.paths.promptsDir);
  const defaultProvider = config.agents.planner.backend;
  return {
    id: projectId,
    name,
    configPath,
    workspaceRoot: config.workspaceRoot,
    runsRoot,
    defaultProvider,
    orchestratorRoot,
    stagesRoot,
    promptsRoot,
    providers: Object.keys(config.executionBackends)
  };
}

function sanitizeId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let index = 2;
  while (taken.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function countDirectories(rootPath: string): Promise<number> {
  try {
    const entries = await readdir(rootPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

async function countStagePlanFiles(orchestratorRoot: string, config: OrchestratorConfig): Promise<number> {
  const candidateRoots = [".artifacts", config.paths.stagesDir, config.paths.runsDir];
  let count = 0;

  for (const root of candidateRoots) {
    const absoluteRoot = path.resolve(orchestratorRoot, root);
    const relativeRoot = path.relative(orchestratorRoot, absoluteRoot);
    if (relativeRoot.startsWith("..") || path.isAbsolute(relativeRoot)) {
      continue;
    }

    count += await walkStagePlanFiles(absoluteRoot, 0);
  }

  return count;
}

async function walkStagePlanFiles(current: string, depth: number): Promise<number> {
  if (depth > 10) {
    return 0;
  }

  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return 0;
  }

  let total = 0;
  for (const entry of entries) {
    const child = path.join(current, entry.name);
    if (entry.isDirectory()) {
      total += await walkStagePlanFiles(child, depth + 1);
      continue;
    }
    if (entry.isFile() && entry.name === "stage-plan.json") {
      total += 1;
    }
  }

  return total;
}
