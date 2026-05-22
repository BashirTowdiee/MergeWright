import React from "react";
import { Box, Text } from "ink";
import type { TuiCommandPreviewState } from "../command-preview-state.js";
import { buildCommandViewDetails, buildCommandViewRows } from "../command-view-details.js";

export function CommandPreviewPane({ state }: { state: TuiCommandPreviewState }) {
  const details = buildCommandViewDetails(state);

  if (!details) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
      <Text bold>Command</Text>
      {buildCommandViewRows(details).map((row) => (
        <Text key={row}>{row}</Text>
      ))}
    </Box>
  );
}
