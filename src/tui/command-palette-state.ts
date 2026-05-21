export interface CommandPaletteUiState {
  open: boolean;
  query: string;
  selectedIndex: number;
}

export function createClosedCommandPaletteState(): CommandPaletteUiState {
  return { open: false, query: "", selectedIndex: 0 };
}

export function openCommandPaletteState(state: CommandPaletteUiState): CommandPaletteUiState {
  return { ...state, open: true };
}

export function closeCommandPaletteState(): CommandPaletteUiState {
  return createClosedCommandPaletteState();
}

export function toggleCommandPaletteState(state: CommandPaletteUiState): CommandPaletteUiState {
  return state.open ? closeCommandPaletteState() : openCommandPaletteState(state);
}

export function updateCommandPaletteQuery(state: CommandPaletteUiState, query: string): CommandPaletteUiState {
  return { ...state, query, selectedIndex: 0 };
}

export function updateCommandPaletteSelectedIndex(state: CommandPaletteUiState, selectedIndex: number): CommandPaletteUiState {
  return { ...state, selectedIndex };
}
