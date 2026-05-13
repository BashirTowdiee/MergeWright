# V1 Acceptance Checklist

This checklist verifies the standalone orchestrator is safe and usable in read-only mode.

## 1) Initialize a project

```bash
npm run agent -- init-project "My App" --workspace /absolute/path/to/target-repo
```

Expected:
- Creates orchestrator files only:
  - `configs/my-app.json`
  - `stages/my-app/example-stage.md`
  - `runs/my-app/.gitkeep`
- Does not write inside the target workspace.

## 2) Run a dry-run preset

```bash
npm run agent -- run example-stage --config configs/my-app.json --preset full-readonly --dry-run
```

Expected:
- Creates a new run directory under `runs/my-app/<run-id>/`
- Writes run artefacts and `run.json`
- Does not execute real Codex
- Does not run configured checks

## 3) Inspect runs

```bash
npm run agent -- list-runs --config configs/my-app.json
npm run agent -- show-run <run-id> --config configs/my-app.json
npm run agent -- open-run <run-id> --config configs/my-app.json
```

Expected:
- `list-runs` includes the generated run
- `show-run` prints metadata, phase status, and artefact listing
- `open-run` resolves and opens run dir (macOS helper; test via injected opener seam)

## 4) Continue a run in dry-run mode

```bash
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-builder --dry-run
```

Expected:
- Validates continuation path and phase dependencies
- Writes no continuation artefacts in dry-run
- Does not modify `run.json` in dry-run

## 5) Safety checklist

- Codex args include read-only sandbox (`-s read-only`)
- No preset enables write-enabled execution
- `full-readonly` resolves only to read-only phase execution flags
- Dangerous configured commands are rejected, including:
  - `/bin/bash -lc ...`
  - `/usr/bin/git commit`
  - `env git commit`
  - `rm -rf ...`
- `init-project` writes only under orchestrator root
- `continue-run --dry-run` does not update persisted run metadata

## 6) Repository hygiene

Verify:
- `npm run build`, `npm test`, and `npm run agent -- --help` work
- `.gitignore` includes:
  - `node_modules/`
  - `dist/`
  - `runs/*`
  - `!runs/.gitkeep`
  - `.env`
  - `*.log`
- No generated run outputs are intended for commit
- No test temp artefacts are intended for commit

## Known limitations (v1)

- Codex execution is read-only
- Write-enabled implementation is not available
- No auto-commit
- No auto-push
- Configured checks are opt-in and safety-filtered
