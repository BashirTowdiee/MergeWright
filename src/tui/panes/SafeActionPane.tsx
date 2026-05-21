import React from "react";
import { Box, Text } from "ink";
import { getEmptyStateMessage } from "../empty-state.js";
import { getFocusedPaneTitle } from "../focus.js";
import type { SafeActionViewModel } from "../view-models.js";

export interface SafeActionPaneProps {
  actions: SafeActionViewModel[];
  selectedActionIndex: number;
  focused: boolean;
  blockedReason?: string;
}

export function SafeActionPane({ actions, selectedActionIndex, focused, blockedReason }: SafeActionPaneProps) {
  const selectedAction = actions[selectedActionIndex];

  return (
    <Box flexDirection="column" width={42} borderStyle="round" paddingX={1}>
      <Text bold>{getFocusedPaneTitle("Safe action", focused)}</Text>
      <Text>{blockedReason ?? "No blocker recorded."}</Text>
      {actions.length === 0 ? <Text dimColor>{getEmptyStateMessage("actions")}</Text> : actions.map((action, index) => (
        <Text key={action.id} inverse={focused && index === selectedActionIndex}>{index === selectedActionIndex ? ">" : " "} {action.enabled ? "ok" : "blocked"} {action.label}</Text>
      ))}
      {selectedAction ? <Text dimColor>Selected: {selectedAction.label}{selectedAction.blockedReason ? ` - ${selectedAction.blockedReason}` : ""}</Text> : null}
    </Box>
  );
}
