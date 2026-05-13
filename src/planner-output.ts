export interface ParsedPlannerOutput {
  decision: "BUILD";
  finalBuilderPrompt: string;
}

const DECISION_HEADING = "## DECISION";
const BUILDER_PROMPT_HEADING = "## FINAL BUILDER PROMPT";

export function parsePlannerOutput(raw: string): ParsedPlannerOutput {
  const lines = raw.split(/\r?\n/);

  const decisionHeadingIndices = findHeadingIndices(lines, DECISION_HEADING);
  if (decisionHeadingIndices.length === 0) {
    throw new Error('Planner output parse error: missing required heading "## DECISION".');
  }
  if (decisionHeadingIndices.length > 1) {
    throw new Error('Planner output parse error: duplicate heading "## DECISION".');
  }
  const decisionHeadingIndex = decisionHeadingIndices[0];

  const builderPromptHeadingIndices = findHeadingIndices(lines, BUILDER_PROMPT_HEADING);
  if (builderPromptHeadingIndices.length === 0) {
    throw new Error('Planner output parse error: missing required heading "## FINAL BUILDER PROMPT".');
  }
  if (builderPromptHeadingIndices.length > 1) {
    throw new Error('Planner output parse error: duplicate heading "## FINAL BUILDER PROMPT".');
  }
  const builderPromptHeadingIndex = builderPromptHeadingIndices[0];

  if (builderPromptHeadingIndex < decisionHeadingIndex) {
    throw new Error(
      'Planner output parse error: heading order invalid; "## FINAL BUILDER PROMPT" appears before "## DECISION".'
    );
  }

  const decisionSection = lines.slice(decisionHeadingIndex + 1, builderPromptHeadingIndex);
  const decisionSectionFirstNonEmptyIndex = decisionSection.findIndex((line) => line.trim().length > 0);
  const decisionLine = decisionSectionFirstNonEmptyIndex === -1 ? "" : decisionSection[decisionSectionFirstNonEmptyIndex].trim();
  if (decisionLine !== "BUILD") {
    throw new Error(`Planner output parse error: unsupported decision "${decisionLine}"; Stage C supports only BUILD.`);
  }

  for (let i = decisionSectionFirstNonEmptyIndex + 1; i < decisionSection.length; i += 1) {
    if (decisionSection[i].trim().length > 0) {
      throw new Error("Planner output parse error: extra unexpected content in DECISION section.");
    }
  }

  const finalBuilderPrompt = lines.slice(builderPromptHeadingIndex + 1).join("\n").trim();
  if (!finalBuilderPrompt) {
    throw new Error("Planner output parse error: FINAL BUILDER PROMPT is empty.");
  }

  return {
    decision: "BUILD",
    finalBuilderPrompt
  };
}

function findHeadingIndices(lines: string[], heading: string): number[] {
  const matches: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] === heading) {
      matches.push(i);
    }
  }
  return matches;
}
