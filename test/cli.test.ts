import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { formatSummaryLines, parseArgs, runCommand } from "../src/cli.js";

test("top-level help contains command list and safety notes", async () => {
  const output: string[] = [];
  await runCommand(parseArgs(["--help"]), process.cwd(), "linux", async () => {}, (line) => output.push(line));
  const text = output.join("\n");
  assert.match(text, /Commands:/);
  assert.match(text, /run <stage-name>/);
  assert.match(text, /continue-run <run-id>/);
  assert.match(text, /report-run <run-id>/);
  assert.match(text, /read-only sandbox/);
  assert.match(text, /No auto-commit or auto-push/);
});

test("run help contains presets and dry-run", async () => {
  const output: string[] = [];
  await runCommand(parseArgs(["run", "--help"]), process.cwd(), "linux", async () => {}, (line) => output.push(line));
  const text = output.join("\n");
  assert.match(text, /Usage: agent-stage run/);
  assert.match(text, /--preset <name>/);
  assert.match(text, /full-readonly/);
  assert.match(text, /--dry-run/);
  assert.match(text, /--auto-chain/);
  assert.match(text, /--max-fix-attempts <n>/);
  assert.match(text, /Incompatible with --preset and explicit phase flags/);
  assert.match(text, /Retry loop is hard bounded by --max-fix-attempts \(0\.\.5\)/);
  assert.match(text, /PASS \| NEEDS_FIX \| NEEDS_FIX_WRITE_DISABLED \| MAX_FIX_ATTEMPTS_REACHED \| CHECKS_FAILED \| FAILED/);
});

test("docs keep auto-chain scoped to run and document final statuses", async () => {
  const commandsDoc = await readFile(path.join(process.cwd(), "docs/COMMANDS.md"), "utf8");
  const workflowDoc = await readFile(path.join(process.cwd(), "docs/WORKFLOW.md"), "utf8");
  const readme = await readFile(path.join(process.cwd(), "README.md"), "utf8");

  assert.match(commandsDoc, /`--auto-chain` is supported only for `run`/);
  assert.match(commandsDoc, /continue-run <run-id> --config <config-path> \[--execute-builder\] \[--execute-reviewer\] \[--plan-fix\] \[--execute-fix\] \[--run-checks\] \[--allow-writes\] \[--dry-run\] \[--verbose\] \[--stream-codex\]/);
  assert.match(readme, /Final statuses:/);
  assert.match(readme, /MAX_FIX_ATTEMPTS_REACHED/);
  assert.match(workflowDoc, /terminal statuses include: `PASS`, `NEEDS_FIX`, `NEEDS_FIX_WRITE_DISABLED`, `MAX_FIX_ATTEMPTS_REACHED`, `CHECKS_FAILED`, `FAILED`/);
});

test("continue-run help states planner continuation unsupported", async () => {
  const output: string[] = [];
  await runCommand(parseArgs(["continue-run", "--help"]), process.cwd(), "linux", async () => {}, (line) => output.push(line));
  const text = output.join("\n");
  assert.match(text, /Usage: agent-stage continue-run/);
  assert.match(text, /Planner continuation is not supported/);
  assert.match(text, /--execute-planner and --preset are not supported/);
});

test("check-write-safety help shows read-only inspection behavior", async () => {
  const output: string[] = [];
  await runCommand(parseArgs(["check-write-safety", "--help"]), process.cwd(), "linux", async () => {}, (line) => output.push(line));
  const text = output.join("\n");
  assert.match(text, /Usage: agent-stage check-write-safety/);
  assert.match(text, /No Codex execution/);
  assert.match(text, /No workspace writes/);
});

test("report-run help shows report generation behavior", async () => {
  const output: string[] = [];
  await runCommand(parseArgs(["report-run", "--help"]), process.cwd(), "linux", async () => {}, (line) => output.push(line));
  const text = output.join("\n");
  assert.match(text, /Usage: agent-stage report-run/);
  assert.match(text, /Does not execute Codex/);
  assert.match(text, /Default writes run-report.md and run-report.json and prints a human summary/);
  assert.match(text, /--stdout-only prints Markdown by default/);
  assert.match(text, /--json output is JSON-only/);
  assert.match(text, /--pr-summary/);
});

test("init-project help shows workspace and force options", async () => {
  const output: string[] = [];
  await runCommand(parseArgs(["init-project", "--help"]), process.cwd(), "linux", async () => {}, (line) => output.push(line));
  const text = output.join("\n");
  assert.match(text, /Usage: agent-stage init-project/);
  assert.match(text, /--workspace <path>/);
  assert.match(text, /--force/);
});

test("missing command prints usage", () => {
  assert.throws(() => parseArgs([]), /Missing command\./);
});

test("unknown command prints available commands", async () => {
  await assert.rejects(
    () => runCommand(parseArgs(["bogus"]), process.cwd(), "linux", async () => {}),
    /Unknown command: bogus[\s\S]*Commands:/
  );
});

test("check-write-safety requires config", async () => {
  await assert.rejects(
    () => runCommand(parseArgs(["check-write-safety"]), process.cwd(), "linux", async () => {}),
    /Missing required --config <config-path>/
  );
});

test("run with option-first args fails with run usage, not unknown argument", async () => {
  await assert.rejects(
    () => runCommand(parseArgs(["run", "--config", "configs/acme.json"]), process.cwd(), "linux", async () => {}),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Usage: agent-stage run <stage-name> --config <config-path>/);
      assert.doesNotMatch(message, /Unknown argument: configs\/acme\.json/);
      return true;
    }
  );
});

test("execute-builder without execute-planner fails clearly", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--execute-builder"]),
    /--execute-builder requires --execute-planner/
  );
});

test("execute-reviewer without execute-planner fails clearly", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--execute-reviewer"]),
    /--execute-reviewer requires --execute-planner/
  );
});

test("plan-fix without execute-reviewer fails clearly", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--plan-fix"]),
    /--plan-fix requires --execute-reviewer/
  );
});

test("execute-fix without plan-fix fails clearly", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--execute-fix"]),
    /--execute-fix requires --plan-fix/
  );
});

test("--allow-writes parses for run", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--execute-planner", "--execute-builder", "--execute-reviewer", "--allow-writes"]);
  assert.equal(args.allowWrites, true);
});

test("--allow-writes parses for continue-run", () => {
  const args = parseArgs(["continue-run", "run-1", "--config", "configs/acme.json", "--execute-builder", "--allow-writes"]);
  assert.equal(args.allowWrites, true);
});

test("--stream-codex parses for run and stays independent from verbose", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--stream-codex"]);
  assert.equal(args.streamCodex, true);
  assert.equal(args.verbose, false);
});

test("--stream-codex parses for continue-run", () => {
  const args = parseArgs(["continue-run", "run-1", "--config", "configs/acme.json", "--execute-builder", "--stream-codex"]);
  assert.equal(args.streamCodex, true);
});

test("--generate-report parses for run", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "plan", "--dry-run", "--generate-report"]);
  assert.equal(args.generateReport, true);
});

test("--plan-html parses for run", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--plan-html"]);
  assert.equal(args.planHtml, true);
});

test("--open-plan implies --plan-html", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--open-plan"]);
  assert.equal(args.openPlan, true);
  assert.equal(args.planHtml, true);
});

test("--generate-report parses for continue-run", () => {
  const args = parseArgs(["continue-run", "run-1", "--config", "configs/acme.json", "--run-checks", "--dry-run", "--generate-report"]);
  assert.equal(args.generateReport, true);
});

test("--generate-report parses for run --auto-chain", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--generate-report"]);
  assert.equal(args.generateReport, true);
  assert.equal(args.autoChain, true);
});

test("unsupported commands reject --generate-report", () => {
  const unsupported = [
    ["report-run", "run-1", "--config", "configs/acme.json", "--generate-report"],
    ["list-runs", "--config", "configs/acme.json", "--generate-report"],
    ["show-run", "run-1", "--config", "configs/acme.json", "--generate-report"],
    ["open-run", "run-1", "--config", "configs/acme.json", "--generate-report"],
    ["init-project", "My App", "--workspace", "/tmp/app", "--generate-report"],
    ["check-write-safety", "--config", "configs/acme.json", "--generate-report"]
  ];
  for (const argv of unsupported) {
    assert.throws(() => parseArgs(argv), /--generate-report is only supported for run and continue-run\./);
  }
});

test("unsupported commands reject --plan-html and --open-plan", () => {
  assert.throws(
    () => parseArgs(["list-runs", "--config", "configs/acme.json", "--plan-html"]),
    /--plan-html and --open-plan are only supported for run and continue-run/
  );
  assert.throws(
    () => parseArgs(["show-run", "run-1", "--config", "configs/acme.json", "--open-plan"]),
    /--plan-html and --open-plan are only supported for run and continue-run/
  );
});

