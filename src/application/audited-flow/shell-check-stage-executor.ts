import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorConfig } from "../../config.js";
import { executeCheckCommand, resolveCheckCommandCwd, validateConfiguredCheckCommand, type CheckExecutionResult } from "../../commands.js";
import type { StageExecutor, StageInput, StageResult } from "./stage-executor.js";

export interface ShellCheckStageExecutorOptions {
  orchestratorRoot: string;
  config: OrchestratorConfig;
  execute?: typeof executeCheckCommand;
}

export class ShellCheckStageExecutor implements StageExecutor {
  readonly id = "shell-check";
  readonly capabilities: StageExecutor["capabilities"] = {
    stageKinds: ["check"],
    writesWorkspace: false,
    streamsOutput: false
  };

  private readonly orchestratorRoot: string;
  private readonly config: OrchestratorConfig;
  private readonly execute: typeof executeCheckCommand;

  constructor(options: ShellCheckStageExecutorOptions) {
    this.orchestratorRoot = options.orchestratorRoot;
    this.config = options.config;
    this.execute = options.execute ?? executeCheckCommand;
  }

  async run(input: StageInput): Promise<StageResult> {
    const configuredChecks = selectConfiguredChecks(this.config, input.contract.requiredChecks);
    await mkdir(input.artefactsDir, { recursive: true });

    if (input.dryRun) {
      const relativePath = "checks-status.json";
      await writeJson(path.join(input.artefactsDir, relativePath), {
        state: "skipped by dry-run",
        total: configuredChecks.length,
        reason: "dryRun=true"
      });
      return {
        stageId: input.stage.id,
        kind: input.stage.kind,
        executor: this.id,
        status: "passed",
        summary: configuredChecks.length > 0 ? `Skipped ${configuredChecks.length} shell checks because dryRun=true.` : "No shell checks configured.",
        artefacts: [{ kind: "json", path: relativePath }],
        metadata: {
          totalChecks: configuredChecks.length,
          dryRun: true
        }
      };
    }

    if (configuredChecks.length === 0) {
      const relativePath = "checks-status.json";
      await writeJson(path.join(input.artefactsDir, relativePath), {
        state: "executed",
        total: 0,
        noChecksConfigured: true
      });
      return {
        stageId: input.stage.id,
        kind: input.stage.kind,
        executor: this.id,
        status: "passed",
        summary: "No shell checks configured.",
        artefacts: [{ kind: "json", path: relativePath }],
        metadata: {
          totalChecks: 0
        }
      };
    }

    const artefacts: Array<{ kind: string; path: string }> = [];
    let completed = 0;

    for (let index = 0; index < configuredChecks.length; index += 1) {
      const check = configuredChecks[index];
      validateConfiguredCheckCommand(check);
      const cwd = resolveCheckCommandCwd(check, this.orchestratorRoot, input.workspace);
      const base = `checks/${String(index + 1).padStart(2, "0")}-${sanitizeCheckName(check.name)}`;
      const commandJsonPath = `${base}-command.json`;
      const stdoutPath = `${base}-stdout.log`;
      const stderrPath = `${base}-stderr.log`;
      const exitJsonPath = `${base}-exit.json`;

      await input.onCommandStarted?.({
        stageId: input.stage.id,
        name: check.name,
        command: check.command,
        args: [...check.args],
        cwd
      });

      const result = await this.execute({
        name: check.name,
        command: check.command,
        args: check.args,
        cwd
      });

      await writeJson(path.join(input.artefactsDir, commandJsonPath), {
        name: result.name,
        command: result.command,
        args: result.args,
        cwd: result.cwd
      });
      await writeText(path.join(input.artefactsDir, stdoutPath), result.stdout);
      await writeText(path.join(input.artefactsDir, stderrPath), result.stderr);
      await writeJson(path.join(input.artefactsDir, exitJsonPath), {
        success: result.success,
        code: result.exitCode,
        signal: result.signal,
        durationMs: result.durationMs
      });
      artefacts.push(
        { kind: "json", path: commandJsonPath },
        { kind: "log", path: stdoutPath },
        { kind: "log", path: stderrPath },
        { kind: "json", path: exitJsonPath }
      );

      await input.onCommandCompleted?.({
        stageId: input.stage.id,
        name: result.name,
        command: result.command,
        args: result.args,
        cwd: result.cwd,
        exitCode: result.exitCode,
        signal: result.signal,
        success: result.success,
        durationMs: result.durationMs,
        stdoutPath,
        stderrPath
      });

      completed += 1;
      if (!result.success) {
        const statusPath = "checks-status.json";
        await writeJson(path.join(input.artefactsDir, statusPath), {
          state: "failed",
          total: configuredChecks.length,
          completed,
          error: formatCheckFailure(result)
        });
        artefacts.push({ kind: "json", path: statusPath });
        return {
          stageId: input.stage.id,
          kind: input.stage.kind,
          executor: this.id,
          status: "failed",
          summary: formatCheckFailure(result),
          artefacts,
          metadata: {
            totalChecks: configuredChecks.length,
            completedChecks: completed
          }
        };
      }
    }

    const statusPath = "checks-status.json";
    await writeJson(path.join(input.artefactsDir, statusPath), {
      state: "executed",
      total: configuredChecks.length,
      completed
    });
    artefacts.push({ kind: "json", path: statusPath });

    return {
      stageId: input.stage.id,
      kind: input.stage.kind,
      executor: this.id,
      status: "passed",
      summary: `Executed ${completed} shell checks successfully.`,
      artefacts,
      metadata: {
        totalChecks: configuredChecks.length,
        completedChecks: completed
      }
    };
  }
}

function selectConfiguredChecks(config: OrchestratorConfig, requiredChecks: string[] | undefined) {
  if (!requiredChecks || requiredChecks.length === 0) {
    return config.commands.checks;
  }

  const selected = config.commands.checks.filter((check) => requiredChecks.includes(check.name));
  const missing = requiredChecks.filter((name) => !selected.some((check) => check.name === name));
  if (missing.length > 0) {
    throw new Error(`Required shell checks are not configured: ${missing.join(", ")}`);
  }
  return selected;
}

function sanitizeCheckName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function formatCheckFailure(result: CheckExecutionResult): string {
  return `Check "${result.name}" failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}`;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}
