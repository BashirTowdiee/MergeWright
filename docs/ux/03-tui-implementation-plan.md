# TUI Implementation Plan

## Status

Proposed implementation plan. The accepted product direction is that the TUI becomes the primary human interface, while the CLI remains the automation and scripting surface.

## Purpose

This document defines the implementation plan for the Shepherds-Staff TUI.

The TUI should be a terminal-native control plane for safe, staged, auditable AI coding workflows. It should not be a chat app, CI dashboard, or generic command launcher.

## Best TUI concept

```txt
Shepherds-Staff TUI:
A terminal-native control plane for safe, staged, auditable AI coding workflows.

CLI = automation layer
TUI = primary human interface
```

The TUI should immediately answer:

- What repository am I in?
- What run am I inspecting?
- What was the run trying to do?
- Which phase passed, failed, or is blocked?
- What did the agent produce?
- What changed?
- What did the reviewer find?
- What artefacts exist?
- What action is safe next?

## UX direction

### Primary UX model

Use a three-pane local developer cockpit:

```txt
┌────────────────────┬──────────────────────────────────────┬────────────────────┐
│ Runs               │ Current run                          │ Safe action        │
│                    │                                      │                    │
│ ! docs-site build  │ Goal                                 │ Needs fix          │
│ ✓ CR-6             │ Add docs site and CI                  │                    │
│ ! provider config  │                                      │ Reviewer found:    │
│                    │ Phase flow                           │ docs route assumes │
│                    │ Planner      ✓                       │ optional metadata  │
│                    │ Builder      ✓                       │                    │
│                    │ Reviewer     !                       │ [f] Generate fix   │
│                    │ Fix          ready                   │ [o] Open artefact  │
│                    │ Checks       blocked                 │                    │
├────────────────────┴──────────────────────────────────────┴────────────────────┤
│ Artefact preview / logs / reviewer output / diff                               │
└────────────────────────────────────────────────────────────────────────────────┘
```

This gives the user:

- Left: where am I?
- Middle: what happened?
- Right: what should I do?
- Bottom: what is the evidence?

### Product feel

The TUI should feel like:

- `lazygit`
- `k9s`
- `lazydocker`
- Raycast-style command palette
- GitHub Desktop clarity, but terminal-native

Avoid:

- SaaS dashboard metrics
- CI/CD job language
- Chat-first interface
- Heavy analytics cards
- Web admin console feel

Use Shepherds-Staff language:

- Run
- Stage
- Phase
- Planner
- Builder
- Reviewer
- Fix attempt
- Checks
- Report
- Artefact
- Safety gate
- Blocked reason
- Safe next action

Avoid CI-style language:

- Pipeline
- Matrix
- Job
- Deployment
- Workflow run

## MVP scope

### MVP 1: Read-only run inspector

First shippable TUI.

Features:

- Open TUI from current repository.
- Show active project/repository context.
- List recent runs.
- Select a run.
- Show run summary.
- Show phase flow.
- Show phase statuses.
- Show artefact list.
- Preview artefacts.
- Show reviewer findings.
- Show blocked reason.
- Show safe next action as display-only.
- Open artefact in editor.
- Open run directory.

Do not include yet:

- Start run.
- Continue run.
- Request fix.
- Write-enabled execution.
- Commit.
- Provider switching.
- Web dashboard.

### MVP 2: Controlled actions

Add safe actions after the read-only state model is solid.

Features:

- Continue run.
- Request fix.
- Generate change report.
- Generate PR summary.
- Rerun reviewer where valid.
- Stop active run.
- Open changed files.

### MVP 3: Write-aware workflow

Add explicit write controls.

Features:

- Write-safety panel.
- Write-enabled confirmation modal.
- Post-write review gate.
- Blocked-state explanation.
- Fix attempt history.
- Review retry history.
- Controlled local commit, optional later.

## Architecture principle

The TUI must not own orchestration.

Correct architecture:

```txt
Filesystem/config/run artefacts
  ↓
readers/repositories
  ↓
application services
  ↓
CLI and TUI
```

Bad:

