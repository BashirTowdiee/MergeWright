# Release process

MergeWright is currently pre-release. This document records the lightweight process to use before formal versioned releases begin.

## Pre-release checklist

Before creating a release:

- confirm the target branch is up to date
- confirm open pull requests are resolved or intentionally deferred
- run the normal build and test commands
- review `CHANGELOG.md`
- update release notes from merged pull requests
- confirm documentation links still work
- check that safety-related changes are called out clearly

## Local checks

Run:

```bash
npm run build
npm test
```

Run any additional docs or packaging checks when they exist.

## Versioning

Once formal releases begin, use semantic versioning:

- patch for fixes and documentation-only release updates
- minor for backwards-compatible features
- major for breaking CLI, config, artefact, or workflow changes

## Release notes

Release notes should include:

- highlights
- changed commands or config
- migration notes
- safety or write-safety impact
- known limitations

## Post-release

After release, verify the published artefacts and update follow-up planning notes if any release blockers were deferred.
