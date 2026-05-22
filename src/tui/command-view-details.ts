import type { TuiCommandPreviewState } from "./command-preview-state.js";

export type CommandViewDetails = {
  readonly title: string;
  readonly summary: string;
  readonly risk: string;
  readonly confirmation: string;
  readonly state: "ready" | "blocked";
  readonly preconditions: readonly string[];
  readonly effects: readonly string[];
  readonly reason?: string;
};

export function buildCommandViewDetails(state: TuiCommandPreviewState): CommandViewDetails | undefined {
  if (state.status !== "previewing") {
    return undefined;
  }

  return {
    title: `${state.preview.description.title} (${state.preview.description.type})`,
    summary: state.preview.description.summary,
    risk: state.preview.risk,
    confirmation: state.preview.requiresConfirmation ? "required" : "not required",
    state: state.preview.canSubmit ? "ready" : "blocked",
    preconditions: state.preview.description.preconditions,
    effects: state.preview.description.effects,
    reason: state.preview.blockedReason
  };
}
