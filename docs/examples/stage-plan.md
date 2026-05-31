# Stage Plan Example

```bash
npm run agent -- import-stage-plan --from docs/examples/stage-plan.example.json --out .artifacts/runs/provider-switching
npm run agent -- run-stages --stage-plan .artifacts/runs/provider-switching/stage-plan.json --config .artifacts/projects/my-app/config.json --stop-after-each-stage --allow-writes
npm run agent -- accept-stage stage-01-provider-contract --stage-plan .artifacts/runs/provider-switching/stage-plan.json
npm run agent -- continue-stages --stage-plan .artifacts/runs/provider-switching/stage-plan.json --config .artifacts/projects/my-app/config.json --allow-writes
```