test("open-plan failure does not fail run command", async () => {
  const lines: string[] = [];
  await runCommand(
    parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--plan-html", "--open-plan", "--dry-run"]),
    process.cwd(),
    "linux",
    async () => {},
    (line) => lines.push(line),
    {
      runHandler: async () =>
        ({
          stageName: "example-stage",
          orchestratorRoot: process.cwd(),
          targetWorkspaceRoot: process.cwd(),
          configPath: "configs/acme.json",
          runDir: "/tmp/acme/20260516-example-stage",
          artefacts: [],
          dryRun: true,
          checksState: "disabled",
          allowWrites: false,
          writeSafetyState: "not checked",
          writeEnabledPhases: []
        }) as Awaited<ReturnType<typeof import("../src/runner.js").runStage>>,
      openPlanHandler: async () => ({ attempted: true, opened: false, skipped: false, reason: "open failed" })
    }
  );
  const out = lines.join("\n");
  assert.match(out, /Plan HTML: \/tmp\/acme\/20260516-example-stage\/plan.html/);
  assert.match(out, /warning: failed to open browser \(open failed\)/);
});

test("unsupported commands reject --stream-codex", () => {
  assert.throws(
    () => parseArgs(["list-runs", "--config", "configs/acme.json", "--stream-codex"]),
    /--stream-codex is only supported for run and continue-run/
  );
});

test("check-write-safety rejects --stream-codex", () => {
  assert.throws(
    () => parseArgs(["check-write-safety", "--config", "configs/acme.json", "--stream-codex"]),
    /--stream-codex is only supported for run and continue-run/
  );
});

test("show-run rejects --stream-codex", () => {
  assert.throws(
    () => parseArgs(["show-run", "run-1", "--config", "configs/acme.json", "--stream-codex"]),
    /--stream-codex is only supported for run and continue-run/
  );
});

test("open-run rejects --stream-codex", () => {
  assert.throws(
    () => parseArgs(["open-run", "run-1", "--config", "configs/acme.json", "--stream-codex"]),
    /--stream-codex is only supported for run and continue-run/
  );
});

test("init-project rejects --stream-codex", () => {
  assert.throws(
    () => parseArgs(["init-project", "My App", "--workspace", "/tmp/app", "--stream-codex"]),
    /--stream-codex is only supported for run and continue-run/
  );
});

test("--auto-chain parses for run", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--dry-run"]);
  assert.equal(args.autoChain, true);
});

test("auto-chain dry-run defaults maxFixAttempts to 1", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--dry-run"]);
  assert.equal(args.maxFixAttempts, 1);
});

test("auto-chain accepts explicit maxFixAttempts", () => {
  const args = parseArgs([
    "run",
    "example-stage",
    "--config",
    "configs/acme.json",
    "--auto-chain",
    "--max-fix-attempts",
    "3",
    "--dry-run"
  ]);
  assert.equal(args.maxFixAttempts, 3);
});

test("auto-chain rejects non-number maxFixAttempts", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--max-fix-attempts", "abc", "--dry-run"]),
    /--max-fix-attempts must be an integer from 0 to 5/
  );
});

test("auto-chain rejects negative maxFixAttempts", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--max-fix-attempts", "-1", "--dry-run"]),
    /--max-fix-attempts must be an integer from 0 to 5/
  );
});

test("auto-chain rejects maxFixAttempts above 5", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--max-fix-attempts", "6", "--dry-run"]),
    /--max-fix-attempts must be an integer from 0 to 5/
  );
});

test("auto-chain rejects preset", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--preset", "plan", "--dry-run"]),
    /--auto-chain cannot be combined with --preset/
  );
});

test("auto-chain rejects explicit phase flags", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--execute-planner", "--dry-run"]),
    /--auto-chain cannot be combined with explicit phase flags/
  );
});

test("auto-chain rejects unsupported commands", () => {
  const unsupported = [
    ["continue-run", "run-1", "--config", "configs/acme.json", "--auto-chain"],
    ["check-write-safety", "--config", "configs/acme.json", "--auto-chain"],
    ["list-runs", "--config", "configs/acme.json", "--auto-chain"],
    ["show-run", "run-1", "--config", "configs/acme.json", "--auto-chain"],
    ["open-run", "run-1", "--config", "configs/acme.json", "--auto-chain"],
    ["init-project", "My App", "--workspace", "/tmp/app", "--auto-chain"]
  ];
  for (const argv of unsupported) {
    assert.throws(() => parseArgs(argv), /--auto-chain is only supported for run/);
  }
});

test("auto-chain allows --allow-writes", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--allow-writes", "--dry-run"]);
  assert.equal(args.allowWrites, true);
});

test("auto-chain allows --stream-codex", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--stream-codex", "--dry-run"]);
  assert.equal(args.streamCodex, true);
});

test("auto-chain allows --verbose", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--auto-chain", "--verbose", "--dry-run"]);
  assert.equal(args.verbose, true);
});

test("max-fix-attempts without auto-chain is rejected", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--max-fix-attempts", "2", "--dry-run"]),
    /--max-fix-attempts is only supported with --auto-chain/
  );
});

test("--verbose alone does not enable streamCodex", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--verbose"]);
  assert.equal(args.verbose, true);
  assert.equal(args.streamCodex, false);
});

test("--stream-codex does not enable verbose", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--stream-codex"]);
  assert.equal(args.streamCodex, true);
  assert.equal(args.verbose, false);
});

test("list-runs rejects --allow-writes", () => {
  assert.throws(
    () => parseArgs(["list-runs", "--config", "configs/acme.json", "--allow-writes"]),
    /--allow-writes is only supported for run and continue-run/
  );
});

test("init-project rejects --allow-writes", () => {
  assert.throws(
    () => parseArgs(["init-project", "My App", "--workspace", "/tmp/app", "--allow-writes"]),
    /--allow-writes is only supported for run and continue-run/
  );
});

test("--allow-writes without builder/fix fails clearly", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--execute-planner", "--execute-reviewer", "--allow-writes"]),
    /--allow-writes requires at least one write-eligible phase/
  );
});

test("run rejects --force", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--force"]),
    /--force is only supported for init-project and report-run/
  );
});

test("continue-run rejects --force", () => {
  assert.throws(
    () =>
      parseArgs([
        "continue-run",
        "some-run",
        "--config",
        "configs/acme.json",
        "--execute-builder",
        "--force"
      ]),
    /--force is only supported for init-project and report-run/
  );
});

test("report-run parses run id and config", () => {
  const args = parseArgs(["report-run", "run-1", "--config", "configs/acme.json"]);
  assert.equal(args.command, "report-run");
  assert.equal(args.runId, "run-1");
  assert.equal(args.configArg, "configs/acme.json");
});

test("report-run parses --json, --stdout-only, --pr-summary, and --force", () => {
  const args = parseArgs(["report-run", "run-1", "--config", "configs/acme.json", "--json", "--pr-summary", "--force"]);
  assert.equal(args.jsonOutput, true);
  assert.equal(args.prSummary, true);
  assert.equal(args.force, true);
});

test("report-run rejects missing run id", () => {
  assert.throws(
    () => parseArgs(["report-run", "--config", "configs/acme.json"]),
    /report-run requires <run-id>/
  );
});

test("report-run rejects missing config", () => {
  assert.throws(
    () => parseArgs(["report-run", "run-1"]),
    /Missing required --config <config-path>/
  );
});

test("non-report commands reject report flags", () => {
  assert.throws(
    () => parseArgs(["list-runs", "--config", "configs/acme.json", "--json"]),
    /--json, --pr-summary, and --stdout-only are only supported for report-run/
  );
  assert.throws(
    () => parseArgs(["show-run", "run-1", "--config", "configs/acme.json", "--stdout-only"]),
    /--json, --pr-summary, and --stdout-only are only supported for report-run/
  );
});

test("report-run rejects --json --pr-summary --stdout-only combination", () => {
  assert.throws(
    () => parseArgs(["report-run", "run-1", "--config", "configs/acme.json", "--json", "--pr-summary", "--stdout-only"]),
    /--json cannot be combined with --pr-summary and --stdout-only/
  );
});

test("list-runs rejects --force", () => {
  assert.throws(
    () => parseArgs(["list-runs", "--config", "configs/acme.json", "--force"]),
    /--force is only supported for init-project and report-run/
  );
});

