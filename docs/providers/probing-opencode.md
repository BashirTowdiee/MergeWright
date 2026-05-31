# Probing OpenCode

Use `probe-opencode` to validate CLI contract availability without executing prompts.

```bash
npm run agent -- probe-opencode --command opencode
npm run agent -- probe-opencode --config .artifacts/projects/my-app/config.json --backend opencode-reviewer --json
npm run agent -- probe-opencode --command opencode --validate-readonly-contract
```

Probe scope is help/version/run-help contract validation only.
