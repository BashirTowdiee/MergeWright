import type { AutoChainExecutionOptions, AutoChainFinalStatus, AutoChainFixDecision } from "../../auto-chain.js";
import type { ReviewerVerdict } from "../../reviewer-output.js";
import type { ReviewToFixDecision } from "../../review-to-fix-output.js";

export function shouldRunChecksAfterInitialVerdict(reviewerVerdict: ReviewerVerdict, fixDecision: AutoChainFixDecision): boolean {
  return reviewerVerdict === "PASS" || fixDecision === "PROCEED";
}

export function classifyFixRequiredWithoutAttempt(options: Pick<AutoChainExecutionOptions, "maxFixAttempts" | "allowWrites">): AutoChainFinalStatus {
  if (options.maxFixAttempts === 0) {
    return "MAX_FIX_ATTEMPTS_REACHED";
  }
  if (!options.allowWrites) {
    return "NEEDS_FIX_WRITE_DISABLED";
  }
  return "NEEDS_FIX";
}

export function resolveUnresolvedFinalStatus(input: {
  pendingFixDecision: ReviewToFixDecision;
  attemptsUsed: number;
  maxFixAttempts: number;
}): AutoChainFinalStatus {
  if (input.pendingFixDecision !== "FIX_REQUIRED") {
    return "NEEDS_FIX";
  }
  if (input.attemptsUsed >= input.maxFixAttempts) {
    return "MAX_FIX_ATTEMPTS_REACHED";
  }
  return "NEEDS_FIX";
}
