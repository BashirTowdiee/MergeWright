import { stat } from "node:fs/promises";
import path from "node:path";
import { continueRun } from "../continue-run.js";
import { generateChangeReport, writeChangeReport, writePrSummary } from "../change-report.js";
import { resolveRunDir } from "../runs.js";
import { runStage } from "../runner.js";
import { loadAndValidateConfig, resolveConfigPath } from "../config.js";
import { checkWriteSafety } from "../write-safety.js";
import { createGitInspectionClient } from "../git-inspection.js";
import {
  buildAndValidateOpenCodeReadOnlyCommand,
  probeOpenCodeCliContract,
  validateOpenCodeProbeCommand
} from "../execution-backends/opencode-cli-contract.js";
import { createCompareRunsReport } from "../reporting/compare-runs.js";
import { createProveResult } from "../reporting/prove-report.js";
import { createFocusedReviewModesResult, parseFocusedReviewModesArg } from "../reporting/review-modes.js";
import { resolvePipelinePreset } from "../presets.js";
import {
  acceptStageFromPlan,
  continueStagesFromPlan,
  fixStageFromPlan,
  runSingleStageFromPlan,
  runStagesFromPlan
} from "../stage-runner.js";
import { reassessStagePlan } from "../stage-reassessment.js";
import type { ChangeReportPolicy } from "../change-report.js";
import { z } from "zod";

const runCliCommandSchema = z.object({
  command: z.literal("run"),
  stageName: z.string().min(1),
  preset: z.string().optional(),
  dryRun: z.boolean().optional(),
  allowWrites: z.boolean().optional(),
  streamCodex: z.boolean().optional(),
  verbose: z.boolean().optional(),
  executePlanner: z.boolean().optional(),
  executeBuilder: z.boolean().optional(),
  executeReviewer: z.boolean().optional(),
  planFix: z.boolean().optional(),
  executeFix: z.boolean().optional(),
  runChecks: z.boolean().optional(),
  generateReport: z.boolean().optional()
});

const continueCliCommandSchema = z.object({
  command: z.literal("continue-run"),
  runId: z.string().min(1),
  dryRun: z.boolean().optional(),
  allowWrites: z.boolean().optional(),
  streamCodex: z.boolean().optional(),
  verbose: z.boolean().optional(),
  executeBuilder: z.boolean().optional(),
  executeReviewer: z.boolean().optional(),
  planFix: z.boolean().optional(),
  executeFix: z.boolean().optional(),
  runChecks: z.boolean().optional(),
  planHtml: z.boolean().optional()
});

const proveCliCommandSchema = z.object({
  command: z.literal("prove"),
  runId: z.string().min(1)
});

const checkWriteSafetyCliCommandSchema = z.object({
  command: z.literal("check-write-safety")
});

const probeOpenCodeCliCommandSchema = z.object({
  command: z.literal("probe-opencode"),
  backendName: z.string().min(1).optional(),
  opencodeCommand: z.string().min(1).optional(),
  validateReadonlyContract: z.boolean().optional()
});

const reportCliCommandSchema = z.object({
  command: z.literal("report-run"),
  runId: z.string().min(1),
  prSummary: z.boolean().optional()
});

const compareCliCommandSchema = z.object({
  command: z.literal("compare-runs"),
  runIdA: z.string().min(1),
  runIdB: z.string().min(1)
});

const reviewModesCliCommandSchema = z.object({
  command: z.literal("review-modes"),
  runId: z.string().min(1),
  modes: z.string().optional()
});

const fixStageCliCommandSchema = z.object({
  command: z.literal("fix-stage"),
  stageId: z.string().min(1),
  stagePlanArg: z.string().min(1),
  feedback: z.string().min(1),
  allowWrites: z.boolean().optional(),
  streamCodex: z.boolean().optional(),
  verbose: z.boolean().optional(),
  reassessDownstream: z.boolean().optional()
});

