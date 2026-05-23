import { formatCommandPreviewNotice, showCommandPreview, type TuiCommandPreviewState } from "./command-preview-state.js";
import { formatCommandResultNotice, showCommandResult, type TuiCommandResultState } from "./command-result-state.js";
import type { TuiCommandController } from "./command-controller.js";
import { buildCoordinationNoteIntent, type BuildCoordinationNoteIntentInput } from "./coordination-note-intent.js";

export type PreviewCoordinationNoteCommandFlowInput = BuildCoordinationNoteIntentInput & {
  readonly controller: TuiCommandController;
};

export type PreviewCoordinationNoteCommandFlowResult = {
  readonly previewState: TuiCommandPreviewState;
  readonly notice: string;
};

export type SubmitCoordinationNoteCommandFlowInput = {
  readonly controller: TuiCommandController;
  readonly previewState: TuiCommandPreviewState;
};

export type SubmitCoordinationNoteCommandFlowResult = {
  readonly resultState: TuiCommandResultState;
  readonly notice: string;
};

export async function previewCoordinationNoteCommand(input: PreviewCoordinationNoteCommandFlowInput): Promise<PreviewCoordinationNoteCommandFlowResult> {
  const intent = buildCoordinationNoteIntent(input);
  const preview = await input.controller.preview(intent);
  const previewState = showCommandPreview(intent, preview);

  return {
    previewState,
    notice: formatCommandPreviewNotice(previewState)
  };
}

export async function submitCoordinationNoteCommand(input: SubmitCoordinationNoteCommandFlowInput): Promise<SubmitCoordinationNoteCommandFlowResult> {
  if (input.previewState.status !== "previewing") {
    throw new Error("Coordination-note command preview is required before submit.");
  }

  if (input.previewState.intent.type !== "update-coordination-note") {
    throw new Error("Coordination-note command preview is required before submit.");
  }

  const outcome = await input.controller.submit({
    intentId: input.previewState.intent.id,
    command: input.previewState.intent.command
  });
  const resultState = showCommandResult(outcome.intentId, outcome.result);

  return {
    resultState,
    notice: formatCommandResultNotice(resultState)
  };
}
