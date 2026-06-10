import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type {
  CliCommandExecutionResult,
  CliCommandPreviewResult,
  CliGatewayRequest
} from "../api/cli-command-gateway.js";
import { cliGatewayRequestSchema } from "../api/cli-command-gateway.js";
import {
  buildDefaultAuditedFlowContract,
  DEFAULT_AUDITED_FLOW_EXECUTOR,
  type DefaultAuditedFlowStageInput
} from "../application/audited-flow/default-run-contract.js";
import type { AuditedFlowAuditEvent } from "../application/audited-flow/audit-events.js";
import type { AuditedFlowStageKind, RunContract } from "../application/audited-flow/contract.js";
import type { StageResult } from "../application/audited-flow/stage-executor.js";
import {
  DefaultAuditedFlowRunFilesQueryService,
  type AuditedFlowRunFilesQueryService
} from "../application/queries/audited-flow-run-files.js";
import type { PolicySnapshot, WriteSafetyStatusSnapshot } from "../application/read-models/policy-read-model.js";
import type { ProjectDetail, ProjectSummary } from "../application/read-models/project-read-model.js";
import type { ProviderInventory } from "../application/read-models/provider-read-model.js";
import type { RunDetail, RunStatus, RunSummary } from "../application/read-models/run-read-model.js";
import type { SettingsSnapshot } from "../application/read-models/settings-read-model.js";
import {
  type AuditedFlowResult
} from "../application/use-cases/execute-audited-flow-use-case.js";
import { MergeWrightMcpRuntime } from "./runtime.js";

const AUDITED_FLOW_STAGE_KIND_SCHEMA = z.enum([
  "plan",
  "build",
  "check",
  "review",
  "fix",
  "final-review",
  "approval",
  "report",
  "github"
]);

const RUN_STATUS_SCHEMA = z.enum(["pending", "running", "passed", "failed", "blocked", "cancelled", "unknown", "all"]);

const stageInputSchema = z.object({
  id: z.string().min(1).describe("Unique stage identifier within the flow."),
  kind: AUDITED_FLOW_STAGE_KIND_SCHEMA.describe("Audited flow stage kind."),
  executor: z
    .string()
    .min(1)
    .optional()
    .describe("Optional executor id. Supported values are deterministic-dry-run and shell-check."),
  model: z.string().min(1).optional().describe("Optional model label recorded in the run contract."),
  required: z.boolean().optional().describe("Whether the stage is required. Defaults to true."),
  onlyIf: z.array(z.string().min(1)).optional().describe("Optional stage gate conditions such as stage:plan:passed.")
});

