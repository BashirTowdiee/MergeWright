# Shepherds-Staff Product Delivery Pack

This documentation pack captures the product, engineering, and UX planning for Shepherds-Staff.

Shepherds-Staff is defined here as a local-first agentic workflow orchestrator for safe, staged, auditable AI-assisted software development. The CLI is the current product surface and automation backbone. Future surfaces may include a local API, local web dashboard, VS Code extension, or desktop app.

## Current document status

These docs are planning artefacts. They describe the intended product direction and should not be read as implemented behaviour unless the root README or code already supports it.

Status labels used in this pack:

- Current: implemented or already represented in the existing CLI.
- Proposed: intended direction, not necessarily implemented.
- Future: intentionally out of current delivery scope.
- Open question: needs a product or technical decision.

## Structure

```txt
docs/
  product/
    01-product-discovery.md
    02-product-requirements.md
    03-product-design.md
    04-roadmap.md
    05-decisions-and-open-questions.md

  engineering/
    01-architecture-plan.md
    02-technical-design.md
    03-data-design.md
    04-api-design.md
    05-testing-strategy.md
    06-cicd-plan.md
    07-release-plan.md
    08-production-readiness.md

  ux/
    01-dashboard-design.md
```

## Recommended reading order

1. Product discovery
2. Product requirements
3. Product design
4. Decisions and open questions
5. Roadmap
6. Architecture plan
7. Technical design
8. Data design
9. API design
10. UX/dashboard design
11. Testing strategy
12. CI/CD, release, and production readiness docs

## Documentation principles

- Keep the CLI as the source of truth until a stable API/dashboard layer exists.
- Keep safety boundaries explicit.
- Prefer durable artefacts over hidden model context.
- Separate product intent from implementation details.
- Mark proposed or future capabilities clearly.
- Keep docs concrete enough to guide staged implementation.
- Keep product decisions traceable to requirements and acceptance criteria.

## Maintenance rules

Update these docs when:

- A new product surface is introduced.
- Run lifecycle states change.
- Safety gates change.
- Auto-chain behaviour changes.
- Provider support changes.
- Artefact formats or metadata schemas change.
- Release or production-readiness expectations change.
