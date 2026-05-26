import test from "node:test";
import assert from "node:assert/strict";
import { createCliProgressLogger, shouldSuppressProgressLogger } from "../src/cli/output/progress-log-policy.js";

test("suppresses progress logging for report-run JSON stdout", () => {
  assert.equal(
    shouldSuppressProgressLogger({
      command: "report-run",
      jsonOutput: true,
      prSummary: false,
      stdoutOnly: false
    }),
    true
  );
});

test("suppresses progress logging for report-run PR summary stdout-only output", () => {
  assert.equal(
    shouldSuppressProgressLogger({
      command: "report-run",
      jsonOutput: false,
      prSummary: true,
      stdoutOnly: true
    }),
    true
  );
});

test("keeps progress logging for non-machine-readable report output", () => {
  assert.equal(
    shouldSuppressProgressLogger({
      command: "report-run",
      jsonOutput: false,
      prSummary: true,
      stdoutOnly: false
    }),
    false
  );
});

test("keeps progress logging for other commands", () => {
  assert.equal(
    shouldSuppressProgressLogger({
      command: "run",
      jsonOutput: true,
      prSummary: true,
      stdoutOnly: true
    }),
    false
  );
});

test("creates a no-op logger when progress output must be suppressed", () => {
  const output: string[] = [];
  const logger = createCliProgressLogger(
    {
      command: "report-run",
      jsonOutput: true,
      prSummary: false,
      stdoutOnly: false,
      verbose: true
    },
    (line) => output.push(line)
  );

  logger.info("hidden");
  logger.success("hidden");
  logger.error("hidden");

  assert.deepEqual(output, []);
});

test("creates a real logger when progress output is safe", () => {
  const output: string[] = [];
  const logger = createCliProgressLogger(
    {
      command: "run",
      jsonOutput: true,
      prSummary: true,
      stdoutOnly: true,
      verbose: false
    },
    (line) => output.push(line)
  );

  logger.info("visible");

  assert.equal(output.length, 1);
  assert.match(output[0], /visible/);
});
