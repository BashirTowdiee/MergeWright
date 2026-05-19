import type { TemplateVariables } from "../../prompts.js";
import type { OrchestratorConfig } from "../../config.js";
import type { CodexExecutor } from "../../codex.js";
import type { RunOptions } from "../../runner.js";

export interface ClassicRunExecutionOptions {
  executePlanner: boolean;
  executeBuilder: boolean;
  executeReviewer: boolean;
  planFix: boolean;
  executeFix: boolean;
  runChecks: boolean;
  allowWrites: boolean;
  writeEnabledPhases: Array<"builder" | "fix">;
}

export interface ClassicRunContext {
  orchestratorRoot: string;
  configPath: string;
  config: OrchestratorConfig;
  executor: CodexExecutor;
  targetWorkspaceRoot: string;
  stagesDir: string;
  promptsDir: string;
  runsBaseDir: string;
  stagePath: string;
  stageInstruction: string;
  templates: Record<string, string>;
  timestamp: string;
  runId: string;
  runDir: string;
  variables: TemplateVariables;
}

export function resolveClassicRunExecutionOptions(options: RunOptions): ClassicRunExecutionOptions {
  const executePlanner = options.executePlanner ?? false;
  const executeBuilder = options.executeBuilder ?? false;
  const executeReviewer = options.executeReviewer ?? false;
  const planFix = options.planFix ?? false;
  const executeFix = options.executeFix ?? false;
  const runChecks = options.runChecks ?? false;
  const allowWrites = options.allowWrites ?? false;
  const writeEnabledPhases: Array<"builder" | "fix"> = [
    ...(executeBuilder ? (["builder"] as const) : []),
    ...(executeFix ? (["fix"] as const) : [])
  ];

  return {
    executePlanner,
    executeBuilder,
    executeReviewer,
    planFix,
    executeFix,
    runChecks,
    allowWrites,
    writeEnabledPhases
  };
}

export function buildTemplateVariables(input: {
  stageName: string;
  stageInstruction: string;
  timestamp: string;
  workspaceRoot: string;
  runDir: string;
}): TemplateVariables {
  return {
    stage_name: input.stageName,
    stage_instruction: input.stageInstruction,
    timestamp: input.timestamp,
    workspace_root: input.workspaceRoot,
    run_dir: input.runDir,
    git_status: "[placeholder: git status skipped in current stage]",
    builder_output: "[placeholder: builder output skipped in current stage]",
    test_output: "[placeholder: test output skipped in current stage]",
    git_diff: "[placeholder: git diff skipped in current stage]",
    review_output: "[placeholder: review output skipped in current stage]"
  };
}
