import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const expectedExports = [
  "src/application/commands/app-command.js",
  "src/application/commands/app-command-error.js",
  "src/application/commands/app-command-result.js",
  "src/application/commands/app-command-service.js",
  "src/application/commands/command-description.js",
  "src/application/commands/command-risk.js",
  "src/application/commands/command-source.js",
  "src/application/commands/confirmation.js",
  "src/application/commands/default-app-command-service.js",
  "src/application/commands/evented-app-command-service.js",
  "src/application/events/app-event.js",
  "src/application/events/app-event-bus.js",
  "src/application/queries/event-query-service.js",
  "src/application/use-cases/add-task-comment-use-case.js",
  "src/application/use-cases/start-run-use-case.js",
  "src/application/use-cases/continue-run-use-case.js",
  "src/application/use-cases/execute-builder-use-case.js",
  "src/application/use-cases/mark-task-reviewed-use-case.js",
  "src/application/use-cases/retry-phase-use-case.js",
  "src/application/use-cases/select-task-use-case.js",
  "src/application/use-cases/update-coordination-note-use-case.js",
  "src/application/use-cases/execute-audited-flow-use-case.js"
];

const expectedNamedExports = [
  "APP_COMMAND_ERROR_CODES",
  "AppCommandService",
  "describeCommand",
  "COMMAND_RISKS",
  "requiresConfirmationForRisk",
  "getCommandConfirmationState",
  "DefaultAppCommandService",
  "EventedAppCommandService",
  "DefaultEventQueryService",
  "DefaultAddTaskCommentUseCase",
  "DefaultContinueRunUseCase",
  "DefaultExecuteBuilderUseCase",
  "DefaultMarkTaskReviewedUseCase",
  "DefaultRetryPhaseUseCase",
  "DefaultSelectTaskUseCase",
  "DefaultStartRunUseCase",
  "DefaultUpdateCoordinationNoteUseCase",
  "DefaultExecuteAuditedFlowUseCase",
  "executeAuditedFlow"
];

test("application package exposes command, event, query, and use-case boundaries", async () => {
  const entrypoint = await readFile(join(process.cwd(), "packages/application/src/index.ts"), "utf8");

  assert.equal(entrypoint.includes("Package boundary placeholder"), false);

  for (const expectedExport of expectedExports) {
    assert.equal(
      entrypoint.includes(expectedExport),
      true,
      `Expected packages/application/src/index.ts to export ${expectedExport}`
    );
  }

  for (const expectedNamedExport of expectedNamedExports) {
    assert.equal(
      entrypoint.includes(expectedNamedExport),
      true,
      `Expected packages/application/src/index.ts to expose ${expectedNamedExport}`
    );
  }
});