const runStageCliCommandSchema = z.object({
  command: z.literal("run-stage"),
  stageId: z.string().min(1),
  stagePlanArg: z.string().min(1),
  allowWrites: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  streamCodex: z.boolean().optional(),
  verbose: z.boolean().optional()
});

const runStagesCliCommandSchema = z.object({
  command: z.literal("run-stages"),
  stagePlanArg: z.string().min(1),
  stopAfterEachStage: z.boolean().optional(),
  allowWrites: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  streamCodex: z.boolean().optional(),
  verbose: z.boolean().optional()
});

const continueStagesCliCommandSchema = z.object({
  command: z.literal("continue-stages"),
  stagePlanArg: z.string().min(1),
  allowWrites: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  streamCodex: z.boolean().optional(),
  verbose: z.boolean().optional()
});

const acceptStageCliCommandSchema = z.object({
  command: z.literal("accept-stage"),
  stageId: z.string().min(1),
  stagePlanArg: z.string().min(1),
  autoCommit: z.boolean().optional(),
  commitMessage: z.string().optional()
});

const reassessStagePlanCliCommandSchema = z.object({
  command: z.literal("reassess-stage-plan"),
  stagePlanArg: z.string().min(1),
  sourceStageId: z.string().min(1),
  dryRun: z.boolean().optional()
});

export const cliGatewayRequestSchema = z.object({
  requestId: z.string().min(1).optional(),
  command: z.discriminatedUnion("command", [
    runCliCommandSchema,
    continueCliCommandSchema,
    proveCliCommandSchema,
    checkWriteSafetyCliCommandSchema,
    probeOpenCodeCliCommandSchema,
    reportCliCommandSchema,
    compareCliCommandSchema,
    reviewModesCliCommandSchema,
    fixStageCliCommandSchema,
    runStageCliCommandSchema,
    runStagesCliCommandSchema,
    continueStagesCliCommandSchema,
    acceptStageCliCommandSchema,
    reassessStagePlanCliCommandSchema
  ])
});

export type CliGatewayRequest = z.infer<typeof cliGatewayRequestSchema>;

type CliCommand = CliGatewayRequest["command"];

export interface CliCommandGatewayOptions {
  readonly orchestratorRoot: string;
  readonly configPath: string;
  readonly runsRoot: string;
  readonly changeReportPolicy?: ChangeReportPolicy;
}

export interface CliCommandExecutionResult {
  readonly requestId?: string;
  readonly command: CliCommand["command"];
  readonly ok: boolean;
  readonly exitCode: number;
  readonly summaryLines: readonly string[];
  readonly artifacts?: readonly string[];
  readonly data?: unknown;
  readonly error?: string;
}

export interface CliCommandPreviewResult {
  readonly requestId?: string;
  readonly command: CliCommand["command"];
  readonly equivalentCli: string;
  readonly risk: "low" | "medium" | "high";
  readonly requiresConfirmation: boolean;
  readonly summaryLines: readonly string[];
  readonly effects: {
    readonly mayWriteWorkspace: boolean;
    readonly mayWriteArtifacts: boolean;
    readonly mayChangeGit: boolean;
  };
}

export interface CliCommandGateway {
  execute(input: CliGatewayRequest): Promise<CliCommandExecutionResult>;
  preview(input: CliGatewayRequest): Promise<CliCommandPreviewResult>;
}

export class DefaultCliCommandGateway implements CliCommandGateway {
  private readonly orchestratorRoot: string;
  private readonly configPath: string;
  private readonly runsRoot: string;
  private readonly changeReportPolicy?: ChangeReportPolicy;

  constructor(options: CliCommandGatewayOptions) {
    this.orchestratorRoot = options.orchestratorRoot;
    this.configPath = options.configPath;
    this.runsRoot = options.runsRoot;
    this.changeReportPolicy = options.changeReportPolicy;
  }

