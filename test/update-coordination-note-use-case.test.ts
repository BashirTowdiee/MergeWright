import test from "node:test";
import assert from "node:assert/strict";
import type { UpdateCoordinationNoteCommand } from "../src/application/commands/app-command.js";
import { DefaultUpdateCoordinationNoteUseCase } from "../src/application/use-cases/update-coordination-note-use-case.js";

const command: UpdateCoordinationNoteCommand = {
  commandId: "coordination-note-1",
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

test("DefaultUpdateCoordinationNoteUseCase accepts a non-empty note", async () => {
  const useCase = new DefaultUpdateCoordinationNoteUseCase();

  const result = await useCase.execute(command);

  assert.deepEqual(result, {
    ok: true,
    commandId: "coordination-note-1",
    type: "update-coordination-note",
    message: "Coordination note accepted for service handling.",
    changedFiles: []
  });
});

test("DefaultUpdateCoordinationNoteUseCase validates empty notes", async () => {
  const useCase = new DefaultUpdateCoordinationNoteUseCase();

  const result = await useCase.execute({ ...command, note: "  " });

  assert.deepEqual(result, {
    ok: false,
    commandId: "coordination-note-1",
    type: "update-coordination-note",
    code: "VALIDATION_FAILED",
    reason: "Coordination note is required."
  });
});
