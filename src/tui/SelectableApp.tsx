import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { getStatusLabel, getStatusSymbol } from "./components/status.js";
import { moveSelection } from "./navigation.js";
import type { TuiSpikeFixture } from "./spike-fixture.js";

export function SelectableTuiApp({ fixture }: { fixture: TuiSpikeFixture }) {
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const selectedRun = useMemo(() => {
    const run = fixture.runs[selectedRunIndex];
    return run ? fixture.runDetailsById[run.id] ?? fixture.selectedRun : fixture.selectedRun;
  }, [fixture, selectedRunIndex]);

  useInput((input, key) => {
    if (input === "k" || key.upArrow) {
      setSelectedRunIndex((currentIndex) => moveSelection({ currentIndex, itemCount: fixture.runs.length, direction: "up" }));
    }
    if (input === "j" || key.downArrow) {
      setSelectedRunIndex((currentIndex) => moveSelection({ currentIndex, itemCount: fixture.runs.length, direction: "down" }));
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="row">
        <Text bold>MergeWright</Text>
        <Text>  Branch: {selectedRun.branch ?? "unknown"}</Text>
        <Text>  Mode: {selectedRun.mode}</Text>
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" width={30} borderStyle="round" paddingX={1} marginRight={1}>
          <Text bold>Runs</Text>
          {fixture.runs.map((run, index) => (
            <Box key={run.id} flexDirection="column" marginBottom={1}>
              <Text inverse={index === selectedRunIndex}>
                {index === selectedRunIndex ? ">" : " "} {getStatusSymbol(run.status)} {run.title}
              </Text>
              <Text dimColor>   {run.subtitle}</Text>
            </Box>
          ))}
        </Box>
        <Box flexDirection="column" width={52} borderStyle="round" paddingX={1} marginRight={1}>
          <Text bold>Current run</Text>
          <Text bold>{selectedRun.title}</Text>
          <Text>{selectedRun.goal ?? "No goal recorded."}</Text>
          <Text>Status: {getStatusLabel(selectedRun.status)}</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Phase flow</Text>
            {selectedRun.phases.map((phase) => (
              <Text key={phase.id}>{getStatusSymbol(phase.status)} {phase.label}</Text>
            ))}
          </Box>
        </Box>
        <Box flexDirection="column" width={42} borderStyle="round" paddingX={1}>
          <Text bold>Safe action</Text>
          <Text>{selectedRun.blockedReason ?? "No blocker recorded."}</Text>
          {selectedRun.safeActions.map((action) => (
            <Text key={action.id}>{action.enabled ? ">" : "x"} {action.label}</Text>
          ))}
        </Box>
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" width={46} borderStyle="round" paddingX={1} marginRight={1}>
          <Text bold>Artefacts</Text>
          {selectedRun.artefacts.length === 0 ? <Text dimColor>No artefacts recorded.</Text> : selectedRun.artefacts.map((artefact) => (
            <Text key={artefact.id}>{artefact.kind.padEnd(8)} {artefact.title}</Text>
          ))}
        </Box>
        <Box flexDirection="column" width={80} borderStyle="round" paddingX={1}>
          <Text bold>Review findings</Text>
          {selectedRun.reviewerFindings.length === 0 ? <Text dimColor>No reviewer findings recorded.</Text> : selectedRun.reviewerFindings.map((finding, index) => (
            <Text key={`${finding.severity}-${index}`}>{finding.severity.toUpperCase()}: {finding.message}</Text>
          ))}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>j/k or arrows select run - read-only - actions disabled - Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
