#!/usr/bin/env node
import process from "node:process";
import { parseMcpCliArgs, renderMcpHelpText } from "./cli.js";
import { startMergeWrightMcpServer } from "./server.js";

async function main(): Promise<void> {
  try {
    const parsed = parseMcpCliArgs(process.argv.slice(2));
    if (parsed.help) {
      process.stdout.write(`${renderMcpHelpText()}\n`);
      return;
    }

    await startMergeWrightMcpServer({
      cwd: () => parsed.orchestratorRoot
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

void main();
