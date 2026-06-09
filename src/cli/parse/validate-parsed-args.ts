import { resolvePipelinePreset } from "../../presets.js";
import type { ParsedArgs } from "../types.js";

export function validateParsedArgs(parsed: ParsedArgs): void {
  if (parsed.command === "tui") {
    if (parsed.repoOverride || parsed.workspaceArg) {
      throw new Error("tui does not accept --repo or --workspace.");
    }
    return;
  }
  if (parsed.command === "tui-spike") {
    if (parsed.configArg || parsed.repoOverride || parsed.workspaceArg) {
      throw new Error("tui-spike does not accept --config, --repo, or --workspace.");
    }
    return;
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
  if ((parsed.prSummary || parsed.stdoutOnly) && parsed.command !== "report-run") {
    throw new Error("--pr-summary and --stdout-only are only supported for report-run.");
  }
  if (
    parsed.jsonOutput &&
    parsed.command !== "report-run" &&
    parsed.command !== "probe-opencode" &&
    parsed.command !== "prove" &&
    parsed.command !== "compare-runs" &&
    parsed.command !== "review-modes"
  ) {
    throw new Error("--json is supported for report-run, prove, compare-runs, review-modes, and probe-opencode.");
  }
  if (parsed.modesArg && parsed.command !== "review-modes") {
    throw new Error("--modes is only supported for review-modes.");
  }
  if (parsed.command === "report-run" && parsed.jsonOutput && parsed.prSummary && parsed.stdoutOnly) {
    throw new Error(
      "--json cannot be combined with --pr-summary and --stdout-only because stdout can contain only one machine-readable format."
    );
  }
  if (parsed.command !== "probe-opencode" && (parsed.backendName || parsed.opencodeCommand || parsed.validateReadonlyContract)) {
    throw new Error("--backend, --command, and --validate-readonly-contract are only supported for probe-opencode.");
  }
  if (parsed.goalArg && parsed.command !== "run-contract") {
    throw new Error("--goal is only supported for run-contract.");
  }
  if (parsed.flowArg && parsed.command !== "run-contract") {
    throw new Error("--flow is only supported for run-contract.");
  }

  if (parsed.command === "run") {
    if (parsed.help) {
      return;
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
      return;
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
      return;
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
      return;
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
      return;
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
  if (parsed.command === "prove") {
    if (parsed.help) {
      return;
    }
    if (!parsed.runId) {
      throw new Error("prove requires <run-id>. Usage: agent-stage prove <run-id> --config <config-path> [--json] [--verbose]");
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
    if (parsed.workspaceArg) {
      throw new Error("--workspace is not supported for prove.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for prove.");
    }
    if (parsed.force) {
      throw new Error("--force is not supported for prove.");
    }
  }
  if (parsed.command === "compare-runs") {
    if (parsed.help) {
      return;
    }
    if (!parsed.runId || !parsed.compareRunId) {
      throw new Error(
        "compare-runs requires <run-id-a> and <run-id-b>. Usage: agent-stage compare-runs <run-id-a> <run-id-b> --config <config-path> [--json] [--verbose]"
      );
    }
    if (parsed.runId === parsed.compareRunId) {
      throw new Error("compare-runs requires two distinct run ids.");
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
    if (parsed.workspaceArg) {
      throw new Error("--workspace is not supported for compare-runs.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for compare-runs.");
    }
    if (parsed.force) {
      throw new Error("--force is not supported for compare-runs.");
    }
  }
  if (parsed.command === "review-modes") {
    if (parsed.help) {
      return;
    }
    if (!parsed.runId) {
      throw new Error(
        "review-modes requires <run-id>. Usage: agent-stage review-modes <run-id> --config <config-path> [--modes architecture,tests,regression,security,docs,maintainability] [--json] [--verbose]"
      );
    }
    if (!parsed.configArg) {
      throw new Error("Missing required --config <config-path>. No implicit default is used.");
    }
    if (parsed.workspaceArg) {
      throw new Error("--workspace is not supported for review-modes.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for review-modes.");
    }
    if (parsed.force) {
      throw new Error("--force is not supported for review-modes.");
    }
  }
  if (parsed.command === "probe-opencode") {
    if (parsed.help) {
      return;
    }
    if (parsed.stdoutOnly || parsed.prSummary) {
      throw new Error("--pr-summary and --stdout-only are not supported for probe-opencode.");
    }
  }
  if (parsed.command === "run-contract") {
    if (parsed.help) {
      return;
    }
    if (!parsed.goalArg?.trim()) {
      throw new Error("run-contract requires --goal <text>.");
    }
    if (!parsed.workspaceArg?.trim()) {
      throw new Error("run-contract requires --workspace <path>.");
    }
    if (parsed.configArg) {
      throw new Error("--config is not supported for run-contract.");
    }
    if (parsed.repoOverride) {
      throw new Error("--repo is not supported for run-contract.");
    }
    if (parsed.force) {
      throw new Error("--force is not supported for run-contract.");
    }
  }
  if (parsed.command === "import-stage-plan") {
    if (parsed.help) {
      return;
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
      return;
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
      return;
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
      return;
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
      return;
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
      return;
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
      return;
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
}
