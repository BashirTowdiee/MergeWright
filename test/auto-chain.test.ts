import test from "node:test";
import assert from "node:assert/strict";
import { buildAutoChainProjectionLines } from "../src/auto-chain.js";

test("buildAutoChainProjectionLines(0) stops without fix execution", () => {
  const lines = buildAutoChainProjectionLines(0);
  const text = lines.join("\n");

  assert.match(text, /stop without fix execution because max fix attempts is 0/);
  assert.doesNotMatch(text, /fix attempt 1/);
  assert.doesNotMatch(text, /reviewer retry/);
});

test("buildAutoChainProjectionLines(1) includes single bounded fix attempt", () => {
  const lines = buildAutoChainProjectionLines(1);
  const text = lines.join("\n");

  assert.match(text, /fix attempt 1/);
  assert.match(text, /reviewer retry after fix attempt 1/);
  assert.doesNotMatch(text, /fix attempt 2/);
});

test("buildAutoChainProjectionLines(3) includes all bounded attempts and retries", () => {
  const lines = buildAutoChainProjectionLines(3);
  const text = lines.join("\n");

  assert.match(text, /fix attempt 1/);
  assert.match(text, /fix attempt 2/);
  assert.match(text, /fix attempt 3/);
  assert.match(text, /reviewer retry after fix attempt 1/);
  assert.match(text, /reviewer retry after fix attempt 2/);
  assert.match(text, /reviewer retry after fix attempt 3/);
  assert.doesNotMatch(text, /fix attempt 4/);
});
