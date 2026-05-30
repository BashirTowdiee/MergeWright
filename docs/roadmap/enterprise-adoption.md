# Enterprise Adoption Roadmap

## Status

Proposed implementation roadmap, based on repository review and competitive research completed on 2026-05-21.

## Strategic thesis

MergeWright should become the evidence-first control plane for AI-assisted code integration.

The product should not try to be the best coding agent, the best semantic merge driver, or the best stacked-diff tool. Those spaces are already served by adjacent tools such as coding agents, merge queues, semantic merge tools, and review workflow platforms.

MergeWright should own the higher-value enterprise question:

> Can this AI-assisted change be trusted enough to merge, and what proof supports that decision?

## Product wedge

### Current strength

MergeWright already has a strong local-first delivery-harness foundation:

- staged Planner, Builder, Reviewer workflows
- write-safety controls
- human-gated acceptance
- bounded fix loops
- run artefacts and change reports
- reviewer verdict parsing
- web-first interface direction over CLI-compatible workflows
- provider abstraction direction

### Enterprise gap

The current repo is still early as an enterprise product. The next gaps are not more prompt variants. The gaps are durability, integrations, policy, team controls, and proof surfaces.

Enterprise users will adopt MergeWright when it becomes a reliable layer around agents and pull requests:

- evidence capture before summaries
- deterministic merge-readiness checks
- visible status checks in the forge
- repeatable policy decisions
- audit records that survive local machines
- secure runner and secrets boundaries
- team-level rules, approvals, and reporting

## Roadmap principles

- Evidence outranks generated summaries.
- No merge-ready result without required proof.
- The CLI remains useful, but teams need shared visibility.
- GitHub-native adoption should come before broad forge support.
- Security and auditability should be designed into the data model, not bolted on later.
- Provider flexibility should stay behind stable executor contracts.
- Do not build a bespoke semantic merge engine until the governance layer proves daily value.
- Prefer vertical slices that can be used on real pull requests.

## Roadmap overview

| Stage | Name | Primary outcome | Adoption level |
|---|---|---|---|
| 0 | Product foundation | Clean, releasable, documented project | Individual developers |
| 1 | Evidence and policy core | Deterministic merge-readiness engine | Small teams |
| 2 | GitHub-native workflow | PR checks, comments, and artefact links | Daily team workflow |
| 3 | Shared review console | Team-visible run, evidence, and approval UI | Engineering teams |
| 4 | Enterprise controls | SSO, RBAC, audit logs, secure runners | Enterprise pilots |
| 5 | Integration platform | GitLab, Bitbucket, Slack, Jira, Linear, API | Cross-tool adoption |
| 6 | Scale intelligence | Monorepo, queue, conflict, and CI optimisation | Platform teams |
| 7 | Commercial and deployment packaging | SaaS, hybrid, and self-hosted offerings | Enterprise procurement |

## Stage 0: Product foundation

### High-level implementation

Turn MergeWright from an early local tool into a cleanly releasable product with consistent naming, stable installation, and trustworthy documentation.

### Mid-level implementation

- Fix remaining stale branding and product terminology.
- Make the public README match the implemented backend and workflow support.
- Define supported, experimental, and future capabilities explicitly.
- Add release packaging and versioning.
- Ensure CI is visible, reliable, and release-gating.
- Create a concise first-run path for new users.

### Low-level implementation

- Search repo metadata, docs, examples, package fields, and comments for stale Shepherds-Staff or Shephards-Staff references.
- Update `package.json` fields so name, description, repository, bin, licence, and private/publish settings match the intended distribution model.
- Add a `CHANGELOG.md` with an initial unreleased section and release note conventions.
- Add installation docs for local checkout, npm-style package usage if intended, and binary usage if intended.
- Add a backend support matrix that separates `codex-cli`, `opencode-cli`, and future providers.
- Add a `docs/product/00-product-positioning.md` page that states the control-plane thesis.
- Harden CI so `build`, `test`, `docs:check`, and docs site build are required before release.
- Add a `docs/release.md` page covering versioning, release checks, and artefact expectations.

