export interface CommandPaletteItem {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export function getCommandPaletteItems(): CommandPaletteItem[] {
  return [
    {
      id: "preview-action",
      label: "Preview selected safe action",
      description: "Shows what the selected safe action would do without executing it.",
      enabled: true
    },
    {
      id: "toggle-file-scope",
      label: "Toggle file scope",
      description: "Switches between phase-scoped files and all files.",
      enabled: true
    },
    {
      id: "open-run-folder",
      label: "Open run folder",
      description: "Planned action. Disabled until mutation/open commands are explicitly implemented.",
      enabled: false
    },
    {
      id: "generate-report",
      label: "Generate report",
      description: "Planned action. Disabled until action execution is implemented safely.",
      enabled: false
    }
  ];
}

export function formatCommandPaletteLine(item: CommandPaletteItem): string {
  return `${item.enabled ? "ok" : "disabled"} ${item.label} - ${item.description}`;
}
