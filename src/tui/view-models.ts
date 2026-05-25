import type {
  RenderableArtefact as SharedRenderableArtefact,
  ReviewFinding,
  RunArtefact,
  RunArtefactKind,
  RunDetail,
  RunMode,
  RunPhase,
  RunPhaseStatus,
  RunStatus,
  RunSummary,
  SafeAction
} from "../application/read-models/run-read-model.js";

export type TuiRunStatus = RunStatus;

export type TuiPhaseStatus = RunPhaseStatus;

export type TuiRunMode = RunMode;

export type TuiArtefactKind = RunArtefactKind;

export type RunListItemViewModel = RunSummary;

export type PhaseNodeViewModel = RunPhase;

export type ArtefactViewModel = RunArtefact;

export type SafeActionId = SafeAction["id"];

export type SafeActionViewModel = SafeAction;

export type ReviewFindingViewModel = ReviewFinding;

export type RunDetailViewModel = RunDetail;

export type RenderableArtefact = SharedRenderableArtefact;
