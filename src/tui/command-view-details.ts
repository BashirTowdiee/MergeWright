import type { TuiCommandPreviewState } from "./command-preview-state.js";

export const COMMAND_VIEW_LIST_SEPARATOR = " | ";
export const COMMAND_VIEW_ROW_LABELS = {
  title: "Command",
  summary: "Summary",
  risk: "Risk",
  confirmation: "Confirmation",
  state: "State",
  preconditions: "Preconditions",
  effects: "Effects",
  reason: "Reason"
} as const;

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

export function joinCommandViewListValues(values: readonly string[]): string {
  return values.join(COMMAND_VIEW_LIST_SEPARATOR);
}

export function buildCommandViewRows(details: CommandViewDetails): readonly string[] {
  const rows = [
    `${COMMAND_VIEW_ROW_LABELS.title}: ${details.title}`,
    `${COMMAND_VIEW_ROW_LABELS.summary}: ${details.summary}`,
    `${COMMAND_VIEW_ROW_LABELS.risk}: ${details.risk}`,
    `${COMMAND_VIEW_ROW_LABELS.confirmation}: ${details.confirmation}`,
    `${COMMAND_VIEW_ROW_LABELS.state}: ${details.state}`
  ];

  if (details.preconditions.length > 0) {
    rows.push(`${COMMAND_VIEW_ROW_LABELS.preconditions}: ${joinCommandViewListValues(details.preconditions)}`);
  }

  if (details.effects.length > 0) {
    rows.push(`${COMMAND_VIEW_ROW_LABELS.effects}: ${joinCommandViewListValues(details.effects)}`);
  }

  if (details.reason) {
    rows.push(`${COMMAND_VIEW_ROW_LABELS.reason}: ${details.reason}`);
  }

  return rows;
}
