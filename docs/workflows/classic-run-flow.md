# Classic run flow

This diagram shows how a classic `run` or `continue-run` moves through planning, implementation, review, bounded fixes, and checks.

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

Related docs:

- `docs/workflows/classic-run.md`
- `docs/architecture/flows.md`
- `docs/safety/write-mode.md`
