# Web App Information Architecture

## Status

Accepted product direction companion to `docs/ux/04-web-interface-implementation-plan.md`.

The web app is the primary human interface for MergeWright. The CLI remains the automation and scripting surface. The TUI is superseded.

## Product goal

The web app should make MergeWright usable as a daily delivery cockpit for AI-assisted engineering work.

It should help users answer:

- What project am I supervising?
- What runs exist and which ones need action?
- What happened inside a run?
- Why is a run blocked or ready?
- What evidence supports the decision?
- What did the reviewer find?
- What changed in the workspace?
- What command is safe to run next?
- What requires explicit approval?
- Is this work PR-ready or merge-ready?

## Navigation model

Recommended side navigation:

```text
Workspace
- Projects
- Runs
- Stage Plans
- Run Detail
- Results
- Review Details
- Evidence
- Artefacts
- Compare Runs
- Commands

Admin
- Providers
- Policy & Safety
- Team Review
- Settings
```

For MVP, implement:

```text
Projects
Runs
Run Detail
Results
Review Details
Commands
Settings
```

Then add:

```text
Stage Plans
Evidence
Artefacts
Compare Runs
Providers
Policy & Safety
Team Review
```

## Page responsibilities

### Projects

Purpose: select and supervise configured workspaces.

Primary content:

- project name
- repository path or repository remote
- config path
- default provider
- runs root
- active branch
- latest run status
- ready rate
- last run time

Primary actions:

- open project
- create project
- edit config
- run write-safety check
- start new run
- view latest artefacts

API requirements:

- list projects
- get project
- create/update project config
- resolve project health
- run write-safety check

### Runs

Purpose: daily operator queue.

Primary content:

- run id
- run title
- status
- branch
- mode
- stage
- started/completed timestamps
- duration
- readiness score
- reviewer verdict
- checks state
- safe next action

Filters:

- all
- running
- blocked
- needs fix
- ready
- failed
- write-enabled
- read-only
- auto-chain

Primary actions:

- open run detail
- continue run
- run prove
- generate report
- compare with previous run
- open artefacts

API requirements:

- `GET /runs`
- `GET /runs?status=<status>`
- future: project-scoped runs

### Stage Plans

Purpose: turn implementation plans into staged, enforceable delivery.

Primary content:

- imported stage plans
- stage status
- current stage
- stage contract
- allowed paths
- forbidden paths
- required checks
- required evidence
- acceptance criteria
- downstream stage impact

Primary actions:

- import stage plan
- run next stage
- run selected stage
- fix current stage
- accept stage
- accept and commit stage
- reassess downstream stages

API requirements:

- list stage plans
- get stage plan
- import stage plan
- run stage
- continue stages
- fix stage
- accept stage
- reassess stage plan

### Run Detail

Purpose: explain what happened and what to do next.

Primary content:

- run goal
- current status
- workspace root
- run directory
- branch
- mode
- provider/model
- phase timeline
- blocked reason
- reviewer findings
- safe next actions
- warnings
- artefact count

Primary actions:

- continue run
- request fix
- rerun reviewer
- run checks
- generate report
- generate PR summary
- open artefact
- open run folder
- stop run

API requirements:

- `GET /runs/:runId`
- `POST /commands`
- future: `GET /runs/:runId/events`

### Results

Purpose: readable merge-readiness proof.

Primary content:

- status: READY, NEEDS_REVIEW, NEEDS_FIX, BLOCKED
- score
- risk
- reviewer verdict
- checks state
- acceptance criteria totals
- missing evidence warnings
- blockers
- next action
- report links
- PR summary preview

Primary actions:

- run prove
- generate report
- generate PR summary
- copy summary
- export evidence pack

API requirements:

- run readiness query
- prove command execution
- report generation command
- generated artefact lookup

### Review Details

Purpose: make reviewer output actionable.

Primary content:

- blocking issues
- non-blocking issues
- severity
- affected files
- evidence checked
- tests observed
- acceptance criteria mapping
- risk level
- recommended fix prompt
- focused review mode results

Primary actions:

- copy recommended fix prompt
- request fix
- open affected artefact
- open affected file diff
- rerun focused review modes

API requirements:

- get reviewer verdict
- get focused review results
- run review modes
- list affected artefacts

### Evidence

Purpose: show why a run is or is not ready.

Primary content:

- evidence matrix
- required versus optional evidence
- evidence source
- present/missing/malformed status
- freshness
- associated artefact path
- blocking impact

Example matrix:

```text
Evidence item       Required   Source             Status
 git.diff           yes        write-audit        present
 checks.unit        yes        checks-status      failed
 reviewer.verdict   yes        reviewer-output    FAIL
 acceptance.map     yes        reviewer-v2        partial
 write.audit        yes        write-audit        present
```

Primary actions:

- open source artefact
- regenerate evidence
- run prove
- explain missing evidence

