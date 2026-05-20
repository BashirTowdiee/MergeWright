export interface TuiKeyBinding {
  key: string;
  description: string;
  scope: "global" | "focused-pane";
}

export const TUI_KEY_BINDINGS: TuiKeyBinding[] = [
  { key: "tab", description: "cycle focused pane", scope: "global" },
  { key: "shift+tab", description: "cycle focused pane backwards", scope: "global" },
  { key: "?", description: "toggle help", scope: "global" },
  { key: "ctrl+c", description: "exit", scope: "global" },
  { key: "j / down", description: "move selection down in focused pane", scope: "focused-pane" },
  { key: "k / up", description: "move selection up in focused pane", scope: "focused-pane" },
  { key: "enter", description: "preview selected safe action", scope: "focused-pane" }
];

export function formatKeyBinding(binding: TuiKeyBinding): string {
  return `${binding.key.padEnd(12)} ${binding.description}`;
}