test("init-project accepts --force", () => {
  const args = parseArgs(["init-project", "My App", "--workspace", "/tmp/app", "--force"]);
  assert.equal(args.command, "init-project");
  assert.equal(args.projectName, "My App");
  assert.equal(args.workspaceArg, "/tmp/app");
  assert.equal(args.force, true);
});

test("default run summary reports planner builder reviewer execution disabled", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json"]);
  assert.equal(args.executePlanner, false);
  assert.equal(args.executeBuilder, false);
  assert.equal(args.executeReviewer, false);
  assert.equal(args.planFix, false);
  assert.equal(args.executeFix, false);

  const lines = formatSummaryLines(
    {
      stageName: "example-stage",
      orchestratorRoot: "/tmp/orchestrator",
      targetWorkspaceRoot: "/tmp/target",
      configPath: "/tmp/orchestrator/configs/acme.json",
      runDir: "/tmp/orchestrator/runs/acme/20260512-000000-example-stage",
      artefacts: [],
      dryRun: false,
      checksState: "disabled"
    },
    args.preset,
    args.executePlanner,
    args.executeBuilder,
    args.executeReviewer,
    args.planFix,
    args.executeFix,
    args.runChecks,
    args.allowWrites,
    "not checked",
    []
  );

  assert.ok(lines.some((line) => line.includes("planner execution: disabled")));
  assert.ok(lines.some((line) => line.includes("preset: none")));
  assert.ok(lines.some((line) => line.includes("resolved execution flags:")));
  assert.ok(lines.some((line) => line.includes("builder execution: disabled")));
  assert.ok(lines.some((line) => line.includes("reviewer execution: disabled")));
  assert.ok(lines.some((line) => line.includes("fix planning: disabled")));
  assert.ok(lines.some((line) => line.includes("fix execution: disabled")));
});

test("execute-planner + execute-builder + execute-reviewer + plan-fix + execute-fix + dry-run summary reports all skipped", () => {
  const args = parseArgs([
    "run",
    "example-stage",
    "--config",
    "configs/acme.json",
    "--execute-planner",
    "--execute-builder",
    "--execute-reviewer",
    "--plan-fix",
    "--execute-fix",
    "--dry-run"
  ]);
  assert.equal(args.executePlanner, true);
  assert.equal(args.executeBuilder, true);
  assert.equal(args.executeReviewer, true);
  assert.equal(args.planFix, true);
  assert.equal(args.executeFix, true);
  assert.equal(args.dryRun, true);

  const lines = formatSummaryLines(
    {
      stageName: "example-stage",
      orchestratorRoot: "/tmp/orchestrator",
      targetWorkspaceRoot: "/tmp/target",
      configPath: "/tmp/orchestrator/configs/acme.json",
      runDir: "/tmp/orchestrator/runs/acme/20260512-000000-example-stage",
      artefacts: [],
      dryRun: true,
      checksState: "skipped by dry-run"
    },
    args.preset,
    args.executePlanner,
    args.executeBuilder,
    args.executeReviewer,
    args.planFix,
    args.executeFix,
    args.runChecks,
    args.allowWrites,
    "not checked",
    []
  );

  assert.ok(lines.some((line) => line.includes("planner execution: skipped by dry-run")));
  assert.ok(lines.some((line) => line.includes("builder execution: skipped by dry-run")));
  assert.ok(lines.some((line) => line.includes("reviewer execution: skipped by dry-run")));
  assert.ok(lines.some((line) => line.includes("fix planning: skipped by dry-run")));
  assert.ok(lines.some((line) => line.includes("fix execution: skipped by dry-run")));
});

test("summary reports fix execution skipped because proceed when execute-fix enabled and fix skipped artefact exists", () => {
  const args = parseArgs([
    "run",
    "example-stage",
    "--config",
    "configs/acme.json",
    "--execute-planner",
    "--execute-reviewer",
    "--plan-fix",
    "--execute-fix"
  ]);
  const lines = formatSummaryLines(
    {
      stageName: "example-stage",
      orchestratorRoot: "/tmp/orchestrator",
      targetWorkspaceRoot: "/tmp/target",
      configPath: "/tmp/orchestrator/configs/acme.json",
      runDir: "/tmp/orchestrator/runs/acme/20260512-000000-example-stage",
      artefacts: [
        "/tmp/orchestrator/runs/acme/20260512-000000-example-stage/review-to-fix-decision.proceed.json",
        "/tmp/orchestrator/runs/acme/20260512-000000-example-stage/fix-skipped.json"
      ],
      dryRun: false,
      checksState: "disabled"
    },
    args.preset,
    args.executePlanner,
    args.executeBuilder,
    args.executeReviewer,
    args.planFix,
    args.executeFix,
    args.runChecks,
    args.allowWrites,
    "not checked",
    []
  );
  assert.ok(lines.some((line) => line.includes("fix execution: skipped because proceed")));
});

test("--run-checks --dry-run summary reports checks skipped by dry-run", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--run-checks", "--dry-run"]);
  const lines = formatSummaryLines(
    {
      stageName: "example-stage",
      orchestratorRoot: "/tmp/orchestrator",
      targetWorkspaceRoot: "/tmp/target",
      configPath: "/tmp/orchestrator/configs/acme.json",
      runDir: "/tmp/orchestrator/runs/acme/20260512-000000-example-stage",
      artefacts: [],
      dryRun: true,
      checksState: "skipped by dry-run"
    },
    args.preset,
    args.executePlanner,
    args.executeBuilder,
    args.executeReviewer,
    args.planFix,
    args.executeFix,
    args.runChecks,
    args.allowWrites,
    "not checked",
    []
  );
  assert.ok(lines.some((line) => line.includes("target checks: skipped by dry-run")));
});

test("summary includes preset when preset is provided", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "full-readonly", "--dry-run"]);
  const lines = formatSummaryLines(
    {
      stageName: "example-stage",
      orchestratorRoot: "/tmp/orchestrator",
      targetWorkspaceRoot: "/tmp/target",
      configPath: "/tmp/orchestrator/configs/acme.json",
      runDir: "/tmp/orchestrator/runs/acme/20260512-000000-example-stage",
      artefacts: [],
      dryRun: true,
      checksState: "skipped by dry-run"
    },
    args.preset,
    args.executePlanner,
    args.executeBuilder,
    args.executeReviewer,
    args.planFix,
    args.executeFix,
    args.runChecks,
    args.allowWrites,
    "not checked",
    []
  );
  assert.ok(lines.some((line) => line.includes("preset: full-readonly")));
});

test("--preset plan --dry-run resolves planner only", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "plan", "--dry-run"]);
  assert.equal(args.executePlanner, true);
  assert.equal(args.executeBuilder, false);
  assert.equal(args.executeReviewer, false);
  assert.equal(args.planFix, false);
  assert.equal(args.executeFix, false);
  assert.equal(args.runChecks, false);
});

test("--preset build --dry-run resolves planner + builder", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "build", "--dry-run"]);
  assert.equal(args.executePlanner, true);
  assert.equal(args.executeBuilder, true);
  assert.equal(args.executeReviewer, false);
});

test("--preset review --dry-run resolves planner + builder + reviewer", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "review", "--dry-run"]);
  assert.equal(args.executePlanner, true);
  assert.equal(args.executeBuilder, true);
  assert.equal(args.executeReviewer, true);
  assert.equal(args.planFix, false);
});

test("--preset fix-plan --dry-run resolves planner + reviewer + plan-fix, builder disabled", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "fix-plan", "--dry-run"]);
  assert.equal(args.executePlanner, true);
  assert.equal(args.executeBuilder, false);
  assert.equal(args.executeReviewer, true);
  assert.equal(args.planFix, true);
  assert.equal(args.executeFix, false);
});

test("--preset full-readonly --dry-run resolves all readonly phases including checks", () => {
  const args = parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "full-readonly", "--dry-run"]);
  assert.equal(args.executePlanner, true);
  assert.equal(args.executeBuilder, true);
  assert.equal(args.executeReviewer, true);
  assert.equal(args.planFix, true);
  assert.equal(args.executeFix, true);
  assert.equal(args.runChecks, true);
});

test("--preset plan --execute-builder --dry-run resolves planner + builder", () => {
  const args = parseArgs([
    "run",
    "example-stage",
    "--config",
    "configs/acme.json",
    "--preset",
    "plan",
    "--execute-builder",
    "--dry-run"
  ]);
  assert.equal(args.executePlanner, true);
  assert.equal(args.executeBuilder, true);
});

