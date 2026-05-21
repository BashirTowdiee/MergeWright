import React from "react";
import { Box, Text } from "ink";
import { getStatusSymbol } from "../components/status.js";
import { getEmptyStateMessage } from "../empty-state.js";
import { getFocusedPaneTitle } from "../focus.js";
import type { FocusedPane } from "../focus.js";
import type { PhaseNodeViewModel, RunDetailViewModel } from "../view-models.js";

export interface CurrentRunPaneProps {
  run: RunDetailViewModel;
  selectedPhaseIndex: number;
  focusedPane: FocusedPane;
  runContextLines: string[];
  runWarningLines: string[];
  phaseDetailLines: string[];
}

export function CurrentRunPane({
  run,
  selectedPhaseIndex,
  focusedPane,
  runContextLines,
  runWarningLines,
  phaseDetailLines
}: CurrentRunPaneProps) {
  return (
    <Box flexDirection="column" width={52} borderStyle="round" paddingX={1} marginRight={1}>
      <Text bold>Current run</Text>
      <Text bold>{run.title}</Text>
      <Text>{run.goal ?? "No goal recorded."}</Text>
      <RunTextSection title="Run context" lines={runContextLines} />
      <RunTextSection title="Warnings" lines={runWarningLines} dimEmptyLine="No warnings recorded." />
      <PhaseFlowList phases={run.phases} selectedPhaseIndex={selectedPhaseIndex} focused={focusedPane === "phases"} />
      <RunTextSection title="Phase detail" lines={phaseDetailLines} />
    </Box>
  );
}

function RunTextSection({ title, lines, dimEmptyLine }: { title: string; lines: string[]; dimEmptyLine?: string }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{title}</Text>
      {lines.map((line) => (
        <Text key={line} dimColor={line === dimEmptyLine}>{line}</Text>
      ))}
    </Box>
  );
}

function PhaseFlowList({ phases, selectedPhaseIndex, focused }: { phases: PhaseNodeViewModel[]; selectedPhaseIndex: number; focused: boolean }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{getFocusedPaneTitle("Phase flow", focused)}</Text>
      {phases.length === 0 ? <Text dimColor>{getEmptyStateMessage("phases")}</Text> : phases.map((phase, index) => (
        <Text key={phase.id} inverse={focused && index === selectedPhaseIndex}>{index === selectedPhaseIndex ? ">" : " "} {getStatusSymbol(phase.status)} {phase.label}</Text>
      ))}
    </Box>
  );
}