```txt
TUI -> shell out to CLI -> parse stdout -> mutate local TUI state
```

Good:

```txt
CLI -> application service -> orchestration core
TUI -> application service -> orchestration core
```

The TUI should only own:

- selected run
- selected phase
- selected artefact
- focused pane
- scroll position
- filters
- open modal
- command palette state

The application/domain layer should own:

- config loading
- stage discovery
- run inspection
- phase state
- artefact index
- safety gates
- available actions
- run continuation
- fix request
- report generation
- provider execution

## Proposed folder structure

```txt
src/
  application/
    list-projects.ts
    inspect-project.ts
    list-stages.ts
    inspect-stage.ts
    list-runs.ts
    inspect-run.ts
    read-artefact.ts
    get-available-actions.ts
    continue-run.ts
    request-fix.ts
    generate-report.ts
    open-run-directory.ts
    open-artefact.ts

  runs/
    run-repository.ts
    run-metadata.ts
    run-status.ts
    phase-status.ts
    run-events.ts
    artefact-index.ts

  tui/
    index.tsx
    App.tsx

    state/
      tui-state.ts
      tui-actions.ts
      focus-model.ts
      keymap.ts

    hooks/
      useProjectContext.ts
      useRuns.ts
      useRunDetail.ts
      useArtefactPreview.ts
      useAvailableActions.ts
      useKeyboardShortcuts.ts
      useTerminalSize.ts
      useRunWatcher.ts

    panes/
      RunListPane.tsx
      CurrentRunPane.tsx
      PhaseFlowPane.tsx
      ArtefactPane.tsx
      SafeActionPane.tsx
      DoctorPane.tsx
      ConfigPane.tsx

    components/
      layout/
        Pane.tsx
        HeaderBar.tsx
        FooterBar.tsx
        FocusBorder.tsx

      lists/
        SelectableList.tsx
        KeyValueTable.tsx
        TreeList.tsx

      workflow/
        PhaseFlow.tsx
        PhaseNode.tsx
        RunSummary.tsx
        ReviewFindings.tsx

      artefacts/
        ArtefactList.tsx
        ArtefactPreview.tsx
        MarkdownPreview.tsx
        JsonPreview.tsx
        LogPreview.tsx
        DiffPreview.tsx

      safety/
        SafetyGatePanel.tsx
        SafetyRuleList.tsx
        AvailableActionList.tsx
        ConfirmDangerAction.tsx

      feedback/
        EmptyState.tsx
        ErrorPanel.tsx
        LoadingPanel.tsx
        BlockedReasonPanel.tsx
```

## Core view models

Define view models before choosing Ink or OpenTUI/Solid. These make the TUI portable.

```ts
export type RunStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "blocked"
  | "cancelled"
  | "unknown";

export type PhaseStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "blocked"
  | "skipped"
  | "unknown";

export type RunListItemViewModel = {
  id: string;
  title: string;
  status: RunStatus;
  subtitle: string;
  startedAt?: string;
  completedAt?: string;
  branch?: string;
  mode?: "dry-run" | "read-only" | "write-enabled" | "auto-chain";
};

export type PhaseNodeViewModel = {
  id: string;
  label: string;
  status: PhaseStatus;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  artefactIds: string[];
  blockedReason?: string;
};

export type ArtefactViewModel = {
  id: string;
  title: string;
  kind: "markdown" | "json" | "log" | "diff" | "text";
  path: string;
  phaseId?: string;
  sizeBytes?: number;
};

export type SafeActionViewModel = {
  id:
    | "continue"
    | "request-fix"
    | "generate-report"
    | "generate-pr-summary"
    | "open-artefact"
    | "open-run-folder"
    | "rerun-reviewer"
    | "stop";
  label: string;
  enabled: boolean;
  blockedReason?: string;
  risk: "low" | "medium" | "high";
  requiresConfirmation: boolean;
};
```

A run detail view model should compose these:

