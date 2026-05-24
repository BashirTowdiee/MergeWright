import React from "react";
import { Box, Text } from "ink";
import type { AppEvent } from "../../application/events/app-event.js";
import { buildProgressPaneModel } from "../progress-pane-model.js";

export function ProgressPane({ events }: { readonly events: readonly AppEvent[] }) {
  const model = buildProgressPaneModel(events);

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
      <Text bold>{model.title}</Text>
      {model.rows.map((row) => (
        <Text key={row}>{row}</Text>
      ))}
    </Box>
  );
}
