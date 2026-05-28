# AGENTS

## Project Overview
- MergeWright is a local-first TypeScript CLI delivery harness for AI-assisted software delivery.
- Primary goal: produce reviewable, auditable, merge-ready change evidence through staged workflows.
- Product surface is CLI-first, with TUI/API/Web support layers evolving around shared workflow/application logic.

## Tech Stack
- Node.js `>=22` with npm workspaces.
- TypeScript (`module: NodeNext`, strict mode).
- Runtime libraries: Fastify, Ink, React, Zod.
- Docs site: Astro (`docs-site`).
- Tests: Node built-in test runner (`node --test`) against compiled `dist/test/**/*.test.js`.

## Source Of Truth Files
- Repo overview: `README.md`.
- CLI command inventory: `docs/cli/commands.md`.
- Architecture boundaries: `docs/architecture/overview.md`.
- Safety and contribution policy: `CONTRIBUTING.md`, `SECURITY.md`.
- Build/test command source: root `package.json` scripts.
- Workspace/package entrypoints: `apps/*/package.json`, `packages/*/package.json`.
- TypeScript compile scope: `tsconfig.json`.
- Runtime config shape/examples: `src/config/types.ts`, `config.example.json`, `configs/*.example.json`.
- Module map and boundaries for agent work: `CODEMAP.yml`.

## First Steps For Agents
- Read `README.md`, this file, and `CODEMAP.yml` before editing.
- If `CODEMAP.yml` is missing or stale for planned structural work, create/update it before or alongside changes.
- Confirm commands from `package.json` scripts before running anything not documented.
- Inspect only relevant paths listed in `CODEMAP.yml` instead of broad repo scans.

## Repository Structure
- `apps/`: app boundaries (`cli`, `api`, `web`) and workspace manifests/tsconfig.
- `packages/`: public workspace packages (`application`, `domain`, `adapters`, `config`, `shared`).
- `src/`: implementation modules (cli, workflows, application, safety, evidence, reporting, tui, api, web, config).
- `test/`: boundary and behavior tests.
- `docs/`: architecture, workflows, safety, and command docs.
- `configs/`: checked-in example/project configs (`*.example.json` mostly).
- `stages/`, `runs/`, `prompts/`, `plans/`: delivery workflow inputs/artefacts and planning records.

## Architecture Rules
- Keep CLI parsing/dispatch in CLI modules; do not move delivery policy into presentation glue.
- Keep orchestration logic in workflow/application layers, not duplicated across CLI/TUI/API/Web surfaces.
- TUI code must not call process execution APIs or write-capable filesystem APIs directly.
- UI/API/Web/TUI surfaces must not import CLI implementation internals.
- Preserve evidence-first flow: decisions should be grounded in diff/checks/review artefacts, not summaries alone.

## Required CODEMAP Usage
- Treat `CODEMAP.yml` as required operational metadata for scope discovery and change review.
- Update `CODEMAP.yml` whenever adding/removing/renaming modules, entrypoints, key files, tests, or scripts.
- For structural code changes, include `CODEMAP.yml` update in the same change set unless explicitly impossible.

## Naming Conventions
- Follow existing file suffix patterns: `*.command.ts`, `*-use-case.ts`, `*-service.ts`, `*-summary.ts`, `*.test.ts`.
- Keep package boundary exports explicit in `packages/*/src/index.ts`; avoid wildcard exports.
- Prefer descriptive, domain-specific names over generic helpers.

## File Size And Complexity Guidance
- Prefer focused modules; split files when responsibilities diverge.
- Soft limit: ~300 lines per file; if approaching ~500 lines, split unless a clear reason is documented.
- Keep functions small enough for direct unit testing and deterministic behavior.

## Public API And Module Boundaries
- Public package APIs are the workspace entrypoints in `packages/*/src/index.ts` plus manifest exports.
- App entrypoints are defined by `apps/*/package.json` and app `src` entry files.
- Do not bypass package/app boundaries by importing deep internal files from unrelated layers unless existing pattern already requires it and tests are updated.
- When changing package exports, update related boundary tests under `test/*boundary*.test.ts`.

## Setup And Command Discovery
- Install: `npm install`.
- Build: `npm run build`.
- Test: `npm test`.
- CLI help: `npm run mergewright -- --help`.
- Docs site: `npm run docs:dev`, `npm run docs:build`, `npm run docs:preview`, `npm run docs:check`.
- If a needed command is unclear, inspect root and workspace `package.json` scripts first; do not invent commands.

## Testing Expectations
- Run relevant tests for touched areas; for broad or risky changes run full `npm test`.
- For boundary changes, run affected boundary tests (especially `test/*boundary*.test.ts` and architecture safety tests).
- If tests are skipped, state exactly which tests were not run and why.

## Security And Secrets
- Never commit real secrets, tokens, or private config values.
- Respect write-safety assumptions: explicit write enablement, auditable mutations, no hidden commit/push behaviors.
- Treat config and path handling as security-sensitive; avoid introducing shell/path injection risks.
- Follow `.gitignore` and keep local/private config files out of commits.

## Dependency Rules
- Prefer existing dependencies and internal modules.
- Add dependencies only when necessary and justified by clear functional need.
- Any dependency changes must update lockfiles and include risk notes in review output.

## Data And Migration Rules
- No database migration system is present; do not invent one.
- Treat `runs/`, `stages/`, `prompts/`, and config files as workflow data surfaces; preserve backward compatibility where practical.
- When changing config shape or run artefact expectations, update docs/examples and related tests in the same change.

## Git Safety Rules
- Do not run destructive git commands (`reset --hard`, force checkout, history rewrite) unless explicitly requested.
- Never revert user-authored unrelated changes.
- Keep commits scoped and reviewable; call out risky paths explicitly.

## Editing Rules
- Make minimal, targeted edits aligned to the requested scope.
- Update `CODEMAP.yml` with any structural edits before finalizing.
- Preserve package/app/test boundary expectations already enforced by tests.
- Do not add unrelated refactors while implementing requested changes.

## Discovery Rules (Token-Efficient)
- Start from `CODEMAP.yml`, then open only files relevant to impacted modules.
- Prefer targeted file listings/searches over whole-repo scans.
- Use docs and boundary tests to resolve intent before exploring broad source areas.

## Review Rules
- Review for regressions, missing tests, boundary violations, safety drift, and dependency risk first.
- Verify changed paths and module boundaries against `CODEMAP.yml`.
- If structure changed without matching `CODEMAP.yml` updates, treat review as incomplete.

## Final Response Format
- Summarize: what changed and why.
- List exact files touched.
- List commands run and key outcomes.
- State test status and any skipped checks.
- State `CODEMAP.yml` status: unchanged, created, or updated, and why.
- State gaps/assumptions/risk follow-ups explicitly.

## Non-Goals
- Do not turn this repo into a generic agent runtime project.
- Do not bypass human-gated safety/acceptance model for convenience.
- Do not introduce broad architectural rewrites when a scoped fix is requested.
