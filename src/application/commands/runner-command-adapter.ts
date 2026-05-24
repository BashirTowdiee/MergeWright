import path from "node:path";
import type { AppCommand } from "./app-command.js";
import type { AppCommandResult } from "./app-command-result.js";
import type { RetryPhaseCommandHandler, StartRunCommandHandler } from "./default-app-command-service.js";
import { runStage, type RunOptions, type RunResult } from "../../runner.js";

export type RunnerCommandAdapterOptions = {
  readonly orchestratorRoot: string;
  readonly repoOverride?: string;
  readonly streamCodex?: boolean;
  readonly runStageHandler?: (options: RunOptions) => Promise<RunResult>;
};

export type RunnerCommandHandlers = {
  readonly startRunHandler: StartRunCommandHandler;
  readonly retryPhaseHandler: RetryPhaseCommandHandler;
};

export function createRunnerCommandHandlers(options: RunnerCommandAdapterOptions): RunnerCommandHandlers {
  const runStageHandler = options.runStageHandler ?? runStage;

  return {
    startRunHandler: async (command) => {
      const result = await runStageHandler({
        stageName: command.stageName,
        configArg: command.configPath,
        repoOverride: options.repoOverride,
        dryRun: false,
        executePlanner: true,
        executeBuilder: false,
        executeReviewer: false,
        planFix: false,
        executeFix: false,
        runChecks: false,
        allowWrites: false,
        preset: command.preset,
        verbose: false,
        streamCodex: options.streamCodex,
        orchestratorRoot: options.orchestratorRoot
      });

      return toRunCommandResult(command, result, `Started planner run for ${result.stageName}.`);
    },
    retryPhaseHandler: async (command) => {
      const result = await runStageHandler({
        stageName: command.runId,
        configArg: command.runId,
        repoOverride: options.repoOverride,
        dryRun: false,
        executePlanner: false,
        executeBuilder: false,
        executeReviewer: true,
        planFix: false,
        executeFix: false,
        runChecks: false,
        allowWrites: false,
        verbose: false,
        streamCodex: options.streamCodex,
        orchestratorRoot: options.orchestratorRoot
      });

      return toRunCommandResult(command, result, `Started reviewer retry for ${command.runId}.`);
    }
  };
}

function toRunCommandResult(command: Extract<AppCommand, { readonly type: "start-run" | "retry-phase" }>, result: RunResult, message: string): AppCommandResult {
  return {
    ok: true,
    commandId: command.commandId,
    type: command.type,
    message,
    runId: runIdFromRunDir(result.runDir),
    artefacts: result.artefacts.map((artefact) => path.join(result.runDir, artefact))
  };
}

function runIdFromRunDir(runDir: string): string {
  return path.basename(path.normalize(runDir));
}
