export type CommandRisk = "none" | "low" | "medium" | "high";

export const COMMAND_RISKS: readonly CommandRisk[] = ["none", "low", "medium", "high"];

export function requiresConfirmationForRisk(risk: CommandRisk): boolean {
  return risk === "medium" || risk === "high";
}
