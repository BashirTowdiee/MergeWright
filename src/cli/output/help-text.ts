export function renderHelpText(command?: string): string {
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

  if (command === "prove") {
    return [
      "Usage: agent-stage prove <run-id> --config <config-path> [--json] [--verbose]",
      "",
      "Computes read-only merge-readiness proof for an existing run.",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --json                   Prints JSON-only proof wrapper to stdout (machine-readable).",
      "",
      "Notes:",
      "  - Does not execute Codex.",
      "  - Does not run checks.",
      "  - Does not mutate target workspace.",
      "  - Does not write report artefacts.",
      "  - Exits 0 only when readiness status is READY."
    ].join("\n");
  }

  if (command === "review-modes") {
    return [
      "Usage: agent-stage review-modes <run-id> --config <config-path> [--modes architecture,tests,regression,security,docs,maintainability] [--json] [--verbose]",
      "",
      "Runs focused read-only assurance reviews against an existing run report.",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --modes <csv>            Optional. Comma-separated subset of: architecture, tests, regression, security, docs, maintainability.",
      "  --json                   Prints JSON-only mode-review payload to stdout (machine-readable).",
      "",
      "Notes:",
      "  - Does not execute Codex.",
      "  - Does not run checks.",
      "  - Does not mutate target workspace.",
      "  - Does not write report artefacts.",
      "  - Exits 0 only when all selected mode verdicts are PASS."
    ].join("\n");
  }

  if (command === "compare-runs") {
    return [
      "Usage: agent-stage compare-runs <run-id-a> <run-id-b> --config <config-path> [--json] [--verbose]",
      "",
      "Compares two read-only run readiness reports using existing run artefacts.",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --json                   Prints JSON-only comparison payload to stdout (machine-readable).",
      "",
      "Notes:",
      "  - Does not execute Codex.",
      "  - Does not run checks.",
      "  - Does not mutate target workspace.",
      "  - Does not write report artefacts.",
      "  - Missing evidence is explicitly reported per run."
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

  if (command === "backfill-evidence") {
    return [
      "Usage: agent-stage backfill-evidence <run-id> --config <config-path> [--dry-run] [--verbose]",
      "",
      "Backfills evidence.json for an existing run from existing run artefacts.",
      "  --config <config-path>   Required. No implicit default is used.",
      "  --dry-run                Preview the evidence manifest without writing evidence.json.",
      "",
      "Notes:",
      "  - Does not execute Codex.",
      "  - Does not run checks.",
      "  - Does not mutate target workspace.",
      "  - Writes only evidence.json inside the selected run directory unless --dry-run is used."
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

  if (command === "run-contract") {
    return [
      "Usage: agent-stage run-contract --goal <text> --workspace <path> [--flow <name>] [--dry-run]",
      "",
      "Runs the audited workflow runner slice with a deterministic no-write executor.",
      "  --goal <text>            Required run goal used to build the example contract.",
      "  --workspace <path>       Required workspace path recorded in the contract.",
      "  --flow <name>            Optional flow name. Defaults to feature-standard.",
      "  --dry-run                Marks the run as dry-run while still writing audited artefacts.",
      "",
      "Notes:",
      "  - Writes artefacts under .artifacts/runs/audited-flow/<run-id>/.",
      "  - Does not require --config.",
      "  - Does not enable workspace writes."
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
    "  compare-runs <run-id-a> <run-id-b> --config <config-path> [--json] [--verbose]",
    "  prove <run-id> --config <config-path> [--json] [--verbose]",
    "  review-modes <run-id> --config <config-path> [--modes architecture,tests,regression,security,docs,maintainability] [--json] [--verbose]",
    "  report-run <run-id> --config <config-path> [--json] [--pr-summary] [--stdout-only] [--force] [--verbose]",
    "  backfill-evidence <run-id> --config <config-path> [--dry-run] [--verbose]",
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
