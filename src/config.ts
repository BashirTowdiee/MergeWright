import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { assertBoolean, assertNumber, assertObject, assertString, assertStringArray } from "./validation.js";
import { validateConfiguredCheckCommand } from "./commands.js";

export interface CodexRoleConfig {
  model: string;
  reasoningEffort: string;
}

export interface OrchestratorConfig {
  version: number;
  projectName: string;
  workspaceRoot: string;
  paths: {
    stagesDir: string;
    promptsDir: string;
    runsDir: string;
  };
  codex: {
    planner: CodexRoleConfig;
    builder: CodexRoleConfig;
    reviewer: CodexRoleConfig;
  };
  pipeline: {
    finalReview: boolean;
    maxFixLoops: number;
  };
  commands: {
    checks: ConfiguredCheckCommand[];
  };
  safety: {
    requireGitRepo: boolean;
    requireCleanStart: boolean;
    manualCommit: true;
    forbidAutoCommit: true;
    forbidAutoPush: true;
  };
  writeSafety: {
    enabled: boolean;
    allowedBranches: string[];
    blockedPaths: string[];
    requireCleanWorkingTree: boolean;
    requireExplicitAllowWrites: boolean;
    captureDiffBeforeAfter: boolean;
    requireReviewAfterWrites: boolean;
    autoCommit: false;
    autoPush: false;
  };
}

export type ConfiguredCheckCommandCwd = "workspace" | "orchestrator";

export interface ConfiguredCheckCommand {
  name: string;
  command: string;
  args: string[];
  cwd: ConfiguredCheckCommandCwd;
}

export async function loadAndValidateConfig(configPath: string): Promise<OrchestratorConfig> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Config file not found or unreadable at ${configPath}. No fallback is used. ${msg}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid config JSON at ${configPath}: ${msg}`);
  }

  return validateConfig(json);
}

export function resolveConfigPath(orchestratorRoot: string, configArg: string): string {
  if (!configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  return path.isAbsolute(configArg) ? configArg : path.resolve(orchestratorRoot, configArg);
}

export async function validateWorkspaceSafety(workspaceRoot: string, requireGitRepo: boolean): Promise<void> {
  try {
    await access(workspaceRoot);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Target workspaceRoot does not exist or is not accessible: ${workspaceRoot}. ${msg}`);
  }

  if (requireGitRepo) {
    const gitDir = path.resolve(workspaceRoot, ".git");
    try {
      await access(gitDir);
    } catch {
      throw new Error(`Target workspaceRoot is not a git repository: missing ${gitDir}`);
    }
  }
}

