import type { TuiCommandPreviewState } from "./command-preview-state.js";

export type TuiCommandConfirmationState =
  | { readonly status: "idle" }
  | {
      readonly status: "required";
      readonly intentId: string;
      readonly commandType: string;
      readonly title: string;
      readonly risk: string;
      readonly prompt: string;
    }
  | {
      readonly status: "blocked";
      readonly intentId: string;
      readonly commandType: string;
      readonly title: string;
      readonly reason: string;
    };

export function createIdleCommandConfirmationState(): TuiCommandConfirmationState {
  return { status: "idle" };
}

export function buildCommandConfirmationState(previewState: TuiCommandPreviewState): TuiCommandConfirmationState {
  if (previewState.status !== "previewing") {
    return createIdleCommandConfirmationState();
  }

  const { intent, preview } = previewState;

  if (preview.blockedReason) {
    return {
      status: "blocked",
      intentId: intent.id,
      commandType: intent.type,
      title: preview.description.title,
      reason: preview.blockedReason
    };
  }

  if (!preview.requiresConfirmation) {
    return createIdleCommandConfirmationState();
  }

  return {
    status: "required",
    intentId: intent.id,
    commandType: intent.type,
    title: preview.description.title,
    risk: preview.risk,
    prompt: `Review ${preview.description.title} before continuing.`
  };
}

export function formatCommandConfirmationNotice(state: TuiCommandConfirmationState): string {
  switch (state.status) {
    case "idle":
      return "No command confirmation required.";
    case "required":
      return `Confirmation required: ${state.title} (${state.commandType}) is ${state.risk}-risk. ${state.prompt}`;
    case "blocked":
      return `Command blocked: ${state.title} (${state.commandType}). ${state.reason}`;
  }
}
