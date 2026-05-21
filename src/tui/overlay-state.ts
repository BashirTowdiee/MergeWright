export type TuiOverlay = "none" | "help" | "command-palette";

export function toggleOverlay(current: TuiOverlay, target: Exclude<TuiOverlay, "none">): TuiOverlay {
  return current === target ? "none" : target;
}

export function closeOverlay(): TuiOverlay {
  return "none";
}

export function isOverlayOpen(overlay: TuiOverlay): boolean {
  return overlay !== "none";
}

export function isHelpOverlayOpen(overlay: TuiOverlay): boolean {
  return overlay === "help";
}

export function isCommandPaletteOverlayOpen(overlay: TuiOverlay): boolean {
  return overlay === "command-palette";
}
