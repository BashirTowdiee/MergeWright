export function createInitialClassicRunArtefacts(input: {
  stageInstruction: string;
  renderedPlannerPrompt: string;
  finalReviewPromptPreview: string;
  allowWrites: boolean;
  writeEnabledPhases: Array<"builder" | "fix">;
  dryRun: boolean;
  postWriteReviewReason: string;
  postWriteReviewRequiredByPhases: string[];
}): Record<string, string> {
  const artefacts: Record<string, string> = {
    "01-stage-input.md": input.stageInstruction,
    "02-rendered-planner-prompt.md": input.renderedPlannerPrompt,
    "10-final-review-prompt.preview.md": input.finalReviewPromptPreview
  };

  if (input.allowWrites && input.writeEnabledPhases.length > 0) {
    if (!input.dryRun) {
      artefacts["post-write-review-required.json"] = JSON.stringify(
        {
          required: true,
          reason: input.postWriteReviewReason,
          requiredByPhases: input.postWriteReviewRequiredByPhases
        },
        null,
        2
      );
      artefacts["post-write-review-status.json"] = JSON.stringify({ status: "pending", reason: "awaiting reviewer execution" }, null, 2);
    } else {
      artefacts["post-write-review-status.json"] = JSON.stringify(
        { status: "not-required", reason: "dryRun=true; post-write review would be required when writes execute" },
        null,
        2
      );
    }
  }

  return artefacts;
}
