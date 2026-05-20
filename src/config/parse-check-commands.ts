import { validateConfiguredCheckCommand } from "../commands.js";
import { assertObject, assertString, assertStringArray } from "../validation.js";
import type { ConfiguredCheckCommand } from "./types.js";

export function parseCheckCommands(value: unknown, field: string): ConfiguredCheckCommand[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid config: ${field} must be an array`);
  }

  return value.map((entry, index) => {
    const check = assertObject(entry, `${field}[${index}]`);
    const name = assertString(check.name, `${field}[${index}].name`);
    const command = assertString(check.command, `${field}[${index}].command`);
    if (command.includes(" ")) {
      throw new Error(`Invalid config: ${field}[${index}].command must be an executable name only`);
    }
    const args = assertStringArray(check.args, `${field}[${index}].args`);
    const cwdRaw = check.cwd;
    if (cwdRaw !== "workspace" && cwdRaw !== "orchestrator") {
      throw new Error(`Invalid config: ${field}[${index}].cwd must be "workspace" or "orchestrator"`);
    }
    validateConfiguredCheckCommand({ name, command, args, cwd: cwdRaw });
    return {
      name,
      command,
      args,
      cwd: cwdRaw
    };
  });
}
