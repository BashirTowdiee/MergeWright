# Codex CLI Backend

`codex-cli` is the primary executable backend.

It supports planner, builder, reviewer, fix-planning, and fix execution orchestration with run artefact capture.

Read-only is default; builder/fix writes require `--allow-writes` and write-safety pass.
