# MergeWright flows

This page shows the main delivery flows in MergeWright.

MergeWright sits above coding agents and turns agent-generated work into reviewable, auditable, merge-ready software changes. These diagrams should be read as product flow diagrams, not implementation call graphs.

## Delivery confidence flow

This is the core product path from intent to PR-ready evidence.

```mermaid
flowchart LR
  A[Intent] --> B[Plan]
  B --> C[Implementation]
  C --> D[Review]
  D --> E{Acceptable?}
  E -- No --> F[Bounded fix loop]
  F --> C
  E -- Yes --> G[Checks]
  G --> H{Checks pass?}
  H -- No --> F
  H -- Yes --> I[Evidence bundle]
  I --> J[AI Change Report]
  J --> K[PR-ready summary]
  K --> L[Human merge decision]

  subgraph Evidence[Evidence-first delivery confidence]
    G
    I
    J
    K
  end
```

## Classic run and auto-chain flow

Use this flow for a single stage file executed through planner, builder, reviewer, optional fix attempts, checks, and report generation.

```mermaid
flowchart TD
  A[run stage file] --> B{dry-run?}
  B -- Yes --> C[Preview prompt, phase order, checks, artefact paths]
  C --> Z[No repository writes]

  B -- No --> D[Planner: read-only]
  D --> E{Builder or fix needs writes?}
  E -- No --> F[Builder: read-only or skipped]
  E -- Yes --> G[check-write-safety]
  G --> H{write-safety passes?}
  H -- No --> X[FAILED or write disabled]
  H -- Yes --> I[Builder or fix: workspace-write]
  I --> J[Capture pre/post git audit artefacts]
  F --> K[Reviewer: read-only]
  J --> K

  K --> L{Reviewer verdict}
  L -- PASS --> M{run checks requested?}
  L -- NEEDS_FIX --> N{allow-writes?}
  N -- No --> O[NEEDS_FIX_WRITE_DISABLED]
  N -- Yes --> P{fix attempts remaining?}
  P -- No --> Q[MAX_FIX_ATTEMPTS_REACHED]
  P -- Yes --> R[review-to-fix: read-only]
  R --> S[fix execution: workspace-write]
  S --> J

  M -- No --> T[PASS]
  M -- Yes --> U[Run configured checks]
  U --> V{Checks pass?}
  V -- Yes --> T
  V -- No --> W[CHECKS_FAILED or NEEDS_FIX]
```

## Stage Plan workflow

Use this flow for human-gated multi-stage delivery. Each stage is run, reviewed, fixed or accepted, and then downstream stages can be reassessed before continuing.

```mermaid
flowchart TD
  A[Import Stage Plan JSON] --> B[Canonical stage-plan.json + Markdown artefacts]
  B --> C[run-stage or run-stages --stop-after-each-stage]
  C --> D[Run one selected or next stage]
  D --> E[Stop at review_required]
  E --> F[Human inspects artefacts, diff, review output]

  F --> G{Accept stage?}
  G -- No: needs changes --> H[fix-stage with human feedback]
  H --> E

  G -- Yes --> I[accept-stage]
  I --> J{--auto-commit?}
  J -- No --> K[Stage accepted, no commit]
  J -- Yes --> L[Commit accepted stage only]
  L --> M[Store commitSha]
  K --> N{Source assumptions changed?}
  M --> N

  N -- Yes --> O[reassess-stage-plan from changed stage]
  O --> P[Downstream stages classified: unchanged / needs_revision / invalidated]
  P --> Q[continue-stages only when gates pass]
  N -- No --> Q
  Q --> C
```

## Write-safety and gate model

Write execution is explicit. Planner, reviewer, and reassessment-style phases stay read-only even when writes are enabled.

```mermaid
flowchart TD
  A[Command starts] --> B{Write mode requested?}
  B -- No --> C[Read-only execution]
  C --> D[No repository writes]

  B -- Yes --> E{Command supports writes?}
  E -- No --> F[Reject write mode]
  E -- Yes --> G[check-write-safety]
  G --> H{Safe git/workspace state?}
  H -- No --> I[Fail closed]
  H -- Yes --> J{Phase supports writes?}

  J -- Planner --> K[Force read-only]
  J -- Reviewer --> K
  J -- review-to-fix --> K
  J -- Builder/Fix --> L[workspace-write]

  L --> M[Capture pre-write audit]
  M --> N[Execute coding backend]
  N --> O[Capture post-write audit]
  O --> P[Post-write review required]
  P --> Q{Review passed?}
  Q -- No --> R[Block checks and acceptance]
  Q -- Yes --> S[Configured checks may run]
  S --> T{Checks pass?}
  T -- No --> U[Needs fix]
  T -- Yes --> V[Evidence can support acceptance]

  V --> W{Stage Plan accept-stage --auto-commit?}
  W -- Yes --> X[Commit accepted stage]
  W -- No --> Y[No auto-commit]
```

## Artefacts and AI Change Report flow

Reports are built from delivery evidence. They should not overclaim when required evidence is absent.

```mermaid
flowchart LR
  A[Stage instruction / Stage Plan] --> B[Rendered prompts]
  B --> C[Planner output]
  B --> D[Builder output]
  B --> E[Reviewer output]
  D --> F[Git diff + changed files]
  D --> G[Write audit artefacts]
  H[Configured checks] --> I[Check output]
  E --> J[Review findings]
  F --> K[Evidence collector]
  G --> K
  I --> K
  J --> K
  K --> L[AI Change Report]
  L --> M[PR summary]
  M --> N[Human reviewer]
```