const stageResultSchema = z.object({
  stageId: z.string(),
  kind: AUDITED_FLOW_STAGE_KIND_SCHEMA,
  executor: z.string(),
  status: z.enum(["passed", "failed", "skipped", "needs-approval"]),
  summary: z.string(),
  artefacts: z.array(z.object({ kind: z.string(), path: z.string() })).optional(),
  changedFiles: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const contractStageSchema = z.object({
  id: z.string(),
  kind: AUDITED_FLOW_STAGE_KIND_SCHEMA,
  executor: z.string(),
  model: z.string().optional(),
  required: z.boolean().optional(),
  onlyIf: z.array(z.string()).optional()
});

const contractSchema = z.object({
  id: z.string().optional(),
  goal: z.string(),
  workspace: z.string(),
  flow: z.string(),
  stages: z.array(contractStageSchema),
  requiredChecks: z.array(z.string()).optional(),
  requiredEvidence: z.array(z.string()).optional(),
  allowedPaths: z.array(z.string()).optional(),
  forbiddenPaths: z.array(z.string()).optional(),
  stopBeforePr: z.boolean().optional(),
  audit: z.object({ mode: z.enum(["required", "best-effort"]) }).optional()
});

const auditEventSchema = z.object({
  type: z.enum([
    "run.created",
    "flow.selected",
    "stage.started",
    "prompt.generated",
    "executor.invoked",
    "executor.completed",
    "command.started",
    "command.completed",
    "files.changed",
    "stage.completed",
    "run.completed",
    "run.failed"
  ]),
  runId: z.string(),
  occurredAt: z.string(),
  stageId: z.string().optional(),
  executorId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

const optionalRootInputSchema = {
  orchestratorRoot: z.string().min(1).optional().describe("Optional MergeWright root. Defaults to the current working directory.")
} as const;

const optionalProjectScopeInputSchema = {
  projectId: z.string().min(1).optional().describe("Optional project id. Defaults to the active project from settings."),
  ...optionalRootInputSchema
} as const;

export interface ExecuteAuditedFlowToolInput {
  goal: string;
  workspace: string;
  flow?: string;
  dryRun?: boolean;
  auditMode?: "required" | "best-effort";
  requiredChecks?: string[];
  stages?: DefaultAuditedFlowStageInput[];
  projectId?: string;
  configPath?: string;
  orchestratorRoot?: string;
  runsRoot?: string;
}

export interface AuditedFlowRunLocatorInput {
  runId: string;
  projectId?: string;
  configPath?: string;
  orchestratorRoot?: string;
  runsRoot?: string;
}

export interface GetAuditedFlowEventsToolInput extends AuditedFlowRunLocatorInput {
  limit?: number;
}

export interface ExecuteAuditedFlowToolOutput extends AuditedFlowResult {
  contract: RunContract;
}

export interface GetAuditedFlowRunToolOutput {
  runId: string;
  artefactsDir: string;
  resultPath: string;
  contractPath: string;
  auditPath: string;
  result: AuditedFlowResult;
  contract: RunContract;
}

export interface GetAuditedFlowEventsToolOutput {
  runId: string;
  auditPath: string;
  events: AuditedFlowAuditEvent[];
}

export interface ExportAuditedFlowAuditToolOutput extends GetAuditedFlowRunToolOutput {
  events: AuditedFlowAuditEvent[];
}

export interface ListProjectsToolOutput {
  orchestratorRoot: string;
  projects: ProjectSummary[];
}

export interface GetSettingsToolOutput {
  orchestratorRoot: string;
  settings: SettingsSnapshot;
}

export interface GetProjectToolOutput {
  orchestratorRoot: string;
  project: ProjectDetail;
}

export interface ListRunsToolInput {
  projectId?: string;
  orchestratorRoot?: string;
  status?: RunStatus | "all";
}

export interface ListRunsToolOutput {
  projectId: string;
  runs: RunSummary[];
}

export interface GetRunDetailToolInput {
  runId: string;
  projectId?: string;
  orchestratorRoot?: string;
}

export interface GetRunDetailToolOutput {
  projectId: string;
  run: RunDetail;
}

export interface ProjectScopedToolInput {
  projectId?: string;
  orchestratorRoot?: string;
}

export interface GetProviderInventoryToolOutput {
  projectId: string;
  providerInventory: ProviderInventory;
}

export interface GetPolicySnapshotToolOutput {
  projectId: string;
  policy: PolicySnapshot;
}

export interface GetWriteSafetyStatusToolOutput {
  projectId: string;
  writeSafetyStatus: WriteSafetyStatusSnapshot;
}

export interface CliGatewayToolInput {
  request: CliGatewayRequest;
  projectId?: string;
  orchestratorRoot?: string;
}

export interface PreviewCliCommandToolOutput {
  projectId: string;
  preview: CliCommandPreviewResult;
}

export interface ExecuteCliCommandToolOutput {
  projectId: string;
  result: CliCommandExecutionResult;
}

export interface MergeWrightMcpTools {
  executeAuditedFlow(input: ExecuteAuditedFlowToolInput): Promise<ExecuteAuditedFlowToolOutput>;
  getAuditedFlowRun(input: AuditedFlowRunLocatorInput): Promise<GetAuditedFlowRunToolOutput>;
  getAuditedFlowEvents(input: GetAuditedFlowEventsToolInput): Promise<GetAuditedFlowEventsToolOutput>;
  exportAuditedFlowAudit(input: AuditedFlowRunLocatorInput): Promise<ExportAuditedFlowAuditToolOutput>;
  listProjects(input?: { orchestratorRoot?: string }): Promise<ListProjectsToolOutput>;
  getSettings(input?: { orchestratorRoot?: string }): Promise<GetSettingsToolOutput>;
  getProject(input: { projectId: string; orchestratorRoot?: string }): Promise<GetProjectToolOutput>;
  listRuns(input: ListRunsToolInput): Promise<ListRunsToolOutput>;
  getRunDetail(input: GetRunDetailToolInput): Promise<GetRunDetailToolOutput>;
  getProviderInventory(input: ProjectScopedToolInput): Promise<GetProviderInventoryToolOutput>;
  getPolicySnapshot(input: ProjectScopedToolInput): Promise<GetPolicySnapshotToolOutput>;
  getWriteSafetyStatus(input: ProjectScopedToolInput): Promise<GetWriteSafetyStatusToolOutput>;
  previewCliCommand(input: CliGatewayToolInput): Promise<PreviewCliCommandToolOutput>;
  executeCliCommand(input: CliGatewayToolInput): Promise<ExecuteCliCommandToolOutput>;
}

export interface MergeWrightMcpServerOptions {
  cwd?: () => string;
  auditedFlowRunFilesQueryService?: AuditedFlowRunFilesQueryService;
  serverInfo?: {
    name: string;
    version: string;
  };
}

const EXECUTE_AUDITED_FLOW_OUTPUT_SCHEMA = {
  runId: z.string(),
  status: z.enum(["passed", "failed", "needs-approval"]),
  stageResults: z.array(stageResultSchema),
  auditPath: z.string(),
  artefactsDir: z.string(),
  dryRun: z.boolean(),
  contract: contractSchema
} as const;

const GET_AUDITED_FLOW_RUN_OUTPUT_SCHEMA = {
  runId: z.string(),
  artefactsDir: z.string(),
  resultPath: z.string(),
  contractPath: z.string(),
  auditPath: z.string(),
  result: z.object({
    runId: z.string(),
    status: z.enum(["passed", "failed", "needs-approval"]),
    stageResults: z.array(stageResultSchema),
    auditPath: z.string(),
    artefactsDir: z.string(),
    dryRun: z.boolean()
  }),
  contract: contractSchema
} as const;

const GET_AUDITED_FLOW_EVENTS_OUTPUT_SCHEMA = {
  runId: z.string(),
  auditPath: z.string(),
  events: z.array(auditEventSchema)
} as const;

const EXPORT_AUDITED_FLOW_AUDIT_OUTPUT_SCHEMA = {
  runId: z.string(),
  artefactsDir: z.string(),
  resultPath: z.string(),
  contractPath: z.string(),
  auditPath: z.string(),
  result: z.object({
    runId: z.string(),
    status: z.enum(["passed", "failed", "needs-approval"]),
    stageResults: z.array(stageResultSchema),
    auditPath: z.string(),
    artefactsDir: z.string(),
    dryRun: z.boolean()
  }),
  contract: contractSchema,
  events: z.array(auditEventSchema)
} as const;

export function createMergeWrightMcpTools(options: MergeWrightMcpServerOptions = {}): MergeWrightMcpTools {
  const cwd = options.cwd ?? (() => process.cwd());
  const auditedFlowRunFilesQueryService =
    options.auditedFlowRunFilesQueryService ?? new DefaultAuditedFlowRunFilesQueryService();

  return {
    async executeAuditedFlow(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const executionContext = await runtime.resolveAuditedFlowExecutionContext({
        projectId: input.projectId,
        configPath: input.configPath
      });
      const stages = normalizeStages(input.stages);

      if (usesExecutor(stages, "shell-check") && !input.projectId?.trim() && !input.configPath?.trim()) {
        throw new Error("shell-check stages require either projectId or configPath so MCP can load the configured checks.");
      }

      const contract = buildDefaultAuditedFlowContract({
        goal: input.goal,
        workspace: path.resolve(orchestratorRoot, input.workspace),
        flow: input.flow,
        auditMode: input.auditMode,
        requiredChecks: input.requiredChecks,
        stages
      });

      const result = await executionContext.executeAuditedFlowUseCase.execute({
        contract,
        orchestratorRoot,
        runsRoot: input.runsRoot?.trim() ? path.resolve(input.runsRoot) : executionContext.runsRoot,
        dryRun: input.dryRun ?? true
      });

      return {
        ...result,
        contract
      };
    },

    async getAuditedFlowRun(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const run = await auditedFlowRunFilesQueryService.getRun({
        runId: input.runId,
        orchestratorRoot,
        runsRoot: await runtime.resolveAuditedFlowRunsRoot(input)
      });

      return {
        runId: run.runId,
        artefactsDir: run.artefactsDir,
        resultPath: run.resultPath,
        contractPath: run.contractPath,
        auditPath: run.auditPath,
        result: run.result,
        contract: run.contract
      };
    },

    async getAuditedFlowEvents(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      return auditedFlowRunFilesQueryService.getEvents({
        runId: input.runId,
        orchestratorRoot,
        runsRoot: await runtime.resolveAuditedFlowRunsRoot(input),
        limit: input.limit
      });
    },

    async exportAuditedFlowAudit(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const run = await auditedFlowRunFilesQueryService.getRun({
        runId: input.runId,
        orchestratorRoot,
        runsRoot: await runtime.resolveAuditedFlowRunsRoot(input)
      });

      return {
        runId: run.runId,
        artefactsDir: run.artefactsDir,
        resultPath: run.resultPath,
        contractPath: run.contractPath,
        auditPath: run.auditPath,
        result: run.result,
        contract: run.contract,
        events: run.events
      };
    },

    async listProjects(input = {}) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      return {
        orchestratorRoot,
        projects: await runtime.listProjects()
      };
    },

    async getSettings(input = {}) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      return {
        orchestratorRoot,
        settings: await runtime.getSettings()
      };
    },

    async getProject(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const project = await runtime.getProject(input.projectId);
      if (!project) {
        throw new Error(`Project ${input.projectId} is not configured.`);
      }

      return {
        orchestratorRoot,
        project
      };
    },

    async listRuns(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const scoped = await runtime.resolveProjectScopedServices(input.projectId);
      return {
        projectId: scoped.projectId,
        runs: await scoped.runQueryService.listRuns({
          status: input.status ?? "all"
        })
      };
    },

    async getRunDetail(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const scoped = await runtime.resolveProjectScopedServices(input.projectId);
      const run = await scoped.runQueryService.getRun({ runId: input.runId });
      if (!run) {
        throw new Error(`Run ${input.runId} was not found in project ${scoped.projectId}.`);
      }

      return {
        projectId: scoped.projectId,
        run
      };
    },

    async getProviderInventory(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const scoped = await runtime.resolveProjectScopedServices(input.projectId);
      return {
        projectId: scoped.projectId,
        providerInventory: await scoped.providerQueryService.getProviderInventory()
      };
    },

    async getPolicySnapshot(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const scoped = await runtime.resolveProjectScopedServices(input.projectId);
      return {
        projectId: scoped.projectId,
        policy: await scoped.policyQueryService.getPolicySnapshot()
      };
    },

    async getWriteSafetyStatus(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const scoped = await runtime.resolveProjectScopedServices(input.projectId);
      return {
        projectId: scoped.projectId,
        writeSafetyStatus: await scoped.policyQueryService.getWriteSafetyStatus()
      };
    },

    async previewCliCommand(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const scoped = await runtime.resolveProjectScopedServices(input.projectId);
      return {
        projectId: scoped.projectId,
        preview: await scoped.cliCommandGateway.preview(input.request)
      };
    },

    async executeCliCommand(input) {
      const orchestratorRoot = resolveOrchestratorRoot(input.orchestratorRoot, cwd);
      const runtime = new MergeWrightMcpRuntime({ orchestratorRoot });
      const scoped = await runtime.resolveProjectScopedServices(input.projectId);
      return {
        projectId: scoped.projectId,
        result: await scoped.cliCommandGateway.execute(input.request)
      };
    }
  };
}

export function createMergeWrightMcpServer(options: MergeWrightMcpServerOptions = {}): McpServer {
  const server = new McpServer(options.serverInfo ?? { name: "mergewright-mcp", version: "0.1.0" });
  const tools = createMergeWrightMcpTools(options);

  server.registerTool(
    "execute_audited_flow",
    {
      description:
        "Execute a MergeWright audited flow using deterministic stages by default, with optional shell-check stages when a project or config context is supplied.",
      inputSchema: {
        goal: z.string().min(1).describe("High-level delivery goal for the audited flow."),
        workspace: z.string().min(1).describe("Target workspace path. Relative paths resolve from orchestratorRoot."),
        flow: z.string().min(1).optional().describe("Optional flow name. Defaults to feature-standard."),
        dryRun: z.boolean().optional().describe("Whether to mark the run as dry-run. Defaults to true."),
        auditMode: z.enum(["required", "best-effort"]).optional().describe("Audit policy recorded in the contract."),
        requiredChecks: z.array(z.string().min(1)).optional().describe("Optional configured shell check names to require for check stages."),
        stages: z
          .array(stageInputSchema)
          .optional()
          .describe("Optional custom stage list. Executors default to deterministic-dry-run. shell-check is allowed only for check stages."),
        projectId: z.string().min(1).optional().describe("Optional project id used to resolve runs root and configured shell checks."),
        configPath: z.string().min(1).optional().describe("Optional config path used to resolve runs root and configured shell checks."),
        ...optionalRootInputSchema,
        runsRoot: z.string().min(1).optional().describe("Optional override for the audited flow runs root.")
      },
      outputSchema: EXECUTE_AUDITED_FLOW_OUTPUT_SCHEMA,
      annotations: {
        readOnlyHint: false
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.executeAuditedFlow(args)))
  );

  server.registerTool(
    "get_audited_flow_run",
    {
      description: "Load an existing MergeWright audited flow run by run id and return its contract, result, and artefact paths.",
      inputSchema: {
        runId: z.string().min(1).describe("Audited flow run id."),
        projectId: z.string().min(1).optional().describe("Optional project id used to resolve the project runs root."),
        configPath: z.string().min(1).optional().describe("Optional config path used to resolve the configured runs root."),
        ...optionalRootInputSchema,
        runsRoot: z.string().min(1).optional().describe("Optional override for the audited flow runs root.")
      },
      outputSchema: GET_AUDITED_FLOW_RUN_OUTPUT_SCHEMA,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.getAuditedFlowRun(args)))
  );

  server.registerTool(
    "get_audited_flow_events",
    {
      description: "Load audited flow audit events for a run in chronological order, optionally limited to the most recent N events.",
      inputSchema: {
        runId: z.string().min(1).describe("Audited flow run id."),
        limit: z.number().int().positive().optional().describe("Optional number of most recent events to return."),
        projectId: z.string().min(1).optional().describe("Optional project id used to resolve the project runs root."),
        configPath: z.string().min(1).optional().describe("Optional config path used to resolve the configured runs root."),
        ...optionalRootInputSchema,
        runsRoot: z.string().min(1).optional().describe("Optional override for the audited flow runs root.")
      },
      outputSchema: GET_AUDITED_FLOW_EVENTS_OUTPUT_SCHEMA,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.getAuditedFlowEvents(args)))
  );

  server.registerTool(
    "export_audited_flow_audit",
    {
      description: "Export the full audited flow audit bundle for a run, including result, contract, artefact paths, and parsed events.",
      inputSchema: {
        runId: z.string().min(1).describe("Audited flow run id."),
        projectId: z.string().min(1).optional().describe("Optional project id used to resolve the project runs root."),
        configPath: z.string().min(1).optional().describe("Optional config path used to resolve the configured runs root."),
        ...optionalRootInputSchema,
        runsRoot: z.string().min(1).optional().describe("Optional override for the audited flow runs root.")
      },
      outputSchema: EXPORT_AUDITED_FLOW_AUDIT_OUTPUT_SCHEMA,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.exportAuditedFlowAudit(args)))
  );

  server.registerTool(
    "list_projects",
    {
      description: "List MergeWright projects from the local project catalog.",
      inputSchema: optionalRootInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.listProjects(args))))
  ;

  server.registerTool(
    "get_settings",
    {
      description: "Return MergeWright settings, including the active project and default provider/model.",
      inputSchema: optionalRootInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.getSettings(args))))
  ;

  server.registerTool(
    "get_project",
    {
      description: "Return a single project detail from the MergeWright project catalog.",
      inputSchema: {
        projectId: z.string().min(1).describe("Project id."),
        ...optionalRootInputSchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.getProject(args))))
  ;

  server.registerTool(
    "list_runs",
    {
      description: "List classic or audited runs for a project using the existing run query service.",
      inputSchema: {
        status: RUN_STATUS_SCHEMA.optional().describe("Optional run status filter. Defaults to all."),
        ...optionalProjectScopeInputSchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.listRuns(args))))
  ;

  server.registerTool(
    "get_run_detail",
    {
      description: "Return the full run detail model for a project run id.",
      inputSchema: {
        runId: z.string().min(1).describe("Project run id."),
        ...optionalProjectScopeInputSchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.getRunDetail(args))))
  ;

  server.registerTool(
    "get_provider_inventory",
    {
      description: "Return configured execution providers and their role usage for a project.",
      inputSchema: optionalProjectScopeInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.getProviderInventory(args))))
  ;

  server.registerTool(
    "get_policy_snapshot",
    {
      description: "Return the configured write-safety and run policy snapshot for a project.",
      inputSchema: optionalProjectScopeInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.getPolicySnapshot(args))))
  ;

  server.registerTool(
    "get_write_safety_status",
    {
      description: "Run the project write-safety check and return the current status snapshot.",
      inputSchema: optionalProjectScopeInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.getWriteSafetyStatus(args))))
  ;

  server.registerTool(
    "preview_cli_command",
    {
      description: "Preview a typed CLI-equivalent MergeWright command through the shared CLI gateway without executing it.",
      inputSchema: {
        request: cliGatewayRequestSchema.describe("Typed CLI gateway request to preview."),
        ...optionalProjectScopeInputSchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.previewCliCommand(args))))
  ;

  server.registerTool(
    "execute_cli_command",
    {
      description: "Execute a typed CLI-equivalent MergeWright command through the shared CLI gateway.",
      inputSchema: {
        request: cliGatewayRequestSchema.describe("Typed CLI gateway request to execute."),
        ...optionalProjectScopeInputSchema
      },
      annotations: {
        readOnlyHint: false
      }
    },
    async (args) => toToolResult(asStructuredOutput(await tools.executeCliCommand(args))))
  ;

  return server;
}

