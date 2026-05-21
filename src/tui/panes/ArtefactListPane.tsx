import React from "react";
import { Box, Text } from "ink";
import { getEmptyStateMessage } from "../empty-state.js";
import { getFocusedPaneTitle } from "../focus.js";
import type { ArtefactViewModel } from "../view-models.js";

export interface ArtefactListPaneProps {
  artefacts: ArtefactViewModel[];
  selectedArtefactIndex: number;
  focused: boolean;
  title: string;
}

export function ArtefactListPane({ artefacts, selectedArtefactIndex, focused, title }: ArtefactListPaneProps) {
  return (
    <Box flexDirection="column" width={46} borderStyle="round" paddingX={1} marginRight={1}>
      <Text bold>{getFocusedPaneTitle(title, focused)}</Text>
      {artefacts.length === 0 ? <Text dimColor>{getEmptyStateMessage("artefacts")}</Text> : artefacts.map((artefact, index) => (
        <Text key={artefact.id} inverse={focused && index === selectedArtefactIndex}>{index === selectedArtefactIndex ? ">" : " "} {artefact.kind.padEnd(8)} {artefact.title}</Text>
      ))}
    </Box>
  );
}
