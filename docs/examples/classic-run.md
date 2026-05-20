# Classic Run Example

```bash
npm run agent -- run stage-01-example --config configs/my-app.json --preset plan --dry-run
npm run agent -- run stage-01-example --config configs/my-app.json --auto-chain --allow-writes --max-fix-attempts 2
npm run agent -- continue-run <run-id> --config configs/my-app.json --execute-reviewer --run-checks --generate-report
```
