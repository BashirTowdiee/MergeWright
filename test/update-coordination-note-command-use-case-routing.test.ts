import test from "node:test";
import assert from "node:assert/strict";
import type { UpdateCoordinationNoteCommand } from "../src/application/commands/app-command.js";
import { DefaultAppCommandService } from "../src/application/commands/default-app-command-service.js";
import type { UpdateCoordinationNoteUseCase } from "../src/application/use-cases/update-coordination-note-use-case.js";

const command: UpdateCoordinationNoteCommand = {
  commandId: "cmd-service-1",
  source: "automation",
  requestedAt: "2026-05-25T00:00:00.000Z",
  actor: {
    id: "tester",
    displayName: "Tester"
  },
  type: "update-coordination-note",
  note: "Record next action.",
  expectedRevision: "rev-1"
};

test("DefaultAppCommandService routes update-coordination-note through injected use case", async () => {
  const calls: UpdateCoordinationNoteCommand[] = [];
  const useCase: UpdateCoordinationNoteUseCase = {
    execute(updateCoordinationNoteCommand) {
      calls.push(updateCoordinationNoteCommand);
      return {
        ok: true,
        commandId: updateCoordinationNoteCommand.commandId,
        type: updateCoordinationNoteCommand.type,
        message: "Use case accepted coordination note.",
        changedFiles: []
      };
    }
  };
  const service = new DefaultAppCommandService({
    resolveRisk: () => "none",
    updateCoordinationNoteUseCase: useCase
  });

  const result = await service.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "cmd-service-1",
    type: "update-coordination-note",
    message: "Use case accepted coordination note.",
    changedFiles: []
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.note, "Record next action.");
});
