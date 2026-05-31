# Classic Run Example

```bash
npm run agent -- run stage-01-example --config .artifacts/projects/my-app/config.json --preset plan --dry-run
npm run agent -- run stage-01-example --config .artifacts/projects/my-app/config.json --auto-chain --allow-writes --max-fix-attempts 2
npm run agent -- continue-run <run-id> --config .artifacts/projects/my-app/config.json --execute-reviewer --run-checks --generate-report
```