export async function startMergeWrightMcpServer(options: MergeWrightMcpServerOptions = {}): Promise<McpServer> {
  const server = createMergeWrightMcpServer(options);
  await server.connect(new StdioServerTransport());
  return server;
}

function normalizeStages(stages?: DefaultAuditedFlowStageInput[]): DefaultAuditedFlowStageInput[] | undefined {
  if (!stages) {
    return undefined;
  }

  return stages.map((stage) => {
    const executor = stage.executor?.trim();
    if (executor && executor !== DEFAULT_AUDITED_FLOW_EXECUTOR && executor !== "shell-check") {
      throw new Error(`MCP audited flows currently support only ${DEFAULT_AUDITED_FLOW_EXECUTOR} and shell-check executors.`);
    }
    if (executor === "shell-check" && stage.kind !== "check") {
      throw new Error("shell-check is only supported for check stages.");
    }

    return {
      id: stage.id.trim(),
      kind: stage.kind as AuditedFlowStageKind,
      executor: executor ?? DEFAULT_AUDITED_FLOW_EXECUTOR,
      model: stage.model?.trim() || undefined,
      required: stage.required,
      onlyIf: stage.onlyIf?.map((condition) => condition.trim()).filter(Boolean)
    };
  });
}

function usesExecutor(stages: DefaultAuditedFlowStageInput[] | undefined, executorId: string): boolean {
  return (stages ?? []).some((stage) => stage.executor === executorId);
}

function resolveOrchestratorRoot(orchestratorRoot: string | undefined, cwd: () => string): string {
  return orchestratorRoot?.trim() ? path.resolve(orchestratorRoot) : path.resolve(cwd());
}

function toToolResult<T extends Record<string, unknown>>(value: T): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ],
    structuredContent: value
  };
}

function asStructuredOutput<T>(value: T): T & Record<string, unknown> {
  return value as T & Record<string, unknown>;
}
