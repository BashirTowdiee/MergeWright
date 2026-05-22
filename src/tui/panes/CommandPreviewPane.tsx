import React from "react";
import { Box, Text } from "ink";
import type { TuiCommandPreviewState } from "../command-preview-state.js";
import { buildCommandViewDetails, buildCommandViewRows } from "../command-view-details.js";

export type CommandPreviewPaneModel = {
  readonly title: string;
  readonly rows: readonly string[];
};

export function buildCommandPreviewPaneModel(state: TuiCommandPreviewState): CommandPreviewPaneModel | undefined {
  const details = buildCommandViewDetails(state);

  if (!details) {
    return undefined;
  }

  return {
    title: "Command",
    rows: buildCommandViewRows(details)
  };
}

export function CommandPreviewPane({ state }: { state: TuiCommandPreviewState }) {
  const model = buildCommandPreviewPaneModel(state);

  if (!model) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
      <Text bold>{model.title}</Text>
      {model.rows.map((row) => (
        <Text key={row}>{row}</Text>
      ))}
    </Box>
  );
}
