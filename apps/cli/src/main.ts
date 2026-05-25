#!/usr/bin/env node
import process from "node:process";
import { defaultOpenRunDirectory, runCommand } from "../../../src/cli.js";
import { parseArgs } from "../../../src/cli/parse/parse-args.js";

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    await runCommand(args, process.cwd(), process.platform, defaultOpenRunDirectory);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

void main();
