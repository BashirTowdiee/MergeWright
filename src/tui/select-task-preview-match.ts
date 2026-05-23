import type { TuiCommandPreviewState } from "./command-preview-state.js";

export function isSelectTaskPreviewForTask(state: TuiCommandPreviewState, taskId: string): boolean {
  return (
    state.status === "previewing" &&
    state.intent.type === "select-task" &&
    state.intent.command.type === "select-task" &&
    state.intent.command.taskId === taskId
  );
}
