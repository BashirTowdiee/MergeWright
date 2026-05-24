import React from "react";
import { Box, Text } from "ink";
import { getEmptyStateMessage } from "../empty-state.js";
import { getFocusedPaneTitle } from "../focus.js";
import type { ArtefactViewModel } from "../view-models.js";

export interface ArtefactListPaneProps {
  artefacts: readonly ArtefactViewModel[];
  selectedArtefactIndex: number;
  focused: boolean;
  title: string;
  width?: number | "100%";
  marginRight?: number;
}

export function ArtefactListPane({
  artefacts,
  selectedArtefactIndex,
  focused,
  title,
  width = 46,
  marginRight = 1
}: ArtefactListPaneProps) {
  return (
    <Box flexDirection="column" width={width} borderStyle="round" paddingX={1} marginRight={marginRight}>
      <Text bold>{getFocusedPaneTitle(title, focused)}</Text>
      {artefacts.length === 0 ? <Text dimColor>{getEmptyStateMessage("artefacts")}</Text> : artefacts.map((artefact, index) => (
        <Text key={artefact.id} inverse={focused && index === selectedArtefactIndex}>{index === selectedArtefactIndex ? ">" : " "} {artefact.kind.padEnd(8)} {artefact.title}</Text>
      ))}
    </Box>
  );
}
