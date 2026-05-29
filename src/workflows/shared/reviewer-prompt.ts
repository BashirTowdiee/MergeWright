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
  const stageAcceptanceCriteria =
    input.baseVariables.stage_acceptance_criteria || extractAcceptanceCriteriaFromStageInstruction(input.baseVariables.stage_instruction);

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
    stage_acceptance_criteria: stageAcceptanceCriteria,
    write_audit_context: input.writeAuditContext,
    test_output: input.testOutput,
    git_diff: input.gitDiff,
    git_status: input.gitStatus
  };
}

export function renderReviewerPromptTemplate(input: ReviewerPromptTemplateInput): string {
  return renderTemplate(input.template, buildReviewerPromptVariables(input));
}

function extractAcceptanceCriteriaFromStageInstruction(stageInstruction: string | undefined): string {
  if (!stageInstruction) {
    return "- [not available]";
  }

  const lines = stageInstruction.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^#{1,6}\s*Acceptance Criteria\s*$/i.test(line.trim()));
  if (headingIndex === -1) {
    return "- [not available]";
  }

  const criteria: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^#{1,6}\s+\S/.test(line)) {
      break;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      criteria.push(`- ${bullet[1].trim()}`);
      continue;
    }
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      criteria.push(`- ${numbered[1].trim()}`);
    }
  }

  return criteria.length > 0 ? criteria.join("\n") : "- [not available]";
}