test("--preset plan --execute-reviewer --dry-run passes dependency validation via preset planner", () => {
  const args = parseArgs([
    "run",
    "example-stage",
    "--config",
    "configs/acme.json",
    "--preset",
    "plan",
    "--execute-reviewer",
    "--dry-run"
  ]);
  assert.equal(args.executePlanner, true);
  assert.equal(args.executeReviewer, true);
});

test("unknown preset fails clearly", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "unknown"]),
    /Unknown preset/
  );
});

async function makeAutoChainFixture(): Promise<{ orchestratorRoot: string; configArg: string; stageName: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-auto-chain-"));
  const stageName = "stage-02-add-request-logging";
  const configArg = "configs/acme.json";
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await writeFile(
    path.join(orchestratorRoot, configArg),
    JSON.stringify(
      {
        version: 1,
        projectName: "acme",
        workspaceRoot: "/tmp/workspace",
        paths: { stagesDir: "stages/acme", promptsDir: "prompts", runsDir: "runs/acme" },
        codex: {
          planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
          builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
          reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
        },
        pipeline: { finalReview: true, maxFixLoops: 1 },
        commands: { checks: [] },
        safety: {
          requireGitRepo: true,
          requireCleanStart: true,
          manualCommit: true,
          forbidAutoCommit: true,
          forbidAutoPush: true
        }
      },
      null,
      2
    ),
    "utf8"
  );
  return { orchestratorRoot, configArg, stageName };
}

async function makeRunnableDryRunFixture(): Promise<{ orchestratorRoot: string; configArg: string; stageName: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-run-dry-report-"));
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "workspace-run-dry-report-"));
  const stageName = "example-stage";
  const configArg = "configs/acme.json";
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "stages/acme"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "prompts"), { recursive: true });
  await writeFile(path.join(orchestratorRoot, `stages/acme/${stageName}.md`), "# Stage\n\nDo work.", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/planner-stage.md"), "Planner prompt", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/reviewer.md"), "Reviewer prompt", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/review-to-fix.md"), "Review-to-fix prompt", "utf8");
  await writeFile(path.join(orchestratorRoot, "prompts/final-review.md"), "Final review prompt", "utf8");
  await writeFile(
    path.join(orchestratorRoot, configArg),
    JSON.stringify(
      {
        version: 1,
        projectName: "acme",
        workspaceRoot,
        paths: { stagesDir: "stages/acme", promptsDir: "prompts", runsDir: "runs/acme" },
        codex: {
          planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
          builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
          reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
        },
        pipeline: { finalReview: true, maxFixLoops: 1 },
        commands: { checks: [] },
        safety: {
          requireGitRepo: false,
          requireCleanStart: false,
          manualCommit: true,
          forbidAutoCommit: true,
          forbidAutoPush: true
        }
      },
      null,
      2
    ),
    "utf8"
  );
  return { orchestratorRoot, configArg, stageName };
}

