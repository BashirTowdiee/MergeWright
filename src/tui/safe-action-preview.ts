import { describeCommand } from "../application/commands/command-description.js";
import { getCommandMetadata } from "../application/commands/command-metadata.js";
import type { SafeActionViewModel } from "./view-models.js";
import { getSafeActionCommandType } from "./action-intent.js";
import { showCommandPreview, type TuiCommandPreviewState } from "./command-preview-state.js";
import { previewCommandIntent, type TuiCommandIntent } from "./write-model.js";

export function buildSafeActionPreview(input: {
  readonly action: SafeActionViewModel | undefined;
  readonly runId: string;
  readonly selectedPhaseId: string;
  readonly requestedAt: string;
}): TuiCommandPreviewState | undefined {
  if (!input.action) {
    return undefined;
  }

  const commandType = getSafeActionCommandType(input.action);
  if (commandType === "continue-run") {
    const command = {
      commandId: `tui-${input.action.id}-${input.runId}`,
      source: "tui" as const,
      requestedAt: input.requestedAt,
      type: commandType,
      runId: input.runId
    };
    const metadata = getCommandMetadata(commandType);
    const intent: TuiCommandIntent = {
      id: input.action.id,
      type: commandType,
      label: input.action.label,
      command
    };

    return showCommandPreview(intent, previewCommandIntent(intent, describeCommand(command, metadata.defaultRisk)));
  }

  if (commandType === "retry-phase") {
    const command = {
      commandId: `tui-${input.action.id}-${input.runId}-${input.selectedPhaseId}`,
      source: "tui" as const,
      requestedAt: input.requestedAt,
      type: commandType,
      runId: input.runId,
      phase: "reviewer" as const
    };
    const metadata = getCommandMetadata(commandType);
    const intent: TuiCommandIntent = {
      id: input.action.id,
      type: commandType,
      label: input.action.label,
      command
    };

    return showCommandPreview(intent, previewCommandIntent(intent, describeCommand(command, metadata.defaultRisk)));
  }

  return undefined;
}
