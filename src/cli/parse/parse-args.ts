import type { ParsedArgs } from "../types.js";
import { parseCommandPositionals } from "./parse-command-positionals.js";
import { parseSharedFlags } from "./parse-shared-flags.js";
import { validateParsedArgs } from "./validate-parsed-args.js";

export function parseArgs(argv: string[]): ParsedArgs {
  const [command] = argv;
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
    reassessDownstream: false,
    autoCommit: false
  };

  if (command === "--help" || command === "-h") {
    parsed.command = undefined;
    parsed.help = true;
    return parsed;
  }

  if (!command) {
    if (argv.length === 0) {
      throw new Error(`Missing command.\n\n${renderTopLevelHelpText()}`);
    }
    if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
      parsed.help = true;
      return parsed;
    }
  }

  const [, firstArg] = argv;
  if (command && (firstArg === "--help" || firstArg === "-h")) {
    parsed.help = true;
    return parsed;
  }

  const { rest } = parseCommandPositionals(argv, parsed);
  parseSharedFlags(parsed, rest);
  validateParsedArgs(parsed);

  return parsed;
}

function renderTopLevelHelpText(): string {
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
    "  tui",
    "  tui-spike",
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