API requirements:

- get evidence manifest
- get missing evidence summary
- get evidence item source artefact

### Artefacts

Purpose: inspect generated outputs without opening local folders.

Primary content:

- artefact list
- kind: markdown, json, log, diff, text
- phase id
- size
- path
- preview
- raw view
- download/open locally

Important artefacts:

- `evidence.json`
- `run-report.md`
- `run-report.json`
- `pr-summary.md`
- `checks-status.json`
- `reviewer-output-last-message.md`
- write-audit summaries
- prompts
- logs

Primary actions:

- open artefact
- copy path
- download
- open locally
- compare artefacts between runs

API requirements:

- `GET /runs/:runId/artifacts`
- `GET /runs/:runId/artifacts/:artifactId`
- future: artefact content endpoint

### Compare Runs

Purpose: understand fix-loop improvement or regression.

Primary content:

- run A and run B selection
- status delta
- score delta
- risk delta
- reviewer verdict delta
- checks state delta
- changed files only in A
- changed files only in B
- failed checks delta
- acceptance regressions
- acceptance improvements
- missing evidence delta

Primary actions:

- compare runs
- copy comparison summary
- open changed file diff
- open each run detail

API requirements:

- compare-runs command
- future: direct comparison endpoint

### Commands

Purpose: main command execution UI for CLI-equivalent workflows.

Primary content:

- command template selector
- project/config selector
- run/stage selector
- options form
- human feedback input
- command preview
- risk preview
- precondition check
- confirmation gate
- typed result
- raw CLI-style output
- live event stream

Command templates:

- `run`
- `continue-run`
- `prove`
- `report-run`
- `compare-runs`
- `review-modes`
- `run-stage`
- `run-stages`
- `continue-stages`
- `accept-stage`
- `fix-stage`
- `reassess-stage-plan`
- `check-write-safety`
- `probe-opencode`

Primary actions:

- preview command
- dry run
- execute read-only
- execute write-enabled after confirmation
- copy equivalent CLI command
- view command history

API requirements:

- `POST /commands`
- future: command preview endpoint
- future: command event stream endpoint

### Providers

Purpose: make execution backend health and capability visible.

Primary content:

- configured providers
- status
- version
- read-only support
- write support
- prompt execution support
- capability declaration
- last probe
- last failure

Primary actions:

- probe provider
- validate read-only contract
- configure provider
- set default provider

API requirements:

- list providers
- probe provider
- validate provider contract

### Policy & Safety

Purpose: make trust and write safety visible before execution.

Primary content:

- write-safety status
- dirty worktree state
- allowed paths
- forbidden paths
- required checks
- required evidence
- confirmation rules
- risk levels
- command audit history

Primary actions:

- run write-safety check
- preview command risk
- approve command
- reject command
- view audit log

API requirements:

- check write safety
- preview command risk
- list policy rules
- list audit events

### Team Review

Purpose: team-visible review and approval workflow.

Primary content:

- approval queue
- blocked runs
- ready-to-merge runs
- reviewer comments
- PR summary preview
- audit trail
- who approved what
- who requested changes

Primary actions:

- approve command
- request changes
- copy PR summary
- mark reviewed
- assign reviewer

API requirements:

- approvals
- comments
- audit events
- PR integration later

### Settings

Purpose: configure local project behaviour.

Primary content:

- default config path
- runs root
- default provider
- default model
- default mode
- evidence retention
- artefact retention
- keyboard shortcuts
- theme
- GitHub integration later

## Layout guidance

Use a persistent side menu.

Use a sticky top bar with:

- breadcrumbs
- current page title
- main page actions

Use dedicated pages instead of one overloaded dashboard.

Recommended page layout pattern:

```text
Sidebar navigation
Topbar: breadcrumb + page actions
Page body:
  Summary metrics
  Main table/detail panel
  Secondary context panel
  Artefacts/output/review section
```

## Output presentation

Each command result should support three output views:

1. Human summary
2. Raw CLI-style output
3. Structured JSON result

For live commands, add event stream later:

```text
10:24:02 command accepted
10:24:03 write safety passed
10:24:12 builder started
10:25:40 reviewer failed
10:25:44 report generated
```

## MVP implementation order

1. Projects and project health
2. Runs list
3. Run detail
4. Artefacts list and preview
5. Results/prove view
6. Commands page with preview and typed execution
7. Review details
8. Stage Plans
9. Evidence matrix
10. Policy & Safety
11. Providers
12. Compare Runs
13. Team Review
14. Settings polish

## Non-goals

Avoid these early:

- chat-first interface
- generic analytics dashboard
- direct terminal emulator as the main UI
- raw stdout as primary state
- React components shelling out to CLI
- duplicated orchestration logic in the web app
- auto-merge as the headline action

The web app should feel like a delivery cockpit, not a chat app, CI dashboard, or SaaS admin panel.