  async execute(input: CliGatewayRequest): Promise<CliCommandExecutionResult> {
    try {
      switch (input.command.command) {
        case "run":
          return await this.executeRun(input.requestId, input.command);
        case "continue-run":
          return await this.executeContinueRun(input.requestId, input.command);
        case "prove":
          return await this.executeProve(input.requestId, input.command);
        case "check-write-safety":
          return await this.executeCheckWriteSafety(input.requestId);
        case "probe-opencode":
          return await this.executeProbeOpenCode(input.requestId, input.command);
        case "report-run":
          return await this.executeReportRun(input.requestId, input.command);
        case "compare-runs":
          return await this.executeCompareRuns(input.requestId, input.command);
        case "review-modes":
          return await this.executeReviewModes(input.requestId, input.command);
        case "fix-stage":
          return await this.executeFixStage(input.requestId, input.command);
        case "run-stage":
          return await this.executeRunStage(input.requestId, input.command);
        case "run-stages":
          return await this.executeRunStages(input.requestId, input.command);
        case "continue-stages":
          return await this.executeContinueStages(input.requestId, input.command);
        case "accept-stage":
          return await this.executeAcceptStage(input.requestId, input.command);
        case "reassess-stage-plan":
          return await this.executeReassessStagePlan(input.requestId, input.command);
      }
    } catch (error) {
      return {
        requestId: input.requestId,
        command: input.command.command,
        ok: false,
        exitCode: 1,
        summaryLines: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async preview(input: CliGatewayRequest): Promise<CliCommandPreviewResult> {
    const preview = buildCliCommandPreview({ requestId: input.requestId, command: input.command, configPath: this.configPath });
    return preview;
  }

  private async executeRun(requestId: string | undefined, command: z.infer<typeof runCliCommandSchema>): Promise<CliCommandExecutionResult> {
    const presetOptions = resolvePipelinePreset(command.preset);
    const executePlanner = command.executePlanner || presetOptions.executePlanner;
    const executeBuilder = command.executeBuilder || presetOptions.executeBuilder;
    const executeReviewer = command.executeReviewer || presetOptions.executeReviewer;
    const planFix = command.planFix || presetOptions.planFix;
    const executeFix = command.executeFix || presetOptions.executeFix;
    const runChecks = command.runChecks || presetOptions.runChecks;

    const result = await runStage({
      stageName: command.stageName,
      configArg: this.configPath,
      orchestratorRoot: this.orchestratorRoot,
      dryRun: command.dryRun ?? false,
      allowWrites: command.allowWrites ?? false,
      streamCodex: command.streamCodex ?? false,
      verbose: command.verbose ?? false,
      executePlanner,
      executeBuilder,
      executeReviewer,
      planFix,
      executeFix,
      runChecks,
      preset: command.preset
    });

    const summaryLines = [
      `Run created: ${result.stageName}`,
      `Run directory: ${result.runDir}`,
      `Checks: ${result.checksState}`,
      `Write safety: ${result.writeSafetyState}`
    ];

    let reportData: unknown;
    const artifacts = [...result.artefacts];
    if (command.generateReport) {
      const report = await generateChangeReport({ runDir: result.runDir, policy: this.changeReportPolicy });
      const reportPaths = await writeChangeReport({ runDir: result.runDir, report });
      artifacts.push(reportPaths.markdownPath, reportPaths.jsonPath);
      reportData = report;
      summaryLines.push(`Report written: ${reportPaths.markdownPath}`);
      summaryLines.push(`Report JSON written: ${reportPaths.jsonPath}`);
    }

    return {
      requestId,
      command: "run",
      ok: true,
      exitCode: 0,
      summaryLines,
      artifacts,
      data: reportData
    };
  }

  private async executeContinueRun(
    requestId: string | undefined,
    command: z.infer<typeof continueCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const result = await continueRun({
      runId: command.runId,
      configArg: this.configPath,
      orchestratorRoot: this.orchestratorRoot,
      dryRun: command.dryRun ?? false,
      allowWrites: command.allowWrites ?? false,
      streamCodex: command.streamCodex ?? false,
      verbose: command.verbose ?? false,
      executeBuilder: command.executeBuilder ?? false,
      executeReviewer: command.executeReviewer ?? false,
      planFix: command.planFix ?? false,
      executeFix: command.executeFix ?? false,
      runChecks: command.runChecks ?? false,
      planHtml: command.planHtml ?? false
    });

    return {
      requestId,
      command: "continue-run",
      ok: true,
      exitCode: 0,
      summaryLines: [
        `Run continued: ${result.runId}`,
        `Run directory: ${result.runDir}`,
        `Selected phases: ${result.selectedPhases.join(", ") || "none"}`,
        `Write safety: ${result.writeSafetyState}`
      ],
      artifacts: [...result.artefacts],
      data: result
    };
  }

  private async executeProve(requestId: string | undefined, command: z.infer<typeof proveCliCommandSchema>): Promise<CliCommandExecutionResult> {
    const runDir = resolveRunDir(this.runsRoot, command.runId);
    await assertPathExists(runDir, `Run does not exist: ${command.runId}`);
    const report = await generateChangeReport({ runDir, policy: this.changeReportPolicy });
    const result = createProveResult(report);

    return {
      requestId,
      command: "prove",
      ok: result.ready,
      exitCode: result.ready ? 0 : 1,
      summaryLines: [
        `Run id: ${result.runId}`,
        `Ready: ${result.ready}`,
        `Status: ${result.report.status}`,
        `Score: ${result.report.score}`,
        `Risk: ${result.report.risk}`,
        `Reviewer verdict: ${result.report.reviewer.verdict}`,
        `Checks state: ${result.report.checks.state}`,
        `Next action: ${result.nextAction}`
      ],
      data: result,
      error: result.ready ? undefined : `prove failed: ${result.report.status}`
    };
  }

  private async executeCheckWriteSafety(requestId: string | undefined): Promise<CliCommandExecutionResult> {
    const configPath = resolveConfigPath(this.orchestratorRoot, this.configPath);
    const config = await loadAndValidateConfig(configPath);
    const result = await checkWriteSafety({
      workspaceRoot: config.workspaceRoot,
      config,
      git: createGitInspectionClient()
    });
    const outcome = {
      configPath,
      workspaceRoot: config.workspaceRoot,
      result
    };
    const summaryLines = formatWriteSafetySummaryLines(outcome);
    const ok = result.ok;
    return {
      requestId,
      command: "check-write-safety",
      ok,
      exitCode: ok ? 0 : 1,
      summaryLines,
      data: outcome,
      error: ok ? undefined : "check-write-safety failed"
    };
  }

  private async executeProbeOpenCode(
    requestId: string | undefined,
    command: z.infer<typeof probeOpenCodeCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const configPath = resolveConfigPath(this.orchestratorRoot, this.configPath);
    const config = await loadAndValidateConfig(configPath);
    let resolvedCommand: string | undefined;

    if (command.backendName) {
      const backend = config.executionBackends[command.backendName];
      if (!backend) {
        throw new Error(`Configured backend "${command.backendName}" was not found in executionBackends.`);
      }
      if (backend.type !== "opencode-cli") {
        throw new Error(`Configured backend "${command.backendName}" is type "${backend.type}", expected "opencode-cli".`);
      }
      resolvedCommand = backend.command ?? "opencode";
    } else {
      const firstOpenCodeBackend = Object.values(config.executionBackends).find((backend) => backend.type === "opencode-cli");
      resolvedCommand = firstOpenCodeBackend?.command ?? undefined;
    }

    const probeCommand = command.opencodeCommand ?? resolvedCommand ?? "opencode";
    validateOpenCodeProbeCommand(probeCommand);
    const probe = await probeOpenCodeCliContract({ command: probeCommand, timeoutMs: 15_000 });

    let readOnlyCommandValidation: { ok: boolean; errors: string[]; warnings: string[] } | undefined;
    if (command.validateReadonlyContract) {
      const validation = buildAndValidateOpenCodeReadOnlyCommand({
        request: {
          prompt: "probe",
          role: "planner",
          model: "probe-model",
          workspaceRoot: process.cwd(),
          outputLastMessagePath: path.resolve(process.cwd(), ".MergeWright-opencode-probe-output.md"),
          orchestratorRoot: process.cwd(),
          dryRun: true,
          command: probeCommand
        },
        contract: probe.contract
      });
      readOnlyCommandValidation = validation.validation;
    }

    const result = {
      ok: probe.ok && (readOnlyCommandValidation?.ok ?? true),
      command: probeCommand,
      probe,
      readOnlyCommandValidation
    };

    const summaryLines = [
      `OpenCode CLI probe: ${result.ok ? "PASS" : "FAIL"}`,
      `Command: ${result.command}`,
      `Run subcommand: ${result.probe.contract.supportsRunSubcommand ? "yes" : "no"}`,
      `Model flag: ${result.probe.contract.supportsModelFlag ? "yes" : "no"}`,
      `Workspace flag: ${result.probe.contract.supportsCwdFlag ? "yes" : "no"}`,
      `Output flag: ${result.probe.contract.supportsOutputFlag ? "yes" : "no"}`,
      `Stdin prompt: ${result.probe.contract.supportsStdinPrompt ? "yes" : "no"}`
    ];
    if (command.validateReadonlyContract) {
      summaryLines.push(`Read-only command contract: ${result.readOnlyCommandValidation?.ok === true ? "PASS" : "FAIL"}`);
    }

    return {
      requestId,
      command: "probe-opencode",
      ok: result.ok,
      exitCode: result.ok ? 0 : 1,
      summaryLines,
      data: result,
      error: result.ok ? undefined : "probe-opencode failed"
    };
  }

  private async executeReportRun(
    requestId: string | undefined,
    command: z.infer<typeof reportCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const runDir = resolveRunDir(this.runsRoot, command.runId);
    await assertPathExists(runDir, `Run does not exist: ${command.runId}`);
    const report = await generateChangeReport({ runDir, policy: this.changeReportPolicy });
    const paths = await writeChangeReport({ runDir, report });
    const artifacts = [paths.markdownPath, paths.jsonPath];

    if (command.prSummary) {
      const prSummary = await writePrSummary({ runDir, report });
      artifacts.push(prSummary.markdownPath);
    }

    return {
      requestId,
      command: "report-run",
      ok: true,
      exitCode: 0,
      summaryLines: [`Report written: ${paths.markdownPath}`, `Report JSON written: ${paths.jsonPath}`],
      artifacts,
      data: report
    };
  }

  private async executeCompareRuns(
    requestId: string | undefined,
    command: z.infer<typeof compareCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    if (command.runIdA === command.runIdB) {
      throw new Error("compare-runs requires two distinct run ids.");
    }

    const runADir = resolveRunDir(this.runsRoot, command.runIdA);
    const runBDir = resolveRunDir(this.runsRoot, command.runIdB);
    await assertPathExists(runADir, `Run does not exist: ${command.runIdA}`);
    await assertPathExists(runBDir, `Run does not exist: ${command.runIdB}`);

    const [reportA, reportB] = await Promise.all([
      generateChangeReport({ runDir: runADir, policy: this.changeReportPolicy }),
      generateChangeReport({ runDir: runBDir, policy: this.changeReportPolicy })
    ]);

    const comparison = createCompareRunsReport(reportA, reportB);

    return {
      requestId,
      command: "compare-runs",
      ok: true,
      exitCode: 0,
      summaryLines: [
        `Run A: ${comparison.runA.runId} (${comparison.runA.status}, score ${comparison.runA.score})`,
        `Run B: ${comparison.runB.runId} (${comparison.runB.status}, score ${comparison.runB.score})`,
        `Score delta: ${comparison.deltas.score}`,
        `Risk delta: ${comparison.deltas.risk}`
      ],
      data: comparison
    };
  }

  private async executeReviewModes(
    requestId: string | undefined,
    command: z.infer<typeof reviewModesCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const runDir = resolveRunDir(this.runsRoot, command.runId);
    await assertPathExists(runDir, `Run does not exist: ${command.runId}`);

    const report = await generateChangeReport({ runDir, policy: this.changeReportPolicy });
    const modes = parseFocusedReviewModesArg(command.modes);
    const result = createFocusedReviewModesResult({ report, modes });

    return {
      requestId,
      command: "review-modes",
      ok: result.aggregateVerdict === "PASS",
      exitCode: result.aggregateVerdict === "PASS" ? 0 : 1,
      summaryLines: [
        `Run id: ${result.runId}`,
        `Aggregate verdict: ${result.aggregateVerdict}`,
        `Mode count: ${result.modes.length}`
      ],
      data: result,
      error: result.aggregateVerdict === "PASS" ? undefined : "review-modes reported FAIL."
    };
  }

  private async executeFixStage(
    requestId: string | undefined,
    command: z.infer<typeof fixStageCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const result = await fixStageFromPlan({
      stageId: command.stageId,
      stagePlanArg: command.stagePlanArg,
      configArg: this.configPath,
      feedback: command.feedback,
      orchestratorRoot: this.orchestratorRoot,
      allowWrites: command.allowWrites ?? false,
      streamCodex: command.streamCodex ?? false,
      verbose: command.verbose ?? false,
      reassessDownstream: command.reassessDownstream ?? false
    });

    return {
      requestId,
      command: "fix-stage",
      ok: true,
      exitCode: 0,
      summaryLines: [
        `Fixed stage: ${result.stageId}`,
        `Status: ${result.status}`,
        `Revision: ${result.revision}`,
        `Stage plan: ${result.stagePlanPath}`
      ],
      artifacts: [result.feedbackPath],
      data: result
    };
  }

  private async executeRunStage(
    requestId: string | undefined,
    command: z.infer<typeof runStageCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const result = await runSingleStageFromPlan({
      stageId: command.stageId,
      stagePlanArg: command.stagePlanArg,
      configArg: this.configPath,
      orchestratorRoot: this.orchestratorRoot,
      allowWrites: command.allowWrites ?? false,
      dryRun: command.dryRun ?? false,
      streamCodex: command.streamCodex ?? false,
      verbose: command.verbose ?? false
    });

    return {
      requestId,
      command: "run-stage",
      ok: true,
      exitCode: 0,
      summaryLines: [
        `Stage run: ${result.stageId}`,
        `Status: ${result.status}`,
        `Dry-run: ${result.dryRun}`,
        `Stage plan: ${result.stagePlanPath}`
      ],
      data: result
    };
  }

  private async executeRunStages(
    requestId: string | undefined,
    command: z.infer<typeof runStagesCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const result = await runStagesFromPlan({
      stagePlanArg: command.stagePlanArg,
      configArg: this.configPath,
      orchestratorRoot: this.orchestratorRoot,
      allowWrites: command.allowWrites ?? false,
      dryRun: command.dryRun ?? false,
      streamCodex: command.streamCodex ?? false,
      verbose: command.verbose ?? false,
      stopAfterEachStage: command.stopAfterEachStage ?? true
    });

    return {
      requestId,
      command: "run-stages",
      ok: true,
      exitCode: 0,
      summaryLines: [
        `Stage id: ${result.stageId ?? "none"}`,
        `Plan status: ${result.stagePlanStatus}`,
        `No pending stages: ${result.noPendingStages}`,
        `Stage plan: ${result.stagePlanPath}`
      ],
      data: result
    };
  }

  private async executeContinueStages(
    requestId: string | undefined,
    command: z.infer<typeof continueStagesCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const result = await continueStagesFromPlan({
      stagePlanArg: command.stagePlanArg,
      configArg: this.configPath,
      orchestratorRoot: this.orchestratorRoot,
      allowWrites: command.allowWrites ?? false,
      dryRun: command.dryRun ?? false,
      streamCodex: command.streamCodex ?? false,
      verbose: command.verbose ?? false
    });

    return {
      requestId,
      command: "continue-stages",
      ok: true,
      exitCode: 0,
      summaryLines: [
        `Stage id: ${result.stageId ?? "none"}`,
        `Plan status: ${result.stagePlanStatus}`,
        `No pending stages: ${result.noPendingStages}`,
        `Stage plan: ${result.stagePlanPath}`
      ],
      data: result
    };
  }

  private async executeAcceptStage(
    requestId: string | undefined,
    command: z.infer<typeof acceptStageCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const result = await acceptStageFromPlan({
      stageId: command.stageId,
      stagePlanArg: command.stagePlanArg,
      orchestratorRoot: this.orchestratorRoot,
      autoCommit: command.autoCommit ?? false,
      commitMessage: command.commitMessage
    });

    return {
      requestId,
      command: "accept-stage",
      ok: true,
      exitCode: 0,
      summaryLines: [
        `Accepted stage: ${result.stageId}`,
        `Status: ${result.status}`,
        `Commit SHA: ${result.commitSha ?? "n/a"}`,
        `Stage plan: ${result.stagePlanPath}`
      ],
      data: result
    };
  }

  private async executeReassessStagePlan(
    requestId: string | undefined,
    command: z.infer<typeof reassessStagePlanCliCommandSchema>
  ): Promise<CliCommandExecutionResult> {
    const result = await reassessStagePlan({
      stagePlanArg: command.stagePlanArg,
      sourceStageId: command.sourceStageId,
      configArg: this.configPath,
      orchestratorRoot: this.orchestratorRoot,
      dryRun: command.dryRun ?? false
    });

    return {
      requestId,
      command: "reassess-stage-plan",
      ok: true,
      exitCode: 0,
      summaryLines: [
        `Source stage: ${result.sourceStageId}`,
        `Dry-run: ${result.dryRun}`,
        `Downstream stages: ${result.downstreamStageIds.length}`,
        `Changed statuses: ${result.changedStatuses.length}`
      ],
      data: result
    };
  }
}

function buildCliCommandPreview(input: { requestId?: string; command: CliCommand; configPath: string }): CliCommandPreviewResult {
  const risk = inferCliCommandRisk(input.command);
  const effects = inferCliCommandEffects(input.command);
  const requiresConfirmation = risk !== "low" && (effects.mayWriteWorkspace || effects.mayChangeGit);
  return {
    requestId: input.requestId,
    command: input.command.command,
    equivalentCli: buildEquivalentCli(input.command, input.configPath),
    risk,
    requiresConfirmation,
    summaryLines: [
      `Command: ${input.command.command}`,
      `Risk: ${risk}`,
      `Workspace writes: ${effects.mayWriteWorkspace}`,
      `Artifact writes: ${effects.mayWriteArtifacts}`,
      `Git mutation: ${effects.mayChangeGit}`,
      `Confirmation required: ${requiresConfirmation}`
    ],
    effects
  };
}

function inferCliCommandRisk(command: CliCommand): "low" | "medium" | "high" {
  if (command.command === "accept-stage" && command.autoCommit) {
    return "high";
  }

  if (
    command.command === "run" ||
    command.command === "continue-run" ||
    command.command === "run-stage" ||
    command.command === "run-stages" ||
    command.command === "continue-stages" ||
    command.command === "accept-stage" ||
    command.command === "fix-stage"
  ) {
    return "medium";
  }

  return "low";
}

function inferCliCommandEffects(command: CliCommand): {
  readonly mayWriteWorkspace: boolean;
  readonly mayWriteArtifacts: boolean;
  readonly mayChangeGit: boolean;
} {
  const mayWriteWorkspace =
    ("allowWrites" in command && command.allowWrites === true) ||
    (command.command === "accept-stage" && command.autoCommit === true);

  const mayWriteArtifacts =
    command.command !== "probe-opencode" &&
    command.command !== "check-write-safety";

  const mayChangeGit =
    (command.command === "accept-stage" && command.autoCommit === true) ||
    ("allowWrites" in command && command.allowWrites === true);

  return { mayWriteWorkspace, mayWriteArtifacts, mayChangeGit };
}

function buildEquivalentCli(command: CliCommand, configPath: string): string {
  switch (command.command) {
    case "run":
      return `npm run mergewright -- run ${command.stageName} --config ${configPath}`;
    case "continue-run":
      return `npm run mergewright -- continue-run ${command.runId} --config ${configPath}`;
    case "prove":
      return `npm run mergewright -- prove ${command.runId} --config ${configPath}`;
    case "check-write-safety":
      return `npm run mergewright -- check-write-safety --config ${configPath}`;
    case "probe-opencode":
      return `npm run mergewright -- probe-opencode --config ${configPath}`;
    case "report-run":
      return `npm run mergewright -- report-run ${command.runId} --config ${configPath}`;
    case "compare-runs":
      return `npm run mergewright -- compare-runs ${command.runIdA} ${command.runIdB} --config ${configPath}`;
    case "review-modes":
      return `npm run mergewright -- review-modes ${command.runId} --config ${configPath}`;
    case "fix-stage":
      return `npm run mergewright -- fix-stage ${command.stageId} --stage-plan ${command.stagePlanArg} --config ${configPath}`;
    case "run-stage":
      return `npm run mergewright -- run-stage ${command.stageId} --stage-plan ${command.stagePlanArg} --config ${configPath}`;
    case "run-stages":
      return `npm run mergewright -- run-stages --stage-plan ${command.stagePlanArg} --config ${configPath}`;
    case "continue-stages":
      return `npm run mergewright -- continue-stages --stage-plan ${command.stagePlanArg} --config ${configPath}`;
    case "accept-stage":
      return `npm run mergewright -- accept-stage ${command.stageId} --stage-plan ${command.stagePlanArg}`;
    case "reassess-stage-plan":
      return `npm run mergewright -- reassess-stage-plan --stage-plan ${command.stagePlanArg} --from ${command.sourceStageId} --config ${configPath}`;
  }
}

async function assertPathExists(targetPath: string, message: string): Promise<void> {
  try {
    await stat(targetPath);
  } catch {
    throw new Error(message);
  }
}

function formatWriteSafetySummaryLines(outcome: {
  configPath: string;
  workspaceRoot: string;
  result: Awaited<ReturnType<typeof checkWriteSafety>>;
}): string[] {
  const { result } = outcome;
  const lines = [
    "Write safety summary",
    `- config path: ${outcome.configPath}`,
    `- workspace root: ${outcome.workspaceRoot}`,
    `- writeSafety.enabled: ${result.enabled}`,
    `- git work tree: ${result.isGitWorkTree}`,
    `- branch: ${result.branch || "(unknown)"}`,
    `- working tree: ${result.workingTreeState}`,
    `- changed files considered: ${result.changedFiles.length}`,
    `- blocked path matches: ${result.matchedBlockedPaths.length}`,
    `- result: ${result.ok ? "PASS" : "FAIL"}`
  ];

  if (result.warnings.length > 0) {
    lines.push("- warnings:");
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  if (result.failures.length > 0) {
    lines.push("- failures:");
    for (const failure of result.failures) {
      lines.push(`  - ${failure}`);
    }
  }

  if (result.matchedBlockedPaths.length > 0) {
    lines.push("- blocked path matches detail:");
    for (const match of result.matchedBlockedPaths) {
      lines.push(`  - ${match}`);
    }
  }

  return lines;
}
