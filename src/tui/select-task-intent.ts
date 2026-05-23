import type { CommandActor } from "../application/commands/command-source.js";
import type { TuiCommandIntent } from "./write-model.js";

export type BuildSelectTaskIntentInput = {
  readonly taskId: string;
  readonly label: string;
  readonly requestedAt: string;
  readonly actor?: CommandActor;
};

export function buildSelectTaskIntent(input: BuildSelectTaskIntentInput): TuiCommandIntent {
  return {
    id: `select-task:${input.taskId}`,
    type: "select-task",
    label: input.label,
    command: {
      commandId: `tui-select-task-${input.taskId}`,
      source: "tui",
      actor: input.actor,
      requestedAt: input.requestedAt,
      type: "select-task",
      taskId: input.taskId
    }
  };
}
