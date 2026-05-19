#!/usr/bin/env node
import process from "node:process";
import { spawn } from "node:child_process";
import { createProgressLogger, NOOP_PROGRESS_LOGGER } from "./progress-logger.js";
import { resolvePipelinePreset, type PipelinePreset } from "./presets.js";
import { commandHandlers } from "./cli/command-registry.js";
import { knownCommands } from "./cli/known-commands.js";
import { runCheckWriteSafety as runCheckWriteSafetyImpl } from "./cli/run-check-write-safety.js";
import { formatSummaryLines as formatSummaryLinesImpl } from "./cli/summary-lines.js";
import type { ParsedArgs, RunCommandDeps, OpenRunDirectory } from "./cli/types.js";

export type { ParsedArgs, RunCommandDeps, OpenRunDirectory, CheckWriteSafetyRunResult } from "./cli/types.js";
export const runCheckWriteSafety = runCheckWriteSafetyImpl;
export const formatSummaryLines = formatSummaryLinesImpl;

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    await runCommand(args, process.cwd(), process.platform, defaultOpenRunDirectory);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${msg}`);
    process.exitCode = 1;
  }
}

export async function runCommand(
  args: ParsedArgs,
  orchestratorRoot: string,
  platform: NodeJS.Platform,
  openRunDirectory: OpenRunDirectory,
  writeLine: (line: string) => void = console.log,
  deps: RunCommandDeps = {}
): Promise<void> {
  const jsonOnlyStdout =
    args.command === "report-run" && (args.jsonOutput === true || (args.prSummary === true && args.stdoutOnly === true));
  const progressLogger = jsonOnlyStdout ? NOOP_PROGRESS_LOGGER : createProgressLogger(writeLine, { verbose: args.verbose });

  if (args.help) {
    writeLine(renderHelpText(args.command));
    return;
  }

  if (!args.command) {
    throw new Error(`Missing command.\n\n${renderHelpText()}`);
  }

  if (!knownCommands.has(args.command)) {
    throw new Error(`Unknown command: ${args.command}\n\n${renderHelpText()}`);
  }

  const handler = commandHandlers[args.command as keyof typeof commandHandlers];
  await handler({
    args,
    orchestratorRoot,
    platform,
    openRunDirectory,
    writeLine,
    deps,
    progressLogger
  });
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, firstArg, ...tail] = argv;
  const parsed: ParsedArgs = {
    command,
    help: false,
    force: false,
    dryRun: false,
    executePlanner: false,
    executeBuilder: false,
    executeReviewer: false,
    planFix: false,
    executeFix: false,
    runChecks: false,
    allowWrites: false,
    verbose: false,
    streamCodex: false,
    autoChain: false,
    generateReport: false,
    planHtml: false,
    openPlan: false,
    stopAfterEachStage: false,
    reassessDownstream: false
    ,
    autoCommit: false
  };

  if (command === "--help" || command === "-h") {
    parsed.command = undefined;
    parsed.help = true;
    return parsed;
  }

  if (!command) {
    if (argv.length === 0) {
      throw new Error(`Missing command.\n\n${renderHelpText()}`);
    }
    if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
      parsed.help = true;
      return parsed;
    }
  }

  if (command && (firstArg === "--help" || firstArg === "-h")) {
    parsed.help = true;
    return parsed;
  }

  if (command === "run") {
    parsed.stageName = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  } else if (command === "init-project") {
    parsed.projectName = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  } else if (command === "show-run" || command === "open-run" || command === "continue-run" || command === "report-run") {
    parsed.runId = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  } else if (command === "run-stage" || command === "accept-stage" || command === "fix-stage") {
    parsed.stageId = firstArg && !firstArg.startsWith("-") ? firstArg : undefined;
  }
  const rest =
    command === "run"
      ? firstArg && firstArg.startsWith("-")
        ? [firstArg, ...tail]
        : tail
      : command === "show-run" || command === "open-run" || command === "continue-run" || command === "report-run"
        ? firstArg && firstArg.startsWith("-")
          ? [firstArg, ...tail]
          : tail
        : command === "run-stage" || command === "accept-stage" || command === "fix-stage"
          ? firstArg && firstArg.startsWith("-")
            ? [firstArg, ...tail]
            : tail
        : command === "init-project"
          ? firstArg && firstArg.startsWith("-")
            ? [firstArg, ...tail]
            : tail
        : [firstArg, ...tail].filter((token): token is string => typeof token === "string");

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }
    if (token === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (token === "--execute-planner") {
      parsed.executePlanner = true;
      continue;
    }
    if (token === "--execute-builder") {
      parsed.executeBuilder = true;
      continue;
    }
    if (token === "--execute-reviewer") {
      parsed.executeReviewer = true;
      continue;
    }
    if (token === "--plan-fix") {
      parsed.planFix = true;
      continue;
    }
    if (token === "--execute-fix") {
      parsed.executeFix = true;
      continue;
    }
    if (token === "--verbose") {
      parsed.verbose = true;
      continue;
    }
    if (token === "--stream-codex") {
      parsed.streamCodex = true;
      continue;
    }
    if (token === "--auto-chain") {
      parsed.autoChain = true;
      continue;
    }
    if (token === "--generate-report") {
      parsed.generateReport = true;
      continue;
    }
    if (token === "--plan-html") {
      parsed.planHtml = true;
      continue;
    }
    if (token === "--open-plan") {
      parsed.openPlan = true;
      parsed.planHtml = true;
      continue;
    }
    if (token === "--max-fix-attempts") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --max-fix-attempts");
      }
      if (!/^-?\d+$/.test(value.trim())) {
        throw new Error("--max-fix-attempts must be an integer from 0 to 5.");
      }
      const parsedValue = Number.parseInt(value, 10);
      if (parsedValue < 0 || parsedValue > 5) {
        throw new Error("--max-fix-attempts must be an integer from 0 to 5.");
      }
      parsed.maxFixAttempts = parsedValue;
      i += 1;
      continue;
    }
    if (token === "--force") {
      if (parsed.command !== "init-project" && parsed.command !== "report-run" && parsed.command !== "import-stage-plan") {
        throw new Error("--force is only supported for init-project, report-run, and import-stage-plan");
      }
      parsed.force = true;
      continue;
    }
    if (token === "--json") {
      parsed.jsonOutput = true;
      continue;
    }
    if (token === "--backend") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --backend");
      }
      parsed.backendName = value;
      i += 1;
      continue;
    }
    if (token === "--command") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --command");
      }
      parsed.opencodeCommand = value;
      i += 1;
      continue;
    }
    if (token === "--validate-readonly-contract") {
      parsed.validateReadonlyContract = true;
      continue;
    }
    if (token === "--stdout-only") {
      parsed.stdoutOnly = true;
      continue;
    }
    if (token === "--pr-summary") {
      parsed.prSummary = true;
      continue;
    }
    if (token === "--run-checks") {
      parsed.runChecks = true;
      continue;
    }
    if (token === "--allow-writes") {
      parsed.allowWrites = true;
      continue;
    }
    if (token === "--preset") {
      if (parsed.command === "continue-run") {
        throw new Error("--preset is not supported for continue-run.");
      }
      if (parsed.preset) {
        throw new Error("Repeated --preset is not allowed. Provide at most one preset.");
      }
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --preset");
      }
      parsed.preset = value as PipelinePreset;
      i += 1;
      continue;
    }
    if (token === "--config") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --config");
      }
      parsed.configArg = value;
      i += 1;
      continue;
    }
    if (token === "--repo") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --repo");
      }
      parsed.repoOverride = value;
      i += 1;
      continue;
    }
    if (token === "--workspace") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --workspace");
      }
      parsed.workspaceArg = value;
      i += 1;
      continue;
    }
    if (token === "--from") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --from");
      }
      if (parsed.command === "import-stage-plan") {
        parsed.importFrom = value;
      } else if (parsed.command === "reassess-stage-plan") {
        parsed.fromStageId = value;
      } else {
        throw new Error("--from is only supported for import-stage-plan and reassess-stage-plan.");
      }
      i += 1;
      continue;
    }
    if (token === "--out") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --out");
      }
      parsed.importOut = value;
      i += 1;
      continue;
    }
    if (token === "--stage-plan") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --stage-plan");
      }
      parsed.stagePlanArg = value;
      i += 1;
      continue;
    }
    if (token === "--feedback") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --feedback");
      }
      parsed.feedback = value;
      i += 1;
      continue;
    }
    if (token === "--stop-after-each-stage") {
      parsed.stopAfterEachStage = true;
      continue;
    }
    if (token === "--reassess-downstream") {
      parsed.reassessDownstream = true;
      continue;
    }
    if (token === "--auto-commit") {
      parsed.autoCommit = true;
      continue;
    }
    if (token === "--commit-message") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --commit-message");
      }
      parsed.commitMessage = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (
    parsed.allowWrites &&
    parsed.command !== "run" &&
    parsed.command !== "continue-run" &&
    parsed.command !== "run-stage" &&
    parsed.command !== "fix-stage" &&
    parsed.command !== "run-stages" &&
    parsed.command !== "continue-stages"
  ) {
    throw new Error("--allow-writes is only supported for run, continue-run, and run-stage. fix-stage also supports --allow-writes.");
  }
  if (
    parsed.streamCodex &&
    parsed.command !== "run" &&
    parsed.command !== "continue-run" &&
    parsed.command !== "run-stage" &&
    parsed.command !== "fix-stage" &&
    parsed.command !== "run-stages" &&
    parsed.command !== "continue-stages"
  ) {
    throw new Error("--stream-codex is only supported for run, continue-run, and run-stage. fix-stage also supports --stream-codex.");
  }
  if (parsed.autoChain && parsed.command !== "run") {
    throw new Error("--auto-chain is only supported for run.");
  }
  if (parsed.generateReport && parsed.command !== "run" && parsed.command !== "continue-run") {
    throw new Error("--generate-report is only supported for run and continue-run.");
  }
  if ((parsed.planHtml || parsed.openPlan) && parsed.command !== "run" && parsed.command !== "continue-run") {
    throw new Error("--plan-html and --open-plan are only supported for run and continue-run.");
  }
  if (parsed.maxFixAttempts != null && !parsed.autoChain) {
    throw new Error("--max-fix-attempts is only supported with --auto-chain.");
  }
  if ((parsed.jsonOutput || parsed.stdoutOnly || parsed.prSummary) && parsed.command !== "report-run" && parsed.command !== "probe-opencode") {
    throw new Error("--json is supported for report-run and probe-opencode. --pr-summary and --stdout-only are only supported for report-run");
  }
  if (parsed.command === "report-run" && parsed.jsonOutput && parsed.prSummary && parsed.stdoutOnly) {
    throw new Error(
      "--json cannot be combined with --pr-summary and --stdout-only because stdout can contain only one machine-readable format."
    );
  }
  if (parsed.command !== "probe-opencode" && (parsed.backendName || parsed.opencodeCommand || parsed.validateReadonlyContract)) {
    throw new Error("--backend, --command, and --validate-readonly-contract are only supported for probe-opencode.");
  }

  if (parsed.command === "run") {
    if (parsed.help) {
      return parsed;
    }
    if (parsed.autoChain) {
      if (parsed.preset) {
        throw new Error("--auto-chain cannot be combined with --preset.");
      }
      if (
        parsed.executePlanner ||
        parsed.executeBuilder ||
        parsed.executeReviewer ||
        parsed.planFix ||
        parsed.executeFix ||
        parsed.runChecks
      ) {
        throw new Error(
          "--auto-chain cannot be combined with explicit phase flags: --execute-planner, --execute-builder, --execute-reviewer, --plan-fix, --execute-fix, --run-checks."
        );
      }
      parsed.maxFixAttempts = parsed.maxFixAttempts ?? 1;
      return parsed;
    }
    const presetOptions = resolvePipelinePreset(parsed.preset);
    parsed.executePlanner = parsed.executePlanner || presetOptions.executePlanner;
    parsed.executeBuilder = parsed.executeBuilder || presetOptions.executeBuilder;
    parsed.executeReviewer = parsed.executeReviewer || presetOptions.executeReviewer;
    parsed.planFix = parsed.planFix || presetOptions.planFix;
    parsed.executeFix = parsed.executeFix || presetOptions.executeFix;
    parsed.runChecks = parsed.runChecks || presetOptions.runChecks;

    if (parsed.executeBuilder && !parsed.executePlanner) {
      throw new Error("--execute-builder requires --execute-planner because builder prompt extraction depends on planner output.");
    }
    if (parsed.executeReviewer && !parsed.executePlanner) {
      throw new Error("--execute-reviewer requires --execute-planner because reviewer context depends on planner artefacts.");
    }
    if (parsed.planFix && !parsed.executeReviewer) {
      throw new Error("--plan-fix requires --execute-reviewer because fix planning depends on reviewer output.");
    }
    if (parsed.executeFix && !parsed.planFix) {
      throw new Error("--execute-fix requires --plan-fix because fix execution depends on review-to-fix output.");
    }
    if (parsed.allowWrites && !parsed.executeBuilder && !parsed.executeFix) {
      throw new Error("--allow-writes requires at least one write-eligible phase: --execute-builder or --execute-fix.");
    }
    if (parsed.allowWrites && (parsed.executeBuilder || parsed.executeFix) && !parsed.executeReviewer && !parsed.dryRun) {
      throw new Error("--allow-writes requires --execute-reviewer for post-write review");
    }
  }
  if (parsed.command === "continue-run") {
    if (parsed.help) {
      return parsed;
    }
    if (parsed.executePlanner) {
      throw new Error("--execute-planner is not supported for continue-run.");
    }
    if (!parsed.executeBuilder && !parsed.executeReviewer && !parsed.planFix && !parsed.executeFix && !parsed.runChecks) {
      throw new Error("continue-run requires at least one phase flag.");
    }
    if (parsed.allowWrites && !parsed.executeBuilder && !parsed.executeFix) {
      throw new Error("--allow-writes requires at least one write-eligible continuation phase: --execute-builder or --execute-fix.");
    }
  }
  if (parsed.command === "init-project") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.projectName) {
      throw new Error("init-project requires <name>. Usage: agent-stage init-project <name> --workspace <path> [--force] [--verbose]");
    }
    if (!parsed.workspaceArg) {
      throw new Error("init-project requires --workspace <path>. Usage: agent-stage init-project <name> --workspace <path> [--force] [--verbose]");
    }
    if (parsed.configArg) {
      throw new Error("--config is not supported for init-project.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for init-project.");
    }
  }
  if (parsed.command === "report-run") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.runId) {
      throw new Error(
        "report-run requires <run-id>. Usage: agent-stage report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]"
      );
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
    if (parsed.workspaceArg) {
      throw new Error("--workspace is not supported for report-run.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for report-run.");
    }
  }
  if (parsed.command === "probe-opencode") {
    if (parsed.help) {
      return parsed;
    }
    if (parsed.stdoutOnly || parsed.prSummary) {
      throw new Error("--pr-summary and --stdout-only are not supported for probe-opencode.");
    }
  }
  if (parsed.command === "import-stage-plan") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.importFrom) {
      throw new Error(
        "import-stage-plan requires --from <path>. Usage: agent-stage import-stage-plan --from <path> --out <path> [--force]"
      );
    }
    if (!parsed.importOut) {
      throw new Error(
        "import-stage-plan requires --out <path>. Usage: agent-stage import-stage-plan --from <path> --out <path> [--force]"
      );
    }
    if (parsed.configArg) {
      throw new Error("--config is not supported for import-stage-plan.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for import-stage-plan.");
    }
  }
  if (parsed.command === "run-stage") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.stageId) {
      throw new Error(
        "run-stage requires <stage-id>. Usage: agent-stage run-stage <stage-id> --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]"
      );
    }
    if (!parsed.stagePlanArg) {
      throw new Error(
        "run-stage requires --stage-plan <path>. Usage: agent-stage run-stage <stage-id> --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]"
      );
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for run-stage.");
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
  }
  if (parsed.command === "accept-stage") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.stageId) {
      throw new Error("accept-stage requires <stage-id>. Usage: agent-stage accept-stage <stage-id> --stage-plan <path>");
    }
    if (!parsed.stagePlanArg) {
      throw new Error("accept-stage requires --stage-plan <path>. Usage: agent-stage accept-stage <stage-id> --stage-plan <path>");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for accept-stage.");
    }
    if (parsed.configArg) {
      throw new Error("--config is not supported for accept-stage.");
    }
  }
  if (parsed.command === "fix-stage") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.stageId) {
      throw new Error(
        "fix-stage requires <stage-id>. Usage: agent-stage fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--allow-writes] [--verbose] [--stream-codex]"
      );
    }
    if (!parsed.stagePlanArg) {
      throw new Error(
        "fix-stage requires --stage-plan <path>. Usage: agent-stage fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--allow-writes] [--verbose] [--stream-codex]"
      );
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
    if (!parsed.feedback) {
      throw new Error(
        "fix-stage requires --feedback <text>. Usage: agent-stage fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--allow-writes] [--verbose] [--stream-codex]"
      );
    }
    if (!parsed.feedback.trim()) {
      throw new Error("fix-stage requires non-empty --feedback.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for fix-stage.");
    }
    if (parsed.dryRun) {
      throw new Error("--dry-run is not supported for fix-stage.");
    }
  }
  if (parsed.command === "reassess-stage-plan") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.stagePlanArg) {
      throw new Error(
        "reassess-stage-plan requires --stage-plan <path>. Usage: agent-stage reassess-stage-plan --stage-plan <path> --from <stage-id> --config <config-path> [--dry-run]"
      );
    }
    if (!parsed.fromStageId) {
      throw new Error(
        "reassess-stage-plan requires --from <stage-id>. Usage: agent-stage reassess-stage-plan --stage-plan <path> --from <stage-id> --config <config-path> [--dry-run]"
      );
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for reassess-stage-plan.");
    }
    if (parsed.feedback) {
      throw new Error("--feedback is not supported for reassess-stage-plan.");
    }
  }
  if (parsed.reassessDownstream && parsed.command !== "fix-stage") {
    throw new Error("--reassess-downstream is only supported for fix-stage.");
  }
  if (parsed.commitMessage && !parsed.autoCommit) {
    throw new Error("--commit-message requires --auto-commit.");
  }
  if (parsed.command === "run-stages") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.stagePlanArg) {
      throw new Error(
        "run-stages requires --stage-plan <path>. Usage: agent-stage run-stages --stage-plan <path> --config <config-path> --stop-after-each-stage [--allow-writes] [--dry-run] [--verbose] [--stream-codex]"
      );
    }
    if (!parsed.stopAfterEachStage) {
      throw new Error("Only --stop-after-each-stage mode is supported in SP-5.");
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for run-stages.");
    }
    if (parsed.autoCommit) {
      throw new Error("SP-7: --auto-commit is only supported with accept-stage.");
    }
  }
  if (parsed.command === "continue-stages") {
    if (parsed.help) {
      return parsed;
    }
    if (!parsed.stagePlanArg) {
      throw new Error(
        "continue-stages requires --stage-plan <path>. Usage: agent-stage continue-stages --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]"
      );
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for continue-stages.");
    }
    if (parsed.autoCommit) {
      throw new Error("SP-7: --auto-commit is only supported with accept-stage.");
    }
  }
  if (parsed.command === "run-stage" && parsed.autoCommit) {
    throw new Error("SP-7: --auto-commit is only supported with accept-stage.");
  }
  if (parsed.command === "accept-stage" && parsed.commitMessage && !parsed.autoCommit) {
    throw new Error("--commit-message requires --auto-commit.");
  }
  if (parsed.command !== "accept-stage" && parsed.autoCommit) {
    throw new Error("SP-7: --auto-commit is only supported with accept-stage.");
  }
  if (parsed.command !== "accept-stage" && parsed.commitMessage) {
    throw new Error("--commit-message is only supported with accept-stage --auto-commit.");
  }

  return parsed;
}

function renderHelpText(command?: string): string {
  if (command === "run") {
    return [
      "Usage: agent-stage run <stage-name> --config <config-path> [--repo <path>] [--preset <name>] [--execute-planner] [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--auto-chain] [--max-fix-attempts <number>] [--dry-run] [--verbose] [--stream-codex] [--plan-html] [--open-plan] [--generate-report]",
      "",
      "Run options:",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --preset <name>          plan | build | review | fix-plan | full-readonly",
      "  --dry-run                Validates/records run without executing Codex or checks.",
      "  --execute-planner        Planner extraction mode (read-only Codex sandbox).",
      "  --execute-builder        Requires --execute-planner.",
      "  --execute-reviewer       Requires --execute-planner.",
      "  --plan-fix               Requires --execute-reviewer.",
      "  --execute-fix            Requires --plan-fix.",
      "  --run-checks             Runs configured checks from config when not dry-run.",
      "  --allow-writes           Enables workspace-write sandbox for builder/fix only (after safety pass).",
      "  --auto-chain             Stage E: bounded planner->builder->reviewer->review-to-fix with fix/reviewer retries.",
      "  --max-fix-attempts <n>   Auto-chain only. Integer 0..5 (default 1); 0 means stop on FIX_REQUIRED without fix execution.",
      "  --stream-codex           Streams raw Codex stdout/stderr live while still writing artefacts.",
      "  --plan-html              Writes plan.html visualisation into the run directory.",
      "  --open-plan              Implies --plan-html and attempts to open plan.html in browser.",
      "  --generate-report        Generates run-report.md and run-report.json after run completion.",
      "",
      "Auto-chain limitations:",
      "  - Supported only for run.",
      "  - Incompatible with --preset and explicit phase flags.",
      "",
      "Safety:",
      "  - Planner/reviewer/review-to-fix stay read-only.",
      "  - Retry loop is hard bounded by --max-fix-attempts (0..5).",
      "  - No auto-commit or auto-push.",
      "  - --allow-writes requires writeSafety.enabled=true and passing check-write-safety.",
      "",
      "Auto-chain statuses:",
      "  - PASS | NEEDS_FIX | NEEDS_FIX_WRITE_DISABLED | MAX_FIX_ATTEMPTS_REACHED | CHECKS_FAILED | FAILED"
    ].join("\n");
  }

  if (command === "continue-run") {
    return [
      "Usage: agent-stage continue-run <run-id> --config <config-path> [--execute-builder] [--execute-reviewer] [--plan-fix] [--execute-fix] [--run-checks] [--allow-writes] [--dry-run] [--verbose] [--stream-codex] [--plan-html] [--open-plan] [--generate-report]",
      "",
      "Continuation options:",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --dry-run                Validates continuation without executing Codex or checks.",
      "  --execute-builder        Continue builder phase for this run.",
      "  --execute-reviewer       Continue reviewer phase for this run.",
      "  --plan-fix               Continue fix planning phase for this run.",
      "  --execute-fix            Continue fix execution phase for this run.",
      "  --run-checks             Continue configured checks for this run.",
      "  --allow-writes           Enables workspace-write sandbox for builder/fix only (after safety pass).",
      "  --stream-codex           Streams raw Codex stdout/stderr live while still writing artefacts.",
      "  --plan-html              Writes plan.html visualisation into the run directory.",
      "  --open-plan              Implies --plan-html and attempts to open plan.html in browser.",
      "  --generate-report        Regenerates run-report.md and run-report.json after continuation completion.",
      "",
      "Limitations:",
      "  - Planner continuation is not supported.",
      "  - --execute-planner and --preset are not supported for continue-run.",
      "  - At least one continuation phase flag is required.",
      "",
      "Safety:",
      "  - Planner/reviewer/review-to-fix stay read-only.",
      "  - No auto-commit or auto-push."
    ].join("\n");
  }

  if (command === "list-runs") {
    return [
      "Usage: agent-stage list-runs --config <config-path>",
      "",
      "Lists run directories and metadata summaries from the configured runs root.",
      "  --config <config-path>   Required. No implicit default is used."
    ].join("\n");
  }

  if (command === "show-run") {
    return [
      "Usage: agent-stage show-run <run-id> --config <config-path>",
      "",
      "Shows run metadata, status summaries, and artefact files for a run id.",
      "  --config <config-path>   Required. No implicit default is used."
    ].join("\n");
  }

  if (command === "open-run") {
    return [
      "Usage: agent-stage open-run <run-id> --config <config-path>",
      "",
      "Resolves a run directory and opens it on macOS (read-only inspection helper).",
      "  --config <config-path>   Required. No implicit default is used."
    ].join("\n");
  }

  if (command === "report-run") {
    return [
      "Usage: agent-stage report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]",
      "",
      "Generates AI Change Report artefacts for an existing run.",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --json                   Prints JSON-only report to stdout (machine-readable).",
      "  --pr-summary             Also generates pr-summary.md based on the ChangeReport.",
      "  --stdout-only            Prints report output without writing artefacts.",
      "  --force                  Overwrite existing run-report.md, run-report.json, and pr-summary.md.",
      "",
      "Notes:",
      "  - Does not execute Codex.",
      "  - Does not run checks.",
      "  - Does not mutate target workspace.",
      "  - Default writes run-report.md and run-report.json and prints a human summary.",
      "  - --pr-summary also writes pr-summary.md.",
      "  - --stdout-only prints Markdown by default.",
      "  - --pr-summary --stdout-only prints PR summary Markdown only.",
      "  - --json output is JSON-only (no progress logs or summary lines).",
      "  - --json --pr-summary --stdout-only is rejected because stdout can contain only one machine-readable format.",
      "  - Does not create a PR and does not call GitHub APIs.",
      "  - Reads existing run artefacts only; does not run git commands."
    ].join("\n");
  }

  if (command === "init-project") {
    return [
      "Usage: agent-stage init-project <name> --workspace <path> [--force] [--verbose]",
      "",
      "Creates orchestrator-side project scaffolding without writing to target workspace.",
      "",
      "Options:",
      "  --workspace <path>       Required target repository path for validation only.",
      "  --force                  Overwrite generated orchestrator files if they exist.",
      "",
      "Safety:",
      "  - Target workspace is not modified.",
      "  - No auto-commit or auto-push."
    ].join("\n");
  }

  if (command === "check-write-safety") {
    return [
      "Usage: agent-stage check-write-safety --config <config-path>",
      "",
      "Runs Stage P read-only write-safety readiness checks against target workspace.",
      "  --config <config-path>   Required. No implicit default is used.",
      "",
      "Safety:",
      "  - No Codex execution.",
      "  - No workspace writes.",
      "  - No git mutation, commit, or push."
    ].join("\n");
  }

  if (command === "probe-opencode") {
    return [
      "Usage: agent-stage probe-opencode [--config <config-path>] [--backend <name>] [--command <command>] [--json] [--validate-readonly-contract]",
      "",
      "Runs OpenCode CLI contract probing using version/help/run-help only.",
      "  --config <config-path>              Optional. Resolve backend command from executionBackends.",
      "  --backend <name>                    Optional. Select a named execution backend from config.",
      "  --command <command>                 Optional. Override command executable name.",
      "  --json                              Print full probe result JSON.",
      "  --validate-readonly-contract        Build and validate a sample read-only command without executing it.",
      "",
      "Safety:",
      "  - Does not execute agent prompts.",
      "  - Does not call OpenCodeCliBackend.execute().",
      "  - Does not write output files."
    ].join("\n");
  }

  if (command === "import-stage-plan") {
    return [
      "Usage: agent-stage import-stage-plan --from <path> --out <path> [--force]",
      "",
      "Imports and validates an existing stage plan JSON, then writes canonical JSON and Markdown artefacts.",
      "",
      "Options:",
      "  --from <path>            Required source stage plan JSON file.",
      "  --out <path>             Required output directory for stage-plan.json and stage-plan.md.",
      "  --force                  Overwrite existing output files.",
      "",
      "Notes:",
      "  - Uses SP-1 stage plan validation.",
      "  - Does not run planner/builder/reviewer.",
      "  - Does not mutate stage statuses."
    ].join("\n");
  }

  if (command === "run-stage") {
    return [
      "Usage: agent-stage run-stage <stage-id> --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]",
      "",
      "Runs exactly one stage from an imported stage plan and stops at human review.",
      "",
      "Options:",
      "  --stage-plan <path>      Required path to stage-plan.json.",
      "  --config <config-path>   Required execution config path.",
      "  --dry-run                Validate stage/dependencies/safety; no execution, no status mutation.",
      "  --allow-writes           Enables workspace-write builder execution (uses existing write-safety gates).",
      "  --stream-codex           Streams Codex output during planner/builder/reviewer execution.",
      "  --auto-commit            Rejected in SP-7. Auto-commit is only supported with accept-stage.",
      "",
      "Notes:",
      "  - Runs planner, builder, reviewer, checks for one stage only.",
      "  - Updates successful stage status to review_required.",
      "  - Persists stage-plan.json and regenerates stage-plan.md.",
      "  - No multi-stage continuation and no auto-commit."
    ].join("\n");
  }

  if (command === "run-stages") {
    return [
      "Usage: agent-stage run-stages --stage-plan <path> --config <config-path> --stop-after-each-stage [--allow-writes] [--dry-run] [--verbose] [--stream-codex]",
      "",
      "Runs exactly one next stage from an imported stage plan and stops at review_required.",
      "",
      "Options:",
      "  --stage-plan <path>         Required path to stage-plan.json.",
      "  --config <config-path>      Required execution config path.",
      "  --stop-after-each-stage     Required in SP-5; no full chaining yet.",
      "  --dry-run                   Validate plan/dependencies and print selected stage only.",
      "  --allow-writes              Enables workspace-write builder execution (uses existing write-safety gates).",
      "  --stream-codex              Streams Codex output during planner/builder/reviewer execution.",
      "  --auto-commit               Rejected in SP-7. Auto-commit is only supported with accept-stage."
    ].join("\n");
  }

  if (command === "continue-stages") {
    return [
      "Usage: agent-stage continue-stages --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]",
      "",
      "Continues stage progression by running exactly one next stage when gates are satisfied.",
      "",
      "Options:",
      "  --stage-plan <path>         Required path to stage-plan.json.",
      "  --config <config-path>      Required execution config path.",
      "  --dry-run                   Validate progression gates and print selected stage only.",
      "  --allow-writes              Enables workspace-write builder execution (uses existing write-safety gates).",
      "  --stream-codex              Streams Codex output during planner/builder/reviewer execution.",
      "  --auto-commit               Rejected in SP-7. Auto-commit is only supported with accept-stage."
    ].join("\n");
  }

  if (command === "accept-stage") {
    return [
      "Usage: agent-stage accept-stage <stage-id> --stage-plan <path> [--auto-commit] [--commit-message <text>]",
      "",
      "Accepts a single stage after human review with no execution.",
      "",
      "Options:",
      "  --stage-plan <path>      Required path to stage-plan.json.",
      "  --auto-commit            Commit accepted stage changes and mark stage committed (SP-7 explicit opt-in).",
      "  --commit-message <text>  Optional custom commit message (requires --auto-commit).",
      "",
      "Notes:",
      "  - Allowed only from review_required or passed.",
      "  - Persists stage-plan.json and regenerates stage-plan.md.",
      "  - Does not execute planner/builder/reviewer.",
      "  - With --auto-commit: requires git, non-empty diff, and scope include/exclude validation.",
      "  - run-stage/run-stages/continue-stages reject --auto-commit in SP-7.",
      "  - Committed stages must use later correction-stage flow; no in-place rewrite."
    ].join("\n");
  }

  if (command === "fix-stage") {
    return [
      "Usage: agent-stage fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--reassess-downstream] [--allow-writes] [--verbose] [--stream-codex]",
      "",
      "Runs a single-stage fix workflow from human feedback.",
      "",
      "Options:",
      "  --stage-plan <path>      Required path to stage-plan.json.",
      "  --config <config-path>   Required execution config path.",
      "  --feedback <text>        Required human feedback for the selected stage.",
      "  --reassess-downstream    Reassess downstream stages after successful fix-stage completion.",
      "  --allow-writes           Enables workspace-write builder execution (uses existing write-safety gates).",
      "  --stream-codex           Streams Codex output during planner/builder/reviewer execution.",
      "",
      "Notes:",
      "  - Refuses committed stages and stages with commitSha.",
      "  - Writes stage feedback artefact under stage artefacts directory.",
      "  - Sets stage to fixing during execution.",
      "  - On success increments revision and returns stage to review_required.",
      "  - No multi-stage continuation and no auto-commit."
    ].join("\n");
  }

  if (command === "reassess-stage-plan") {
    return [
      "Usage: agent-stage reassess-stage-plan --stage-plan <path> --from <stage-id> --config <config-path> [--dry-run]",
      "",
      "Classifies downstream stages after a source stage revision.",
      "",
      "Options:",
      "  --stage-plan <path>      Required path to stage-plan.json.",
      "  --from <stage-id>        Required source stage id.",
      "  --config <config-path>   Required execution config path.",
      "  --dry-run                Validate and list downstream targets only; no model execution, no writes."
    ].join("\n");
  }

  return [
    "Usage: agent-stage <command> [options]",
    "",
    "Commands:",
    "  run <stage-name> --config <config-path> [options]",
    "  continue-run <run-id> --config <config-path> [options]",
    "  list-runs --config <config-path>",
    "  show-run <run-id> --config <config-path>",
    "  open-run <run-id> --config <config-path>",
    "  report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]",
    "  init-project <name> --workspace <path> [--force] [--verbose]",
    "  check-write-safety --config <config-path>",
    "  probe-opencode [--config <config-path>] [--backend <name>] [--command <command>] [--json] [--validate-readonly-contract]",
    "  import-stage-plan --from <path> --out <path> [--force]",
    "  run-stage <stage-id> --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]",
    "  run-stages --stage-plan <path> --config <config-path> --stop-after-each-stage [--allow-writes] [--dry-run] [--verbose] [--stream-codex]",
    "  continue-stages --stage-plan <path> --config <config-path> [--allow-writes] [--dry-run] [--verbose] [--stream-codex]",
    "  accept-stage <stage-id> --stage-plan <path> [--auto-commit] [--commit-message <text>]",
    "  fix-stage <stage-id> --stage-plan <path> --config <config-path> --feedback <text> [--reassess-downstream] [--allow-writes] [--verbose] [--stream-codex]",
    "  reassess-stage-plan --stage-plan <path> --from <stage-id> --config <config-path> [--dry-run]",
    "",
    "Use \"agent-stage <command> --help\" for command details.",
    "",
    "Safety defaults:",
    "  - Codex runs in read-only sandbox.",
    "  - No auto-commit or auto-push.",
    "  - Write-enabled execution requires explicit --allow-writes and write-safety pass."
  ].join("\n");
}


export async function defaultOpenRunDirectory(runDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("open", [runDir], { stdio: "ignore", shell: false });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to open run directory with open. code=${code ?? "null"} signal=${signal ?? "null"}`));
      }
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith("cli.js")) {
  void main();
}
