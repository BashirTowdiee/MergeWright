# Security Policy

MergeWright is a local delivery harness for AI-assisted engineering workflows. Security reports should focus on issues that could expose source code, secrets, credentials, write-safety boundaries, execution sandboxes, or repository integrity.

## Supported versions

MergeWright is currently pre-release. Security fixes are handled on the `main` branch until a formal release policy exists.

## Reporting a vulnerability

Do not open a public GitHub issue for security-sensitive reports.

Until GitHub private vulnerability reporting is configured for this repository, contact the repository owner directly with:

- a concise summary of the issue
- affected commands or files
- reproduction steps
- expected impact
- whether secrets, source code, git state, run artefacts, or write paths are involved
- any safe proof-of-concept details

Avoid sending real secrets, private tokens, or proprietary source code in the initial report.

## Security-sensitive areas

Please report issues involving:

- write-safety bypasses
- unsafe workspace mutation
- unexpected git operations
- command injection
- shell execution from UI-facing layers
- TUI or future UI paths parsing CLI stdout to infer write results
- prompt or artefact paths that leak secrets
- unsafe handling of run artefacts
- path traversal
- sandbox escapes
- insecure temporary file handling
- unsafe default permissions
- credentials committed to the repository

## Expected handling

Reports should be acknowledged as soon as practical. Valid reports will be triaged by severity and fixed before public disclosure where appropriate.

For high-impact findings, public details should wait until a fix is merged or a mitigation is available.

## Security design principles

MergeWright changes should preserve these principles:

- read-only execution by default
- explicit write enablement
- write-safety checks before write-capable phases
- auditable run artefacts
- human-gated acceptance
- no hidden commits, pushes, merges, or destructive cleanup
- no UI layer bypassing application services for writes
- no secret values in logs, prompts, reports, or evidence packs

## Disclosure scope

This policy covers the MergeWright repository and its documented workflows. Third-party tools, AI execution backends, GitHub Actions infrastructure, and user workspaces may have their own security policies.
