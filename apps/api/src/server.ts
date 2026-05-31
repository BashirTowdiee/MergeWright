#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { createApiServer } from "../../../src/api/create-api-server.js";
import { DefaultCliCommandGateway } from "../../../src/api/cli-command-gateway.js";
import type { ContinueRunCommand, ExecuteBuilderCommand, RetryPhaseCommand, StartRunCommand } from "../../../src/application/commands/app-command.js";
import type { AppCommandResult } from "../../../src/application/commands/app-command-result.js";
import { DefaultAppCommandService } from "../../../src/application/commands/default-app-command-service.js";
import { FilesystemCommandAuditStore } from "../../../src/application/commands/filesystem-command-audit-store.js";
import { DefaultArtifactQueryService } from "../../../src/application/queries/artifact-query-service.js";
import { FilesystemRunReadRepository } from "../../../src/application/queries/filesystem-run-read-repository.js";
import { StaticPolicyQueryService } from "../../../src/application/queries/policy-query-service.js";
import { FileProjectCatalogQueryService } from "../../../src/application/queries/project-query-service.js";
import { StaticProviderQueryService } from "../../../src/application/queries/provider-query-service.js";
import { DefaultReviewQueryService } from "../../../src/application/queries/review-query-service.js";
import { DefaultRunComparisonQueryService } from "../../../src/application/queries/run-comparison-query-service.js";
import { DefaultRunInsightsQueryService } from "../../../src/application/queries/run-insights-query-service.js";
import { DefaultRunQueryService } from "../../../src/application/queries/run-query-service.js";
import { FileSettingsQueryService } from "../../../src/application/queries/settings-query-service.js";
import { FilesystemStagePlanQueryService } from "../../../src/application/queries/stage-plan-query-service.js";
import { continueRun } from "../../../src/continue-run.js";
import { loadAndValidateConfig, resolveConfigPath } from "../../../src/config.js";
import { initProject as initProjectFiles } from "../../../src/init-project.js";
import { runStage } from "../../../src/runner.js";
import { resolveRunsRoot } from "../../../src/runs.js";

interface ApiServerRuntimeOptions {
  orchestratorRoot: string;
  configArg: string;
  host: string;
  port: number;
}

interface ContinueRunOverrides {
  readonly configPath?: string;
  readonly dryRun?: boolean;
  readonly allowWrites?: boolean;
  readonly streamCodex?: boolean;
  readonly verbose?: boolean;
  readonly executeBuilder?: boolean;
  readonly executeReviewer?: boolean;
  readonly planFix?: boolean;
  readonly executeFix?: boolean;
  readonly runChecks?: boolean;
  readonly planHtml?: boolean;
}

interface ExecuteBuilderOverrides {
  readonly configPath?: string;
  readonly dryRun?: boolean;
  readonly allowWrites?: boolean;
  readonly streamCodex?: boolean;
  readonly verbose?: boolean;
  readonly executeReviewer?: boolean;
  readonly runChecks?: boolean;
}

