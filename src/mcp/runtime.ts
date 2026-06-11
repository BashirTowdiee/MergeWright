import path from "node:path";
import { DefaultCliCommandGateway, type CliCommandGateway } from "../api/cli-command-gateway.js";
import { DeterministicStageExecutor } from "../application/audited-flow/deterministic-stage-executor.js";
import { StageExecutorRegistry } from "../application/audited-flow/executor-registry.js";
import { ShellCheckStageExecutor } from "../application/audited-flow/shell-check-stage-executor.js";
import type { StageExecutor } from "../application/audited-flow/stage-executor.js";
import { FilesystemRunReadRepository } from "../application/queries/filesystem-run-read-repository.js";
import { StaticPolicyQueryService, type PolicyQueryService } from "../application/queries/policy-query-service.js";
import { FileProjectCatalogQueryService, type ProjectContext, type ProjectQueryService } from "../application/queries/project-query-service.js";
import { StaticProviderQueryService, type ProviderQueryService } from "../application/queries/provider-query-service.js";
import { DefaultRunQueryService, type RunQueryService } from "../application/queries/run-query-service.js";
import { FileSettingsQueryService, type SettingsQueryService } from "../application/queries/settings-query-service.js";
import {
  DefaultExecuteAuditedFlowUseCase,
  type ExecuteAuditedFlowUseCase
} from "../application/use-cases/execute-audited-flow-use-case.js";
import { loadAndValidateConfig, resolveConfigPath } from "../config.js";
import type { OrchestratorConfig } from "../config/types.js";
import { resolveRunsRoot } from "../runs.js";

export interface MergeWrightMcpRuntimeOptions {
  orchestratorRoot: string;
}

export interface MergeWrightMcpScopedServices {
  projectId: string;
  context: ProjectContext;
  runQueryService: RunQueryService;
  providerQueryService: ProviderQueryService;
  policyQueryService: PolicyQueryService;
  cliCommandGateway: CliCommandGateway;
  executeAuditedFlowUseCase: ExecuteAuditedFlowUseCase;
}

export interface MergeWrightMcpAuditedFlowExecutionContext {
  runsRoot: string;
  executeAuditedFlowUseCase: ExecuteAuditedFlowUseCase;
}

export class MergeWrightMcpRuntime {
  readonly orchestratorRoot: string;

  private readonly settingsQueryService: SettingsQueryService;
  private readonly projectQueryService: ProjectQueryService;

