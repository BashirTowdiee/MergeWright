import test from "node:test";
import assert from "node:assert/strict";
import { filterRunsByStatus } from "../src/tui/hooks/useRuns.js";
import type { RunListItemViewModel } from "../src/tui/view-models.js";

const runs: RunListItemViewModel[] = [
  { id: "failed", title: "failed run", status: "failed", subtitle: "review failed", mode: "read-only", warnings: [] },
  { id: "passed", title: "passed run", status: "passed", subtitle: "review passed", mode: "read-only", warnings: [] },
  { id: "blocked", title: "blocked run", status: "blocked", subtitle: "needs input", mode: "unknown", warnings: ["missing metadata"] }
];

test("filterRunsByStatus returns all runs by default", () => {
  assert.deepEqual(filterRunsByStatus(runs).map((run) => run.id), ["failed", "passed", "blocked"]);
});

test("filterRunsByStatus narrows runs by status", () => {
  assert.deepEqual(filterRunsByStatus(runs, "blocked").map((run) => run.id), ["blocked"]);
});

test("filterRunsByStatus returns empty list when no run matches", () => {
  assert.deepEqual(filterRunsByStatus(runs, "running"), []);
});