export function validateConfig(input: unknown): OrchestratorConfig {
  const root = assertObject(input, "root");

  const paths = assertObject(root.paths, "paths");
  const codex = assertObject(root.codex, "codex");
  const planner = assertObject(codex.planner, "codex.planner");
  const builder = assertObject(codex.builder, "codex.builder");
  const reviewer = assertObject(codex.reviewer, "codex.reviewer");
  const pipeline = assertObject(root.pipeline, "pipeline");
  const commands = assertObject(root.commands, "commands");
  const safety = assertObject(root.safety, "safety");
  const writeSafety = root.writeSafety == null ? {} : assertObject(root.writeSafety, "writeSafety");

  const manualCommit = assertBoolean(safety.manualCommit, "safety.manualCommit");
  if (!manualCommit) {
    throw new Error("Invalid config: safety.manualCommit must be true for this workflow");
  }

  const forbidAutoCommit = assertBoolean(safety.forbidAutoCommit, "safety.forbidAutoCommit");
  if (!forbidAutoCommit) {
    throw new Error("Invalid config: safety.forbidAutoCommit must be true");
  }

  const forbidAutoPush = assertBoolean(safety.forbidAutoPush, "safety.forbidAutoPush");
  if (!forbidAutoPush) {
    throw new Error("Invalid config: safety.forbidAutoPush must be true");
  }

  const autoCommit = assertOptionalBooleanWithDefault(writeSafety.autoCommit, "writeSafety.autoCommit", false);
  if (autoCommit) {
    throw new Error("Invalid config: writeSafety.autoCommit must be false");
  }
  const autoPush = assertOptionalBooleanWithDefault(writeSafety.autoPush, "writeSafety.autoPush", false);
  if (autoPush) {
    throw new Error("Invalid config: writeSafety.autoPush must be false");
  }

  return {
    version: assertNumber(root.version, "version"),
    projectName: assertString(root.projectName, "projectName"),
    workspaceRoot: assertString(root.workspaceRoot, "workspaceRoot"),
    paths: {
      stagesDir: assertString(paths.stagesDir, "paths.stagesDir"),
      promptsDir: assertString(paths.promptsDir, "paths.promptsDir"),
      runsDir: assertString(paths.runsDir, "paths.runsDir")
    },
    codex: {
      planner: {
        model: assertString(planner.model, "codex.planner.model"),
        reasoningEffort: assertString(planner.reasoningEffort, "codex.planner.reasoningEffort")
      },
      builder: {
        model: assertString(builder.model, "codex.builder.model"),
        reasoningEffort: assertString(builder.reasoningEffort, "codex.builder.reasoningEffort")
      },
      reviewer: {
        model: assertString(reviewer.model, "codex.reviewer.model"),
        reasoningEffort: assertString(reviewer.reasoningEffort, "codex.reviewer.reasoningEffort")
      }
    },
    pipeline: {
      finalReview: assertBoolean(pipeline.finalReview, "pipeline.finalReview"),
      maxFixLoops: assertNumber(pipeline.maxFixLoops, "pipeline.maxFixLoops")
    },
    commands: {
      checks: assertConfiguredChecks(commands.checks, "commands.checks")
    },
    safety: {
      requireGitRepo: assertBoolean(safety.requireGitRepo, "safety.requireGitRepo"),
      requireCleanStart: assertBoolean(safety.requireCleanStart, "safety.requireCleanStart"),
      manualCommit: true,
      forbidAutoCommit: true,
      forbidAutoPush: true
    },
    writeSafety: {
      enabled: assertOptionalBooleanWithDefault(writeSafety.enabled, "writeSafety.enabled", false),
      allowedBranches: assertOptionalStringArrayWithDefault(
        writeSafety.allowedBranches,
        "writeSafety.allowedBranches",
        ["feature/*", "bugfix/*", "chore/*"]
      ),
      blockedPaths: assertOptionalStringArrayWithDefault(
        writeSafety.blockedPaths,
        "writeSafety.blockedPaths",
        [".git/", ".env", ".env.*", "*.p12", "*.mobileprovision", "fastlane/", "DistributionKit/"]
      ),
      requireCleanWorkingTree: assertOptionalBooleanWithDefault(
        writeSafety.requireCleanWorkingTree,
        "writeSafety.requireCleanWorkingTree",
        true
      ),
      requireExplicitAllowWrites: assertOptionalBooleanWithDefault(
        writeSafety.requireExplicitAllowWrites,
        "writeSafety.requireExplicitAllowWrites",
        true
      ),
      captureDiffBeforeAfter: assertOptionalBooleanWithDefault(
        writeSafety.captureDiffBeforeAfter,
        "writeSafety.captureDiffBeforeAfter",
        true
      ),
      requireReviewAfterWrites: assertOptionalBooleanWithDefault(
        writeSafety.requireReviewAfterWrites,
        "writeSafety.requireReviewAfterWrites",
        true
      ),
      autoCommit: false,
      autoPush: false
    }
  };
}

function assertOptionalBooleanWithDefault(value: unknown, field: string, defaultValue: boolean): boolean {
  if (value == null) {
    return defaultValue;
  }
  return assertBoolean(value, field);
}

function assertOptionalStringArrayWithDefault(value: unknown, field: string, defaultValue: string[]): string[] {
  if (value == null) {
    return [...defaultValue];
  }
  const parsed = assertStringArray(value, field);
  for (let i = 0; i < parsed.length; i += 1) {
    if (!parsed[i].trim()) {
      throw new Error(`Invalid config: ${field}[${i}] must be a non-empty string`);
    }
  }
  return parsed;
}

function assertConfiguredChecks(value: unknown, field: string): ConfiguredCheckCommand[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid config: ${field} must be an array`);
  }

  return value.map((entry, index) => {
    const check = assertObject(entry, `${field}[${index}]`);
    const name = assertString(check.name, `${field}[${index}].name`);
    const command = assertString(check.command, `${field}[${index}].command`);
    if (command.includes(" ")) {
      throw new Error(`Invalid config: ${field}[${index}].command must be an executable name only`);
    }
    const args = assertStringArray(check.args, `${field}[${index}].args`);
    const cwdRaw = check.cwd;
    if (cwdRaw !== "workspace" && cwdRaw !== "orchestrator") {
      throw new Error(`Invalid config: ${field}[${index}].cwd must be "workspace" or "orchestrator"`);
    }
    validateConfiguredCheckCommand({ name, command, args, cwd: cwdRaw });
    return {
      name,
      command,
      args,
      cwd: cwdRaw
    };
  });
}
