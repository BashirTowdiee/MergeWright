import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { describeSafeActionIntent } from "./action-intent.js";
import { AppChrome } from "./components/AppChrome.js";
import {
  appendCommandPaletteQuery,
  backspaceCommandPaletteQuery,
  filterCommandPaletteItems,
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
import { createIdleCommandPreviewState, formatCommandPreviewNotice, type TuiCommandPreviewState } from "./command-preview-state.js";
import { buildCommandViewDetails } from "./command-view-details.js";
import { buildEvidencePreview } from "./evidence-preview.js";
import { buildFindingDetailLines } from "./finding-detail.js";
import { formatFileScopeLabel, resolveScopedFiles, toggleFileScope, type FileScope } from "./file-scope.js";
import { buildFocusBreadcrumb } from "./focus-breadcrumb.js";
import { getFocusedPaneTitle, moveFocus, type FocusedPane } from "./focus.js";
import { useRuns } from "./hooks/useRuns.js";
import { buildLayoutSummary } from "./layout-summary.js";
import { createInfoNotice, formatNotice, type TuiNotice } from "./notice.js";
import { closeOverlay, isCommandPaletteOverlayOpen, isHelpOverlayOpen, isOverlayOpen, toggleOverlay, type TuiOverlay } from "./overlay-state.js";
import { getNavigationDirection } from "./navigation-keys.js";
import { getNavigationNoticeForFocusedPane, moveSelectionForFocusedPane } from "./navigation-state.js";
import { moveSelection } from "./navigation.js";
import { CommandPalettePreview } from "./overlays/CommandPalettePreview.js";
import { HelpOverlay } from "./overlays/HelpOverlay.js";
import { ArtefactListPane } from "./panes/ArtefactListPane.js";
import { CurrentRunPane } from "./panes/CurrentRunPane.js";
import { EvidenceReviewPane } from "./panes/EvidenceReviewPane.js";
import { RunListPane } from "./panes/RunListPane.js";
import { SafeActionPane } from "./panes/SafeActionPane.js";
import { buildPhaseDetailLines } from "./phase-detail.js";
import { buildRunContextLines } from "./run-context.js";
import { buildRunWarningLines } from "./run-warnings.js";
import { buildSafeActionPreview } from "./safe-action-preview.js";
import { createInitialSelectionState, resetFileSelection } from "./selection-state.js";
import type { TuiSpikeFixture } from "./spike-fixture.js";

const HELP_LINE = "? help - p command palette - esc close overlay - s toggle file scope - tab focus pane - j/k select item - enter previews selected action - read-only - Ctrl+C to exit";

function renderCommandPreviewSection(state: TuiCommandPreviewState) {
  const details = buildCommandViewDetails(state);

  if (!details) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
      <Text bold>Command</Text>
      <Text>{details.title}</Text>
      <Text>{details.summary}</Text>
      <Text>Risk: {details.risk}</Text>
      <Text>Confirmation: {details.confirmation}</Text>
      <Text>State: {details.state}</Text>
    </Box>
  );
}

export function SelectableTuiApp({ fixture }: { fixture: TuiSpikeFixture }) {
  const [focusedPane, setFocusedPane] = useState<FocusedPane>("runs");
  const [fileScope, setFileScope] = useState<FileScope>("phase");
  const [overlay, setOverlay] = useState<TuiOverlay>("none");
  const [commandPreviewState, setCommandPreviewState] = useState(createIdleCommandPreviewState());
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
      const nextPreviewState = buildSafeActionPreview({
        action: selectedAction,
        runId: selectedRun.id,
        selectedPhaseId: selectedPhase.id,
        requestedAt: new Date(0).toISOString()
      });
      if (nextPreviewState) {
        setCommandPreviewState(nextPreviewState);
        setNotice(createInfoNotice(formatCommandPreviewNotice(nextPreviewState)));
        return;
      }
      setCommandPreviewState(createIdleCommandPreviewState());
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
    <AppChrome
      branch={selectedRun.branch}
      mode={selectedRun.mode}
      layoutSummary={layoutSummary}
      focusBreadcrumb={focusBreadcrumb}
      notice={formatNotice(notice)}
      helpLine={HELP_LINE}
    >
      <Box flexDirection="row" marginTop={1}>
        <RunListPane runs={runs} selectedRunIndex={selection.runIndex} focused={focusedPane === "runs"} title={getFocusedPaneTitle("Runs", focusedPane === "runs")} />
        <CurrentRunPane
          run={selectedRun}
          selectedPhaseIndex={selection.phaseIndex}
          focusedPane={focusedPane}
          runContextLines={runContextLines}
          runWarningLines={runWarningLines}
          phaseDetailLines={phaseDetailLines}
        />
        <SafeActionPane actions={selectedRun.safeActions} selectedActionIndex={selection.actionIndex} focused={focusedPane === "actions"} blockedReason={selectedRun.blockedReason} />
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <ArtefactListPane artefacts={scopedArtifacts} selectedArtefactIndex={selection.fileIndex} focused={focusedPane === "artefacts"} title={fileScopeLabel} />
        <EvidenceReviewPane
          evidenceLines={evidenceLines}
          findings={selectedRun.reviewerFindings}
          selectedFindingIndex={selection.findingIndex}
          findingsFocused={focusedPane === "findings"}
          findingDetailLines={findingDetailLines}
        />
      </Box>
      {renderCommandPreviewSection(commandPreviewState)}
    </AppChrome>
  );
}
