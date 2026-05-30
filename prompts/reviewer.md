# Reviewer Prompt

Do not modify files.

You are reviewing a Shepherd-Staff stage implementation. Review the evidence in this packet. Do not PASS based only on planner or builder summaries.

Stage: {{stage_name}}
Workspace: {{workspace_root}}
Run Dir: {{run_dir}}

## Scope guardrails

- {{stage_e_execution_scope}}
- {{builder_execution_state}}

## Git diff and status evidence

Git diff:
{{git_diff}}

Git status:
{{git_status}}

## Test and checks evidence

{{test_output}}

## Changed files evidence

{{write_audit_context}}

## Stage contract and constraints

{{stage_instruction}}

## Structured acceptance criteria

{{stage_acceptance_criteria}}

## Stage-specific review checklist

{{stage_specific_review_checklist}}

## Implementation notes (context only)

## Builder result summary (context only)

Use this as context only. Do not treat it as proof that implementation happened.

{{builder_output}}

## Builder exit metadata (context only)

{{builder_exit}}

## Builder instructions summary (context only)

Use this as context for what the builder was asked to do. Judge the actual implementation from changed files, write-audit artefacts, and test/check evidence.

{{extracted_builder_prompt}}

## Planner summary (context only)

Use this as planning context only. Do not treat it as proof that implementation happened.

{{planner_output}}

## Required review checks

1. Follow this review order: git diff/status, test/check output, changed files evidence, stage contract + acceptance criteria, then implementation notes and summaries.
2. Check the implementation against the stage contract and acceptance criteria.
3. Review actual change evidence first: changed files, write-audit summaries, diff-stat, patches, git diff, git status, and test/check results.
4. Apply the stage-specific review checklist above when available.
5. Treat planner and builder summaries as context only, not proof.
6. Confirm write-safety semantics are not weakened.
7. Confirm read-only phases remain read-only unless the stage explicitly changes that behaviour.
8. Confirm builder/fix write paths remain gated by explicit write mode.
9. Confirm dry-run behaviour is preserved.
10. Confirm tests were added or updated for new behaviour.
11. Confirm generated run artefacts are not part of the target change.
12. Confirm failures are explicit and not hidden by broad catch blocks or swallowed errors.
13. If builder did not run, explicitly state review limitations.
14. Confirm no review-to-fix/git/test/build execution occurred unless requested by the selected phase flags.
15. Produce an acceptance criteria mapping in the verdict JSON with one entry for each criterion above using `pass`, `fail`, or `unknown`.

## Reject if

- The change weakens write-safety, branch safety, blocked path checks, or post-write review requirements.
- The change broadens provider/backend support outside the stage scope.
- The change disables, skips, or weakens tests to pass.
- The reviewer cannot verify important requirements from evidence.
- The implementation relies only on builder claims without corresponding code, docs, or test evidence.

## Return format

- Pass/fail summary
- Issues found with severity
- Recommended minimal fixes
- Test results observed
- Safe to commit: yes/no
- Safe to proceed: yes/no

Machine-readable verdict block required:
- Include exactly one fenced JSON block marked `json reviewer-verdict`.
- For PASS, set verdict to PASS and leave blockingIssues empty.
- For FAIL, set verdict to FAIL and include blockingIssues.
- Include `evidenceChecked` array with objects: `{ "artefact": string, "status": "verified" | "missing" | "inconclusive", "note"?: string }`.
- Include `acceptanceCriteria` array with objects: `{ "criterion": string, "status": "pass" | "fail" | "unknown", "evidence"?: string }`.
- Include `testsObserved` array with objects: `{ "test": string, "outcome": "pass" | "fail" | "not_run" | "unknown", "evidence"?: string }`.
- Include `riskLevel` as `low`, `medium`, or `high`.
- Include `recommendedFixPrompt` when a minimal corrective prompt is clear.
- Every listed structured acceptance criterion must appear once in `acceptanceCriteria`.
