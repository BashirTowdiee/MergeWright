import test from "node:test";
import assert from "node:assert/strict";
import type { CodexExecutionResult, CodexExecutor } from "../src/codex.js";
import type { AgentExecutor, AgentExecutorRequest, AgentExecutorResult } from "../src/agent-executor.js";
import { createCodexCompatibleExecutor } from "../src/execution-backends/codex-compatible-executor.js";
import { createAgentExecutor } from "../src/execution-backends/agent-executor.js";

void (0 as unknown as CodexExecutionResult);
void (0 as unknown as AgentExecutorRequest);
void (0 as unknown as AgentExecutorResult);

test("legacy and generic executor exports resolve with compatible callable factories", () => {
  assert.equal(typeof createCodexCompatibleExecutor, "function");
  assert.equal(typeof createAgentExecutor, "function");

  const maybeLegacyExecutor: CodexExecutor | undefined = undefined;
  const maybeGenericExecutor: AgentExecutor | undefined = undefined;
  assert.equal(maybeLegacyExecutor, undefined);
  assert.equal(maybeGenericExecutor, undefined);
});
