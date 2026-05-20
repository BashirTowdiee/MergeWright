export type FocusedPane = "runs" | "phases" | "actions" | "artefacts";

const PANE_ORDER: FocusedPane[] = ["runs", "phases", "actions", "artefacts"];

export function moveFocus(input: { current: FocusedPane; direction: "next" | "previous" }): FocusedPane {
  const index = PANE_ORDER.indexOf(input.current);
  const currentIndex = index === -1 ? 0 : index;

  if (input.direction === "previous") {
    return PANE_ORDER[currentIndex <= 0 ? PANE_ORDER.length - 1 : currentIndex - 1];
  }

  return PANE_ORDER[currentIndex >= PANE_ORDER.length - 1 ? 0 : currentIndex + 1];
}

export function getFocusedPaneTitle(title: string, focused: boolean): string {
  return focused ? `${title} *` : title;
}
