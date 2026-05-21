export interface TuiInputKeyState {
  upArrow?: boolean | undefined;
  downArrow?: boolean | undefined;
}

export type NavigationDirection = "up" | "down";

export function getNavigationDirection(input: string, key: TuiInputKeyState): NavigationDirection | null {
  if (input === "k" || key.upArrow) {
    return "up";
  }

  if (input === "j" || key.downArrow) {
    return "down";
  }

  return null;
}
