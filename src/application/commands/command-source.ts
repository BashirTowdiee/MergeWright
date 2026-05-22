export type CommandSource = "cli" | "tui" | "mcp" | "automation";

export type CommandActor = {
  readonly id?: string;
  readonly displayName?: string;
};

export type CommandMetadata = {
  readonly commandId: string;
  readonly source: CommandSource;
  readonly requestedAt: string;
  readonly actor?: CommandActor;
};
