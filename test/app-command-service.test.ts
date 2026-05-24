import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { ContinueRunCommandHandler, RetryPhaseCommandHandler, StartRunCommandHandler } from "../src/application/commands/default-app-command-service.js";
import type { CommandMetadata } from "../src/application/commands/command-source.js";

const metadata: CommandMetadata = {
  commandId: "cmd-service-1",
  source: "tui",
  requestedAt: "2026-05-23T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  }
};

const command: AppCommand = {
  ...metadata,
  type: "select-task",
  taskId: "task-1"
};

test("DefaultAppCommandService describes commands from metadata", async () => {
  const service = new DefaultAppCommandService();

  const description = await service.describe(command);

  assert.equal(description.commandId, "cmd-service-1");
  assert.equal(description.type, "select-task");
  assert.equal(description.title, "Select task");
  assert.equal(description.risk, "none");
  assert.equal(description.requiresConfirmation, false);
  assert.deepEqual(description.preconditions, ["Task exists in the current read model."]);
});

test("DefaultAppCommandService can describe overridden command risk", async () => {
  const service = new DefaultAppCommandService({ resolveRisk: () => "high" });

  const description = await service.describe(command);

  assert.equal(description.risk, "high");
  assert.equal(description.requiresConfirmation, true);
  assert.equal(description.blockedReason, "select-task requires confirmation because its risk is high.");
});

test("DefaultAppCommandService executes select-task without file changes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "select-task",
    message: "Selected task task-1."
  });
});

test("DefaultAppCommandService validates missing select-task IDs", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({ ...command, taskId: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "select-task",
    code: "VALIDATION_FAILED",
    reason: "Task ID is required."
  });
});

test("DefaultAppCommandService accepts coordination notes without direct file writes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "update-coordination-note",
    note: "Record next action.",
    expectedRevision: "rev-1"
  });

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "update-coordination-note",
    message: "Coordination note accepted for service handling.",
    changedFiles: []
  });
});

test("DefaultAppCommandService validates empty coordination notes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "update-coordination-note",
    note: "  "
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "update-coordination-note",
    code: "VALIDATION_FAILED",
    reason: "Coordination note is required."
  });
});

test("DefaultAppCommandService marks tasks reviewed without direct file writes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "mark-task-reviewed",
    taskId: "task-1",
    reviewedAt: "2026-05-23T00:00:00.000Z"
  });

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "mark-task-reviewed",
    message: "Marked task task-1 reviewed.",
    changedFiles: []
  });
});

test("DefaultAppCommandService validates missing reviewed task IDs", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "mark-task-reviewed",
    taskId: "  ",
    reviewedAt: "2026-05-23T00:00:00.000Z"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "mark-task-reviewed",
    code: "VALIDATION_FAILED",
    reason: "Task ID is required."
  });
});

test("DefaultAppCommandService validates reviewed timestamps", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "mark-task-reviewed",
    taskId: "task-1",
    reviewedAt: "not-a-date"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "mark-task-reviewed",
    code: "VALIDATION_FAILED",
    reason: "Reviewed-at timestamp must be a valid date."
  });
});

test("DefaultAppCommandService accepts task comments without direct file writes", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "add-task-comment",
    taskId: "task-1",
    comment: "Looks ready."
  });

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "add-task-comment",
    message: "Comment accepted for task task-1.",
    changedFiles: []
  });
});

test("DefaultAppCommandService validates missing commented task IDs", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "add-task-comment",
    taskId: "  ",
    comment: "Looks ready."
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "add-task-comment",
    code: "VALIDATION_FAILED",
    reason: "Task ID is required."
  });
});

test("DefaultAppCommandService validates empty task comments", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "add-task-comment",
    taskId: "task-1",
    comment: "  "
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "add-task-comment",
    code: "VALIDATION_FAILED",
    reason: "Task comment is required."
  });
});

test("DefaultAppCommandService routes start-run through an injected service handler", async () => {
  const calls: Extract<AppCommand, { readonly type: "start-run" }>[] = [];
  const handler: StartRunCommandHandler = (startRunCommand) => {
    calls.push(startRunCommand);
    return {
      ok: true,
      commandId: startRunCommand.commandId,
      type: startRunCommand.type,
      message: "Started planner run.",
      runId: "run-1",
      artefacts: ["runs/run-1/planner-output.md"]
    };
  };
  const service = new DefaultAppCommandService({ startRunHandler: handler });

  const result = await service.execute({
    ...metadata,
    type: "start-run",
    stageName: "stage-8",
    configPath: "configs/shepherd-self.json",
    preset: "plan"
  });

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "start-run",
    message: "Started planner run.",
    runId: "run-1",
    artefacts: ["runs/run-1/planner-output.md"]
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].stageName, "stage-8");
  assert.equal(calls[0].configPath, "configs/shepherd-self.json");
});

test("DefaultAppCommandService validates start-run before handler execution", async () => {
  let called = false;
  const service = new DefaultAppCommandService({
    startRunHandler: () => {
      called = true;
      return {
        ok: true,
        commandId: "cmd-service-1",
        type: "start-run",
        message: "Started planner run."
      };
    }
  });

  const result = await service.execute({
    ...metadata,
    type: "start-run",
    stageName: "  ",
    configPath: "configs/shepherd-self.json"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "start-run",
    code: "VALIDATION_FAILED",
    reason: "Stage name is required."
  });
  assert.equal(called, false);
});

