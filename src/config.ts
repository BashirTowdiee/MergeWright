import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { assertBoolean, assertNumber, assertObject, assertString, assertStringArray } from "./validation.js";
import { validateConfiguredCheckCommand } from "./commands.js";
import {
  DEFAULT_CHANGE_REPORT_POLICY,
  type ChangeReportPolicy
} from "./change-report.js";
import type { ExecutionBackendType } from "./execution-backends/execution-backend-types.js";

export interface CodexRoleConfig {
  model: string;
  reasoningEffort: string;
}

export interface CodexCliBackendConfig {
  type: "codex-cli";
}

export interface OpenCodeCliBackendConfig {
  type: "opencode-cli";
  command?: string;
}

export type ExecutionBackendConfig = CodexCliBackendConfig | OpenCodeCliBackendConfig;

export type ExecutionBackendConfigMap = Record<string, ExecutionBackendConfig>;

export interface AgentRoleConfig {
  backend: string;
  model: string;
  reasoningEffort: string;
}

export interface AgentConfigMap {
  planner: AgentRoleConfig;
  builder: AgentRoleConfig;
  reviewer: AgentRoleConfig;
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
  executionBackends: ExecutionBackendConfigMap;
  agents: AgentConfigMap;
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
  changeReport?: ChangeReportPolicy;
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
  const codexRaw = root.codex == null ? undefined : assertObject(root.codex, "codex");
  const pipeline = assertObject(root.pipeline, "pipeline");
  const commands = assertObject(root.commands, "commands");
  const safety = assertObject(root.safety, "safety");
  const writeSafety = root.writeSafety == null ? {} : assertObject(root.writeSafety, "writeSafety");
  const changeReport = root.changeReport == null ? {} : assertObject(root.changeReport, "changeReport");

  const executionBackends = parseExecutionBackends(root.executionBackends, codexRaw);
  const agents = parseAgents(root.agents, codexRaw, executionBackends);
  const codex = codexRaw == null ? codexFromAgents(agents) : parseCodexConfig(codexRaw);

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
    codex,
    executionBackends,
    agents,
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
    },
    changeReport: parseChangeReportPolicy(changeReport)
  };
}

function parseCodexConfig(raw: Record<string, unknown>): OrchestratorConfig["codex"] {
  const planner = assertObject(raw.planner, "codex.planner");
  const builder = assertObject(raw.builder, "codex.builder");
  const reviewer = assertObject(raw.reviewer, "codex.reviewer");

  return {
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
  };
}

function parseExecutionBackends(value: unknown, codexRaw: Record<string, unknown> | undefined): ExecutionBackendConfigMap {
  if (value == null) {
    if (codexRaw == null) {
      throw new Error("Invalid config: executionBackends is required when codex is not provided");
    }
    return {
      codex: {
        type: "codex-cli"
      }
    };
  }

  const raw = assertObject(value, "executionBackends");
  const entries = Object.entries(raw);
  if (entries.length === 0) {
    throw new Error("Invalid config: executionBackends must contain at least one backend");
  }

  const parsed: ExecutionBackendConfigMap = {};
  for (const [name, definition] of entries) {
    if (!name.trim()) {
      throw new Error("Invalid config: executionBackends backend name must be non-empty");
    }
    const backend = assertObject(definition, `executionBackends.${name}`);
    const type = assertExecutionBackendType(backend.type, `executionBackends.${name}.type`);
    parsed[name] = parseExecutionBackendDefinition(type, backend, `executionBackends.${name}`);
  }
  return parsed;
}

function parseAgents(
  value: unknown,
  codexRaw: Record<string, unknown> | undefined,
  executionBackends: ExecutionBackendConfigMap
): AgentConfigMap {
  if (value == null) {
    if (codexRaw == null) {
      throw new Error("Invalid config: agents is required when codex is not provided");
    }
    const codex = parseCodexConfig(codexRaw);
    return {
      planner: { backend: "codex", ...codex.planner },
      builder: { backend: "codex", ...codex.builder },
      reviewer: { backend: "codex", ...codex.reviewer }
    };
  }

  const raw = assertObject(value, "agents");
  return {
    planner: parseAgentRole(raw.planner, "agents.planner", executionBackends),
    builder: parseAgentRole(raw.builder, "agents.builder", executionBackends),
    reviewer: parseAgentRole(raw.reviewer, "agents.reviewer", executionBackends)
  };
}

