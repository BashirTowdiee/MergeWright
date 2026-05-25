import type { AppCommandType } from "./app-command.js";
import type { CommandRisk } from "./command-risk.js";

export type CommandMetadataDefinition = {
  readonly type: AppCommandType;
  readonly title: string;
  readonly summary: string;
  readonly defaultRisk: CommandRisk;
  readonly preconditions: readonly string[];
  readonly effects: readonly string[];
};

export const COMMAND_METADATA: Readonly<Record<AppCommandType, CommandMetadataDefinition>> = {
  "select-task": {
    type: "select-task",
    title: "Select task",
    summary: "Selects a task for display or follow-up action.",
    defaultRisk: "none",
    preconditions: ["Task exists in the current read model."],
    effects: ["Updates the selected task intent only."]
  },
  "update-coordination-note": {
    type: "update-coordination-note",
    title: "Update coordination note",
    summary: "Updates coordination notes through the command boundary.",
    defaultRisk: "medium",
    preconditions: ["Planning workspace exists.", "Expected revision still matches when supplied."],
    effects: ["Writes a coordination note."]
  },
  "mark-task-reviewed": {
    type: "mark-task-reviewed",
    title: "Mark task reviewed",
    summary: "Marks a task review as complete through the command boundary.",
    defaultRisk: "low",
    preconditions: ["Task exists."],
    effects: ["Records review state for a task."]
  },
  "add-task-comment": {
    type: "add-task-comment",
    title: "Add task comment",
    summary: "Adds a comment to a task through the command boundary.",
    defaultRisk: "low",
    preconditions: ["Task exists."],
    effects: ["Records a task comment."]
  },
  "start-run": {
    type: "start-run",
    title: "Start run",
    summary: "Starts a run through the command boundary.",
    defaultRisk: "high",
    preconditions: ["Configuration is valid.", "Write safety checks pass when writes are requested."],
    effects: ["Creates a new run and related artefacts."]
  },
  "continue-run": {
    type: "continue-run",
    title: "Continue run",
    summary: "Continues an existing run through the command boundary.",
    defaultRisk: "medium",
    preconditions: ["Run exists.", "Run is resumable."],
    effects: ["Updates run artefacts and state."]
  },
  "retry-phase": {
    type: "retry-phase",
    title: "Retry phase",
    summary: "Retries a failed or selected phase through the command boundary.",
    defaultRisk: "medium",
    preconditions: ["Run exists.", "Phase is retryable."],
    effects: ["Updates phase artefacts and state."]
  },
  "execute-builder": {
    type: "execute-builder",
    title: "Execute builder",
    summary: "Executes the builder phase through the command boundary after safety gates pass.",
    defaultRisk: "high",
    preconditions: [
      "Run exists.",
      "Builder phase is available for the run.",
      "Write safety checks pass.",
      "Repo is clean or the command is explicitly confirmed for writes.",
      "Branch is safe for writes.",
      "No dependency-blocked or overlapping file-scope task is active."
    ],
    effects: ["Runs the builder phase through service-routed execution.", "Captures builder output as artefacts."]
  },
  "approve-stage": {
    type: "approve-stage",
    title: "Approve stage",
    summary: "Approves a stage after review.",
    defaultRisk: "high",
    preconditions: ["Stage exists.", "Required review evidence is present."],
    effects: ["Records approval intent for the stage."]
  },
  "reassess-stage-plan": {
    type: "reassess-stage-plan",
    title: "Reassess stage plan",
    summary: "Requests reassessment of a stage plan.",
    defaultRisk: "low",
    preconditions: ["Stage exists."],
    effects: ["Records reassessment intent."]
  }
};

export function getCommandMetadata(type: AppCommandType): CommandMetadataDefinition {
  return COMMAND_METADATA[type];
}