```ts
export type RunDetailViewModel = {
  id: string;
  title: string;
  goal?: string;
  status: RunStatus;
  workspaceRoot: string;
  branch?: string;
  mode?: string;
  provider?: string;
  model?: string;
  phases: PhaseNodeViewModel[];
  artefacts: ArtefactViewModel[];
  safeActions: SafeActionViewModel[];
  blockedReason?: string;
  reviewerFindings?: ReviewFindingViewModel[];
};
```

## UI layout details

### Header

Purpose: keep repo context visible.

Example:

```txt
Shepherds-Staff  Repo: Shepherds-Staff  Branch: docs/tui-primary-interface  Mode: local
```

Include:

- project name
- shortened workspace path
- git branch
- dirty/clean status
- provider/backend
- current time or live indicator

### Left pane: Runs

```txt
Runs
────────────────────
! docs-site build
  failed · 2 min ago

✓ product docs
  passed · 28 min ago

! provider config
  blocked · yesterday
```

Keyboard:

- j/k: move
- enter: select
- /: filter
- r: refresh

Filters:

- all
- failed
- blocked
- running
- passed

### Middle pane: Current run

Top summary:

```txt
Goal
Add product docs and Astro docs site

Status
Failed at reviewer

Mode
Auto-chain, read-only
```

Phase flow:

```txt
Planner       ✓  completed
Builder       ✓  completed
Reviewer      !  failed
Fix Planner   ○  ready
Fix Executor  ○  pending
Checks        ○  blocked
Report        ○  pending
```

Use a vertical flow first. It is simpler and more terminal-friendly than a graph.

Later, support branching:

```txt
Planner
  ↓
Builder
  ↓
Reviewer
  ├─ pass → Checks → Report
  └─ fail → Fix Planner → Fix Executor → Reviewer retry
```

### Right pane: Safe action

Purpose: prevent the user from guessing.

```txt
Safe next action
────────────────────
Needs fix

Reviewer found:
docs route assumes optional order metadata exists.

Available:
[f] Generate fix prompt
[o] Open reviewer output
[d] View diff

Blocked:
Checks cannot run until review passes.
```

This pane is critical. It is what makes Shepherds-Staff different from a log viewer.

### Bottom pane: Artefact preview

Tabs:

```txt
[Output] [Logs] [Diff] [Metadata] [Report]
```

Renderers:

- Markdown: headings, bullets, code fences.
- JSON: formatted tree or pretty JSON.
- Log: scrollable text.
- Diff: minimal syntax highlighting.
- Text: plain.

## Keyboard model

Global shortcuts:

- q: quit
- ?: help
- tab: next pane
- shift-tab: previous pane
- r: refresh
- /: filter/search
- :: command palette
- escape: close modal/back

Run shortcuts:

- j/k: move selection
- enter: select/open
- p: planner output
- b: builder output
- v: reviewer output
- f: fix output
- l: logs
- d: diff
- m: metadata
- g: generate report
- c: continue
- x: stop/cancel
- o: open artefact in editor

Dangerous actions should always use a confirmation modal:

```txt
Write-enabled execution

This may modify files in the target repository.

Safety:
✓ Git repo valid
✓ Branch allowed
✓ Working tree clean
✓ Post-write review required

Type "allow writes" to continue.
```

Never bury write-mode behind a shortcut alone.

## Required application services

### `listRuns`

```ts
listRuns(input: {
  projectRoot: string;
  filter?: RunStatus | "all";
}): Promise<RunListItemViewModel[]>
```

### `inspectRun`

```ts
inspectRun(input: {
  projectRoot: string;
  runId: string;
}): Promise<RunDetailViewModel>
```

### `readArtefact`

```ts
readArtefact(input: {
  projectRoot: string;
  runId: string;
  artefactId: string;
}): Promise<RenderableArtefact>
```

### `getAvailableActions`

```ts
getAvailableActions(input: {
  projectRoot: string;
  runId: string;
}): Promise<SafeActionViewModel[]>
```

### `executeTuiAction`

```ts
executeTuiAction(input: {
  projectRoot: string;
  runId: string;
  actionId: SafeActionViewModel["id"];
  confirmed?: boolean;
}): Promise<RunDetailViewModel>
```

The TUI should not know how to continue a run. It should call `executeTuiAction`.

## State model

