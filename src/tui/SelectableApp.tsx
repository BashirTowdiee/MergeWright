import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { describeSafeActionIntent } from "./action-intent.js";
import { formatStatusLegend, getStatusSymbol } from "./components/status.js";
import {
  appendCommandPaletteQuery,
  backspaceCommandPaletteQuery,
  describeCommandPaletteSelection,
  filterCommandPaletteItems,
  formatCommandPaletteLine,
  getCommandPaletteItems,
  previewCommandPaletteSelection
} from "./command-palette.js";
import {
  closeCommandPaletteState,
  createClosedCommandPaletteState,
  toggleCommandPaletteState,
  updateCommandPaletteQuery,
  updateCommandPaletteSelectedIndex
} from "./command-palette-state.js";
import { buildEvidencePreview } from "./evidence-preview.js";
import { getEmptyStateMessage } from "./empty-state.js";
import { buildFindingDetailLines } from "./finding-detail.js";
import { formatFileScopeLabel, resolveScopedFiles, toggleFileScope, type FileScope } from "./file-scope.js";
import { buildFocusBreadcrumb } from "./focus-breadcrumb.js";
import { getFocusedPaneTitle, moveFocus, type FocusedPane } from "./focus.js";
import { useRuns } from "./hooks/useRuns.js";
import { formatKeyBinding, TUI_KEY_BINDINGS } from "./keymap.js";
import { buildLayoutSummary } from "./layout-summary.js";
import { createInfoNotice, formatNotice, type TuiNotice } from "./notice.js";
import { closeOverlay, isCommandPaletteOverlayOpen, isHelpOverlayOpen, isOverlayOpen, toggleOverlay, type TuiOverlay } from "./overlay-state.js";
import { getNavigationDirection } from "./navigation-keys.js";
import { getNavigationNoticeForFocusedPane, moveSelectionForFocusedPane } from "./navigation-state.js";
import { moveSelection } from "./navigation.js";
import { RunListPane } from "./panes/RunListPane.js";
import { buildPhaseDetailLines } from "./phase-detail.js";
import { buildRunContextLines } from "./run-context.js";
import { buildRunWarningLines } from "./run-warnings.js";
import { createInitialSelectionState, resetFileSelection } from "./selection-state.js";
import type { TuiSpikeFixture } from "./spike-fixture.js";

