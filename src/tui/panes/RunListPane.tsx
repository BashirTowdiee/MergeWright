import React from "react";
import { Box, Text } from "ink";
import { getStatusSymbol } from "../components/status.js";
import { getEmptyStateMessage } from "../empty-state.js";
import type { RunListItemViewModel } from "../view-models.js";

export interface RunListPaneProps {
  runs: RunListItemViewModel[];
  selectedRunIndex: number;
  focused: boolean;
  title?: string;
}

export function RunListPane({ runs, selectedRunIndex, focused, title = "Runs" }: RunListPaneProps) {
  const heading = focused ? `[${title}]` : title;
  return (
    <Box flexDirection="column" width={30} borderStyle="round" paddingX={1} marginRight={1}>
      <Text bold>{heading}</Text>
      {runs.length === 0 ? <Text dimColor>{getEmptyStateMessage("runs")}</Text> : runs.map((run, index) => (
        <Box key={run.id} flexDirection="column" marginBottom={1}>
          <Text inverse={focused && index === selectedRunIndex}>
            {index === selectedRunIndex ? "selected" : "       "} {getStatusSymbol(run.status)} {run.title}
          </Text>
          <Text dimColor>   {run.subtitle}</Text>
        </Box>
      ))}
    </Box>
  );
}