### TUI state only

```ts
export type FocusedPane =
  | "runs"
  | "currentRun"
  | "artefacts"
  | "safeActions"
  | "preview";

export type TuiState = {
  selectedRunId?: string;
  selectedPhaseId?: string;
  selectedArtefactId?: string;
  focusedPane: FocusedPane;
  runFilter: "all" | "failed" | "blocked" | "running" | "passed";
  previewScrollOffset: number;
  listScrollOffset: number;
  commandPaletteOpen: boolean;
  helpOpen: boolean;
  confirmation?: {
    actionId: string;
    prompt: string;
  };
};
```

### Not TUI state

Do not put these in TUI state as source of truth:

- config values
- stage content
- run status
- phase status
- artefact metadata
- available actions
- safety gate result
- provider config

They are domain/application state.

## Important reusable components

### Layout components

- Pane
- HeaderBar
- FooterBar
- FocusBorder
- SplitLayout
- StatusLine

### Workflow components

- RunSummary
- PhaseFlow
- PhaseNode
- ReviewFindings
- ChangedFilesSummary

### Safety components

- SafetyGatePanel
- SafetyRuleList
- BlockedReasonPanel
- AvailableActionList
- ConfirmDangerAction

This is the most important category.

### Artefact components

- ArtefactList
- ArtefactPreview
- MarkdownPreview
- JsonPreview
- LogPreview
- DiffPreview

### Utility components

- SelectableList
- KeyValueTable
- HelpOverlay
- CommandPalette
- EmptyState
- ErrorPanel
- LoadingPanel

## Doctor screen

Include a diagnostics screen early.

```txt
Doctor
────────────────────────
Node version             ✓
Git available            ✓
Current directory repo   ✓
Config valid             ✓
Runs directory writable  ✓
Codex available          ✓
OpenCode available       ?
Working tree clean       !
```

Checks:

- Node version
- package installed
- Git available
- workspace is repo
- config exists
- config valid
- prompts directory exists
- runs directory writable
- provider executable available
- provider probe result
- working tree state
- docs-site build scripts, if relevant

## Framework decision

### Option A: Ink

Use if:

- faster MVP is more important
- React mental model is preferred
- lower framework risk is preferred
- the first goal is a read-only inspector

Concerns:

- complex full-screen layouts
- scrolling logs
- focus management
- flicker risk in live views

### Option B: OpenTUI/Solid

Use if:

- TUI is definitely central
- a serious full-screen terminal app is the goal
- ecosystem risk is acceptable
- OpenCode-style architecture is desirable

Concerns:

- less mature docs
- smaller community
- more framework-specific debugging

### Recommendation

Do a two-spike decision.

Build the same screen in both:

- left run list
- middle phase flow
- right safe action
- bottom artefact preview
- keyboard navigation
- scrollable log
- terminal resize

Timebox:

- Ink spike: 1 day
- OpenTUI/Solid spike: 1 day
- Decision doc: 0.5 day

Acceptance:

```txt
Which framework handles panes, focus, scroll, resize, and live updates with less friction?
```

## Implementation stages

### Stage TUI-0: Prepare contracts

Goal: make TUI possible without UI work.

Deliverables:

- RunListItemViewModel
- RunDetailViewModel
- PhaseNodeViewModel
- ArtefactViewModel
- SafeActionViewModel
- listRuns service
- inspectRun service
- readArtefact service
- getAvailableActions service

Tests:

- listRuns returns sorted runs
- inspectRun handles missing metadata
- inspectRun maps phases consistently
- getAvailableActions returns blocked reasons
- readArtefact supports markdown/json/log/text

### Stage TUI-1: Framework spike

Goal: choose Ink vs OpenTUI/Solid.

Deliverables:

- `spike/ink-tui`
- `spike/opentui-solid`
- decision doc

Acceptance:

- Both render the same hard screen.
- Both support pane focus.
- Both support scrollable preview.
- Both handle resize.
- Decision is recorded.

### Stage TUI-2: TUI shell

Goal: add entry point and app shell.

Command:

```bash
npm run agent -- tui
```

Deliverables:

