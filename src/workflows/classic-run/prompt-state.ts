import { renderTemplate, type TemplateVariables } from "../../prompts.js";
import { renderReviewerPromptTemplate } from "../shared/reviewer-prompt.js";
import { buildWriteAuditContext } from "../shared/write-audit-context.js";
import type { RunMetadata } from "../../run-metadata.js";

interface ExecutionMetadata {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  success: boolean;
  skipped: boolean;
}

export interface ClassicPromptState {
  refreshReviewerPreview(builderWasExecuted: boolean): void;
  renderReviewToFixPrompt(): string;
  getExtractedBuilderPrompt(): string;
  setPlannerParsed(plannerOutputLastMessage: string, extractedBuilderPrompt: string): void;
  setBuilderCompleted(output: string, executionMetadata: ExecutionMetadata): void;
  setReviewerCompleted(output: string, executionMetadata: ExecutionMetadata): void;
}

export function createClassicPromptState(input: {
  templates: Record<string, string>;
  variables: TemplateVariables;
  renderedPlanner: string;
  metadata: RunMetadata;
  artefacts: Record<string, string>;
}): ClassicPromptState {
  let plannerOutputLastMessage = "";
  let extractedBuilderPrompt = "";
  let builderOutputLastMessage = "";
  let reviewerOutputLastMessage = "";
  let builderExecutionMetadata: ExecutionMetadata | null = null;
  let reviewerExecutionMetadata: ExecutionMetadata | null = null;

  const refreshReviewerPreview = (builderWasExecuted: boolean): void => {
    input.artefacts["08-reviewer-prompt.preview.md"] = renderReviewerPromptTemplate({
      template: input.templates["reviewer.md"],
      baseVariables: input.variables,
      plannerPrompt: input.renderedPlanner,
      plannerOutput: plannerOutputLastMessage,
      extractedBuilderPrompt,
      builderOutput: builderOutputLastMessage,
      builderStdout: builderExecutionMetadata?.stdout ?? "[not available]",
      builderStderr: builderExecutionMetadata?.stderr ?? "[not available]",
      builderExit: builderExecutionMetadata
        ? JSON.stringify(
            {
              success: builderExecutionMetadata.success,
              code: builderExecutionMetadata.exitCode,
              signal: builderExecutionMetadata.signal,
              durationMs: builderExecutionMetadata.durationMs,
              skipped: builderExecutionMetadata.skipped
            },
            null,
            2
          )
        : "[not available]",
      builderWasExecuted,
      stageExecutionScope:
        "Stage E scope: review-to-fix loop, git commands, and test/build execution are all disabled and must remain unexecuted.",
      writeAuditContext: buildWriteAuditContext(input.metadata),
      testOutput: "[placeholder: test output skipped in Stage E]",
      gitDiff: "[placeholder: git diff skipped in Stage E]",
      gitStatus: "[placeholder: git status skipped in Stage E]"
    });
  };

  const renderReviewToFixPrompt = (): string =>
    renderTemplate(input.templates["review-to-fix.md"], {
      ...input.variables,
      planner_output: plannerOutputLastMessage || "[not available]",
      extracted_builder_prompt: extractedBuilderPrompt || "[not available]",
      builder_output: builderOutputLastMessage || "[not available]",
      review_output: reviewerOutputLastMessage || "[not available]",
      reviewer_exit: reviewerExecutionMetadata
        ? JSON.stringify(
            {
              success: reviewerExecutionMetadata.success,
              code: reviewerExecutionMetadata.exitCode,
              signal: reviewerExecutionMetadata.signal,
              durationMs: reviewerExecutionMetadata.durationMs,
              skipped: reviewerExecutionMetadata.skipped
            },
            null,
            2
          )
        : "[not available]"
    });

  return {
    refreshReviewerPreview,
    renderReviewToFixPrompt,
    getExtractedBuilderPrompt: () => extractedBuilderPrompt,
    setPlannerParsed: (plannerOutput, builderPrompt) => {
      plannerOutputLastMessage = plannerOutput;
      extractedBuilderPrompt = builderPrompt;
    },
    setBuilderCompleted: (output, executionMetadata) => {
      builderOutputLastMessage = output;
      builderExecutionMetadata = executionMetadata;
    },
    setReviewerCompleted: (output, executionMetadata) => {
      reviewerOutputLastMessage = output;
      reviewerExecutionMetadata = executionMetadata;
    }
  };
}
