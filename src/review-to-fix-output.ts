export type ReviewToFixDecision = "PROCEED" | "FIX_REQUIRED";

export interface ParsedReviewToFixOutput {
  decision: ReviewToFixDecision;
  rationale: string;
  finalFixPrompt?: string;
}

const DECISION_HEADING = "## DECISION";
const RATIONALE_HEADING = "## RATIONALE";
const FINAL_FIX_PROMPT_HEADING = "## FINAL FIX PROMPT";

export function parseReviewToFixOutput(raw: string): ParsedReviewToFixOutput {
  const lines = raw.split(/\r?\n/);

  const decisionHeadingIndices = findHeadingIndices(lines, DECISION_HEADING);
  const rationaleHeadingIndices = findHeadingIndices(lines, RATIONALE_HEADING);
  const finalFixPromptHeadingIndices = findHeadingIndices(lines, FINAL_FIX_PROMPT_HEADING);

  if (decisionHeadingIndices.length === 0) {
    throw new Error('Review-to-fix output parse error: missing required heading "## DECISION".');
  }
  if (decisionHeadingIndices.length > 1) {
    throw new Error('Review-to-fix output parse error: duplicate heading "## DECISION".');
  }
  if (rationaleHeadingIndices.length === 0) {
    throw new Error('Review-to-fix output parse error: missing required heading "## RATIONALE".');
  }
  if (rationaleHeadingIndices.length > 1) {
    throw new Error('Review-to-fix output parse error: duplicate heading "## RATIONALE".');
  }
  if (finalFixPromptHeadingIndices.length > 1) {
    throw new Error('Review-to-fix output parse error: duplicate heading "## FINAL FIX PROMPT".');
  }

  const decisionHeadingIndex = decisionHeadingIndices[0];
  const rationaleHeadingIndex = rationaleHeadingIndices[0];
  const finalFixPromptHeadingIndex = finalFixPromptHeadingIndices[0] ?? -1;

  if (rationaleHeadingIndex < decisionHeadingIndex) {
    throw new Error(
      'Review-to-fix output parse error: heading order invalid; "## RATIONALE" appears before "## DECISION".'
    );
  }
  if (finalFixPromptHeadingIndex !== -1 && finalFixPromptHeadingIndex < rationaleHeadingIndex) {
    throw new Error(
      'Review-to-fix output parse error: heading order invalid; "## FINAL FIX PROMPT" appears before "## RATIONALE".'
    );
  }

  const decisionSectionEnd = rationaleHeadingIndex;
  const decisionSection = lines.slice(decisionHeadingIndex + 1, decisionSectionEnd);
  const decision = parseDecisionLine(decisionSection);

  const rationaleSectionEnd = finalFixPromptHeadingIndex === -1 ? lines.length : finalFixPromptHeadingIndex;
  const rationale = lines.slice(rationaleHeadingIndex + 1, rationaleSectionEnd).join("\n").trim();
  if (!rationale) {
    throw new Error("Review-to-fix output parse error: RATIONALE is empty.");
  }

  if (decision === "PROCEED") {
    if (finalFixPromptHeadingIndex !== -1) {
      const finalFixPrompt = lines.slice(finalFixPromptHeadingIndex + 1).join("\n").trim();
      if (finalFixPrompt.length > 0) {
        throw new Error("Review-to-fix output parse error: FINAL FIX PROMPT must be empty or omitted when DECISION is PROCEED.");
      }
    }
    return { decision, rationale };
  }

  if (finalFixPromptHeadingIndex === -1) {
    throw new Error('Review-to-fix output parse error: missing required heading "## FINAL FIX PROMPT" for FIX_REQUIRED decision.');
  }

  const finalFixPrompt = lines.slice(finalFixPromptHeadingIndex + 1).join("\n").trim();
  if (!finalFixPrompt) {
    throw new Error("Review-to-fix output parse error: FINAL FIX PROMPT is empty for FIX_REQUIRED decision.");
  }

  return {
    decision,
    rationale,
    finalFixPrompt
  };
}

function parseDecisionLine(decisionSection: string[]): ReviewToFixDecision {
  const firstNonEmptyIndex = decisionSection.findIndex((line) => line.trim().length > 0);
  const decisionLine = firstNonEmptyIndex === -1 ? "" : decisionSection[firstNonEmptyIndex].trim();

  if (decisionLine !== "PROCEED" && decisionLine !== "FIX_REQUIRED") {
    throw new Error(`Review-to-fix output parse error: unsupported decision "${decisionLine}".`);
  }

  for (let i = firstNonEmptyIndex + 1; i < decisionSection.length; i += 1) {
    if (decisionSection[i].trim().length > 0) {
      throw new Error("Review-to-fix output parse error: extra unexpected content in DECISION section.");
    }
  }

  return decisionLine;
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
