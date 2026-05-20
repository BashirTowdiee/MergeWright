import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { TuiSpikeFixture } from "./spike-fixture.js";
import { getStatusLabel, getStatusSymbol } from "./components/status.js";
import { moveSelection } from "./navigation.js";

export interface TuiAppProps {
  fixture: TuiSpikeFixture;
}

export function TuiApp({ fixture }: TuiAppProps) {
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const selectedRun = useMemo(() => {
    const selected = fixture.runs[selectedRunIndex];
    if (!selected) {
      return fixture.selectedRun;
    }
    return selected.id === fixture.selectedRun.id ? fixture.selectedRun : fixture.selectedRun;
  }, [fixture, selectedRunIndex]);

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setSelectedRunIndex((currentIndex) => moveSelection({ currentIndex, itemCount: fixture.runs.length, direction: "up" }));
    }
    if (key.downArrow || input === "j") {
      setSelectedRunIndex((currentIndex) => moveSelection({ currentIndex, itemCount: fixture.runs.length, direction: "down" }));
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <HeaderBar repo="MergeWright" branch={selectedRun.branch ?? "unknown"} mode={selectedRun.mode} />
      <Box flexDirection="row" marginTop={1}>
        <Box marginRight={1}>
          <Pane title="Runs" width={30}>
            {fixture.runs.map((run, index) => (
              <Box key={run.id} flexDirection="column" marginBottom={1}>
                <Text inverse={index === selectedRunIndex}>{index === selectedRunIndex ? ">" : " "} {getStatusSymbol(run.status)} {run.title}</Text>
                <Text dimColor>   {run.subtitle}</Text>
              </Box>
            ))}
          </Pane>
        </Box>
        <Box marginRight={1}>
          <Pane title="Current run" width={52}>
            <Text bold>{selectedRun.title}</Text>
            <Text>{selectedRun.goal ?? "No goal recorded."}</Text>
            <Text>Status: {getStatusLabel(selectedRun.status)}</Text>
            <Box flexDirection="column" marginTop={1}>
              <Text bold>Phase flow</Text>
              {selectedRun.phases.map((phase) => (
                <Text key={phase.id}>{getStatusSymbol(phase.status)} {phase.label}{phase.blockedReason ? ` - ${phase.blockedReason}` : phase.summary ? ` - ${phase.summary}` : ""}</Text>
              ))}
            </Box>
          </Pane>
        </Box>
        <Pane title="Safe action" width={42}>
          <Text>{selectedRun.blockedReason ?? "No blocker recorded."}</Text>
          <Box flexDirection="column" marginTop={1}>
            {selectedRun.safeActions.map((action) => (
              <Text key={action.id}>{action.enabled ? ">" : "x"} {action.label}{action.blockedReason ? ` - ${action.blockedReason}` : ""}</Text>
            ))}
          </Box>
        </Pane>
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <Box marginRight={1}>
          <Pane title="Artefacts" width={46}>
            {selectedRun.artefacts.map((artefact) => (
              <Text key={artefact.id}>{artefact.kind.padEnd(8)} {artefact.title}</Text>
            ))}
          </Pane>
        </Box>
        <Pane title="Review findings" width={80}>
          {selectedRun.reviewerFindings.map((finding, index) => (
            <Text key={`${finding.severity}-${index}`}>{finding.severity.toUpperCase()}: {finding.message}</Text>
          ))}
        </Pane>
      </Box>
      <FooterBar />
    </Box>
  );
}

interface HeaderBarProps {
  repo: string;
  branch: string;
  mode: string;
}

function HeaderBar({ repo, branch, mode }: HeaderBarProps) {
  return (
    <Box flexDirection="row">
      <Text bold>MergeWright</Text>
      <Text>  Repo: {repo}</Text>
      <Text>  Branch: {branch}</Text>
      <Text>  Mode: {mode}</Text>
    </Box>
  );
}

interface PaneProps {
  title: string;
  width: number;
  children: React.ReactNode;
}

function Pane({ title, width, children }: PaneProps) {
  return (
    <Box flexDirection="column" width={width} borderStyle="round" paddingX={1}>
      <Text bold>{title}</Text>
      {children}
    </Box>
  );
}

function FooterBar() {
  return (
    <Box marginTop={1}>
      <Text dimColor>j/k or arrows select run - read-only Ink preview - actions disabled - Ctrl+C to exit</Text>
    </Box>
  );
}
