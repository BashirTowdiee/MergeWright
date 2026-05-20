# Stage Plan flow

This diagram shows the human-gated multi-stage delivery path for Stage Plans.

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

Related docs:

- `docs/workflows/stage-plan.md`
- `docs/architecture/flows.md`
- `docs/safety/write-mode.md`
