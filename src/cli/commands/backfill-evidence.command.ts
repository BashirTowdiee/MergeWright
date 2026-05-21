import { backfillEvidenceFromRunArtefacts } from "../../evidence/evidence-backfill.js";
import { resolveRunDir } from "../../runs.js";
import type { CommandHandler } from "../command-context.js";
import { assertPathExists, loadConfigAndRunsRoot } from "../command-helpers.js";

export const handleBackfillEvidenceCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine, progressLogger }) => {
  if (!args.configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  if (!args.runId) {
    throw new Error("Usage: agent-stage backfill-evidence <run-id> --config <config-path> [--dry-run] [--verbose]");
  }

  const { configPath, runsRoot } = await loadConfigAndRunsRoot(orchestratorRoot, args.configArg);
  progressLogger.phaseStart("evidence", "loading config");
  progressLogger.verbose(`[evidence] config path: ${configPath}`);
  progressLogger.verbose(`[evidence] runs root: ${runsRoot}`);

  progressLogger.phaseStart("evidence", "resolving run directory");
  const runDir = resolveRunDir(runsRoot, args.runId);
  progressLogger.verbose(`[evidence] run directory: ${runDir}`);
  await assertPathExists(runDir, `Run does not exist: ${args.runId}`);

  progressLogger.phaseStart("evidence", args.dryRun ? "backfilling evidence dry run" : "backfilling evidence");
  const result = await backfillEvidenceFromRunArtefacts(runDir, { write: !args.dryRun });
  progressLogger.phaseComplete("evidence", args.dryRun ? "dry run completed" : "completed");

  writeLine(`Evidence backfill ${args.dryRun ? "previewed" : "written"}: ${args.runId}`);
  writeLine(`Status: ${result.manifest.status}`);
  writeLine(`Changed files: ${result.manifest.git.changedFiles.length}`);
  writeLine(`Untracked files: ${result.manifest.git.untrackedFiles.length}`);
  writeLine(`Missing artefacts: ${result.diagnostics.missingArtefacts.length}`);
  writeLine(`Malformed artefacts: ${result.diagnostics.malformedArtefacts.length}`);
};
