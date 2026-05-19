import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_REVIEWER_PROMPT_MAX_CHARS, renderTemplate, truncateMiddle } from "../src/prompts.js";

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

function reviewerVariables(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    stage_name: "example-stage",
    workspace_root: "/tmp/workspace",
    run_dir: mkdtempSync(path.join(os.tmpdir(), "reviewer-budget-")),
    stage_e_execution_scope: "scope",
    builder_execution_state: "state",
    stage_instruction: "stage",
    planner_output: "planner",
    extracted_builder_prompt: "builder prompt",
    builder_output: "builder output",
    builder_exit: "exit",
    write_audit_context: "audit",
    test_output: "tests",
    git_diff: "diff",
    git_status: "status",
    ...overrides
  };
}

test("reviewer template rendering bounds large evidence sections and writes budget metadata", () => {
  const templatePath = path.resolve(process.cwd(), "prompts/reviewer.md");
  const template = readFileSync(templatePath, "utf8");
  const variables = reviewerVariables({ git_diff: "x".repeat(260_000) });
  const output = renderTemplate(template, variables);

  assert.match(output, /## Git diff and status evidence/);
  assert.match(output, /\[truncated: original length 260000 chars, retained 200000 chars\]/);
  assert.ok(output.length < 260_000);

  const metadata = JSON.parse(readFileSync(path.join(variables.run_dir, "reviewer-prompt-budget.json"), "utf8")) as {
    maxChars: number;
    finalChars: number;
    exceedsBudget: boolean;
    sections: Array<{ name: string; originalChars: number; retainedChars: number; truncated: boolean }>;
  };
  assert.equal(metadata.maxChars, DEFAULT_REVIEWER_PROMPT_MAX_CHARS);
  assert.equal(metadata.finalChars, output.length);
  assert.equal(metadata.exceedsBudget, false);
  const gitDiffSection = metadata.sections.find((section) => section.name === "git_diff");
  assert.ok(gitDiffSection);
  assert.equal(gitDiffSection.originalChars, 260_000);
  assert.equal(gitDiffSection.retainedChars, 200_000);
  assert.equal(gitDiffSection.truncated, true);
});

test("reviewer template rendering enriches placeholder evidence from run artefacts", () => {
  const templatePath = path.resolve(process.cwd(), "prompts/reviewer.md");
  const template = readFileSync(templatePath, "utf8");
  const runDir = mkdtempSync(path.join(os.tmpdir(), "reviewer-evidence-"));
  mkdirSync(path.join(runDir, "write-audit/builder"), { recursive: true });
  mkdirSync(path.join(runDir, "checks"), { recursive: true });
  writeFileSync(path.join(runDir, "write-audit/builder/post-diff.patch"), "diff --git a/src/app.ts b/src/app.ts\n", "utf8");
  writeFileSync(path.join(runDir, "write-audit/builder/summary.json"), "{\"changedFiles\":[\"src/app.ts\"]}\n", "utf8");
  writeFileSync(path.join(runDir, "checks/01-build-stdout.log"), "build ok\n", "utf8");
  writeFileSync(path.join(runDir, "reviewer-stdout.log"), "must not be included\n", "utf8");

  const output = renderTemplate(template, reviewerVariables({
    run_dir: runDir,
    git_diff: "[placeholder: git diff skipped in Stage E]",
    test_output: "[placeholder: test output skipped in Stage E]",
    git_status: "[placeholder: git status skipped in Stage E]"
  }));

  assert.match(output, /## write-audit\/builder\/post-diff\.patch/);
  assert.match(output, /diff --git a\/src\/app\.ts b\/src\/app\.ts/);
  assert.match(output, /## checks\/01-build-stdout\.log/);
  assert.match(output, /build ok/);
  assert.match(output, /## write-audit\/builder\/summary\.json/);
  assert.match(output, /changedFiles/);
  assert.doesNotMatch(output, /must not be included/);
});

test("reviewer template extracts stage-specific checklist from planner output", () => {
  const templatePath = path.resolve(process.cwd(), "prompts/reviewer.md");
  const template = readFileSync(templatePath, "utf8");
  const output = renderTemplate(template, reviewerVariables({
    planner_output: [
      "Planner context",
      "## Review Checklist",
      "1. Verify the experimental gate.",
      "2. Verify dry-run behaviour.",
      "## FINAL BUILDER PROMPT",
      "Builder instructions"
    ].join("\n")
  }));

  assert.match(output, /## Stage-specific review checklist/);
  assert.match(output, /1\. Verify the experimental gate\./);
  assert.match(output, /2\. Verify dry-run behaviour\./);
  const checklistIndex = output.indexOf("## Stage-specific review checklist");
  const evidenceIndex = output.indexOf("## Write-safety and change evidence");
  const plannerIndex = output.indexOf("## Planner summary");
  assert.ok(checklistIndex < evidenceIndex);
  assert.ok(evidenceIndex < plannerIndex);
});

test("reviewer template rendering fails before execution when final prompt exceeds hard budget", () => {
  const template = [
    "You are reviewing a Shepherd-Staff stage implementation.",
    "json reviewer-verdict",
    "{{unbudgeted_payload}}"
  ].join("\n");
  const runDir = mkdtempSync(path.join(os.tmpdir(), "reviewer-budget-fail-"));

  assert.throws(
    () =>
      renderTemplate(template, {
        run_dir: runDir,
        unbudgeted_payload: "x".repeat(DEFAULT_REVIEWER_PROMPT_MAX_CHARS + 1)
      }),
    /Reviewer prompt exceeds configured budget after truncation\. Final length: \d+ chars\. Budget: 900000 chars\./
  );

  const metadata = JSON.parse(readFileSync(path.join(runDir, "reviewer-prompt-budget.json"), "utf8")) as {
    exceedsBudget: boolean;
    finalChars: number;
  };
  assert.equal(metadata.exceedsBudget, true);
  assert.ok(metadata.finalChars > DEFAULT_REVIEWER_PROMPT_MAX_CHARS);
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
  assert.match(template, /## Stage-specific review checklist/);
  assert.match(template, /## Planner summary/);
  assert.match(template, /## Builder instructions summary/);
  assert.match(template, /## Builder result summary/);
  assert.match(template, /## Write-safety and change evidence/);
  assert.match(template, /## Test results/);
  assert.match(template, /## Git diff and status evidence/);
  assert.match(template, /Review actual change evidence first/);
  assert.match(template, /Apply the stage-specific review checklist above when available/);
  assert.match(template, /Pass\/fail summary/);
  assert.match(template, /Issues found with severity/);
  assert.match(template, /Safe to commit: yes\/no/);
  assert.match(template, /Safe to proceed: yes\/no/);
  assert.match(template, /Machine-readable verdict block required/);
  assert.match(template, /json reviewer-verdict/);

  assert.ok(template.indexOf("## Write-safety and change evidence") < template.indexOf("## Builder result summary"));
  assert.ok(template.indexOf("## Test results") < template.indexOf("## Builder result summary"));
  assert.ok(template.indexOf("## Git diff and status evidence") < template.indexOf("## Planner summary"));
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
