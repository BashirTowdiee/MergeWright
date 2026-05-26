import test from "node:test";
import assert from "node:assert/strict";
import { renderHelpText } from "../src/cli/output/help-text.js";

test("top-level help text lists commands and safety defaults", () => {
  const text = renderHelpText();

  assert.match(text, /Usage: agent-stage <command> \[options\]/);
  assert.match(text, /Commands:/);
  assert.match(text, /run <stage-name> --config <config-path>/);
  assert.match(text, /continue-run <run-id> --config <config-path>/);
  assert.match(text, /Safety defaults:/);
  assert.match(text, /Codex runs in read-only sandbox/);
});

test("run help text documents auto-chain limits and statuses", () => {
  const text = renderHelpText("run");

  assert.match(text, /Usage: agent-stage run <stage-name>/);
  assert.match(text, /--auto-chain/);
  assert.match(text, /Incompatible with --preset and explicit phase flags/);
  assert.match(text, /PASS \| NEEDS_FIX \| NEEDS_FIX_WRITE_DISABLED \| MAX_FIX_ATTEMPTS_REACHED \| CHECKS_FAILED \| FAILED/);
});

test("stage command help text documents auto-commit constraints", () => {
  const text = renderHelpText("accept-stage");

  assert.match(text, /Usage: agent-stage accept-stage <stage-id>/);
  assert.match(text, /--auto-commit/);
  assert.match(text, /run-stage\/run-stages\/continue-stages reject --auto-commit/);
});