test("DefaultAppCommandService reports unwired start-run handler", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "start-run",
    stageName: "stage-8",
    configPath: "configs/shepherd-self.json"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "start-run",
    code: "EXECUTION_FAILED",
    reason: "Start-run handler is not configured."
  });
});

test("DefaultAppCommandService routes continue-run through an injected service handler", async () => {
  const calls: Extract<AppCommand, { readonly type: "continue-run" }>[] = [];
  const handler: ContinueRunCommandHandler = (continueRunCommand) => {
    calls.push(continueRunCommand);
    return {
      ok: true,
      commandId: continueRunCommand.commandId,
      type: continueRunCommand.type,
      message: "Continued run.",
      runId: continueRunCommand.runId,
      artefacts: ["runs/run-1/continue-output.md"]
    };
  };
  const service = new DefaultAppCommandService({ continueRunHandler: handler });

  const result = await service.execute({
    ...metadata,
    type: "continue-run",
    runId: "run-1"
  });

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "continue-run",
    message: "Continued run.",
    runId: "run-1",
    artefacts: ["runs/run-1/continue-output.md"]
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].runId, "run-1");
});

test("DefaultAppCommandService validates continue-run before handler execution", async () => {
  let called = false;
  const service = new DefaultAppCommandService({
    continueRunHandler: () => {
      called = true;
      return {
        ok: true,
        commandId: "cmd-service-1",
        type: "continue-run",
        message: "Continued run."
      };
    }
  });

  const result = await service.execute({
    ...metadata,
    type: "continue-run",
    runId: "  "
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "continue-run",
    code: "VALIDATION_FAILED",
    reason: "Run ID is required."
  });
  assert.equal(called, false);
});

test("DefaultAppCommandService reports unwired continue-run handler", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "continue-run",
    runId: "run-1"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "continue-run",
    code: "EXECUTION_FAILED",
    reason: "Continue-run handler is not configured."
  });
});

test("DefaultAppCommandService routes reviewer retry-phase through an injected service handler", async () => {
  const calls: Extract<AppCommand, { readonly type: "retry-phase" }>[] = [];
  const handler: RetryPhaseCommandHandler = (retryPhaseCommand) => {
    calls.push(retryPhaseCommand);
    return {
      ok: true,
      commandId: retryPhaseCommand.commandId,
      type: retryPhaseCommand.type,
      message: "Started reviewer retry.",
      runId: retryPhaseCommand.runId,
      artefacts: ["runs/run-1/reviewer-output.md"]
    };
  };
  const service = new DefaultAppCommandService({ retryPhaseHandler: handler });

  const result = await service.execute({
    ...metadata,
    type: "retry-phase",
    runId: "run-1",
    phase: "reviewer"
  });

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "retry-phase",
    message: "Started reviewer retry.",
    runId: "run-1",
    artefacts: ["runs/run-1/reviewer-output.md"]
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].runId, "run-1");
  assert.equal(calls[0].phase, "reviewer");
});

test("DefaultAppCommandService validates reviewer retry-phase before handler execution", async () => {
  let called = false;
  const service = new DefaultAppCommandService({
    retryPhaseHandler: () => {
      called = true;
      return {
        ok: true,
        commandId: "cmd-service-1",
        type: "retry-phase",
        message: "Started reviewer retry."
      };
    }
  });

  const result = await service.execute({
    ...metadata,
    type: "retry-phase",
    runId: "  ",
    phase: "reviewer"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "retry-phase",
    code: "VALIDATION_FAILED",
    reason: "Run ID is required."
  });
  assert.equal(called, false);
});

test("DefaultAppCommandService only supports reviewer retry-phase routing", async () => {
  let called = false;
  const service = new DefaultAppCommandService({
    retryPhaseHandler: () => {
      called = true;
      return {
        ok: true,
        commandId: "cmd-service-1",
        type: "retry-phase",
        message: "Started retry."
      };
    }
  });

  const result = await service.execute({
    ...metadata,
    type: "retry-phase",
    runId: "run-1",
    phase: "builder"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "retry-phase",
    code: "VALIDATION_FAILED",
    reason: "Only reviewer retry-phase commands are currently supported."
  });
  assert.equal(called, false);
});

test("DefaultAppCommandService reports unwired retry-phase handler", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "retry-phase",
    runId: "run-1",
    phase: "reviewer"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "retry-phase",
    code: "EXECUTION_FAILED",
    reason: "Retry-phase handler is not configured."
  });
});

test("DefaultAppCommandService rejects unwired command execution", async () => {
  const service = new DefaultAppCommandService();

  const result = await service.execute({
    ...metadata,
    type: "approve-stage",
    stageId: "stage-8"
  });

  assert.deepEqual(result, {
    ok: false,
    commandId: "cmd-service-1",
    type: "approve-stage",
    code: "EXECUTION_FAILED",
    reason: "Command execution is not wired yet."
  });
});