- tui command
- App component
- HeaderBar
- FooterBar
- Pane layout
- keyboard focus switching
- help overlay
- empty states

Acceptance:

- TUI opens.
- TUI shows current repo context.
- TUI quits cleanly.
- TUI shows help.
- TUI does not execute run actions.

### Stage TUI-3: Read-only run list

Deliverables:

- RunListPane
- useRuns
- run filters
- run selection
- refresh

Acceptance:

- recent runs appear
- failed/blocked/passed statuses render
- selection changes current run detail
- missing runs directory shows helpful empty state

### Stage TUI-4: Run detail and phase flow

Deliverables:

- CurrentRunPane
- PhaseFlow
- PhaseNode
- selected phase
- blocked reason rendering

Acceptance:

- selected run shows goal/status/phases
- failed phase is obvious
- blocked state is explained
- phase flow uses Shepherds-Staff terms

### Stage TUI-5: Artefact viewer

Deliverables:

- ArtefactList
- ArtefactPreview
- MarkdownPreview
- JsonPreview
- LogPreview
- DiffPreview
- scrolling preview
- open artefact in editor

Acceptance:

- planner output renders
- reviewer output renders
- metadata renders
- logs are scrollable
- missing artefact shows clear error

### Stage TUI-6: Safe action display

Deliverables:

- SafeActionPane
- AvailableActionList
- BlockedReasonPanel
- SafetyGatePanel

Acceptance:

- safe next action is visible
- blocked actions show reason
- write actions are marked high risk
- no action is inferred in the TUI without application service result

### Stage TUI-7: Controlled read-only actions

Add low-risk actions:

- open artefact
- open run folder
- generate report
- generate PR summary
- refresh

Acceptance:

- actions call application services
- TUI refreshes after action
- errors render in ErrorPanel
- no write-enabled action exists yet

### Stage TUI-8: Continue/fix actions

Add controlled workflow actions:

- continue run
- request fix
- rerun reviewer
- stop run

Acceptance:

- only enabled when application service says enabled
- blocked reasons shown
- confirmation appears for medium/high risk
- run detail refreshes after action

### Stage TUI-9: Write-aware controls

Deliverables:

- write-safety panel
- confirm write modal
- post-write review gate
- fix attempt history
- review retry history

Acceptance:

- write-enabled actions require explicit confirmation
- safety check failure blocks action
- post-write review requirement is visible
- no auto-commit or auto-push is introduced

## Testing strategy

### Unit tests

Test:

- view model mappers
- available action logic
- run status mapping
- phase status mapping
- artefact kind detection
- blocked reason rendering
- keymap resolution

### Component tests

For the chosen TUI framework:

- RunListPane renders empty state.
- RunListPane renders failed runs.
- PhaseFlow highlights failed phase.
- SafeActionPane shows blocked reason.
- ArtefactPreview handles missing artefact.
- HelpOverlay lists shortcuts.

### Integration tests

- create fake run directory
- load TUI service layer
- list runs
- inspect run
- read artefact
- derive actions

### Manual smoke test

```bash
npm run agent -- tui
```

Check:

- opens cleanly
- keyboard navigation works
- run list works
- artefact preview scrolls
- resize does not break layout
- quit exits cleanly

## Data and metadata requirements

Ideal run directory:

```txt
runs/<project>/<timestamp-stage>/
  run.json
  artefacts.json
  events.jsonl
  planner-output-last-message.md
  builder-output-last-message.md
  reviewer-output-last-message.md
  review-to-fix-output-last-message.md
  checks-output.log
  change-report.md
  pr-summary.md
```

### `run.json`

Should contain:

```ts
type RunMetadata = {
  id: string;
  projectName: string;
  workspaceRoot: string;
  stageId: string;
  goal?: string;
  status: RunStatus;
  mode: string;
  createdAt: string;
  updatedAt: string;
  phases: Record<string, {
    status: PhaseStatus;
    startedAt?: string;
    completedAt?: string;
    outputArtefactIds?: string[];
    blockedReason?: string;
  }>;
  provider?: {
    id: string;
    model?: string;
  };
};
```