async function main(): Promise<void> {
  const options = parseRuntimeOptions(process.argv.slice(2), process.cwd());
  const hasBootstrapConfig = Boolean(options.configArg.trim());
  const bootstrapConfigPath = hasBootstrapConfig ? resolveConfigPath(options.orchestratorRoot, options.configArg) : undefined;
  const bootstrapConfig = bootstrapConfigPath ? await loadAndValidateConfig(bootstrapConfigPath) : undefined;
  const bootstrapRunsRoot = bootstrapConfig
    ? resolveRunsRoot(options.orchestratorRoot, bootstrapConfig)
    : path.resolve(options.orchestratorRoot, ".artifacts", "runs", "default");
  const settingsQueryService = new FileSettingsQueryService({
    settingsPath: path.resolve(options.orchestratorRoot, ".artifacts", "web-settings.json"),
    defaults: {
      version: 1,
      project: {
        activeProjectId: "default",
        defaultConfigPath: bootstrapConfigPath ?? ".artifacts/projects/default/config.json",
        runsRoot: bootstrapRunsRoot,
        defaultProvider: bootstrapConfig?.agents.planner.backend ?? "codex",
        defaultModel: bootstrapConfig?.agents.planner.model ?? "gpt-5.3-codex",
        defaultMode: "preview-first"
      },
      retention: {
        evidenceDays: 30,
        artifactDays: 30
      },
      ui: {
        theme: "system",
        keyboardShortcuts: true
      }
    }
  });

  const projectQueryService = new FileProjectCatalogQueryService({
    orchestratorRoot: options.orchestratorRoot,
    catalogPath: path.resolve(options.orchestratorRoot, ".artifacts", "projects.json"),
    initialProject:
      bootstrapConfigPath && bootstrapConfig
        ? {
            id: "default",
            name: bootstrapConfig.projectName,
            configPath: bootstrapConfigPath
          }
        : undefined
  });

  async function getActiveProjectId(): Promise<string | null> {
    const defaultSettings = await settingsQueryService.getSettings();
    return defaultSettings.project.activeProjectId?.trim() ? defaultSettings.project.activeProjectId : null;
  }

  async function buildScopedServices(projectId: string) {
    const context = await projectQueryService.resolveProjectContext(projectId);
    if (!context) {
      return null;
    }

    const runRepository = new FilesystemRunReadRepository({ runsRoot: context.runsRoot });
    const runQueryService = new DefaultRunQueryService(runRepository);
    const runInsightsQueryService = new DefaultRunInsightsQueryService({ runQueryService });
    const runComparisonQueryService = new DefaultRunComparisonQueryService({
      runQueryService,
      changeReportPolicy: context.config.changeReport
    });
    const reviewQueryService = new DefaultReviewQueryService({
      runQueryService,
      runsRoot: context.runsRoot
    });
    const artifactQueryService = new DefaultArtifactQueryService(runRepository);
    const providerQueryService = new StaticProviderQueryService({ config: context.config });
    const policyQueryService = new StaticPolicyQueryService({
      config: context.config,
      workspaceRoot: context.config.workspaceRoot
    });
    const stagePlanQueryService = new FilesystemStagePlanQueryService({
      orchestratorRoot: options.orchestratorRoot,
      candidateRoots: [".artifacts", context.config.paths.stagesDir, context.config.paths.runsDir]
    });
    const commandAuditStore = new FilesystemCommandAuditStore({
      auditDirectory: `${context.runsRoot}/command-audit`
    });
    const commandService = new DefaultAppCommandService({
      auditStore: commandAuditStore,
      startRunHandler: async (command) => executeStartRun(command, options.orchestratorRoot, context.configPath),
      continueRunHandler: async (command) => executeContinue(command, options.orchestratorRoot, context.configPath),
      retryPhaseHandler: async (command) => executeRetryPhase(command, options.orchestratorRoot, context.configPath),
      executeBuilderHandler: async (command) => executeBuilder(command, options.orchestratorRoot, context.configPath)
    });
    const cliCommandGateway = new DefaultCliCommandGateway({
      orchestratorRoot: options.orchestratorRoot,
      configPath: context.configPath,
      runsRoot: context.runsRoot,
      changeReportPolicy: context.config.changeReport
    });

    return {
      runQueryService,
      runInsightsQueryService,
      runComparisonQueryService,
      reviewQueryService,
      artifactQueryService,
      providerQueryService,
      policyQueryService,
      settingsQueryService,
      stagePlanQueryService,
      commandService,
      cliCommandGateway
    };
  }

  const defaultProjectId = await getActiveProjectId();
  const defaultScopedServices = defaultProjectId ? await buildScopedServices(defaultProjectId) : null;

  const server = createApiServer({
    projectQueryService,
    ...(defaultScopedServices ?? {}),
    resolveProjectScopedServices: async (projectId) => {
      const scoped = await buildScopedServices(projectId);
      return scoped;
    },
    resolveDefaultProjectId: getActiveProjectId,
    initProject: async (input) => {
      const result = await initProjectFiles({
        orchestratorRoot: options.orchestratorRoot,
        projectName: input.name,
        workspaceArg: input.workspacePath,
        force: input.force,
        verbose: false
      });
      return { configPath: result.configPath };
    }
  });

  await server.listen({ host: options.host, port: options.port });
  const address = server.server.address();
  const resolved = typeof address === "string" ? address : `${options.host}:${address?.port ?? options.port}`;
  console.log(`MergeWright API listening on ${resolved}`);
}

function parseRuntimeOptions(argv: string[], cwd: string): ApiServerRuntimeOptions {
  const options: ApiServerRuntimeOptions = {
    orchestratorRoot: cwd,
    configArg: "",
    host: "127.0.0.1",
    port: 3040
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (token === "--config") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--config requires a value.");
      }
      options.configArg = value;
      index += 1;
      continue;
    }

    if (token === "--host") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--host requires a value.");
      }
      options.host = value;
      index += 1;
      continue;
    }

    if (token === "--port") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--port requires a value.");
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error(`Invalid --port value: ${value}`);
      }
      options.port = parsed;
      index += 1;
      continue;
    }

    if (token === "--orchestrator-root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--orchestrator-root requires a value.");
      }
      options.orchestratorRoot = value;
      index += 1;
      continue;
    }

    if (token === "--help" || token === "-h") {
      throw new Error(renderHelpText());
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return options;
}

