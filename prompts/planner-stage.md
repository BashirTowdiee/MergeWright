# Planner Prompt

Stage: {{stage_name}}
Timestamp: {{timestamp}}
Workspace: {{workspace_root}}
Run Dir: {{run_dir}}

Task:
Create exactly one scoped builder prompt for the stage instruction below.

Rules:
- Do not implement the work.
- Stage C supports only the `BUILD` decision.
- Include architecture constraints in the builder prompt.
- Include concrete validation steps in the builder prompt.
- Include what must not be done in the builder prompt.
- Do not include implementation output.
- Do not include trailing text after the final builder prompt unless it is part of the builder prompt itself.

Stage instruction:
{{stage_instruction}}

Output format (exact headings, case-sensitive):
## DECISION
BUILD

## FINAL BUILDER PROMPT
<full builder prompt>
