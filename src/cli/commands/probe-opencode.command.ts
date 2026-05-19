import type { CommandHandler } from "../command-context.js";
import { runProbeOpenCodeCommand } from "../command-helpers.js";

export const handleProbeOpenCodeCommand: CommandHandler = async ({ args, orchestratorRoot, writeLine }) => {
  const result = await runProbeOpenCodeCommand(args, orchestratorRoot);
  if (args.jsonOutput) {
    writeLine(JSON.stringify(result, null, 2));
  } else {
    writeLine(`OpenCode CLI probe: ${result.ok ? "PASS" : "FAIL"}`);
    writeLine(`Command: ${result.command}`);
    writeLine(`Run subcommand: ${result.probe.contract.supportsRunSubcommand ? "yes" : "no"}`);
    writeLine(`Model flag: ${result.probe.contract.supportsModelFlag ? "yes" : "no"}`);
    writeLine(`Workspace flag: ${result.probe.contract.supportsCwdFlag ? "yes" : "no"}`);
    writeLine(`Output flag: ${result.probe.contract.supportsOutputFlag ? "yes" : "no"}`);
    writeLine(`Stdin prompt: ${result.probe.contract.supportsStdinPrompt ? "yes" : "no"}`);
    if (args.validateReadonlyContract) {
      writeLine(`Read-only command contract: ${result.readOnlyCommandValidation?.ok === true ? "PASS" : "FAIL"}`);
    }
  }
  if (!result.ok) {
    throw new Error("probe-opencode failed");
  }
};
