import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { getStatusLabel, getStatusSymbol } from "./components/status.js";
import { buildEvidencePreview } from "./evidence-preview.js";
import { getFocusedPaneTitle, moveFocus, type FocusedPane } from "./focus.js";
import { moveSelection } from "./navigation.js";
import type { TuiSpikeFixture } from "./spike-fixture.js";

export function SelectableTuiApp({ fixture }: { fixture: TuiSpikeFixture }) {
  const [focusedPane, setFocusedPane] = useState<FocusedPane>("runs");
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const [selectedArtefactIndex, setSelectedArtefactIndex] = useState(0);
  const selectedRun = useMemo(() => {
    const run = fixture.runs[selectedRunIndex];
    return run ? fixture.runDetailsById[run.id] ?? fixture.selectedRun : fixture.selectedRun;
  }, [fixture, selectedRunIndex]);
  const selectedArtefact = selectedRun.artefacts[selectedArtefactIndex];
  const evidenceLines = buildEvidencePreview({ artefact: selectedArtefact, findings: selectedRun.reviewerFindings });

  useInput((input, key) => {
    if (input === "\t" || key.tab) {
      setFocusedPane((current) => moveFocus({ current, direction: key.shift ? "previous" : "next" }));
      return;
    }

    if (focusedPane === "runs" && (input === "k" || key.upArrow)) {
      setSelectedRunIndex((currentIndex) => moveSelection({ currentIndex, itemCount: fixture.runs.length, direction: "up" }));
      setSelectedArtefactIndex(0);
    }
    if (focusedPane === "runs" && (input === "j" || key.downArrow)) {
      setSelectedRunIndex((currentIndex) => moveSelection({ currentIndex, itemCount: fixture.runs.length, direction: "down" }));
      setSelectedArtefactIndex(0);
    }
    if (focusedPane === "artefacts" && (input === "k" || key.upArrow)) {
      setSelectedArtefactIndex((currentIndex) => moveSelection({ currentIndex, itemCount: selectedRun.artefacts.length, direction: "up" }));
    }
    if (focusedPane === "artefacts" && (input === "j" || key.downArrow)) {
      setSelectedArtefactIndex((currentIndex) => moveSelection({ currentIndex, itemCount: selectedRun.artefacts.length, direction: "down" }));
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
          <Text bold>{getFocusedPaneTitle("Runs", focusedPane === "runs")}</Text>
          {fixture.runs.map((run, index) => (
            <Box key={run.id} flexDirection="column" marginBottom={1}>
              <Text inverse={focusedPane === "runs" && index === selectedRunIndex}>
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
          <Text bold>{getFocusedPaneTitle("Artefacts", focusedPane === "artefacts")}</Text>
          {selectedRun.artefacts.length === 0 ? <Text dimColor>No artefacts recorded.</Text> : selectedRun.artefacts.map((artefact, index) => (
            <Text key={artefact.id} inverse={focusedPane === "artefacts" && index === selectedArtefactIndex}>{index === selectedArtefactIndex ? ">" : " "} {artefact.kind.padEnd(8)} {artefact.title}</Text>
          ))}
        </Box>
        <Box flexDirection="column" width={80} borderStyle="round" paddingX={1}>
          <Text bold>Evidence preview</Text>
          {evidenceLines.map((line, index) => (
            <Text key={`${line}-${index}`}>{line}</Text>
          ))}
          <Box marginTop={1}>
            <Text bold>Review findings</Text>
            {selectedRun.reviewerFindings.length === 0 ? <Text dimColor>No reviewer findings recorded.</Text> : selectedRun.reviewerFindings.map((finding, index) => (
              <Text key={`${finding.severity}-${index}`}>{finding.severity.toUpperCase()}: {finding.message}</Text>
            ))}
          </Box>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>tab focus pane - j/k select item - read-only - actions disabled - Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