### Exit criteria

- A new developer can install, run, inspect, and understand MergeWright within 15 minutes.
- Public claims match implemented behaviour.
- The repo no longer leaks old project names.
- Releases are repeatable.

## Stage 1: Evidence and policy core

### High-level implementation

Create a canonical evidence model and deterministic merge-readiness policy engine. This is the core differentiator.

### Mid-level implementation

- Add a canonical `evidence.json` manifest for every run.
- Define evidence types, provenance, required checks, and missing-evidence behaviour.
- Convert readiness scoring into policy decisions that explain pass, fail, warning, and unknown states.
- Make stage contracts produce machine-readable acceptance requirements.
- Ensure reports read from evidence first, then summaries.

### Low-level implementation

- Add typed domain models for `EvidenceManifest`, `EvidenceItem`, `PolicyRule`, `PolicyDecision`, `ReadinessResult`, and `StageContract`.
- Emit `evidence.json` during run execution instead of reconstructing evidence only after the fact.
- Capture diff metadata, changed files, git head SHA, base SHA, command invocations, command exit codes, test output references, reviewer verdicts, write-audit summaries, and fix-loop history.
- Add policy rules for required checks missing, failed checks, reviewer fail, post-write review missing, scope drift, dirty worktree, forbidden path touched, and stale base branch.
- Add a policy configuration file, for example `mergewright.policy.json`, with repo defaults and stage overrides.
- Update `report-run` to show policy decision, blocking reasons, missing evidence, non-blocking risks, and manual review checklist.
- Add golden fixture tests for policy decisions.
- Add regression tests proving no `PASS` is possible when required evidence is absent.

### Exit criteria

- Every run has a canonical evidence manifest.
- Readiness decisions are deterministic and test-covered.
- Reports can explain exactly why a change is or is not merge-ready.

## Stage 2: GitHub-native workflow

### High-level implementation

Make MergeWright visible inside pull requests so engineers do not need to leave their normal review flow.

### Mid-level implementation

- Build a GitHub App or GitHub Action integration as the first forge-native surface.
- Publish merge-readiness as a status check.
- Add PR comments with concise evidence summaries and links to artefacts.
- Support rerun, continue, fix, and report-generation actions through safe commands.
- Preserve local-first CLI usage while adding shared PR visibility.

### Low-level implementation

- Define webhook handlers for pull request opened, synchronised, reopened, ready for review, review submitted, and check suite events.
- Add a GitHub check-run formatter for readiness status, blocking reasons, artefact links, and reviewer verdict.
- Add a PR comment renderer that is concise and idempotent.
- Add repository installation config for allowed branches, required policies, and runner mode.
- Add a GitHub Action wrapper for teams that do not want an app at first.
- Store run IDs and commit SHAs so PR comments and status checks can be updated safely.
- Add tests using saved webhook payload fixtures.
- Document a minimal GitHub onboarding path.

### Exit criteria

- A team can install MergeWright on a GitHub repo and see readiness results on a real PR.
- Merge-readiness can be used as a required check.
- PR output is concise enough for daily use.

## Stage 3: Shared review console

### High-level implementation

Add a lightweight web console for teams to review runs, evidence, policy decisions, and approval history.

### Mid-level implementation

- Add an API and data store for runs, evidence metadata, policies, approvals, and users.
- Add an artefact store for logs, reports, diffs, and evidence packs.
- Build a web UI focused on run timeline, policy decision, changed files, reviewer findings, and approvals.
- Make the web app the main local and shared review cockpit for CLI-equivalent workflows; keep the CLI as the automation surface and treat the TUI as superseded.

### Low-level implementation

