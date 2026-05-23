import { formatCommandPreviewNotice, showCommandPreview, type TuiCommandPreviewState } from "./command-preview-state.js";
import { formatCommandResultNotice, showCommandResult, type TuiCommandResultState } from "./command-result-state.js";
import type { TuiCommandController } from "./command-controller.js";
import { buildSelectTaskIntent, type BuildSelectTaskIntentInput } from "./select-task-intent.js";

export type PreviewSelectTaskCommandFlowInput = BuildSelectTaskIntentInput & {
  readonly controller: TuiCommandController;
};

export type PreviewSelectTaskCommandFlowResult = {
  readonly previewState: TuiCommandPreviewState;
  readonly notice: string;
};

export type SubmitSelectTaskCommandFlowInput = {
  readonly controller: TuiCommandController;
  readonly previewState: TuiCommandPreviewState;
};

export type SubmitSelectTaskCommandFlowResult = {
  readonly resultState: TuiCommandResultState;
  readonly notice: string;
};

export async function previewSelectTaskCommand(input: PreviewSelectTaskCommandFlowInput): Promise<PreviewSelectTaskCommandFlowResult> {
  const intent = buildSelectTaskIntent(input);
  const preview = await input.controller.preview(intent);
  const previewState = showCommandPreview(intent, preview);

  return {
    previewState,
    notice: formatCommandPreviewNotice(previewState)
  };
}

export async function submitSelectTaskCommand(input: SubmitSelectTaskCommandFlowInput): Promise<SubmitSelectTaskCommandFlowResult> {
  if (input.previewState.status !== "previewing") {
    throw new Error("Select-task command preview is required before submit.");
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