  constructor(options: MergeWrightMcpRuntimeOptions) {
    this.orchestratorRoot = path.resolve(options.orchestratorRoot);
    this.settingsQueryService = new FileSettingsQueryService({
      settingsPath: path.resolve(this.orchestratorRoot, ".artifacts", "web-settings.json"),
      defaults: {
        version: 1,
        project: {
          activeProjectId: "default",
          defaultConfigPath: ".artifacts/projects/default/config.json",
          runsRoot: path.resolve(this.orchestratorRoot, ".artifacts", "runs", "default"),
          defaultProvider: "codex",
          defaultModel: "gpt-5.5",
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
    this.projectQueryService = new FileProjectCatalogQueryService({
      orchestratorRoot: this.orchestratorRoot,
      catalogPath: path.resolve(this.orchestratorRoot, ".artifacts", "projects.json")
    });
  }

  getSettings(): Promise<Awaited<ReturnType<SettingsQueryService["getSettings"]>>> {
    return this.settingsQueryService.getSettings();
  }

  listProjects(): Promise<Awaited<ReturnType<ProjectQueryService["listProjects"]>>> {
    return this.projectQueryService.listProjects();
  }

  getProject(projectId: string): Promise<Awaited<ReturnType<ProjectQueryService["getProject"]>>> {
    return this.projectQueryService.getProject(projectId);
  }

  async resolveDefaultProjectId(): Promise<string | null> {
    const settings = await this.getSettings();
    const activeProjectId = settings.project.activeProjectId?.trim();
    if (activeProjectId) {
      return activeProjectId;
    }

    const projects = await this.listProjects();
    return projects[0]?.id ?? null;
  }

  async resolveProjectId(projectId?: string): Promise<string> {
    const explicit = projectId?.trim();
    if (explicit) {
      return explicit;
    }

    const resolved = await this.resolveDefaultProjectId();
    if (!resolved) {
      throw new Error("No active or explicit project id is available for this MCP operation.");
    }
    return resolved;
  }

  async resolveProjectScopedServices(projectId?: string): Promise<MergeWrightMcpScopedServices> {
    const resolvedProjectId = await this.resolveProjectId(projectId);
    const context = await this.projectQueryService.resolveProjectContext(resolvedProjectId);
    if (!context) {
      throw new Error(`Project ${resolvedProjectId} is not configured.`);
    }

    const runRepository = new FilesystemRunReadRepository({ runsRoot: context.runsRoot });
    const runQueryService = new DefaultRunQueryService(runRepository);
    const providerQueryService = new StaticProviderQueryService({ config: context.config });
    const policyQueryService = new StaticPolicyQueryService({
      config: context.config,
      workspaceRoot: context.config.workspaceRoot
    });
    const cliCommandGateway = new DefaultCliCommandGateway({
      orchestratorRoot: this.orchestratorRoot,
      configPath: context.configPath,
      runsRoot: context.runsRoot,
      changeReportPolicy: context.config.changeReport
    });

    return {
      projectId: resolvedProjectId,
      context,
      runQueryService,
      providerQueryService,
      policyQueryService,
      cliCommandGateway,
      executeAuditedFlowUseCase: createAuditedFlowUseCase(this.orchestratorRoot, context.config)
    };
  }

  async resolveAuditedFlowExecutionContext(input: {
    projectId?: string;
    configPath?: string;
  }): Promise<MergeWrightMcpAuditedFlowExecutionContext> {
    if (input.projectId?.trim() && input.configPath?.trim()) {
      throw new Error("projectId and configPath cannot be combined for audited-flow execution.");
    }

    if (input.projectId?.trim()) {
      const scoped = await this.resolveProjectScopedServices(input.projectId);
      return {
        runsRoot: scoped.context.runsRoot,
        executeAuditedFlowUseCase: scoped.executeAuditedFlowUseCase
      };
    }

    if (input.configPath?.trim()) {
      const config = await loadAndValidateConfig(resolveConfigPath(this.orchestratorRoot, input.configPath));
      return {
        runsRoot: resolveRunsRoot(this.orchestratorRoot, config),
        executeAuditedFlowUseCase: createAuditedFlowUseCase(this.orchestratorRoot, config)
      };
    }

    return {
      runsRoot: path.resolve(this.orchestratorRoot, ".artifacts", "runs", "audited-flow"),
      executeAuditedFlowUseCase: createAuditedFlowUseCase(this.orchestratorRoot)
    };
  }

  async resolveAuditedFlowRunsRoot(input: {
    projectId?: string;
    configPath?: string;
    runsRoot?: string;
  }): Promise<string | undefined> {
    if (input.runsRoot?.trim()) {
      return path.resolve(input.runsRoot);
    }

    if (input.projectId?.trim() || input.configPath?.trim()) {
      return (await this.resolveAuditedFlowExecutionContext(input)).runsRoot;
    }

    return undefined;
  }
}

function createAuditedFlowUseCase(orchestratorRoot: string, config?: OrchestratorConfig): ExecuteAuditedFlowUseCase {
  const executors: StageExecutor[] = [new DeterministicStageExecutor()];
  if (config) {
    executors.push(
      new ShellCheckStageExecutor({
        orchestratorRoot,
        config
      })
    );
  }

  return new DefaultExecuteAuditedFlowUseCase({
    executorRegistry: new StageExecutorRegistry(executors)
  });
}
