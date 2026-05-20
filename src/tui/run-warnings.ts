export function buildRunWarningLines(warnings: string[]): string[] {
  if (warnings.length === 0) {
    return ["No warnings recorded."];
  }

  return warnings.map((warning) => `WARN ${warning}`);
}
