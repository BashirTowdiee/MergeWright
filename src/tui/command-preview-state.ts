import type { TuiCommandIntent, TuiCommandPreview } from "./write-model.js";

export type TuiCommandPreviewState =
  | { readonly status: "idle" }
  | { readonly status: "previewing"; readonly intent: TuiCommandIntent; readonly preview: TuiCommandPreview };

export function createIdleCommandPreviewState(): TuiCommandPreviewState {
  return { status: "idle" };
}

export function showCommandPreview(intent: TuiCommandIntent, preview: TuiCommandPreview): TuiCommandPreviewState {
  return { status: "previewing", intent, preview };
}

export function clearCommandPreview(): TuiCommandPreviewState {
  return createIdleCommandPreviewState();
}

export function formatCommandPreviewNotice(state: TuiCommandPreviewState): string {
  if (state.status === "idle") {
    return "No command preview selected.";
  }

  const submitState = state.preview.canSubmit ? "submit-ready" : "blocked";
  const confirmation = state.preview.requiresConfirmation ? " confirmation required" : " no confirmation required";
  const blockedReason = state.preview.blockedReason ? ` Blocked: ${state.preview.blockedReason}` : "";

  return `Preview: ${state.preview.description.title} (${state.preview.description.type}) is ${state.preview.risk}-risk and ${submitState};${confirmation}.${blockedReason}`;
}
