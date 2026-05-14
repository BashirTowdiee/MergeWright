# Reviewer Prompt (Stage E)

Do not modify files.

You are reviewing Stage E orchestration behaviour only.

Stage: {{stage_name}}
Workspace: {{workspace_root}}
Run Dir: {{run_dir}}

Scope guardrails:
- {{stage_e_execution_scope}}
- {{builder_execution_state}}

Stage instruction:
{{stage_instruction}}

Rendered planner prompt:
{{planner_prompt}}

Planner output (raw/final):
{{planner_output}}

Extracted builder prompt:
{{extracted_builder_prompt}}

Builder final output:
{{builder_output}}

Builder stdout:
{{builder_stdout}}

Builder stderr:
{{builder_stderr}}

Builder exit metadata:
{{builder_exit}}

Write-audit context (when write-enabled phases ran):
{{write_audit_context}}

Test output placeholder:
{{test_output}}

Git diff placeholder:
{{git_diff}}

Git status placeholder:
{{git_status}}

Required checks:
1. Confirm Stage E scope is respected.
2. Confirm planner output contract and extracted builder prompt quality.
3. If builder ran, review builder output and safety signals.
4. If write-audit context is present, inspect changed files and write-audit summary/diff artefacts.
5. If builder did not run, explicitly state review limitations.
6. Confirm no review-to-fix/git/test/build execution occurred.

Return format:
- Pass/fail summary
- Issues found with severity
- Recommended minimal fixes
- Safe to commit: yes/no
- Safe to proceed: yes/no

Machine-readable verdict block (required):
- Include exactly one fenced JSON block using this exact marker: `json reviewer-verdict`
- The JSON must be valid and match this schema.

For pass:

```json reviewer-verdict
{
  "verdict": "PASS",
  "blockingIssues": [],
  "nonBlockingIssues": []
}
```

For failure:

```json reviewer-verdict
{
  "verdict": "FAIL",
  "blockingIssues": [
    {
      "severity": "high",
      "summary": "Request logging includes request bodies by default",
      "files": ["src/app.ts"]
    }
  ],
  "nonBlockingIssues": []
}
```