function renderHelpText(): string {
  return [
    "Usage: node dist/apps/api/src/server.js [--config <config-path>] [--host <host>] [--port <port>] [--orchestrator-root <path>]",
    "",
    "Options:",
    "  --config             Optional. MergeWright config file path used to seed default project on first run.",
    "  --host               API host (default: 127.0.0.1).",
    "  --port               API port (default: 3040).",
    "  --orchestrator-root  Base root used to resolve config and runs paths (default: cwd)."
  ].join("\n");
}

async function executeStartRun(command: StartRunCommand, orchestratorRoot: string, defaultConfigPath: string): Promise<AppCommandResult> {
  const runConfigPath = command.configPath?.trim() ? command.configPath : defaultConfigPath;

  try {
    const result = await runStage({
      stageName: command.stageName,
      configArg: runConfigPath,
      orchestratorRoot,
      dryRun: true,
      executePlanner: true,
      executeBuilder: false,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false,
      allowWrites: false,
      streamCodex: false,
      verbose: false,
      preset: command.preset
    });

    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: `Started run ${result.stageName}.`,
      runId: result.runDir.split("/").at(-1),
      artefacts: result.artefacts,
      warnings: result.dryRun ? ["Run executed in dry-run mode by API default."] : undefined
    };
  } catch (error) {
    return toExecutionFailure(command, error);
  }
}

async function executeContinue(command: ContinueRunCommand, orchestratorRoot: string, defaultConfigPath: string): Promise<AppCommandResult> {
  const overrides = command as ContinueRunCommand & ContinueRunOverrides;

  try {
    const result = await continueRun({
      runId: command.runId,
      configArg: overrides.configPath?.trim() ? overrides.configPath : defaultConfigPath,
      orchestratorRoot,
      dryRun: overrides.dryRun ?? true,
      allowWrites: overrides.allowWrites ?? false,
      streamCodex: overrides.streamCodex ?? false,
      verbose: overrides.verbose ?? false,
      executeBuilder: overrides.executeBuilder ?? false,
      executeReviewer: overrides.executeReviewer ?? true,
      planFix: overrides.planFix ?? false,
      executeFix: overrides.executeFix ?? false,
      runChecks: overrides.runChecks ?? true,
      planHtml: overrides.planHtml ?? false
    });

    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: `Continued run ${result.runId}.`,
      runId: result.runId,
      artefacts: result.artefacts,
      warnings: result.dryRun ? ["Continuation executed in dry-run mode by API default."] : undefined
    };
  } catch (error) {
    return toExecutionFailure(command, error);
  }
}

async function executeRetryPhase(command: RetryPhaseCommand, orchestratorRoot: string, defaultConfigPath: string): Promise<AppCommandResult> {
  try {
    const result = await continueRun({
      runId: command.runId,
      configArg: defaultConfigPath,
      orchestratorRoot,
      dryRun: true,
      allowWrites: false,
      streamCodex: false,
      verbose: false,
      executeBuilder: false,
      executeReviewer: true,
      planFix: false,
      executeFix: false,
      runChecks: false,
      planHtml: false
    });

    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: `Retried ${command.phase} for run ${result.runId}.`,
      runId: result.runId,
      artefacts: result.artefacts,
      warnings: ["Retry executed in dry-run mode by API default."]
    };
  } catch (error) {
    return toExecutionFailure(command, error);
  }
}

async function executeBuilder(command: ExecuteBuilderCommand, orchestratorRoot: string, defaultConfigPath: string): Promise<AppCommandResult> {
  const overrides = command as ExecuteBuilderCommand & ExecuteBuilderOverrides;

  try {
    const result = await continueRun({
      runId: command.runId,
      configArg: overrides.configPath?.trim() ? overrides.configPath : defaultConfigPath,
      orchestratorRoot,
      dryRun: overrides.dryRun ?? true,
      allowWrites: overrides.allowWrites ?? false,
      streamCodex: overrides.streamCodex ?? false,
      verbose: overrides.verbose ?? false,
      executeBuilder: true,
      executeReviewer: overrides.executeReviewer ?? true,
      planFix: false,
      executeFix: false,
      runChecks: overrides.runChecks ?? false,
      planHtml: false
    });

    return {
      ok: true,
      commandId: command.commandId,
      type: command.type,
      message: `Executed builder continuation for run ${result.runId}.`,
      runId: result.runId,
      artefacts: result.artefacts,
      warnings: result.dryRun ? ["Builder continuation executed in dry-run mode by API default."] : undefined
    };
  } catch (error) {
    return toExecutionFailure(command, error);
  }
}

function toExecutionFailure(command: { commandId: string; type: StartRunCommand["type"] | ContinueRunCommand["type"] | RetryPhaseCommand["type"] | ExecuteBuilderCommand["type"] }, error: unknown): AppCommandResult {
  return {
    ok: false,
    commandId: command.commandId,
    type: command.type,
    code: "EXECUTION_FAILED",
    reason: error instanceof Error ? error.message : String(error)
  };
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
