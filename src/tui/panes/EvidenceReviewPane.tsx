import React from "react";
import { Box, Text } from "ink";
import { getEmptyStateMessage } from "../empty-state.js";
import { getFocusedPaneTitle } from "../focus.js";
import type { ReviewFindingViewModel } from "../view-models.js";

export interface EvidenceReviewPaneProps {
  evidenceLines: string[];
  findings: ReviewFindingViewModel[];
  selectedFindingIndex: number;
  findingsFocused: boolean;
  findingDetailLines: string[];
}

export function EvidenceReviewPane({
  evidenceLines,
  findings,
  selectedFindingIndex,
  findingsFocused,
  findingDetailLines
}: EvidenceReviewPaneProps) {
  return (
    <Box flexDirection="column" width={80} borderStyle="round" paddingX={1}>
      <Text bold>Evidence preview</Text>
      {evidenceLines.map((line, index) => (
        <Text key={`${line}-${index}`}>{line}</Text>
      ))}
      <Box marginTop={1}>
        <Text bold>{getFocusedPaneTitle("Review findings", findingsFocused)}</Text>
        {findings.length === 0 ? <Text dimColor>{getEmptyStateMessage("findings")}</Text> : findings.map((finding, index) => (
          <Text key={`${finding.severity}-${index}`} inverse={findingsFocused && index === selectedFindingIndex}>{index === selectedFindingIndex ? ">" : " "} {finding.severity.toUpperCase()}: {finding.message}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text bold>Finding detail</Text>
        {findingDetailLines.map((line) => (
          <Text key={line}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
}