export function SelectableTuiApp({ fixture }: { fixture: TuiSpikeFixture }) {
  const [focusedPane, setFocusedPane] = useState<FocusedPane>("runs");
  const [fileScope, setFileScope] = useState<FileScope>("phase");
  const [overlay, setOverlay] = useState<TuiOverlay>("none");
  const [commandPaletteState, setCommandPaletteState] = useState(createClosedCommandPaletteState());
  const [notice, setNotice] = useState<TuiNotice | null>(createInfoNotice("TUI is read-only. Actions are previews only."));
  const [selection, setSelection] = useState(createInitialSelectionState());
  const runs = useRuns({ runs: fixture.runs });
  const commandItems = getCommandPaletteItems();
  const filteredCommandItems = filterCommandPaletteItems(commandItems, commandPaletteState.query);
  const selectedCommand = filteredCommandItems[commandPaletteState.selectedIndex];
  const selectedRun = useMemo(() => {
    const run = runs[selection.runIndex];
    return run ? fixture.runDetailsById[run.id] ?? fixture.selectedRun : fixture.selectedRun;
  }, [fixture, runs, selection.runIndex]);
  const selectedPhase = selectedRun.phases[selection.phaseIndex];
  const scopedArtifacts = resolveScopedFiles({ scope: fileScope, files: selectedRun.artefacts, selectedPhase });
  const selectedArtefact = scopedArtifacts[selection.fileIndex];
  const selectedAction = selectedRun.safeActions[selection.actionIndex];
  const selectedFinding = selectedRun.reviewerFindings[selection.findingIndex];
  const selectedSafeActionDescription = describeSafeActionIntent(selectedAction);
  const navigationCounts = {
    runs: runs.length,
    phases: selectedRun.phases.length,
    actions: selectedRun.safeActions.length,
    files: scopedArtifacts.length,
    findings: selectedRun.reviewerFindings.length
  };
  const evidenceLines = buildEvidencePreview({
    artefact: selectedArtefact,
    findings: selectedRun.reviewerFindings,
    snippets: fixture.evidenceSnippets
  });
  const focusBreadcrumb = buildFocusBreadcrumb({ focusedPane, selectedRun, selectedPhase, fileScope });
  const findingDetailLines = buildFindingDetailLines(selectedFinding);
  const runContextLines = buildRunContextLines(selectedRun);
  const runWarningLines = buildRunWarningLines(selectedRun.warnings);
  const phaseDetailLines = buildPhaseDetailLines(selectedPhase);
  const layoutSummary = buildLayoutSummary({ runs, selectedRun });
  const fileScopeLabel = formatFileScopeLabel({ scope: fileScope, selectedPhase });

  function applyNavigation(direction: "up" | "down") {
    setSelection((current) => moveSelectionForFocusedPane({ focusedPane, selection: current, counts: navigationCounts, direction }));
    const message = getNavigationNoticeForFocusedPane(focusedPane);
    setNotice(message ? createInfoNotice(message) : null);
  }

  useInput((input, key) => {
    if (key.escape) {
      if (isOverlayOpen(overlay)) {
        setOverlay(closeOverlay());
        setCommandPaletteState(closeCommandPaletteState());
        return;
      }
    }
    if (input === "?") {
      setOverlay((current) => toggleOverlay(current, "help"));
      return;
    }
    if (input === "p") {
      setOverlay((current) => toggleOverlay(current, "command-palette"));
      setCommandPaletteState((current) => toggleCommandPaletteState(current));
      return;
    }
    if (isHelpOverlayOpen(overlay)) {
      return;
    }
    if (isCommandPaletteOverlayOpen(overlay)) {
      if (key.backspace || key.delete) {
        setCommandPaletteState((current) => updateCommandPaletteQuery(current, backspaceCommandPaletteQuery(current.query)));
        return;
      }
      const paletteDirection = getNavigationDirection(input, key);
      if (paletteDirection) {
        setCommandPaletteState((current) => updateCommandPaletteSelectedIndex(current, moveSelection({ currentIndex: current.selectedIndex, itemCount: filteredCommandItems.length, direction: paletteDirection })));
        return;
      }
      if (key.return) {
        const result = previewCommandPaletteSelection({
          item: selectedCommand,
          context: { selectedSafeActionDescription, currentFileScope: fileScope }
        });
        setNotice(createInfoNotice(result.message));
        return;
      }
      const nextQuery = appendCommandPaletteQuery(commandPaletteState.query, input);
      if (nextQuery !== commandPaletteState.query) {
        setCommandPaletteState((current) => updateCommandPaletteQuery(current, nextQuery));
      }
      return;
    }
    if (input === "s") {
      setFileScope((current) => toggleFileScope(current));
      setSelection((current) => resetFileSelection(current));
      setNotice(createInfoNotice("File scope changed."));
      return;
    }
    if (key.return && focusedPane === "actions") {
      setNotice(createInfoNotice(selectedSafeActionDescription));
      return;
    }
    if (input === "\t" || key.tab) {
      setFocusedPane((current) => moveFocus({ current, direction: key.shift ? "previous" : "next" }));
      return;
    }

    const direction = getNavigationDirection(input, key);
    if (direction) {
      applyNavigation(direction);
    }
  });

  if (isHelpOverlayOpen(overlay)) {
    return <HelpOverlay />;
  }

  if (isCommandPaletteOverlayOpen(overlay)) {
    return <CommandPalettePreview query={commandPaletteState.query} items={filteredCommandItems} selectedCommandIndex={commandPaletteState.selectedIndex} selectedCommand={selectedCommand} />;
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
        <Text dimColor>{focusBreadcrumb}</Text>
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <RunListPane runs={runs} selectedRunIndex={selection.runIndex} focused={focusedPane === "runs"} title={getFocusedPaneTitle("Runs", focusedPane === "runs")} />
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
            <Text bold>{getFocusedPaneTitle("Phase flow", focusedPane === "phases")}</Text>
            {selectedRun.phases.length === 0 ? <Text dimColor>{getEmptyStateMessage("phases")}</Text> : selectedRun.phases.map((phase, index) => (
              <Text key={phase.id} inverse={focusedPane === "phases" && index === selection.phaseIndex}>{index === selection.phaseIndex ? ">" : " "} {getStatusSymbol(phase.status)} {phase.label}</Text>
            ))}
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Phase detail</Text>
            {phaseDetailLines.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </Box>
        </Box>
        <Box flexDirection="column" width={42} borderStyle="round" paddingX={1}>
          <Text bold>{getFocusedPaneTitle("Safe action", focusedPane === "actions")}</Text>
          <Text>{selectedRun.blockedReason ?? "No blocker recorded."}</Text>
          {selectedRun.safeActions.length === 0 ? <Text dimColor>{getEmptyStateMessage("actions")}</Text> : selectedRun.safeActions.map((action, index) => (
            <Text key={action.id} inverse={focusedPane === "actions" && index === selection.actionIndex}>{index === selection.actionIndex ? ">" : " "} {action.enabled ? "ok" : "blocked"} {action.label}</Text>
          ))}
          {selectedAction ? <Text dimColor>Selected: {selectedAction.label}{selectedAction.blockedReason ? ` - ${selectedAction.blockedReason}` : ""}</Text> : null}
        </Box>
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" width={46} borderStyle="round" paddingX={1} marginRight={1}>
          <Text bold>{getFocusedPaneTitle(fileScopeLabel, focusedPane === "artefacts")}</Text>
          {scopedArtifacts.length === 0 ? <Text dimColor>{getEmptyStateMessage("artefacts")}</Text> : scopedArtifacts.map((artefact, index) => (
            <Text key={artefact.id} inverse={focusedPane === "artefacts" && index === selection.fileIndex}>{index === selection.fileIndex ? ">" : " "} {artefact.kind.padEnd(8)} {artefact.title}</Text>
          ))}
        </Box>
        <Box flexDirection="column" width={80} borderStyle="round" paddingX={1}>
          <Text bold>Evidence preview</Text>
          {evidenceLines.map((line, index) => (
            <Text key={`${line}-${index}`}>{line}</Text>
          ))}
          <Box marginTop={1}>
            <Text bold>{getFocusedPaneTitle("Review findings", focusedPane === "findings")}</Text>
            {selectedRun.reviewerFindings.length === 0 ? <Text dimColor>{getEmptyStateMessage("findings")}</Text> : selectedRun.reviewerFindings.map((finding, index) => (
              <Text key={`${finding.severity}-${index}`} inverse={focusedPane === "findings" && index === selection.findingIndex}>{index === selection.findingIndex ? ">" : " "} {finding.severity.toUpperCase()}: {finding.message}</Text>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text bold>Finding detail</Text>
            {findingDetailLines.map((line) => (
              <Text key={line}>{line}</Text>
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
        <Text dimColor>? help - p command palette - esc close overlay - s toggle file scope - tab focus pane - j/k select item - enter previews selected action - read-only - Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}

function HelpOverlay() {
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

function CommandPalettePreview({
  query,
  items,
  selectedCommandIndex,
  selectedCommand
}: {
  query: string;
  items: ReturnType<typeof getCommandPaletteItems>;
  selectedCommandIndex: number;
  selectedCommand: ReturnType<typeof getCommandPaletteItems>[number] | undefined;
}) {
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
