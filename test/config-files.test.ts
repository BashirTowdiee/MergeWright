import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadAndValidateConfig } from "../src/config.js";

test("config.example.json validates and has writeSafety defaults", async () => {
  const configPath = path.resolve(process.cwd(), "config.example.json");
  const config = await loadAndValidateConfig(configPath);
  assert.equal(config.writeSafety.enabled, false);
});

test("configs/acme.execution-backends.example.json validates", async () => {
  const configPath = path.resolve(process.cwd(), "configs/acme.execution-backends.example.json");
  const config = await loadAndValidateConfig(configPath);
  assert.equal(config.executionBackends["codex-local"]?.type, "codex-cli");
  assert.equal(config.agents.planner.backend, "codex-local");
});
