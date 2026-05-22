# ADR 0002: Evidence manifest

Status: Proposed
Date: 2026-05-22

## Context

MergeWright relies on run artefacts, review output, checks, write-safety records, and stage state to decide whether an AI-assisted change is ready to merge. Without a stable machine-readable manifest, each surface can drift into interpreting evidence differently.

The CLI, TUI, GitHub integration, future API, and future web console should all be able to read the same evidence record and reach the same merge-readiness conclusion.

## Decision

MergeWright will define a versioned evidence manifest for every meaningful run.

The manifest is the canonical index for evidence produced by a run. It should not replace raw artefacts. It should point to them, summarise their purpose, and capture enough metadata for policy evaluation, review, export, and audit.

A manifest should include:

- manifest version
- run ID
- stage ID or task ID when available
- workspace and config identity
- git base SHA
- git head SHA
- branch name
- changed files
- executed phases
- commands run
- checks run and their outcomes
- reviewer verdict
- write-safety result
- policy result when available
- artefact references
- timestamps
- failure or blocker reasons

## Shape

The initial schema should be deliberately small and extensible:

```ts
export type EvidenceManifest = {
  version: 1;
  runId: string;
  stageId?: string;
  createdAt: string;
  updatedAt: string;
  git: {
    branch?: string;
    baseSha?: string;
    headSha?: string;
    changedFiles: string[];
  };
  phases: Array<{
    name: string;
    status: "pending" | "running" | "passed" | "failed" | "skipped";
    startedAt?: string;
    finishedAt?: string;
    artefacts: string[];
  }>;
  checks: Array<{
    name: string;
    command?: string;
    status: "passed" | "failed" | "skipped";
    artefacts: string[];
  }>;
  reviewer?: {
    verdict: "pass" | "fail" | "needs_fix";
    artefacts: string[];
  };
  writeSafety?: {
    status: "passed" | "failed" | "not_required";
    artefacts: string[];
  };
  policy?: {
    status: "passed" | "failed" | "warning";
    reasons: string[];
  };
  artefacts: Array<{
    path: string;
    kind: string;
    sha256?: string;
  }>;
};
```

## Consequences

This gives every surface a single evidence index:

- CLI can show concise run status.
- TUI can render run details without scraping logs.
- GitHub checks can link to the exact evidence used.
- Future API and web console can store and retrieve evidence consistently.
- Policy evaluation can fail clearly when required evidence is missing.

The manifest must be versioned from the start so later hosted, multi-repo, or enterprise features can migrate safely.

## Non-goals

The manifest is not intended to:

- replace raw logs or artefacts
- contain full prompt or model output by default
- include secrets
- duplicate every line of test output
- make policy decisions by itself

## Follow-up work

- Add a JSON schema or Zod schema for manifest validation.
- Generate a manifest for each run.
- Add manifest golden tests.
- Add manifest verification to report generation.
- Use the manifest as policy-engine input.
