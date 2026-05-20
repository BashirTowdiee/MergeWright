import path from "node:path";

export function resolveConfigPath(orchestratorRoot: string, configArg: string): string {
  if (!configArg) {
    throw new Error("Missing required --config <config-path>. No implicit default is used.");
  }
  return path.isAbsolute(configArg) ? configArg : path.resolve(orchestratorRoot, configArg);
}
