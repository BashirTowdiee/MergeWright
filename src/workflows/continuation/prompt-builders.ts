import path from "node:path";
import { renderTemplate, type TemplateVariables } from "../../prompts.js";
import type { RunMetadata } from "../../run-metadata.js";
import { renderReviewerPromptTemplate } from "../shared/reviewer-prompt.js";
import { buildWriteAuditContext } from "../shared/write-audit-context.js";
import { readText } from "./artefact-io.js";

export async function renderReviewerPromptForContinuation(template: string, metadata: RunMetadata, runDir: string): Promise<string> {
  const stageInstruction = await readText(path.resolve(runDir, "01-stage-input.md"), "");
  const plannerPrompt = await readText(path.resolve(runDir, "02-rendered-planner-prompt.md"), "[not available]");
  const plannerOutput = await readText(path.resolve(runDir, "06-planner-output-last-message.md"), "[not available]");
  const extractedBuilderPrompt = await readText(path.resolve(runDir, "builder-prompt.extracted.md"), "[not available]");
  const builderOutput = await readText(path.resolve(runDir, "builder-output-last-message.md"), "[not available]");
  const builderStdout = await readText(path.resolve(runDir, "builder-stdout.log"), "[not available]");
  const builderStderr = await readText(path.resolve(runDir, "builder-stderr.log"), "[not available]");
  const builderExit = await readText(path.resolve(runDir, "builder-exit.json"), "[not available]");
  const builderExecuted = metadata.phases.builder.status === "executed";

  const variables: TemplateVariables = {
    stage_name: metadata.stageName,
    stage_instruction: stageInstruction,
    timestamp: metadata.startedAt,
    workspace_root: metadata.workspaceRoot,
    run_dir: runDir
  };
  return renderReviewerPromptTemplate({
    template,
    baseVariables: variables,
    plannerPrompt,
    plannerOutput,
    extractedBuilderPrompt,
    builderOutput,
    builderStdout,
    builderStderr,
    builderExit,
    builderWasExecuted: builderExecuted,
    stageExecutionScope:
      "Stage E scope: review-to-fix loop, git commands, and test/build execution are all disabled and must remain unexecuted.",
    writeAuditContext: buildWriteAuditContext(metadata),
    testOutput: "[placeholder: test output skipped in Stage E]",
    gitDiff: "[placeholder: git diff skipped in Stage E]",
    gitStatus: "[placeholder: git status skipped in Stage E]"
  });
}

export async function renderReviewToFixPromptForContinuation(template: string, metadata: RunMetadata, runDir: string): Promise<string> {
  const stageInstruction = await readText(path.resolve(runDir, "01-stage-input.md"), "");
  const plannerOutput = await readText(path.resolve(runDir, "06-planner-output-last-message.md"), "[not available]");
  const extractedBuilderPrompt = await readText(path.resolve(runDir, "builder-prompt.extracted.md"), "[not available]");
  const builderOutput = await readText(path.resolve(runDir, "builder-output-last-message.md"), "[not available]");
  const reviewOutput = await readText(path.resolve(runDir, "reviewer-output-last-message.md"), "[not available]");
  const reviewerExit = await readText(path.resolve(runDir, "reviewer-exit.json"), "[not available]");
  return renderTemplate(template, {
    stage_name: metadata.stageName,
    stage_instruction: stageInstruction,
    timestamp: metadata.startedAt,
    workspace_root: metadata.workspaceRoot,
    run_dir: runDir,
    planner_output: plannerOutput,
    extracted_builder_prompt: extractedBuilderPrompt,
    builder_output: builderOutput,
    review_output: reviewOutput,
    reviewer_exit: reviewerExit,
    git_status: "[placeholder: git status skipped in current stage]",
    test_output: "[placeholder: test output skipped in current stage]",
    git_diff: "[placeholder: git diff skipped in current stage]"
  });
}
