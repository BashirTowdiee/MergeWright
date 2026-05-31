import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateConfig, type OrchestratorConfig } from "./config.js";

export interface InitProjectOptions {
  orchestratorRoot: string;
  projectName: string;
  workspaceArg: string;
  force: boolean;
  verbose: boolean;
  writeLine?: (line: string) => void;
}

export interface InitProjectResult {
  projectName: string;
  projectSlug: string;
  workspacePath: string;
  configPath: string;
  stagesPath: string;
  runsPath: string;
}

export function slugifyProjectName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }

  const slug = trimmed
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug;
}

export function validateProjectSlug(slug: string): void {
  if (!slug) {
    throw new Error("Project name is invalid: generated slug is empty.");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(`Invalid project slug: ${slug}. Slug must match ^[a-z0-9][a-z0-9-]*$`);
  }
}

export function buildProjectConfig(projectName: string, projectSlug: string, workspacePath: string): OrchestratorConfig {
  return validateConfig({
    version: 1,
    projectName,
    workspaceRoot: workspacePath,
    paths: {
      stagesDir: `stages/${projectSlug}`,
      promptsDir: "prompts",
      runsDir: `.artifacts/runs/${projectSlug}`
    },
    executionBackends: {
      codex: { type: "codex-cli" }
    },
    agents: {
      planner: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" },
      builder: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "medium" },
      reviewer: { backend: "codex", model: "gpt-5.3-codex", reasoningEffort: "high" }
    },
    pipeline: { finalReview: true, maxFixLoops: 1 },
    commands: { checks: [] },
    safety: {
      requireGitRepo: true,
      requireCleanStart: true,
      manualCommit: true,
      forbidAutoCommit: true,
      forbidAutoPush: true
    },
    writeSafety: {
      enabled: false,
      allowedBranches: ["feature/*", "bugfix/*", "chore/*"],
      blockedPaths: [".git/", ".env", ".env.*", "*.p12", "*.mobileprovision", "fastlane/", "DistributionKit/"],
      requireCleanWorkingTree: true,
      requireExplicitAllowWrites: true,
      captureDiffBeforeAfter: true,
      requireReviewAfterWrites: true,
      autoCommit: false,
      autoPush: false
    }
  });
}

export function buildExampleStage(projectName: string, projectSlug: string): string {
  return `# Example Stage\n\nThis is a starter stage instruction for ${projectName} (${projectSlug}).\n\nReplace this file with a real stage before running production orchestration.\n\nKeep stage scope small and concrete:\n- Define a clear goal and expected outcome.\n- List hard constraints and safety boundaries.\n- Identify files likely to change.\n- Specify validation expectations and success criteria.\n\nCodex execution remains read-only unless future stages explicitly change that policy.\n`;
}

export async function initProject(options: InitProjectOptions): Promise<InitProjectResult> {
  const projectName = options.projectName.trim();
  if (!projectName) {
    throw new Error("Missing required project name. Usage: agent-stage init-project <name> --workspace <path> [--force] [--verbose]");
  }

  const slug = slugifyProjectName(projectName);
  validateProjectSlug(slug);

  if (!options.workspaceArg) {
    throw new Error("Missing required --workspace <path> for init-project.");
  }

  const workspacePath = path.isAbsolute(options.workspaceArg)
    ? options.workspaceArg
    : path.resolve(options.orchestratorRoot, options.workspaceArg);

  let workspaceStat;
  try {
    workspaceStat = await stat(workspacePath);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Workspace path does not exist or is not accessible: ${workspacePath}. ${msg}`);
  }
  if (!workspaceStat.isDirectory()) {
    throw new Error(`Workspace path is not a directory: ${workspacePath}`);
  }

  const gitDir = path.resolve(workspacePath, ".git");
  try {
    await access(gitDir);
  } catch {
    throw new Error(`Workspace path does not look like a git repository: missing ${gitDir}`);
  }

  const configPath = resolveChildPath(options.orchestratorRoot, ".artifacts", "projects", slug, "config.json");
  const stagesPath = resolveChildPath(options.orchestratorRoot, "stages", slug);
  const stageFilePath = resolveChildPath(options.orchestratorRoot, "stages", slug, "example-stage.md");
  const runsPath = resolveChildPath(options.orchestratorRoot, ".artifacts", "runs", slug);
  const gitkeepPath = resolveChildPath(options.orchestratorRoot, ".artifacts", "runs", slug, ".gitkeep");

  if (!options.force) {
    await assertDoesNotExist(configPath, "config");
    await assertDoesNotExist(stageFilePath, "example stage");
  }

  const config = buildProjectConfig(projectName, slug, workspacePath);
  const stageContent = buildExampleStage(projectName, slug);

  await mkdir(path.dirname(configPath), { recursive: true });
  await mkdir(stagesPath, { recursive: true });
  await mkdir(runsPath, { recursive: true });

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await writeFile(stageFilePath, stageContent, "utf8");

  let keepExisting = false;
  try {
    await readFile(gitkeepPath, "utf8");
    keepExisting = true;
  } catch {
    keepExisting = false;
  }
  if (!keepExisting) {
    await writeFile(gitkeepPath, "", "utf8");
  }

  if (options.verbose && options.writeLine) {
    options.writeLine(`init-project: wrote ${configPath}`);
    options.writeLine(`init-project: wrote ${stageFilePath}`);
    options.writeLine(`init-project: ensured ${gitkeepPath}`);
  }

  return {
    projectName,
    projectSlug: slug,
    workspacePath,
    configPath,
    stagesPath,
    runsPath
  };
}

async function assertDoesNotExist(filePath: string, label: string): Promise<void> {
  try {
    await access(filePath);
    throw new Error(`${label} already exists at ${filePath}. Re-run with --force to overwrite generated files.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists at")) {
      throw error;
    }
  }
}

function resolveChildPath(root: string, ...parts: string[]): string {
  const resolved = path.resolve(root, ...parts);
  const relative = path.relative(root, resolved);
  if (relative === "" || relative === ".") {
    return resolved;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Resolved path escapes orchestrator root: ${resolved}`);
  }
  return resolved;
}
