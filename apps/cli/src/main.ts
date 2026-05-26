#!/usr/bin/env node
import process from "node:process";
import { openRunDirectory } from "../../../packages/adapters/src/open-run-directory.js";
import { runCommand, parseArgs } from "./runtime.js";

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    await runCommand(args, process.cwd(), process.platform, openRunDirectory);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

void main();