function parseAgentRole(value: unknown, field: string, executionBackends: ExecutionBackendConfigMap): AgentRoleConfig {
  const raw = assertObject(value, field);
  const backend = assertString(raw.backend, `${field}.backend`);
  if (!executionBackends[backend]) {
    const configured = Object.keys(executionBackends).sort().join(", ") || "none";
    throw new Error(`Invalid config: ${field}.backend references unknown execution backend "${backend}". Configured execution backends: ${configured}`);
  }
  return {
    backend,
    model: assertString(raw.model, `${field}.model`),
    reasoningEffort: assertString(raw.reasoningEffort, `${field}.reasoningEffort`)
  };
}

function codexFromAgents(agents: AgentConfigMap): OrchestratorConfig["codex"] {
  return {
    planner: {
      model: agents.planner.model,
      reasoningEffort: agents.planner.reasoningEffort
    },
    builder: {
      model: agents.builder.model,
      reasoningEffort: agents.builder.reasoningEffort
    },
    reviewer: {
      model: agents.reviewer.model,
      reasoningEffort: agents.reviewer.reasoningEffort
    }
  };
}

function assertExecutionBackendType(value: unknown, field: string): ExecutionBackendType {
  const type = assertString(value, field);
  if (type !== "codex-cli" && type !== "opencode-cli") {
    throw new Error(`Invalid config: ${field} must be "codex-cli" or "opencode-cli"`);
  }
  return type;
}