### `artefacts.json`

```ts
type ArtefactIndex = {
  artefacts: Array<{
    id: string;
    phaseId?: string;
    kind: "markdown" | "json" | "log" | "diff" | "text";
    title: string;
    path: string;
    createdAt?: string;
  }>;
};
```

### `events.jsonl`

Useful later for live mode:

```ts
type RunEvent = {
  id: string;
  type:
    | "phase.started"
    | "phase.completed"
    | "phase.failed"
    | "artefact.written"
    | "safety.blocked"
    | "action.available";
  timestamp: string;
  runId: string;
  phaseId?: string;
  message?: string;
};
```

## Live mode

Do not start with live streaming. Add it after the read-only inspector works.

Live mode needs:

- filesystem watcher
- `events.jsonl` tailing
- run metadata refresh
- log tailing
- debounced UI refresh
- cancel handling

Implementation:

```txt
useRunWatcher(runId)
  watches run.json
  watches artefacts.json
  tails events.jsonl
  refreshes detail safely
```

Acceptance:

- phase changes update without restarting TUI
- new artefacts appear
- logs can tail
- UI does not flicker badly

## Important UX details

### Empty states

Good empty state:

```txt
No runs found.

Start with:
npm run agent -- run <stage> --config <config> --preset plan
```

### Missing metadata

Do not crash. Show:

```txt
This run does not have structured metadata.
Some TUI features are unavailable.
Open run folder? [o]
```

### Blocked states

Always explain:

```txt
Checks are blocked because reviewer failed.
Generate fix or inspect reviewer output.
```

### Error handling

Errors should include:

- what failed
- why it failed if known
- safe next step
- path to artefact/log if useful

### Confirmation

Use clear confirmations:

```txt
This action may modify files in the target workspace.
Type "allow writes" to continue.
```

Never bury write-mode in a shortcut alone.

## Hiring appeal features

These would make the TUI stronger for AI engineering roles:

- phase-level token/cost/duration display
- provider/model metadata
- review verdict history
- fix attempt history
- tool/action audit trail
- blocked reason and safety gates
- doctor diagnostics
- replay/resume support
- change report preview
- PR summary preview

The strongest hiring signal is:

```txt
AI agent runs are observable, reviewable, resumable, and safe.
```

## First implementation prompt

```txt
Implement Stage TUI-0: TUI data contracts and read-only application services.

Context:
Shepherds-Staff is moving toward a TUI as the primary human interface. The CLI remains the automation layer. The TUI must not own orchestration state or parse CLI stdout.

Scope:
Add TUI-ready view-model types and read-only application services only.

Implement:
1. RunListItemViewModel
2. RunDetailViewModel
3. PhaseNodeViewModel
4. ArtefactViewModel
5. SafeActionViewModel
6. listRuns service
7. inspectRun service
8. readArtefact service
9. getAvailableActions service

Rules:
- Do not add a TUI framework yet.
- Do not add run mutation actions.
- Do not change existing CLI behaviour.
- Do not shell out to CLI commands.
- Read from existing run directories and metadata where available.
- Degrade gracefully when metadata is missing.
- Keep safety/action derivation centralised outside the future TUI.

Tests:
- Unit test view-model mapping.
- Test missing/partial run metadata.
- Test failed/blocked/passed phase mapping.
- Test artefact kind detection.
- Test available action derivation for failed reviewer, blocked checks, completed run, and missing metadata.

Acceptance:
- Existing tests pass.
- New services can support a read-only TUI run inspector.
- No runtime orchestration behaviour changes.
```

## Summary recommendation

Build in this order:

1. TUI contracts and read-only services.
2. Ink vs OpenTUI/Solid spike.
3. TUI shell.
4. Run list.
5. Run detail and phase flow.
6. Artefact viewer.
7. Safe action panel.
8. Controlled actions.
9. Write-aware confirmations.
10. Live mode.

Important product rules:

- TUI does not own domain state.
- TUI does not parse CLI output.
- Safe next actions come from application services.
- Write actions require explicit confirmation.
- Artefacts remain source of truth.
- CLI remains scriptable.
