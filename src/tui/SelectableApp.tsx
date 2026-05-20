import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { describeSafeActionIntent } from "./action-intent.js";
import { formatStatusLegend, getStatusSymbol } from "./components/status.js";
import { buildEvidencePreview } from "./evidence-preview.js";
import { getEmptyStateMessage } from "./empty-state.js";
import { getFocusedPaneTitle, moveFocus, type FocusedPane } from "./focus.js";
import { formatKeyBinding, TUI_KEY_BINDINGS } from "./keymap.js";
import { buildLayoutSummary } from "./layout-summary.js";
import { createInfoNotice, formatNotice, type TuiNotice } from "./notice.js";
import { moveSelection } from "./navigation.js";
import { buildRunContextLines } from "./run-context.js";
import { buildRunWarningLines } from "./run-warnings.js";
import type { TuiSpikeFixture } from "./spike-fixture.js";

export function SelectableTuiApp({ fixture }: { fixture: TuiSpikeFixture }) {
  const [focusedPane, setFocusedPane] = useState<FocusedPane>("runs");
  const [helpOpen, setHelpOpen] = useState(false);
  const [notice, setNotice] = useState<TuiNotice | null>(createInfoNotice("TUI is read-only. Actions are previews only."));
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [selectedArtefactIndex, setSelectedArtefactIndex] = useState(0);
  const selectedRun = useMemo(() => {
    const run = fixture.runs[selectedRunIndex];
    return run ? fixture.runDetailsById[run.id] ?? fixture.selectedRun : fixture.selectedRun;
  }, [fixture, selectedRunIndex]);
  const selectedArtefact = selectedRun.artefacts[selectedArtefactIndex];
  const selectedAction = selectedRun.safeActions[selectedActionIndex];
  const evidenceLines = buildEvidencePreview({
    artefact: selectedArtefact,
    findings: selectedRun.reviewerFindings,
    snippets: fixture.evidenceSnippets
  });
  const runContextLines = buildRunContextLines(selectedRun);
  const runWarningLines = buildRunWarningLines(selectedRun.warnings);
  const layoutSummary = buildLayoutSummary({ runs: fixture.runs, selectedRun });

  useInput((input, key) => {
    if (input === "?") {
      setHelpOpen((current) => !current);
      return;
    }
    if (helpOpen) {
      return;
    }
    if (key.return && focusedPane === "actions") {
      setNotice(createInfoNotice(describeSafeActionIntent(selectedAction)));
      return;
    }
    if (input === "\t" || key.tab) {
      setFocusedPane((current) => moveFocus({ current, direction: key.shift ? "previous" : "next" }));
      return;
    }

    if (focusedPane === "runs" && (input === "k" || key.upArrow)) {
      setSelectedRunIndex((currentIndex) => moveSelection({ currentIndex, itemCount: fixture.runs.length, direction: "up" }));
      setSelectedActionIndex(0);
      setSelectedArtefactIndex(0);
      setNotice(createInfoNotice("Selected run changed."));
    }
    if (focusedPane === "runs" && (input === "j" || key.downArrow)) {
      setSelectedRunIndex((currentIndex) => moveSelection({ currentIndex, itemCount: fixture.runs.length, direction: "down" }));
      setSelectedActionIndex(0);
      setSelectedArtefactIndex(0);
      setNotice(createInfoNotice("Selected run changed."));
    }
    if (focusedPane === "actions" && (input === "k" || key.upArrow)) {
      setSelectedActionIndex((currentIndex) => moveSelection({ currentIndex, itemCount: selectedRun.safeActions.length, direction: "up" }));
      setNotice(null);
    }
    if (focusedPane === "actions" && (input === "j" || key.downArrow)) {
      setSelectedActionIndex((currentIndex) => moveSelection({ currentIndex, itemCount: selectedRun.safeActions.length, direction: "down" }));
      setNotice(null);
    }
    if (focusedPane === "artefacts" && (input === "k" || key.upArrow)) {
      setSelectedArtefactIndex((currentIndex) => moveSelection({ currentIndex, itemCount: selectedRun.artefacts.length, direction: "up" }));
      setNotice(null);
    }
    if (focusedPane === "artefacts" && (input === "j" || key.downArrow)) {
      setSelectedArtefactIndex((currentIndex) => moveSelection({ currentIndex, itemCount: selectedRun.artefacts.length, direction: "down" }));
      setNotice(null);
    }
  });

  if (helpOpen) {
    return <HelpOverlay />;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text bold>MergeWright</Text>
          <Text>  Branch: {selectedRun.branch ?? "unknown"}</Text>
          <Text>  Mode: {selectedRun.mode}</Text>
        </Box>
        <Text dimColor>{layoutSummary}</Text>
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" width={30} borderStyle="round" paddingX={1} marginRight={1}>
          <Text bold>{getFocusedPaneTitle("Runs", focusedPane === "runs")}</Text>
          {fixture.runs.length === 0 ? <Text dimColor>{getEmptyStateMessage("runs")}</Text> : fixture.runs.map((run, index) => (
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
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Run context</Text>
            {runContextLines.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Warnings</Text>
            {runWarningLines.map((line) => (
              <Text key={line} dimColor={line === "No warnings recorded."}>{line}</Text>
            ))}
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Phase flow</Text>
            {selectedRun.phases.length === 0 ? <Text dimColor>{getEmptyStateMessage("phases")}</Text> : selectedRun.phases.map((phase) => (
              <Text key={phase.id}>{getStatusSymbol(phase.status)} {phase.label}</Text>
            ))}
          </Box>
        </Box>
        <Box flexDirection="column" width={42} borderStyle="round" paddingX={1}>
          <Text bold>{getFocusedPaneTitle("Safe action", focusedPane === "actions")}</Text>
          <Text>{selectedRun.blockedReason ?? "No blocker recorded."}</Text>
          {selectedRun.safeActions.length === 0 ? <Text dimColor>{getEmptyStateMessage("actions")}</Text> : selectedRun.safeActions.map((action, index) => (
            <Text key={action.id} inverse={focusedPane === "actions" && index === selectedActionIndex}>{index === selectedActionIndex ? ">" : " "} {action.enabled ? "ok" : "blocked"} {action.label}</Text>
          ))}
          {selectedAction ? <Text dimColor>Selected: {selectedAction.label}{selectedAction.blockedReason ? ` - ${selectedAction.blockedReason}` : ""}</Text> : null}
        </Box>
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" width={46} borderStyle="round" paddingX={1} marginRight={1}>
          <Text bold>{getFocusedPaneTitle("Artefacts", focusedPane === "artefacts")}</Text>
          {selectedRun.artefacts.length === 0 ? <Text dimColor>{getEmptyStateMessage("artefacts")}</Text> : selectedRun.artefacts.map((artefact, index) => (
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
            {selectedRun.reviewerFindings.length === 0 ? <Text dimColor>{getEmptyStateMessage("findings")}</Text> : selectedRun.reviewerFindings.map((finding, index) => (
              <Text key={`${finding.severity}-${index}`}>{finding.severity.toUpperCase()}: {finding.message}</Text>
            ))}
          </Box>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text>{formatNotice(notice)}</Text>
      </Box>
      <Box>
        <Text dimColor>Status: {formatStatusLegend()}</Text>
      </Box>
      <Box>
        <Text dimColor>? help - tab focus pane - j/k select item - enter previews selected action - read-only - Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}

function HelpOverlay() {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>MergeWright TUI Help</Text>
      <Text dimColor>Press ? to close help.</Text>
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