- Add Postgres-backed tables for organisations, repositories, runs, stages, evidence items, policy decisions, approvals, integrations, and audit events.
- Add S3-compatible object storage for evidence packs and generated reports.
- Add REST endpoints for listing runs, reading one run, reading policy decisions, downloading artefacts, and recording approvals.
- Build UI pages for repository dashboard, run detail, evidence browser, readiness decision, and approval trail.
- Add diff rendering and Markdown report rendering.
- Add search and filters by repo, branch, author, status, risk level, stage, and date.
- Add retention settings for artefacts and logs.
- Add end-to-end tests for run ingestion and UI rendering from fixtures.

### Exit criteria

- Engineering leads can inspect AI-assisted work across repositories without opening local run directories.
- Reviewers can understand blocked states and evidence gaps quickly.
- Artefacts are durable and shareable.

## Stage 4: Enterprise controls

### High-level implementation

Add the controls required for enterprise pilots: identity, access, auditability, secure execution, and secrets boundaries.

### Mid-level implementation

- Add SSO and team access controls.
- Add RBAC for organisation, repository, policy, runner, and approval actions.
- Add immutable audit logging.
- Add customer-hosted runner support.
- Add secrets isolation and network egress controls.
- Add prompt-injection and untrusted-output handling guidance.

### Low-level implementation

- Add SAML or OIDC SSO support.
- Add SCIM later if enterprise account provisioning becomes a blocker.
- Define roles such as owner, admin, maintainer, reviewer, runner operator, and read-only auditor.
- Emit audit events for policy changes, approvals, rejected approvals, runner registration, secrets access attempts, and artefact downloads.
- Add signed runner registration tokens and short-lived runner credentials.
- Add runner modes for local, hosted, and customer-managed execution.
- Add secret redaction to logs and artefacts.
- Add configurable network egress policy for runners.
- Add security docs covering data flow, trust boundaries, artefact retention, and incident response.
- Add integration tests for tenant isolation and permission checks.

### Exit criteria

- A security-conscious team can pilot MergeWright without sharing source code with a hosted runner.
- Admins can answer who approved what, when, under which policy, and with which evidence.
- Runner and artefact access is controlled and auditable.

## Stage 5: Integration platform

### High-level implementation

Expand from GitHub-first to a toolchain platform while preserving the same evidence and policy core.

### Mid-level implementation

- Add GitLab support after GitHub proves the model.
- Add Bitbucket support if customer demand justifies it.
- Add Slack, Jira, and Linear integrations for notifications and traceability.
- Add a public API and SDK for custom workflows.
- Expand provider adapters only after executor contracts are stable.

### Low-level implementation

- Introduce a forge adapter interface for pull request metadata, comments, status checks, webhooks, and branch protection signals.
- Implement GitLab merge request comments, pipeline status, and merge train awareness.
- Implement Bitbucket pull request build status and comment support if prioritised.
- Add Slack notifications for blocked runs, ready-for-review runs, merge-ready runs, and policy changes.
- Add Jira and Linear issue-link extraction from branch names, commits, and PR descriptions.
- Add REST API tokens, scoped API permissions, and rate limits.
- Add SDK examples for custom policy rules and external evidence injection.
- Add provider capability matrix tests for Codex, OpenCode, and any future providers.

### Exit criteria

- MergeWright can fit into common engineering workflows without becoming GitHub-only.
- Integrations reuse the same run, evidence, and policy model.
- External systems can consume readiness and evidence data safely.

## Stage 6: Scale intelligence

### High-level implementation

Add features that make MergeWright valuable to platform teams managing large repos, high PR volume, and expensive CI.

### Mid-level implementation

- Add concurrent change and conflict-risk detection.
- Add monorepo impact analysis.
- Add selective check recommendations.
- Add queue visibility and stale-branch detection.
- Add analytics for broken-main prevention and review bottlenecks.

### Low-level implementation

