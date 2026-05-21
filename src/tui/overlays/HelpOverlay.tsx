import React from "react";
import { Box, Text } from "ink";
import { formatStatusLegend } from "../components/status.js";
import { formatKeyBinding, TUI_KEY_BINDINGS } from "../keymap.js";

export function HelpOverlay() {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>MergeWright TUI Help</Text>
      <Text dimColor>Press ? or Esc to close help.</Text>
      <Box flexDirection="column" borderStyle="round" paddingX={1} marginTop={1}>
        {TUI_KEY_BINDINGS.map((binding) => (
          <Text key={`${binding.scope}-${binding.key}`}>{formatKeyBinding(binding)}</Text>
        ))}
      </Box>
      <Box flexDirection="column" borderStyle="round" paddingX={1} marginTop={1}>
        <Text bold>Status legend</Text>
        <Text>{formatStatusLegend()}</Text>
      </Box>
    </Box>
  );
}
