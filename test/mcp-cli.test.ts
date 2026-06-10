import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { parseMcpCliArgs, renderMcpHelpText } from "../apps/mcp/src/cli.js";
import { parseArgs, runCommand } from "../src/cli-core.js";

test("mcp parses as a top-level command", () => {
  const parsed = parseArgs(["mcp"]);

  assert.equal(parsed.command, "mcp");
  assert.equal(parsed.help, false);
});

test("mcp command starts the MCP server handler without CLI output", async () => {
  const output: string[] = [];
  const calls: string[] = [];

  await runCommand(parseArgs(["mcp"]), process.cwd(), "linux", async () => {}, (line) => output.push(line), {
    mcpServerHandler: async ({ orchestratorRoot }) => {
      calls.push(orchestratorRoot);
    }
  });

  assert.deepEqual(calls, [process.cwd()]);
  assert.deepEqual(output, []);
});

test("MCP app entrypoint parser resolves orchestrator root overrides", () => {
  const parsed = parseMcpCliArgs(["--orchestrator-root", "fixtures/root"], () => "/tmp/current");

  assert.equal(parsed.help, false);
  assert.equal(parsed.orchestratorRoot, path.resolve("fixtures/root"));
});

test("MCP app entrypoint parser accepts inline root syntax and help", () => {
  const parsed = parseMcpCliArgs(["--help", "--orchestrator-root=/tmp/mergewright"]);

  assert.equal(parsed.help, true);
  assert.equal(parsed.orchestratorRoot, "/tmp/mergewright");
});

test("MCP app entrypoint help documents protocol-clean launch guidance", () => {
  const help = renderMcpHelpText();

  assert.match(help, /Usage: node dist\/apps\/mcp\/src\/main\.js/);
  assert.match(help, /--orchestrator-root <path>/);
  assert.match(help, /launch it directly instead of through npm wrappers/);
  assert.match(help, /docs\/cli\/mcp\.md/);
});