function parseExecutionBackendDefinition(
  type: ExecutionBackendType,
  raw: Record<string, unknown>,
  field: string
): ExecutionBackendConfig {
  switch (type) {
    case "codex-cli":
      return { type };
    case "opencode-cli": {
      if (raw.command == null) {
        return { type };
      }
      const command = assertString(raw.command, `${field}.command`);
      if (!command.trim()) {
        throw new Error(`Invalid config: ${field}.command must be a non-empty executable name`);
      }
      if (command.includes(" ")) {
        throw new Error(`Invalid config: ${field}.command must be an executable name only`);
      }
      return { type, command };
    }
  }
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

function parseChangeReportPolicy(raw: Record<string, unknown>): ChangeReportPolicy {
  const riskRules = raw.riskRules == null ? {} : assertObject(raw.riskRules, "changeReport.riskRules");
  const scopeDrift = raw.scopeDrift == null ? {} : assertObject(raw.scopeDrift, "changeReport.scopeDrift");
  const readiness = raw.readiness == null ? {} : assertObject(raw.readiness, "changeReport.readiness");
  const penalties = readiness.penalties == null ? {} : assertObject(readiness.penalties, "changeReport.readiness.penalties");

  const readyMinimumScore = assertOptionalNumberWithDefault(
    readiness.readyMinimumScore,
    "changeReport.readiness.readyMinimumScore",
    DEFAULT_CHANGE_REPORT_POLICY.readiness.readyMinimumScore
  );
  const needsReviewMinimumScore = assertOptionalNumberWithDefault(
    readiness.needsReviewMinimumScore,
    "changeReport.readiness.needsReviewMinimumScore",
    DEFAULT_CHANGE_REPORT_POLICY.readiness.needsReviewMinimumScore
  );
  assertScoreRange(readyMinimumScore, "changeReport.readiness.readyMinimumScore");
  assertScoreRange(needsReviewMinimumScore, "changeReport.readiness.needsReviewMinimumScore");
  if (readyMinimumScore < needsReviewMinimumScore) {
    throw new Error(
      "Invalid config: changeReport.readiness.readyMinimumScore must be greater than or equal to changeReport.readiness.needsReviewMinimumScore"
    );
  }

  return {
    riskRules: {
      highRiskPaths: assertOptionalStringArrayWithDefault(
        riskRules.highRiskPaths,
        "changeReport.riskRules.highRiskPaths",
        DEFAULT_CHANGE_REPORT_POLICY.riskRules.highRiskPaths
      ),
      mediumRiskPaths: assertOptionalStringArrayWithDefault(
        riskRules.mediumRiskPaths,
        "changeReport.riskRules.mediumRiskPaths",
        DEFAULT_CHANGE_REPORT_POLICY.riskRules.mediumRiskPaths
      ),
      lowRiskPaths: assertOptionalStringArrayWithDefault(
        riskRules.lowRiskPaths,
        "changeReport.riskRules.lowRiskPaths",
        DEFAULT_CHANGE_REPORT_POLICY.riskRules.lowRiskPaths
      )
    },
    scopeDrift: {
      enabled: assertOptionalBooleanWithDefault(
        scopeDrift.enabled,
        "changeReport.scopeDrift.enabled",
        DEFAULT_CHANGE_REPORT_POLICY.scopeDrift.enabled
      ),
      allowUnlistedTestFiles: assertOptionalBooleanWithDefault(
        scopeDrift.allowUnlistedTestFiles,
        "changeReport.scopeDrift.allowUnlistedTestFiles",
        DEFAULT_CHANGE_REPORT_POLICY.scopeDrift.allowUnlistedTestFiles
      ),
      allowUnlistedDocsFiles: assertOptionalBooleanWithDefault(
        scopeDrift.allowUnlistedDocsFiles,
        "changeReport.scopeDrift.allowUnlistedDocsFiles",
        DEFAULT_CHANGE_REPORT_POLICY.scopeDrift.allowUnlistedDocsFiles
      )
    },
    readiness: {
      readyMinimumScore,
      needsReviewMinimumScore,
      penalties: {
        failedRun: assertNonNegativePenalty(
          penalties.failedRun,
          "changeReport.readiness.penalties.failedRun",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.failedRun
        ),
        reviewerFail: assertNonNegativePenalty(
          penalties.reviewerFail,
          "changeReport.readiness.penalties.reviewerFail",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.reviewerFail
        ),
        checksFailed: assertNonNegativePenalty(
          penalties.checksFailed,
          "changeReport.readiness.penalties.checksFailed",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.checksFailed
        ),
        checksSkippedWithSourceChanges: assertNonNegativePenalty(
          penalties.checksSkippedWithSourceChanges,
          "changeReport.readiness.penalties.checksSkippedWithSourceChanges",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.checksSkippedWithSourceChanges
        ),
        postWriteReviewPendingOrFailed: assertNonNegativePenalty(
          penalties.postWriteReviewPendingOrFailed,
          "changeReport.readiness.penalties.postWriteReviewPendingOrFailed",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.postWriteReviewPendingOrFailed
        ),
        highRiskFiles: assertNonNegativePenalty(
          penalties.highRiskFiles,
          "changeReport.readiness.penalties.highRiskFiles",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.highRiskFiles
        ),
        mediumRiskFiles: assertNonNegativePenalty(
          penalties.mediumRiskFiles,
          "changeReport.readiness.penalties.mediumRiskFiles",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.mediumRiskFiles
        ),
        scopeDriftWarning: assertNonNegativePenalty(
          penalties.scopeDriftWarning,
          "changeReport.readiness.penalties.scopeDriftWarning",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.scopeDriftWarning
        ),
        nonBlockingReviewerIssue: assertNonNegativePenalty(
          penalties.nonBlockingReviewerIssue,
          "changeReport.readiness.penalties.nonBlockingReviewerIssue",
          DEFAULT_CHANGE_REPORT_POLICY.readiness.penalties.nonBlockingReviewerIssue
        )
      }
    }
  };
}

function assertOptionalNumberWithDefault(value: unknown, field: string, defaultValue: number): number {
  if (value == null) {
    return defaultValue;
  }
  return assertNumber(value, field);
}

function assertScoreRange(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Invalid config: ${field} must be a number between 0 and 100`);
  }
}

function assertNonNegativePenalty(value: unknown, field: string, defaultValue: number): number {
  const parsed = value == null ? defaultValue : assertNumber(value, field);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`Invalid config: ${field} must be a number between 0 and 100`);
  }
  return parsed;
}
