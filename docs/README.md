# Shepherds-Staff Product Delivery Pack

This documentation pack captures the product, engineering, and UX planning for Shepherds-Staff.

Shepherds-Staff is treated as a local-first agentic workflow orchestrator for safe, staged, auditable AI-assisted software development. The CLI remains the current foundation. Future product surfaces may include a local web dashboard, VS Code extension, or desktop app.

## Structure

```txt
docs/
  product/
    01-product-discovery.md
    02-product-requirements.md
    03-product-design.md
    04-roadmap.md

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

## How to use these docs

Use these documents as living planning artefacts. They should be updated when product direction, workflow behaviour, architecture, or release expectations change.

Recommended order of use:

1. Product discovery
2. Product requirements
3. Product design
4. Architecture plan
5. Technical design
6. Data design
7. API design
8. UX/dashboard design
9. Roadmap
10. Testing, CI/CD, release, and production readiness docs

## Documentation principles

- Keep the CLI as the source of truth until a stable API/dashboard layer exists.
- Keep safety boundaries explicit.
- Prefer durable artefacts over hidden model context.
- Separate product intent from implementation details.
- Keep docs concrete enough to guide staged implementation.
