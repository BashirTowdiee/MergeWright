export interface TuiSelectionState {
  runIndex: number;
  phaseIndex: number;
  actionIndex: number;
  fileIndex: number;
  findingIndex: number;
}

export function createInitialSelectionState(): TuiSelectionState {
  return {
    runIndex: 0,
    phaseIndex: 0,
    actionIndex: 0,
    fileIndex: 0,
    findingIndex: 0
  };
}

export function selectRun(state: TuiSelectionState, runIndex: number): TuiSelectionState {
  return {
    ...state,
    runIndex,
    phaseIndex: 0,
    actionIndex: 0,
    fileIndex: 0,
    findingIndex: 0
  };
}

export function selectPhase(state: TuiSelectionState, phaseIndex: number): TuiSelectionState {
  return {
    ...state,
    phaseIndex,
    fileIndex: 0
  };
}

export function selectAction(state: TuiSelectionState, actionIndex: number): TuiSelectionState {
  return { ...state, actionIndex };
}

export function selectFile(state: TuiSelectionState, fileIndex: number): TuiSelectionState {
  return { ...state, fileIndex };
}

export function selectFinding(state: TuiSelectionState, findingIndex: number): TuiSelectionState {
  return { ...state, findingIndex };
}

export function resetFileSelection(state: TuiSelectionState): TuiSelectionState {
  return { ...state, fileIndex: 0 };
}
