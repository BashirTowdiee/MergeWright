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

export function filterCommandPaletteItems(items: CommandPaletteItem[], query: string): CommandPaletteItem[] {
  const normalisedQuery = query.trim().toLowerCase();
  if (normalisedQuery.length === 0) {
    return items;
  }

  return items.filter((item) => {
    const searchable = `${item.id} ${item.label} ${item.description}`.toLowerCase();
    return searchable.includes(normalisedQuery);
  });
}

export function appendCommandPaletteQuery(query: string, input: string): string {
  if (input.length !== 1) {
    return query;
  }

  return `${query}${input}`;
}

export function backspaceCommandPaletteQuery(query: string): string {
  return query.slice(0, -1);
}

export function formatCommandPaletteLine(item: CommandPaletteItem): string {
  return `${item.enabled ? "ok" : "disabled"} ${item.label} - ${item.description}`;
}

export function describeCommandPaletteSelection(item: CommandPaletteItem | undefined): string {
  if (!item) {
    return "No command selected.";
  }

  if (!item.enabled) {
    return `Disabled command: ${item.label}. ${item.description}`;
  }

  return `Preview command: ${item.label}. ${item.description}`;
}
