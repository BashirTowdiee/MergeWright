# Write Audit

Write-enabled builder/fix execution captures pre/post git state under `write-audit/<phase>/`.

Artifacts include status, diff stats, diff patches, changed/untracked file lists, and summary.

Post-write review gate artifacts:

- `post-write-review-required.json`
- `post-write-review-status.json`
