import { resolveCheckCommandCwd, type executeCheckCommand } from "../../commands.js";
import type { OrchestratorConfig } from "../../config.js";
import type { ProgressLogger } from "../../progress-logger.js";
import type { RunPhaseName } from "../../run-metadata.js";

export async function executeChecksPhase(input: {
  runChecks: boolean;
  dryRun: boolean;
  runDir: string;
  orchestratorRoot: string;
  targetWorkspaceRoot: string;
  config: OrchestratorConfig;
  progressLogger: ProgressLogger;
  artefacts: Record<string, string>;
  checkCommandExecutor: typeof executeCheckCommand;
  updatePhaseAndPersist: (phase: RunPhaseName, update: any) => Promise<void>;
  setPhaseSkipped: (phase: RunPhaseName, reason: string) => Promise<void>;
  bestEffortUpdatePhaseAndPersistOnFailure: (phase: RunPhaseName, update: any) => Promise<void>;
  writeArtefacts: (runDir: string, artefacts: Record<string, string>) => Promise<string[]>;
  canRunChecks: () => { ok: boolean; reason?: string };
  postWriteReviewStatus: string;
  setFailedPhase: (phase: RunPhaseName) => void;
}): Promise<"disabled" | "skipped by dry-run" | "executed" | "failed"> {
  const {
    runChecks,
    dryRun,
    runDir,
    orchestratorRoot,
    targetWorkspaceRoot,
    config,
    progressLogger,
    artefacts,
    checkCommandExecutor,
    updatePhaseAndPersist,
    setPhaseSkipped,
    bestEffortUpdatePhaseAndPersistOnFailure,
    writeArtefacts,
    canRunChecks,
    postWriteReviewStatus,
    setFailedPhase
  } = input;

  let checksState: "disabled" | "skipped by dry-run" | "executed" | "failed" = "disabled";
  if (!runChecks) {
    artefacts["checks-status.json"] = JSON.stringify({ state: "disabled", reason: "--run-checks not set" }, null, 2);
    progressLogger.phaseSkipped("checks", "disabled");
  } else if (dryRun) {
    checksState = "skipped by dry-run";
    await setPhaseSkipped("checks", "target checks skipped because dryRun=true");
    artefacts["checks-status.json"] = JSON.stringify(
      { state: "skipped by dry-run", reason: "dryRun=true", total: config.commands.checks.length },
      null,
      2
    );
    progressLogger.phaseSkipped("checks", "skipped by dry-run");
  } else if (!canRunChecks().ok) {
    checksState = "failed";
    setFailedPhase("checks");
    const reason = canRunChecks().reason ?? "checks blocked";
    await bestEffortUpdatePhaseAndPersistOnFailure("checks", {
      status: "failed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      reason,
      artefacts: ["checks-status.json"]
    });
    artefacts["checks-status.json"] = JSON.stringify(
      { state: "blocked", reason, postWriteReviewStatus },
      null,
      2
    );
    const writtenBeforeThrow = await writeArtefacts(runDir, artefacts);
    progressLogger.phaseFailed("checks", reason);
    throw new Error(`Checks blocked. Diagnostics written to ${runDir}. ${reason}. Artefacts: ${writtenBeforeThrow.length}`);
  } else if (config.commands.checks.length === 0) {
    checksState = "executed";
    await updatePhaseAndPersist("checks", {
      status: "executed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      reason: "no checks configured",
      artefacts: ["checks-status.json"]
    });
    artefacts["checks-status.json"] = JSON.stringify(
      { state: "executed", total: 0, noChecksConfigured: true },
      null,
      2
    );
    progressLogger.phaseComplete("checks", "completed (no checks configured)");
  } else {
    progressLogger.phaseStart("checks");
    setFailedPhase("checks");
    await updatePhaseAndPersist("checks", { status: "unknown", startedAt: new Date().toISOString() });
    let completed = 0;
    try {
      for (let i = 0; i < config.commands.checks.length; i += 1) {
        const check = config.commands.checks[i];
        progressLogger.info(`[checks] running: ${check.name}`);
        progressLogger.verbose(`[checks] command: ${check.command} ${check.args.join(" ")}`);
        const cwd = resolveCheckCommandCwd(check, orchestratorRoot, targetWorkspaceRoot);
        const result = await checkCommandExecutor({
          name: check.name,
          command: check.command,
          args: check.args,
          cwd
        });
        const base = `checks/${String(i + 1).padStart(2, "0")}-${sanitizeCheckName(check.name)}`;
        artefacts[`${base}-command.json`] = JSON.stringify(
          {
            name: result.name,
            command: result.command,
            args: result.args,
            cwd: result.cwd
          },
          null,
          2
        );
        artefacts[`${base}-stdout.log`] = result.stdout;
        artefacts[`${base}-stderr.log`] = result.stderr;
        artefacts[`${base}-exit.json`] = JSON.stringify(
          {
            success: result.success,
            code: result.exitCode,
            signal: result.signal,
            durationMs: result.durationMs
          },
          null,
          2
        );
        completed += 1;
        if (!result.success) {
          throw new Error(
            `Check "${check.name}" failed with exit code ${result.exitCode ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}`
          );
        }
      }
      checksState = "executed";
      await updatePhaseAndPersist("checks", {
        status: "executed",
        completedAt: new Date().toISOString(),
        artefacts: ["checks-status.json"]
      });
      artefacts["checks-status.json"] = JSON.stringify(
        { state: "executed", total: config.commands.checks.length, completed },
        null,
        2
      );
      progressLogger.phaseComplete("checks", "completed");
    } catch (error) {
      checksState = "failed";
      const message = error instanceof Error ? error.message : String(error);
      const checksFailureMessage = `Checks failed. Diagnostics written to ${runDir}. ${message}. Artefacts: `;
      await bestEffortUpdatePhaseAndPersistOnFailure("checks", {
        status: "failed",
        completedAt: new Date().toISOString(),
        artefacts: ["checks-status.json"]
      });
      artefacts["checks-status.json"] = JSON.stringify(
        {
          state: "failed",
          total: config.commands.checks.length,
          completed,
          error: message
        },
        null,
        2
      );
      const writtenBeforeThrow = await writeArtefacts(runDir, artefacts);
      progressLogger.phaseFailed("checks", message);
      throw new Error(`${checksFailureMessage}${writtenBeforeThrow.length}`);
    }
  }

  return checksState;
}

function sanitizeCheckName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}
