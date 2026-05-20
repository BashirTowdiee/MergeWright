import { assertBoolean, assertNumber, assertObject, assertString } from "../validation.js";
import { parseAgents } from "./parse-agents.js";
import { parseChangeReportPolicy } from "./parse-change-report-policy.js";
import { parseCheckCommands } from "./parse-check-commands.js";
import { parseExecutionBackends } from "./parse-execution-backends.js";
import { parseSafety } from "./parse-safety.js";
import type { OrchestratorConfig } from "./types.js";
import { parseWriteSafety } from "./parse-write-safety.js";

export function validateConfig(input: unknown): OrchestratorConfig {
  const root = assertObject(input, "root");

  if (root.codex != null) {
    throw new Error("Invalid config: legacy codex config is no longer supported. Use executionBackends and agents.");
  }

  const paths = assertObject(root.paths, "paths");
  const pipeline = assertObject(root.pipeline, "pipeline");
  const commands = assertObject(root.commands, "commands");
  const safety = assertObject(root.safety, "safety");
  const writeSafety = root.writeSafety == null ? {} : assertObject(root.writeSafety, "writeSafety");
  const changeReport = root.changeReport == null ? {} : assertObject(root.changeReport, "changeReport");

  const executionBackends = parseExecutionBackends(root.executionBackends);
  const agents = parseAgents(root.agents, executionBackends);

  return {
    version: assertNumber(root.version, "version"),
    projectName: assertString(root.projectName, "projectName"),
    workspaceRoot: assertString(root.workspaceRoot, "workspaceRoot"),
    paths: {
      stagesDir: assertString(paths.stagesDir, "paths.stagesDir"),
      promptsDir: assertString(paths.promptsDir, "paths.promptsDir"),
      runsDir: assertString(paths.runsDir, "paths.runsDir")
    },
    executionBackends,
    agents,
    pipeline: {
      finalReview: assertBoolean(pipeline.finalReview, "pipeline.finalReview"),
      maxFixLoops: assertNumber(pipeline.maxFixLoops, "pipeline.maxFixLoops")
    },
    commands: {
      checks: parseCheckCommands(commands.checks, "commands.checks")
    },
    safety: parseSafety(safety),
    writeSafety: parseWriteSafety(writeSafety),
    changeReport: parseChangeReportPolicy(changeReport)
  };
}
