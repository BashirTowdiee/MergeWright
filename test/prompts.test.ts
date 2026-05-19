import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderTemplate, truncateMiddle } from "../src/prompts.js";

test("template rendering replaces variables", () => {
  const output = renderTemplate("Hello {{name}}", { name: "world" });
  assert.equal(output, "Hello world");
});

test("missing variable fails clearly", () => {
  assert.throws(() => renderTemplate("Hello {{name}} {{missing}}", { name: "world" }), {
    message: /missing variable "missing"/
  });
});

test("truncateMiddle preserves small values unchanged", () => {
  assert.equal(truncateMiddle("small", 10), "small");
});

test("truncateMiddle bounds large values with explicit metadata marker", () => {
  const input = `${"a".repeat(100)}${"b".repeat(100)}`;
  const output = truncateMiddle(input, 120);
  assert.equal(output.length, 120);
  assert.match(output, /\[truncated: original length 200 chars, retained 120 chars\]/);
  assert.ok(output.startsWith("a"));
  assert.ok(output.endsWith("b"));
});

test("reviewer template rendering bounds large evidence sections", () => {
  const templatePath = path.resolve(process.cwd(), "prompts/reviewer.md");
  const template = readFileSync(templatePath, "utf8");
  const output = renderTemplate(template, {
    stage_name: "example-stage",
    workspace_root: "/tmp/workspace",
    run_dir: "/tmp/run",
    stage_e_execution_scope: "scope",
    builder_execution_state: "state",
    stage_instruction: "stage",
    planner_output: "planner",
    extracted_builder_prompt: "builder prompt",
    builder_output: "builder output",
    builder_exit: "exit",
    write_audit_context: "audit",
    test_output: "tests",
    git_diff: "x".repeat(260_000),
    git_status: "status"
  });

  assert.match(output, /## Git diff and status evidence/);
  assert.match(output, /\[truncated: original length 260000 chars, retained 200000 chars\]/);
  assert.ok(output.length < 260_000);
});

test("planner template includes Stage C output contract guidance", () => {
  const templatePath = path.resolve(process.cwd(), "prompts/planner-stage.md");
  const template = readFileSync(templatePath, "utf8");
  assert.match(template, /Do not implement the work\./);
  assert.match(template, /Create exactly one scoped builder prompt/);
  assert.match(template, /supports only the `BUILD` decision/);
  assert.match(template, /^## DECISION$/m);
  assert.match(template, /^## FINAL BUILDER PROMPT$/m);
  assert.match(template, /Do not include trailing text after the final builder prompt/);
});

test("reviewer template is evidence-focused and preserves verdict contract", () => {
  const templatePath = path.resolve(process.cwd(), "prompts/reviewer.md");
  const template = readFileSync(templatePath, "utf8");
  assert.match(template, /Do not modify files\./);
  assert.match(template, /Review the evidence in this packet/);
  assert.match(template, /Do not PASS based only on planner or builder summaries/);
  assert.match(template, /## Stage contract/);
  assert.match(template, /## Planner summary/);
  assert.match(template, /## Builder instructions summary/);
  assert.match(template, /## Builder result summary/);
  assert.match(template, /## Write-safety and change evidence/);
  assert.match(template, /## Test results/);
  assert.match(template, /## Git diff and status evidence/);
  assert.match(template, /Review actual change evidence first/);
  assert.match(template, /Pass\/fail summary/);
  assert.match(template, /Issues found with severity/);
  assert.match(template, /Safe to commit: yes\/no/);
  assert.match(template, /Safe to proceed: yes\/no/);
  assert.match(template, /Machine-readable verdict block required/);
  assert.match(template, /json reviewer-verdict/);
});

test("reviewer template avoids transcript-style replay variables", () => {
  const templatePath = path.resolve(process.cwd(), "prompts/reviewer.md");
  const template = readFileSync(templatePath, "utf8");
  assert.doesNotMatch(template, /\{\{\s*planner_prompt\s*\}\}/);
  assert.doesNotMatch(template, /\{\{\s*builder_stdout\s*\}\}/);
  assert.doesNotMatch(template, /\{\{\s*builder_stderr\s*\}\}/);
  assert.doesNotMatch(template, /Rendered planner prompt/);
  assert.doesNotMatch(template, /Builder stdout/);
  assert.doesNotMatch(template, /Builder stderr/);
});

test("review-to-fix template includes Stage F decision contracts and constraints", () => {
  const templatePath = path.resolve(process.cwd(), "prompts/review-to-fix.md");
  const template = readFileSync(templatePath, "utf8");
  assert.match(template, /Do not modify files\./);
  assert.match(template, /Do not execute the fix prompt\./);
  assert.match(template, /Do not broaden into the next stage\./);
  assert.match(template, /^## DECISION$/m);
  assert.match(template, /^PROCEED$/m);
  assert.match(template, /^FIX_REQUIRED$/m);
  assert.match(template, /^## RATIONALE$/m);
  assert.match(template, /^## FINAL FIX PROMPT$/m);
});
