import { renderTemplate, type TemplateVariables } from "../../prompts.js";

export interface ReviewerPromptTemplateInput {
  template: string;
  baseVariables: TemplateVariables;
  plannerPrompt: string;
  plannerOutput: string;
  extractedBuilderPrompt: string;
  builderOutput: string;
  builderStdout: string;
  builderStderr: string;
  builderExit: string;
  builderWasExecuted: boolean;
  stageExecutionScope: string;
  writeAuditContext: string;
  testOutput: string;
  gitDiff: string;
  gitStatus: string;
  executedMessage?: string;
  notExecutedMessage?: string;
}

export function buildReviewerPromptVariables(input: ReviewerPromptTemplateInput): TemplateVariables {
  return {
    ...input.baseVariables,
    planner_prompt: input.plannerPrompt || "[not available]",
    planner_output: input.plannerOutput || "[not available]",
    extracted_builder_prompt: input.extractedBuilderPrompt || "[not available]",
    builder_output: input.builderOutput || "[not available]",
    builder_stdout: input.builderStdout || "[not available]",
    builder_stderr: input.builderStderr || "[not available]",
    builder_exit: input.builderExit || "[not available]",
    builder_execution_state: input.builderWasExecuted
      ? (input.executedMessage ?? "Builder executed. Review planner output, extracted builder prompt, and builder execution results.")
      : (input.notExecutedMessage ?? "Builder was not executed in Stage E. Limit review to planner output and extracted builder prompt artefacts."),
    stage_e_execution_scope: input.stageExecutionScope,
    write_audit_context: input.writeAuditContext,
    test_output: input.testOutput,
    git_diff: input.gitDiff,
    git_status: input.gitStatus
  };
}

export function renderReviewerPromptTemplate(input: ReviewerPromptTemplateInput): string {
  return renderTemplate(input.template, buildReviewerPromptVariables(input));
}