test("valid run --auto-chain --dry-run prints projection summary", async () => {
  const fixture = await makeAutoChainFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["run", fixture.stageName, "--config", fixture.configArg, "--auto-chain", "--dry-run"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  assert.ok(output.some((line) => line.includes("[auto-chain] projecting flow")));
  assert.ok(output.some((line) => line.includes("[auto-chain] dry-run complete")));
  assert.ok(output.some((line) => line.includes("Auto-chain dry-run summary")));
  assert.ok(output.some((line) => line.includes("max fix attempts: 1")));
  assert.ok(output.some((line) => line.includes("No Codex execution, checks, git mutation, commit, push, or merge occurred.")));
});

test("auto-chain dry-run remains projection-only and does not execute single-pass handler", async () => {
  const fixture = await makeAutoChainFixture();
  let called = 0;
  await runCommand(
    parseArgs(["run", fixture.stageName, "--config", fixture.configArg, "--auto-chain", "--dry-run"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    () => {},
    {
      autoChainHandler: async () => {
        called += 1;
        throw new Error("should not run");
      }
    }
  );
  assert.equal(called, 0);
});

test("auto-chain without dry-run executes single-pass path and prints summary", async () => {
  const fixture = await makeAutoChainFixture();
  const output: string[] = [];
  let called = 0;
  await runCommand(
    parseArgs(["run", fixture.stageName, "--config", fixture.configArg, "--auto-chain"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line),
    {
      autoChainHandler: async () => {
        called += 1;
        return {
          stageName: fixture.stageName,
          runDir: "/tmp/runs/acme/20260514-example-stage",
          reviewerVerdict: "PASS",
          fixDecision: "PROCEED",
          checks: "executed",
          finalStatus: "PASS",
          attemptsUsed: 0
        };
      }
    }
  );
  assert.equal(called, 1);
  assert.ok(output.some((line) => line.includes("Auto-chain summary")));
  assert.ok(output.some((line) => line.includes("final status: PASS")));
});

test("run --preset plan --dry-run --generate-report writes report artefacts and prints summary after run summary", async () => {
  const fixture = await makeRunnableDryRunFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["run", fixture.stageName, "--config", fixture.configArg, "--preset", "plan", "--dry-run", "--generate-report"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  const runSummaryIndex = output.findIndex((line) => line === "Run summary");
  const reportIndex = output.findIndex((line) => line === "AI Change Report");
  assert.ok(runSummaryIndex >= 0);
  assert.ok(reportIndex > runSummaryIndex);
  const runDirLine = output.find((line) => line.startsWith("- run directory: "));
  assert.ok(runDirLine);
  const runDir = runDirLine!.replace("- run directory: ", "");
  await readFile(path.join(runDir, "run-report.md"), "utf8");
  await readFile(path.join(runDir, "run-report.json"), "utf8");
  assert.ok(output.some((line) => line.includes("[report] generating AI Change Report")));
  assert.ok(output.some((line) => line.includes("[report] completed")));
});

test("continue-run --generate-report writes and overwrites report artefacts after continuation summary", async () => {
  const fixture = await makeReportRunFixture();
  await writeFile(
    path.join(fixture.runDir, "run.json"),
    JSON.stringify(
      {
        version: 1,
        runId: fixture.runId,
        projectName: "acme",
        stageName: "example-stage",
        workspaceRoot: "/tmp/workspace",
        orchestratorRoot: fixture.orchestratorRoot,
        configPath: path.join(fixture.orchestratorRoot, fixture.configArg),
        startedAt: "2026-05-14T00:00:00.000Z",
        completedAt: "2026-05-14T00:01:00.000Z",
        status: "success",
        resolvedOptions: {},
        writeSafety: { state: "passed", allowWrites: true, status: "passed" },
        postWriteReview: { required: false, status: "completed" },
        phases: {
          planner: { status: "executed" },
          builder: { status: "executed" },
          reviewer: { status: "executed" },
          fixPlanning: { status: "disabled" },
          fixExecution: { status: "disabled" },
          checks: { status: "disabled" }
        },
        artefacts: [],
        error: null
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(path.join(fixture.runDir, "run-report.md"), "old-markdown", "utf8");
  await writeFile(path.join(fixture.runDir, "run-report.json"), "old-json", "utf8");
  const output: string[] = [];
  await runCommand(
    parseArgs(["continue-run", fixture.runId, "--config", fixture.configArg, "--run-checks", "--dry-run", "--generate-report"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  const continuationSummaryIndex = output.findIndex((line) => line === "Continuation summary");
  const reportIndex = output.findIndex((line) => line === "AI Change Report");
  assert.ok(continuationSummaryIndex >= 0);
  assert.ok(reportIndex > continuationSummaryIndex);
  const markdown = await readFile(path.join(fixture.runDir, "run-report.md"), "utf8");
  const json = await readFile(path.join(fixture.runDir, "run-report.json"), "utf8");
  assert.notEqual(markdown, "old-markdown");
  assert.notEqual(json, "old-json");
});

test("--generate-report uses configured changeReport policy", async () => {
  const fixture = await makeReportRunFixture();
  await writeFile(
    path.join(fixture.runDir, "run.json"),
    JSON.stringify(
      {
        version: 1,
        runId: fixture.runId,
        projectName: "acme",
        stageName: "example-stage",
        workspaceRoot: "/tmp/workspace",
        orchestratorRoot: fixture.orchestratorRoot,
        configPath: path.join(fixture.orchestratorRoot, fixture.configArg),
        startedAt: "2026-05-14T00:00:00.000Z",
        completedAt: "2026-05-14T00:01:00.000Z",
        status: "success",
        resolvedOptions: {},
        writeSafety: { state: "passed", allowWrites: true, status: "passed" },
        postWriteReview: { required: false, status: "completed" },
        phases: {
          planner: { status: "executed" },
          builder: { status: "executed" },
          reviewer: { status: "executed" },
          fixPlanning: { status: "disabled" },
          fixExecution: { status: "disabled" },
          checks: { status: "disabled" }
        },
        artefacts: [],
        error: null
      },
      null,
      2
    ),
    "utf8"
  );
  const configPath = path.join(fixture.orchestratorRoot, fixture.configArg);
  const configRaw = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  configRaw.changeReport = {
    readiness: {
      readyMinimumScore: 100,
      needsReviewMinimumScore: 60,
      penalties: {
        failedRun: 40,
        reviewerFail: 35,
        checksFailed: 30,
        checksSkippedWithSourceChanges: 20,
        postWriteReviewPendingOrFailed: 20,
        highRiskFiles: 15,
        mediumRiskFiles: 25,
        scopeDriftWarning: 10,
        nonBlockingReviewerIssue: 5
      }
    }
  };
  await writeFile(configPath, JSON.stringify(configRaw, null, 2), "utf8");

  await runCommand(
    parseArgs(["continue-run", fixture.runId, "--config", fixture.configArg, "--run-checks", "--dry-run", "--generate-report"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {}
  );

  const report = JSON.parse(await readFile(path.join(fixture.runDir, "run-report.json"), "utf8")) as { status: string; score: number };
  assert.equal(report.score < 100, true);
  assert.equal(report.status, "NEEDS_REVIEW");
});

test("run --auto-chain --generate-report writes report after auto-chain summary", async () => {
  const autoChainFixture = await makeAutoChainFixture();
  const reportFixture = await makeReportRunFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["run", autoChainFixture.stageName, "--config", autoChainFixture.configArg, "--auto-chain", "--generate-report"]),
    autoChainFixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line),
    {
      autoChainHandler: async () => ({
        stageName: autoChainFixture.stageName,
        runDir: reportFixture.runDir,
        reviewerVerdict: "PASS",
        fixDecision: "PROCEED",
        checks: "executed",
        finalStatus: "PASS",
        attemptsUsed: 0
      })
    }
  );
  const autoChainSummaryIndex = output.findIndex((line) => line === "Auto-chain summary");
  const reportIndex = output.findIndex((line) => line === "AI Change Report");
  assert.ok(autoChainSummaryIndex >= 0);
  assert.ok(reportIndex > autoChainSummaryIndex);
  await readFile(path.join(reportFixture.runDir, "run-report.md"), "utf8");
  await readFile(path.join(reportFixture.runDir, "run-report.json"), "utf8");
});

test("run --auto-chain --dry-run --generate-report skips report generation with clear note", async () => {
  const fixture = await makeAutoChainFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["run", fixture.stageName, "--config", fixture.configArg, "--auto-chain", "--dry-run", "--generate-report"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  assert.ok(output.some((line) => line.includes("AI Change Report skipped: auto-chain dry-run projection does not create a run directory.")));
});

test("run --generate-report primary failure preserves original error and skips report output", async () => {
  const output: string[] = [];
  const original = new Error("run-primary-failure");
  await assert.rejects(
    () =>
      runCommand(
        parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "plan", "--dry-run", "--generate-report"]),
        process.cwd(),
        "linux",
        async () => {},
        (line) => output.push(line),
        {
          runHandler: async () => {
            throw original;
          }
        }
      ),
    /run-primary-failure/
  );
  const text = output.join("\n");
  assert.doesNotMatch(text, /AI Change Report/);
  assert.doesNotMatch(text, /\[report\] generating AI Change Report/);
  assert.doesNotMatch(text, /\[report\] completed/);
});

test("continue-run --generate-report primary failure preserves original error and does not overwrite existing report files", async () => {
  const fixture = await makeReportRunFixture();
  const output: string[] = [];
  await writeFile(path.join(fixture.runDir, "run-report.md"), "original-markdown", "utf8");
  await writeFile(path.join(fixture.runDir, "run-report.json"), "original-json", "utf8");
  await assert.rejects(
    () =>
      runCommand(
        parseArgs(["continue-run", fixture.runId, "--config", fixture.configArg, "--run-checks", "--dry-run", "--generate-report"]),
        fixture.orchestratorRoot,
        "linux",
        async () => {},
        (line) => output.push(line),
        {
          continueRunHandler: async () => {
            throw new Error("continue-primary-failure");
          }
        }
      ),
    /continue-primary-failure/
  );
  const text = output.join("\n");
  assert.doesNotMatch(text, /AI Change Report/);
  assert.doesNotMatch(text, /\[report\] generating AI Change Report/);
  assert.doesNotMatch(text, /\[report\] completed/);
  assert.equal(await readFile(path.join(fixture.runDir, "run-report.md"), "utf8"), "original-markdown");
  assert.equal(await readFile(path.join(fixture.runDir, "run-report.json"), "utf8"), "original-json");
});

test("run --auto-chain --generate-report primary failure preserves original error and skips report output", async () => {
  const fixture = await makeAutoChainFixture();
  const output: string[] = [];
  await assert.rejects(
    () =>
      runCommand(
        parseArgs(["run", fixture.stageName, "--config", fixture.configArg, "--auto-chain", "--generate-report"]),
        fixture.orchestratorRoot,
        "linux",
        async () => {},
        (line) => output.push(line),
        {
          autoChainHandler: async () => {
            throw new Error("auto-chain-primary-failure");
          }
        }
      ),
    /auto-chain-primary-failure/
  );
  const text = output.join("\n");
  assert.doesNotMatch(text, /AI Change Report/);
  assert.doesNotMatch(text, /\[report\] generating AI Change Report/);
  assert.doesNotMatch(text, /\[report\] completed/);
});

async function makeRunFixture(): Promise<{ orchestratorRoot: string; configArg: string; runId: string }> {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-cli-"));
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs/acme"), { recursive: true });
  const configArg = "configs/acme.json";
  await writeFile(
    path.join(orchestratorRoot, configArg),
    JSON.stringify(
      {
        version: 1,
        projectName: "acme",
        workspaceRoot: "/tmp/workspace",
        paths: { stagesDir: "stages/acme", promptsDir: "prompts", runsDir: "runs/acme" },
        codex: {
          planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
          builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
          reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
        },
        pipeline: { finalReview: true, maxFixLoops: 1 },
        commands: { checks: [] },
        safety: {
          requireGitRepo: true,
          requireCleanStart: true,
          manualCommit: true,
          forbidAutoCommit: true,
          forbidAutoPush: true
        }
      },
      null,
      2
    ),
    "utf8"
  );
  const runId = "20260513-000000-example-stage";
  const runDir = path.join(orchestratorRoot, "runs/acme", runId);
  await mkdir(path.join(runDir, "checks"), { recursive: true });
  await writeFile(path.join(runDir, "01-stage-input.md"), "stage", "utf8");
  await writeFile(path.join(runDir, "07-planner-exit.json"), "{}", "utf8");
  await writeFile(path.join(runDir, "builder-output.placeholder.md"), "skipped", "utf8");
  await writeFile(path.join(runDir, "reviewer-skipped.json"), "{}", "utf8");
  await writeFile(path.join(runDir, "review-to-fix-skipped.json"), "{}", "utf8");
  await writeFile(path.join(runDir, "fix-skipped.json"), "{}", "utf8");
  await writeFile(path.join(runDir, "checks-status.json"), JSON.stringify({ state: "disabled" }), "utf8");
  return { orchestratorRoot, configArg, runId };
}

async function makeReportRunFixture(): Promise<{ orchestratorRoot: string; configArg: string; runId: string; runDir: string }> {
  const fixture = await makeRunFixture();
  const runDir = path.join(fixture.orchestratorRoot, "runs/acme", fixture.runId);
  await mkdir(path.join(runDir, "write-audit/builder"), { recursive: true });
  await writeFile(
    path.join(runDir, "run.json"),
    JSON.stringify(
      {
        version: 1,
        runId: fixture.runId,
        projectName: "acme",
        stageName: "example-stage",
        workspaceRoot: "/tmp/workspace",
        orchestratorRoot: fixture.orchestratorRoot,
        configPath: path.join(fixture.orchestratorRoot, fixture.configArg),
        startedAt: "2026-05-14T00:00:00.000Z",
        completedAt: "2026-05-14T00:01:00.000Z",
        status: "success",
        resolvedOptions: {},
        writeSafety: { state: "passed", allowWrites: true, status: "passed" },
        postWriteReview: { required: false, status: "completed" },
        phases: {
          planner: { status: "executed" },
          builder: { status: "executed" },
          reviewer: { status: "executed" },
          fixPlanning: { status: "disabled" },
          fixExecution: { status: "disabled" },
          checks: { status: "executed" }
        },
        artefacts: [],
        error: null
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(runDir, "reviewer-output-last-message.md"),
    `# Reviewer\n\n\`\`\`json reviewer-verdict\n${JSON.stringify({ verdict: "PASS", blockingIssues: [], nonBlockingIssues: [] }, null, 2)}\n\`\`\``,
    "utf8"
  );
  await writeFile(path.join(runDir, "checks-status.json"), JSON.stringify({ state: "executed" }, null, 2), "utf8");
  await writeFile(
    path.join(runDir, "write-audit/builder/summary.json"),
    JSON.stringify(
      {
        post: { changedFiles: ["src/routes/api.ts"], untrackedFiles: [] },
        changedFilesAddedByPhase: ["src/routes/api.ts"]
      },
      null,
      2
    ),
    "utf8"
  );
  return { ...fixture, runDir };
}

test("list-runs works with empty runs directory", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-cli-empty-"));
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs/acme"), { recursive: true });
  await writeFile(
    path.join(orchestratorRoot, "configs/acme.json"),
    JSON.stringify(
      {
        version: 1,
        projectName: "acme",
        workspaceRoot: "/tmp/workspace",
        paths: { stagesDir: "stages/acme", promptsDir: "prompts", runsDir: "runs/acme" },
        codex: {
          planner: { model: "gpt-5.3-codex", reasoningEffort: "high" },
          builder: { model: "gpt-5.3-codex", reasoningEffort: "medium" },
          reviewer: { model: "gpt-5.3-codex", reasoningEffort: "high" }
        },
        pipeline: { finalReview: true, maxFixLoops: 1 },
        commands: { checks: [] },
        safety: {
          requireGitRepo: true,
          requireCleanStart: true,
          manualCommit: true,
          forbidAutoCommit: true,
          forbidAutoPush: true
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const output: string[] = [];
  await runCommand(parseArgs(["list-runs", "--config", "configs/acme.json"]), orchestratorRoot, "linux", async () => {}, (line) =>
    output.push(line)
  );
  assert.ok(output.some((line) => line.includes("No runs found.")));
});

test("show-run prints summary and artefact list", async () => {
  const fixture = await makeRunFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["show-run", fixture.runId, "--config", fixture.configArg]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  assert.ok(output.some((line) => line.includes("run id: 20260513-000000-example-stage")));
  assert.ok(output.some((line) => line.includes("planner execution status: executed")));
  assert.ok(output.some((line) => line.includes("01-stage-input.md")));
});

test("list-runs output includes metadata status when available", async () => {
  const fixture = await makeRunFixture();
  const runDir = path.join(fixture.orchestratorRoot, "runs/acme", fixture.runId);
  await writeFile(
    path.join(runDir, "run.json"),
    JSON.stringify(
      {
        version: 1,
        runId: fixture.runId,
        projectName: "Acme",
        stageName: "example-stage",
        preset: "full-readonly",
        workspaceRoot: "/tmp/workspace",
        orchestratorRoot: fixture.orchestratorRoot,
        configPath: path.join(fixture.orchestratorRoot, fixture.configArg),
        startedAt: "2026-05-11T12:34:56.000Z",
        completedAt: "2026-05-11T12:35:10.000Z",
        status: "failed",
        resolvedOptions: {},
        phases: {
          planner: { status: "executed" },
          builder: { status: "failed" },
          reviewer: { status: "skipped" },
          fixPlanning: { status: "disabled" },
          fixExecution: { status: "disabled" },
          checks: { status: "unknown" }
        },
        artefacts: ["01-stage-input.md"],
        error: { message: "builder failed", failedPhase: "builder" }
      },
      null,
      2
    ),
    "utf8"
  );
  const output: string[] = [];
  await runCommand(
    parseArgs(["list-runs", "--config", fixture.configArg]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  assert.ok(output.some((line) => line.includes("status")));
  assert.ok(output.some((line) => line.includes("| failed |")));
});

test("show-run output includes phase statuses and error summary from metadata", async () => {
  const fixture = await makeRunFixture();
  const runDir = path.join(fixture.orchestratorRoot, "runs/acme", fixture.runId);
  await writeFile(
    path.join(runDir, "run.json"),
    JSON.stringify(
      {
        version: 1,
        runId: fixture.runId,
        projectName: "Acme",
        stageName: "example-stage",
        preset: "full-readonly",
        workspaceRoot: "/tmp/workspace",
        orchestratorRoot: fixture.orchestratorRoot,
        configPath: path.join(fixture.orchestratorRoot, fixture.configArg),
        startedAt: "2026-05-11T12:34:56.000Z",
        completedAt: "2026-05-11T12:35:10.000Z",
        status: "failed",
        resolvedOptions: {},
        phases: {
          planner: { status: "executed" },
          builder: { status: "failed" },
          reviewer: { status: "skipped" },
          fixPlanning: { status: "disabled" },
          fixExecution: { status: "disabled" },
          checks: { status: "unknown" }
        },
        artefacts: ["01-stage-input.md"],
        error: { message: "builder failed", failedPhase: "builder" }
      },
      null,
      2
    ),
    "utf8"
  );
  const output: string[] = [];
  await runCommand(
    parseArgs(["show-run", fixture.runId, "--config", fixture.configArg]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  assert.ok(output.some((line) => line.includes("status: failed")));
  assert.ok(output.some((line) => line.includes("builder execution status: failed")));
  assert.ok(output.some((line) => line.includes("error summary: builder failed")));
});

test("show-run with --config but missing run id fails with usage error", async () => {
  const fixture = await makeRunFixture();
  await assert.rejects(
    () => runCommand(parseArgs(["show-run", "--config", fixture.configArg]), fixture.orchestratorRoot, "linux", async () => {}),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Usage: agent-stage show-run <run-id> --config <config-path>/);
      assert.doesNotMatch(message, /Unknown argument: configs\/acme\.json/);
      return true;
    }
  );
});

test("show-run rejects traversal run id", async () => {
  const fixture = await makeRunFixture();
  await assert.rejects(
    () => runCommand(parseArgs(["show-run", "../bad", "--config", fixture.configArg]), fixture.orchestratorRoot, "linux", async () => {}),
    /Invalid run id/
  );
});

test("open-run rejects traversal run id", async () => {
  const fixture = await makeRunFixture();
  await assert.rejects(
    () => runCommand(parseArgs(["open-run", "../bad", "--config", fixture.configArg]), fixture.orchestratorRoot, "darwin", async () => {}),
    /Invalid run id/
  );
});

test("open-run with --config but missing run id fails with usage error", async () => {
  const fixture = await makeRunFixture();
  await assert.rejects(
    () => runCommand(parseArgs(["open-run", "--config", fixture.configArg]), fixture.orchestratorRoot, "darwin", async () => {}),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /Usage: agent-stage open-run <run-id> --config <config-path>/);
      assert.doesNotMatch(message, /Unknown argument: configs\/acme\.json/);
      return true;
    }
  );
});

test("open-run uses injected opener on macOS", async () => {
  const fixture = await makeRunFixture();
  const calls: string[] = [];
  await runCommand(
    parseArgs(["open-run", fixture.runId, "--config", fixture.configArg]),
    fixture.orchestratorRoot,
    "darwin",
    async (runDir) => {
      calls.push(runDir);
    }
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0], /runs\/acme\/20260513-000000-example-stage$/);
});

test("open-run on non-macOS prints unsupported message and does not call opener", async () => {
  const fixture = await makeRunFixture();
  let called = 0;
  const output: string[] = [];
  await runCommand(
    parseArgs(["open-run", fixture.runId, "--config", fixture.configArg]),
    fixture.orchestratorRoot,
    "linux",
    async () => {
      called += 1;
    },
    (line) => output.push(line)
  );
  assert.equal(called, 0);
  assert.ok(output.some((line) => line.includes("Auto-open unsupported on platform linux")));
});

test("report-run default writes report markdown/json and prints concise summary", async () => {
  const fixture = await makeReportRunFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["report-run", fixture.runId, "--config", fixture.configArg]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  const markdown = await readFile(path.join(fixture.runDir, "run-report.md"), "utf8");
  const json = await readFile(path.join(fixture.runDir, "run-report.json"), "utf8");
  assert.match(markdown, /# AI Change Report/);
  assert.match(json, /"status":/);
  assert.ok(output.some((line) => line.includes("AI Change Report")));
  assert.ok(output.some((line) => line.includes("status:")));
  assert.ok(output.some((line) => line.includes("score:")));
  assert.ok(output.some((line) => line.includes("risk:")));
  assert.ok(output.some((line) => line.includes("changed files:")));
  assert.ok(output.some((line) => line.includes("report markdown:")));
  assert.ok(output.some((line) => line.includes("report json:")));
});

test("report-run --pr-summary writes report artefacts and pr-summary.md and prints path", async () => {
  const fixture = await makeReportRunFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["report-run", fixture.runId, "--config", fixture.configArg, "--pr-summary"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  await readFile(path.join(fixture.runDir, "run-report.md"), "utf8");
  await readFile(path.join(fixture.runDir, "run-report.json"), "utf8");
  const prSummary = await readFile(path.join(fixture.runDir, "pr-summary.md"), "utf8");
  assert.match(prSummary, /^# /);
  assert.ok(output.some((line) => line.includes("PR summary markdown:")));
});

test("report-run --pr-summary --stdout-only prints PR markdown only and writes no files", async () => {
  const fixture = await makeReportRunFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["report-run", fixture.runId, "--config", fixture.configArg, "--pr-summary", "--stdout-only"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  await assert.rejects(() => readFile(path.join(fixture.runDir, "run-report.md"), "utf8"));
  await assert.rejects(() => readFile(path.join(fixture.runDir, "run-report.json"), "utf8"));
  await assert.rejects(() => readFile(path.join(fixture.runDir, "pr-summary.md"), "utf8"));
  const text = output.join("\n");
  assert.match(text, /^# /);
  assert.match(text, /## Manual Checklist/);
  assert.doesNotMatch(text, /# AI Change Report/);
});

test("report-run --stdout-only writes no files and prints markdown", async () => {
  const fixture = await makeReportRunFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["report-run", fixture.runId, "--config", fixture.configArg, "--stdout-only"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  await assert.rejects(() => readFile(path.join(fixture.runDir, "run-report.md"), "utf8"));
  await assert.rejects(() => readFile(path.join(fixture.runDir, "run-report.json"), "utf8"));
  assert.match(output.join("\n"), /# AI Change Report/);
});

test("report-run --stdout-only --json writes no files and stdout is parseable json only", async () => {
  const fixture = await makeReportRunFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["report-run", fixture.runId, "--config", fixture.configArg, "--stdout-only", "--json"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  const stdout = output.join("\n");
  await assert.rejects(() => readFile(path.join(fixture.runDir, "run-report.md"), "utf8"));
  await assert.rejects(() => readFile(path.join(fixture.runDir, "run-report.json"), "utf8"));
  const parsed = JSON.parse(stdout) as { version: number; runId: string };
  assert.equal(parsed.version, 1);
  assert.equal(parsed.runId, fixture.runId);
  assert.equal(output.length, 1);
  assert.doesNotMatch(stdout, /\[report\]/);
  assert.doesNotMatch(stdout, /AI Change Report/);
});

test("report-run --json writes files and stdout is parseable json only", async () => {
  const fixture = await makeReportRunFixture();
  const output: string[] = [];
  await runCommand(
    parseArgs(["report-run", fixture.runId, "--config", fixture.configArg, "--json"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  const stdout = output.join("\n");
  const parsed = JSON.parse(stdout) as { version: number; runId: string };
  assert.equal(parsed.version, 1);
  assert.equal(parsed.runId, fixture.runId);
  assert.equal(output.length, 1);
  assert.doesNotMatch(stdout, /\[report\]/);
  assert.doesNotMatch(stdout, /AI Change Report/);
  await readFile(path.join(fixture.runDir, "run-report.md"), "utf8");
  await readFile(path.join(fixture.runDir, "run-report.json"), "utf8");
});

test("report-run uses configured changeReport policy", async () => {
  const fixture = await makeReportRunFixture();
  const configPath = path.join(fixture.orchestratorRoot, fixture.configArg);
  const configRaw = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  configRaw.changeReport = {
    riskRules: {
      highRiskPaths: [],
      mediumRiskPaths: ["src/"],
      lowRiskPaths: ["src/"]
    },
    readiness: {
      readyMinimumScore: 100,
      needsReviewMinimumScore: 60,
      penalties: {
        failedRun: 40,
        reviewerFail: 35,
        checksFailed: 30,
        checksSkippedWithSourceChanges: 20,
        postWriteReviewPendingOrFailed: 20,
        highRiskFiles: 15,
        mediumRiskFiles: 50,
        scopeDriftWarning: 10,
        nonBlockingReviewerIssue: 5
      }
    }
  };
  await writeFile(configPath, JSON.stringify(configRaw, null, 2), "utf8");

  await runCommand(parseArgs(["report-run", fixture.runId, "--config", fixture.configArg]), fixture.orchestratorRoot, "linux", async () => {});

  const report = JSON.parse(await readFile(path.join(fixture.runDir, "run-report.json"), "utf8")) as { status: string; score: number };
  assert.equal(report.status, "NEEDS_REVIEW");
  assert.equal(report.score, 50);
});

test("report-run fails when report artefacts already exist unless --force is provided", async () => {
  const fixture = await makeReportRunFixture();
  await writeFile(path.join(fixture.runDir, "run-report.md"), "old", "utf8");
  await assert.rejects(
    () =>
      runCommand(
        parseArgs(["report-run", fixture.runId, "--config", fixture.configArg]),
        fixture.orchestratorRoot,
        "linux",
        async () => {}
      ),
    /Report artefacts already exist\. Use --force to overwrite\./
  );
});

test("report-run --pr-summary fails atomically when pr-summary.md exists and report files are missing", async () => {
  const fixture = await makeReportRunFixture();
  const prSummaryPath = path.join(fixture.runDir, "pr-summary.md");
  await writeFile(prSummaryPath, "existing-pr-summary", "utf8");

  await assert.rejects(
    () =>
      runCommand(
        parseArgs(["report-run", fixture.runId, "--config", fixture.configArg, "--pr-summary"]),
        fixture.orchestratorRoot,
        "linux",
        async () => {}
      ),
    /PR summary artefact already exists\. Use --force to overwrite\./
  );

  await assert.rejects(() => readFile(path.join(fixture.runDir, "run-report.md"), "utf8"));
  await assert.rejects(() => readFile(path.join(fixture.runDir, "run-report.json"), "utf8"));
  assert.equal(await readFile(prSummaryPath, "utf8"), "existing-pr-summary");
});

test("report-run --pr-summary fails atomically when report file exists and does not overwrite pr-summary.md", async () => {
  const fixture = await makeReportRunFixture();
  const reportMarkdownPath = path.join(fixture.runDir, "run-report.md");
  const prSummaryPath = path.join(fixture.runDir, "pr-summary.md");
  await writeFile(reportMarkdownPath, "existing-report", "utf8");
  await writeFile(prSummaryPath, "existing-pr-summary", "utf8");

  await assert.rejects(
    () =>
      runCommand(
        parseArgs(["report-run", fixture.runId, "--config", fixture.configArg, "--pr-summary"]),
        fixture.orchestratorRoot,
        "linux",
        async () => {}
      ),
    /Report artefacts already exist\. Use --force to overwrite\./
  );

  assert.equal(await readFile(reportMarkdownPath, "utf8"), "existing-report");
  await assert.rejects(() => readFile(path.join(fixture.runDir, "run-report.json"), "utf8"));
  assert.equal(await readFile(prSummaryPath, "utf8"), "existing-pr-summary");
});

test("report-run overwrites artefacts with --force", async () => {
  const fixture = await makeReportRunFixture();
  await writeFile(path.join(fixture.runDir, "run-report.md"), "old-md", "utf8");
  await writeFile(path.join(fixture.runDir, "run-report.json"), "old-json", "utf8");
  await runCommand(
    parseArgs(["report-run", fixture.runId, "--config", fixture.configArg, "--force"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {}
  );
  const markdown = await readFile(path.join(fixture.runDir, "run-report.md"), "utf8");
  const json = await readFile(path.join(fixture.runDir, "run-report.json"), "utf8");
  assert.notEqual(markdown, "old-md");
  assert.notEqual(json, "old-json");
});

test("report-run --pr-summary --force overwrites pr-summary.md and writes report files", async () => {
  const fixture = await makeReportRunFixture();
  const prSummaryPath = path.join(fixture.runDir, "pr-summary.md");
  await writeFile(prSummaryPath, "old-pr-summary", "utf8");
  await runCommand(
    parseArgs(["report-run", fixture.runId, "--config", fixture.configArg, "--pr-summary", "--force"]),
    fixture.orchestratorRoot,
    "linux",
    async () => {}
  );
  const prSummary = await readFile(prSummaryPath, "utf8");
  const markdown = await readFile(path.join(fixture.runDir, "run-report.md"), "utf8");
  const json = await readFile(path.join(fixture.runDir, "run-report.json"), "utf8");
  assert.notEqual(prSummary, "old-pr-summary");
  assert.match(prSummary, /^# /);
  assert.match(markdown, /# AI Change Report/);
  assert.match(json, /"status":/);
});

test("report-run fails clearly when run directory is missing", async () => {
  const fixture = await makeReportRunFixture();
  await assert.rejects(
    () =>
      runCommand(
        parseArgs(["report-run", "missing-run-id", "--config", fixture.configArg]),
        fixture.orchestratorRoot,
        "linux",
        async () => {}
      ),
    /Run does not exist: missing-run-id/
  );
});

test("report-run does not call run/continue/check-write-safety/auto-chain handlers", async () => {
  const fixture = await makeReportRunFixture();
  let checkSafetyCalls = 0;
  let autoChainCalls = 0;
  await runCommand(
    parseArgs(["report-run", fixture.runId, "--config", fixture.configArg]),
    fixture.orchestratorRoot,
    "linux",
    async () => {},
    () => {},
    {
      checkWriteSafetyHandler: async () => {
        checkSafetyCalls += 1;
        throw new Error("should not be called");
      },
      autoChainHandler: async () => {
        autoChainCalls += 1;
        throw new Error("should not be called");
      }
    }
  );
  assert.equal(checkSafetyCalls, 0);
  assert.equal(autoChainCalls, 0);
});

test("repeated preset fails clearly", () => {
  assert.throws(
    () => parseArgs(["run", "example-stage", "--config", "configs/acme.json", "--preset", "plan", "--preset", "build"]),
    /Repeated --preset/
  );
});

test("continue-run missing run id fails clearly", async () => {
  const fixture = await makeRunFixture();
  await assert.rejects(
    () => runCommand(parseArgs(["continue-run", "--config", fixture.configArg, "--execute-builder"]), fixture.orchestratorRoot, "linux", async () => {}),
    /Usage: agent-stage continue-run <run-id> --config <config-path>/
  );
});

test("continue-run invalid run id rejects traversal", async () => {
  const fixture = await makeRunFixture();
  await assert.rejects(
    () => runCommand(parseArgs(["continue-run", "../bad", "--config", fixture.configArg, "--execute-builder"]), fixture.orchestratorRoot, "linux", async () => {}),
    /Invalid run id/
  );
});

test("continue-run without phase flags fails clearly", () => {
  assert.throws(() => parseArgs(["continue-run", "run-id", "--config", "configs/acme.json"]), /requires at least one phase flag/);
});

test("continue-run --execute-planner fails clearly", () => {
  assert.throws(
    () => parseArgs(["continue-run", "run-id", "--config", "configs/acme.json", "--execute-planner"]),
    /--execute-planner is not supported for continue-run/
  );
});

test("continue-run --preset fails clearly", () => {
  assert.throws(
    () => parseArgs(["continue-run", "run-id", "--config", "configs/acme.json", "--preset", "plan", "--execute-builder"]),
    /--preset is not supported for continue-run/
  );
});

test("init-project missing name fails clearly", () => {
  assert.throws(
    () => parseArgs(["init-project", "--workspace", "/tmp/repo"]),
    /init-project requires <name>|Usage: agent-stage init-project/
  );
});

test("init-project missing workspace fails clearly", () => {
  assert.throws(
    () => parseArgs(["init-project", "My App"]),
    /init-project requires --workspace <path>/
  );
});

test("init-project unknown args fail clearly", () => {
  assert.throws(
    () => parseArgs(["init-project", "My App", "--workspace", "/tmp/repo", "--bogus"]),
    /Unknown argument: --bogus/
  );
});

test("init-project success prints example run command", async () => {
  const orchestratorRoot = await mkdtemp(path.join(os.tmpdir(), "orchestrator-init-cli-"));
  await mkdir(path.join(orchestratorRoot, "configs"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "stages"), { recursive: true });
  await mkdir(path.join(orchestratorRoot, "runs"), { recursive: true });
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "target-repo-init-cli-"));
  await mkdir(path.join(workspaceRoot, ".git"), { recursive: true });

  const output: string[] = [];
  await runCommand(
    parseArgs(["init-project", "My App", "--workspace", workspaceRoot]),
    orchestratorRoot,
    "linux",
    async () => {},
    (line) => output.push(line)
  );
  assert.ok(output.some((line) => line.includes("Project initialization summary")));
  assert.ok(output.some((line) => line.includes("example run command: npm run agent -- run example-stage --config configs/my-app.json --preset plan --dry-run")));
});

test("check-write-safety prints clear output and uses injected handler", async () => {
  const output: string[] = [];
  let called = 0;
  await runCommand(
    parseArgs(["check-write-safety", "--config", "configs/acme.json"]),
    process.cwd(),
    "linux",
    async () => {},
    (line) => output.push(line),
    {
      checkWriteSafetyHandler: async (configPath) => {
        called += 1;
        assert.equal(configPath, "configs/acme.json");
        return {
          configPath: "/tmp/orchestrator/configs/acme.json",
          workspaceRoot: "/tmp/workspace",
          result: {
            ok: true,
            summary: "Write safety check passed.",
            failures: [],
            warnings: [],
            enabled: true,
            branch: "feature/test",
            isGitWorkTree: true,
            isCleanWorkingTree: true,
            workingTreeState: "clean",
            changedFiles: [],
            matchedBlockedPaths: []
          }
        };
      }
    }
  );

  assert.equal(called, 1);
  assert.ok(output.some((line) => line.includes("Write safety summary")));
  assert.ok(output.some((line) => line.includes("result: PASS")));
});

test("check-write-safety shows live progress lines before summary", async () => {
  const output: string[] = [];
  await runCommand(
    parseArgs(["check-write-safety", "--config", "configs/acme.json"]),
    process.cwd(),
    "linux",
    async () => {},
    (line) => output.push(line),
    {
      checkWriteSafetyHandler: async (_configPath, _root, progressLogger) => {
        progressLogger.phaseStart("write-safety", "loading config");
        progressLogger.phaseStart("write-safety", "inspecting git workspace");
        progressLogger.phaseStart("write-safety", "checking blocked paths");
        progressLogger.phaseComplete("write-safety", "passed");
        return {
          configPath: "/tmp/orchestrator/configs/acme.json",
          workspaceRoot: "/tmp/workspace",
          result: {
            ok: true,
            summary: "Write safety check passed.",
            failures: [],
            warnings: [],
            enabled: true,
            branch: "feature/test",
            isGitWorkTree: true,
            isCleanWorkingTree: true,
            workingTreeState: "clean",
            changedFiles: [],
            matchedBlockedPaths: []
          }
        };
      }
    }
  );

  const text = output.join("\n");
  assert.match(text, /\[write-safety\] loading config/);
  assert.match(text, /\[write-safety\] inspecting git workspace/);
  assert.match(text, /\[write-safety\] checking blocked paths/);
  assert.match(text, /\[write-safety\] passed/);
  assert.match(text, /Write safety summary/);
});

test("check-write-safety exits non-zero via thrown error when failing", async () => {
  await assert.rejects(
    () =>
      runCommand(parseArgs(["check-write-safety", "--config", "configs/acme.json"]), process.cwd(), "linux", async () => {}, () => {}, {
        checkWriteSafetyHandler: async () => ({
          configPath: "/tmp/orchestrator/configs/acme.json",
          workspaceRoot: "/tmp/workspace",
          result: {
            ok: false,
            summary: "Write safety check failed.",
            failures: ["writeSafety.enabled is false"],
            warnings: [],
            enabled: false,
            branch: "main",
            isGitWorkTree: true,
            isCleanWorkingTree: true,
            workingTreeState: "clean",
            changedFiles: [],
            matchedBlockedPaths: []
          }
        })
      }),
    /check-write-safety failed/
  );
});

test("check-write-safety prints working tree unknown when inspection unavailable", async () => {
  const output: string[] = [];
  await runCommand(
    parseArgs(["check-write-safety", "--config", "configs/acme.json"]),
    process.cwd(),
    "linux",
    async () => {},
    (line) => output.push(line),
    {
      checkWriteSafetyHandler: async () => ({
        configPath: "/tmp/orchestrator/configs/acme.json",
        workspaceRoot: "/tmp/workspace",
        result: {
          ok: true,
          summary: "Write safety check passed.",
          failures: [],
          warnings: [],
          enabled: true,
          branch: "",
          isGitWorkTree: false,
          isCleanWorkingTree: false,
          workingTreeState: "unknown",
          changedFiles: [],
          matchedBlockedPaths: []
        }
      })
    }
  );
  assert.ok(output.some((line) => line.includes("working tree: unknown")));
});
