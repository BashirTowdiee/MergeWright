import test from "node:test";
import assert from "node:assert/strict";
import type { AppCommand } from "../src/application/commands/app-command.js";
import { describeCommand } from "../src/application/commands/command-description.js";
import { COMMAND_RISKS, requiresConfirmationForRisk } from "../src/application/commands/command-risk.js";
import { getConfirmationRequirement } from "../src/application/commands/confirmation.js";

const command: AppCommand = {
  commandId: "cmd-1",
  source: "tui",
  requestedAt: "2026-05-22T13:20:00.000Z",
  type: "approve-stage",
  stageId: "stage-1"
};

test("command risk model identifies confirmation levels", () => {
  assert.deepEqual(COMMAND_RISKS, ["none", "low", "medium", "high"]);
  assert.equal(requiresConfirmationForRisk("none"), false);
  assert.equal(requiresConfirmationForRisk("low"), false);
  assert.equal(requiresConfirmationForRisk("medium"), true);
  assert.equal(requiresConfirmationForRisk("high"), true);
});

test("confirmation is required for medium or high risk commands", () => {
  assert.deepEqual(getConfirmationRequirement(command, "medium"), {
    required: true,
    reason: "approve-stage requires confirmation because its risk is medium."
  });
});

test("confirmation token satisfies approve-stage confirmation", () => {
  const confirmed: AppCommand = {
    ...command,
    confirmationToken: "confirm-1"
  };

  assert.deepEqual(getConfirmationRequirement(confirmed, "high"), { required: false });
});

test("command descriptions are service-renderable without execution", () => {
  const description = describeCommand(command, "medium");

  assert.deepEqual(description, {
    commandId: "cmd-1",
    type: "approve-stage",
    title: "approve-stage",
    summary: "Describes the approve-stage command before execution.",
    risk: "medium",
    requiresConfirmation: true,
    preconditions: [],
    effects: [],
    blockedReason: "approve-stage requires confirmation because its risk is medium."
  });
});
