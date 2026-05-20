# TUI Implementation Plan

## Status

Proposed implementation plan. The accepted product direction is that the TUI becomes the primary human interface, while the CLI remains the automation and scripting surface.

Framework decision: Ink is accepted for the first central TUI implementation.

## Purpose

This document defines the implementation plan for the MergeWright TUI.

The TUI should be a terminal-native control plane for safe, staged, auditable AI coding workflows. It should not be a chat app, CI dashboard, or generic command launcher.

## Best TUI concept

```txt
MergeWright TUI:
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

Use MergeWright language:

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

## Accepted framework

Ink is the accepted framework for the first central TUI implementation.

Rationale:

- MergeWright is already TypeScript/Node.
- The first TUI milestone is a read-only inspector.
- Ink gives a React-style component model without introducing another language.
- It is lower risk than OpenTUI/Solid for the first shippable TUI.

Implementation notes:

- Add `ink` and `react` through `npm install`, not by manually editing lockfiles.
- Keep the existing dependency-free `tui-spike` command as a fixture/preview helper until the Ink shell fully replaces it.
- Use Ink for the real `tui` command after dependencies are installed.
- Keep the TUI app behind shared read-model services.

Known Ink risks:

- Complex full-screen layouts can become fiddly.
- Scrollable logs and large artefacts need careful rendering.
- Focus management should be explicit and testable.
- Live rendering may need debouncing to avoid flicker.

Revisit OpenTUI/Solid only if Ink becomes a blocker for panes, scrollback, live logs, or rendering stability.

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

## Implementation stages

### Stage TUI-0: Prepare contracts

Status: complete.

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

### Stage TUI-1: Ink dependency and shell

Goal: install Ink correctly and render a real Ink app shell.

Required local command:

```bash
npm install ink react
```

Deliverables:

- `package.json` and `package-lock.json` updated by npm.
- `src/tui/App.tsx`.
- `src/tui/index.tsx`.
- `tui` command renders the Ink app shell.
- Preview app uses the existing fixture/read-model data.
- No run mutation actions.

Acceptance:

- `npm run build` passes.
- `npm test` passes.
- `npm run agent -- tui` opens the Ink shell.
- The shell shows header, runs, phase flow, safe action, and evidence preview sections.
- The TUI exits cleanly.

### Stage TUI-2: Read-only run list

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

### Stage TUI-3: Run detail and phase flow

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
- phase flow uses MergeWright terms

### Stage TUI-4: Artefact viewer

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

### Stage TUI-5: Safe action display

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

### Stage TUI-6: Controlled read-only actions

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

### Stage TUI-7: Continue/fix actions

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

### Stage TUI-8: Write-aware controls

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

### Ink component tests

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

## Live mode

Do not start with live streaming. Add it after the read-only inspector works.

Live mode needs:

- filesystem watcher
- `events.jsonl` tailing
- run metadata refresh
- log tailing
- debounced UI refresh
- cancel handling

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

## Next implementation prompt

```txt
Implement Stage TUI-1: Ink dependency and app shell.

Context:
Ink is the accepted TUI framework for MergeWright. The CLI remains the automation layer. The TUI must not own orchestration state or parse CLI stdout.

Scope:
Install Ink/React through npm, add an Ink app shell, and wire the existing `tui` command to render it.

Rules:
- Run `npm install ink react` so package-lock.json is generated correctly.
- Do not manually edit package-lock.json.
- Keep `tui-spike` as the dependency-free fixture renderer.
- Do not add run mutation actions.
- Do not change orchestration behaviour.
- Use existing TUI fixture/read-model data only.

Acceptance:
- `npm run build` passes.
- `npm test` passes.
- `npm run agent -- tui` renders an Ink app shell with header, run list, phase flow, safe action, and evidence sections.
```

## Summary recommendation

Build in this order:

1. TUI contracts and read-only services.
2. Ink framework decision.
3. Ink dependency and app shell.
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
