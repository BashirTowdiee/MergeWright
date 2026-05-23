import type { CommandActor } from "../application/commands/command-source.js";
import type { TuiCommandIntent } from "./write-model.js";

export type BuildCoordinationNoteIntentInput = {
  readonly note: string;
  readonly requestedAt: string;
  readonly expectedRevision?: string;
  readonly actor?: CommandActor;
};

export function buildCoordinationNoteIntent(input: BuildCoordinationNoteIntentInput): TuiCommandIntent {
  const label = input.note.trim().length > 0 ? "Update coordination note" : "Update empty coordination note";

  return {
    id: `update-coordination-note:${input.requestedAt}`,
    type: "update-coordination-note",
    label,
    command: {
      commandId: `tui-update-coordination-note-${input.requestedAt}`,
      source: "tui",
      actor: input.actor,
      requestedAt: input.requestedAt,
      type: "update-coordination-note",
      note: input.note,
      expectedRevision: input.expectedRevision
    }
  };
}
