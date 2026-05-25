#!/usr/bin/env node
import process from "node:process";
import { spawn } from "node:child_process";
import { runCommand, type OpenRunDirectory } from "../../../src/cli.js";
import { parseArgs } from "../../../src/cli/parse/parse-args.js";

const openRunDirectory: OpenRunDirectory = async (runDir) => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("open", [runDir], { stdio: "ignore", shell: false });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to open run directory with open. code=${code ?? "null"} signal=${signal ?? "null"}`));
      }
    });
  });
};

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
