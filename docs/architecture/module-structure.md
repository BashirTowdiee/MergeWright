# Module Structure

Main modules:

- CLI parsing/dispatch: `src/cli.ts`, `src/cli/parse/*`
- classic workflow: `src/runner.ts`, `src/continue-run.ts`, `src/workflows/classic-run/*`
- stage-plan workflow: `src/stage-runner.ts`, `src/workflows/stage-plan/*`
- metadata/artefacts: `src/run-metadata.ts`, `src/change-report.ts`
- providers/backends: `src/execution-backends/*`