- Build a repository graph from changed files, dependency metadata, package boundaries, owners, and recent PR history.
- Detect overlapping changed files and high-risk ownership areas across open PRs.
- Add stale-base policy rules when target branch moved after evidence was captured.
- Add optional integration with GitHub merge queue and GitLab merge trains.
- Add test-selection hints by path, package, owner, and dependency impact.
- Add metrics for blocked-run reasons, missing evidence frequency, fix-loop counts, review turnaround, and readiness trend.
- Add dashboards for risky branches, noisy policies, frequent conflict paths, and CI cost hotspots.
- Add false-positive feedback capture for policy rules.

### Exit criteria

- Platform teams can use MergeWright to reduce integration risk, not only inspect individual runs.
- Teams can identify where AI-assisted changes repeatedly create review or merge risk.
- Policy tuning is driven by observed data.

## Stage 7: Commercial and deployment packaging

### High-level implementation

Package MergeWright for adoption, procurement, and long-term operation.

### Mid-level implementation

- Keep the local CLI and core harness developer-friendly.
- Monetise shared control-plane, team, and enterprise features.
- Offer SaaS, hybrid, and self-hosted deployment options.
- Add marketplace and procurement-ready documentation.
- Add support and success processes.

### Low-level implementation

- Define open-core boundaries: local CLI, local evidence, and basic reports stay free; hosted evidence, team policy, SSO, audit, managed runners, and enterprise deployment become paid features.
- Add billing primitives for active developers, repositories, runner minutes, and storage.
- Publish GitHub Marketplace listing once the GitHub App is stable.
- Add deployment templates for Docker Compose, Helm, and Terraform when the API is stable.
- Add backup, restore, retention, migration, and upgrade docs.
- Add service-level objectives for API availability, runner queue time, and artefact retrieval.
- Add admin onboarding docs, security review packet, and pilot checklist.
- Add sample enterprise case studies once pilots exist.

### Exit criteria

- MergeWright can be trialled by a team, adopted by an engineering organisation, and reviewed by security/procurement.
- Deployment choices are explicit.
- Commercial packaging maps to team value rather than blocking basic local usage.

## Suggested sequencing

### First 30 days

- Finish Stage 0.
- Start Stage 1 with `evidence.json` and deterministic policy decisions.
- Add golden policy tests.
- Update docs so product claims, backend support, and roadmap match reality.

### Days 31 to 60

- Complete Stage 1.
- Start GitHub Action or GitHub App proof of concept.
- Publish readiness output as a GitHub check on a real PR.
- Add GitHub webhook fixtures and tests.

### Days 61 to 90

- Complete a GitHub-native beta flow.
- Add durable run metadata and artefact storage prototype.
- Build the first shared run detail page.
- Pilot on MergeWright itself and one external repo.

### Next 6 months

- Harden enterprise controls.
- Add customer-managed runner mode.
- Add team policy management.
- Add Slack and issue tracker integrations.
- Start enterprise pilot packaging.

## Success metrics

| Area | Metric |
|---|---|
| Developer adoption | Time from install to first assessed run |
| Daily usefulness | Weekly active repositories and repeat runs per repo |
| Trust | Percentage of readiness decisions with complete evidence |
| Review efficiency | Median time from run completion to accepted change |
| Safety | Number of blocked unsafe write or missing-evidence cases |
| Enterprise readiness | Number of pilots passing security review |
| Product quality | Policy false-positive and false-negative feedback rate |
| Commercial signal | Trial-to-team conversion and retained active developers |

## Non-goals for now

- Do not build a full semantic merge engine yet.
- Do not build a generic agent marketplace yet.
- Do not optimise for every forge before GitHub proves the workflow.
- Do not make auto-merge the headline feature.
- Do not hide policy failures behind optimistic summaries.
- Do not depend on parsing TUI or CLI text output for core product state.

## Implementation stance

The strongest path is to productise MergeWright as a trusted merge-readiness layer for AI-assisted teams:

```text
Agents produce changes.
CI produces signals.
Reviewers produce judgement.
MergeWright turns all of it into evidence, policy, and a defensible merge decision.
```
