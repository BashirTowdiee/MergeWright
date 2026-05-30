import type { PipelinePreset } from "../../presets.js";
import type { ParsedArgs } from "../types.js";

export function parseSharedFlags(parsed: ParsedArgs, rest: string[]): void {
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
    if (token === "--modes") {
      const value = rest[i + 1];
      if (!value) {
        throw new Error("Missing value for --modes");
      }
      parsed.modesArg = value;
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
}
