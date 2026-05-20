# Write gates flow

This diagram shows how MergeWright keeps write execution explicit, gated, and auditable.

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

Related docs:

- `docs/safety/write-safety.md`
- `docs/safety/write-mode.md`
- `docs/architecture/flows.md`
