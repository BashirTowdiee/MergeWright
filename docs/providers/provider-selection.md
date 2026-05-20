# Provider Selection

Provider/backend selection is role-based using `agents.<role>.backend` mapped to `executionBackends` entries.

Roles:

- planner
- builder
- reviewer

Define providers in `executionBackends` and bind planner/builder/reviewer roles in `agents`.
