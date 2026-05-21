import React from "react";
import { Box, Text } from "ink";
import {
  describeCommandPaletteSelection,
  formatCommandPaletteLine,
  getCommandPaletteItems
} from "../command-palette.js";

export interface CommandPalettePreviewProps {
  query: string;
  items: ReturnType<typeof getCommandPaletteItems>;
  selectedCommandIndex: number;
  selectedCommand: ReturnType<typeof getCommandPaletteItems>[number] | undefined;
}

export function CommandPalettePreview({
  query,
  items,
  selectedCommandIndex,
  selectedCommand
}: CommandPalettePreviewProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Command palette</Text>
      <Text dimColor>Press p or Esc to close. Type to filter. Backspace edits. Use j/k and Enter to inspect.</Text>
      <Text>Query: {query.length === 0 ? "none" : query}</Text>
      <Box flexDirection="column" borderStyle="round" paddingX={1} marginTop={1}>
        {items.length === 0 ? <Text dimColor>No matching commands.</Text> : items.map((item, index) => (
          <Text key={item.id} inverse={index === selectedCommandIndex}>{index === selectedCommandIndex ? ">" : " "} {formatCommandPaletteLine(item)}</Text>
        ))}
      </Box>
      <Box flexDirection="column" borderStyle="round" paddingX={1} marginTop={1}>
        <Text bold>Selected command</Text>
        <Text>{describeCommandPaletteSelection(selectedCommand)}</Text>
      </Box>
    </Box>
  );
}
