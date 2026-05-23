import React, { useMemo, useState } from "react";
import { Box, useInput } from "ink";
import { DefaultAppCommandService } from "../application/commands/default-app-command-service.js";
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
import { TuiCommandController } from "./command-controller.js";
import { createIdleCommandPreviewState } from "./command-preview-state.js";
import { previewCoordinationNoteCommand, submitCoordinationNoteCommand } from "./coordination-note-command-flow.js";
import { buildTuiDashboardReadModel } from "./dashboard-read-model.js";
import { toggleFileScope, type FileScope } from "./file-scope.js";
import { getFocusedPaneTitle, moveFocus, type FocusedPane } from "./focus.js";
import { useRuns } from "./hooks/useRuns.js";
import { createInfoNotice, formatNotice, type TuiNotice } from "./notice.js";
import { closeOverlay, isCommandPaletteOverlayOpen, isHelpOverlayOpen, isOverlayOpen, toggleOverlay, type TuiOverlay } from "./overlay-state.js";
import { getNavigationDirection } from "./navigation-keys.js";
import { getNavigationNoticeForFocusedPane, moveSelectionForFocusedPane } from "./navigation-state.js";
import { moveSelection } from "./navigation.js";
import { CommandPalettePreview } from "./overlays/CommandPalettePreview.js";
import { HelpOverlay } from "./overlays/HelpOverlay.js";
import { ArtefactListPane } from "./panes/ArtefactListPane.js";
import { CommandPreviewPane } from "./panes/CommandPreviewPane.js";
import { CurrentRunPane } from "./panes/CurrentRunPane.js";
import { EvidenceReviewPane } from "./panes/EvidenceReviewPane.js";
import { RunListPane } from "./panes/RunListPane.js";
import { SafeActionPane } from "./panes/SafeActionPane.js";
import { isSelectTaskPreviewForTask } from "./select-task-preview-match.js";
import { previewSelectTaskCommand, submitSelectTaskCommand } from "./select-task-command-flow.js";
import { buildTuiSelectionContext } from "./selection-context-read-model.js";
import { createInitialSelectionState, resetFileSelection } from "./selection-state.js";
import type { TuiSpikeFixture } from "./spike-fixture.js";

const HELP_LINE = "? help - p command palette - esc close overlay - s toggle file scope - tab focus pane - j/k select item - enter previews/submits selected task - read-only - Ctrl+C to exit";
const DEFAULT_COORDINATION_NOTE = "TUI coordination note update requested.";

export function SelectableTuiApp({ fixture }: { fixture: TuiSpikeFixture }) {
  const [focusedPane, setFocusedPane] = useState<FocusedPane>("runs");
  const [fileScope, setFileScope] = useState<FileScope>("phase");
  const [overlay, setOverlay] = useState<TuiOverlay>("none");
  const [commandPreviewState, setCommandPreviewState] = useState(createIdleCommandPreviewState());
  const [commandPaletteState, setCommandPaletteState] = useState(createClosedCommandPaletteState());
  const [notice, setNotice] = useState<TuiNotice | null>(createInfoNotice("TUI is service-wired for safe task selection."));
  const [selection, setSelection] = useState(createInitialSelectionState());
  const commandController = useMemo(() => new TuiCommandController({ commandService: new DefaultAppCommandService() }), []);
  const runs = useRuns({ runs: fixture.runs });
  const commandItems = getCommandPaletteItems();
  const filteredCommandItems = filterCommandPaletteItems(commandItems, commandPaletteState.query);
  const selectedCommand = filteredCommandItems[commandPaletteState.selectedIndex];
  const selectionContext = useMemo(
    () =>
      buildTuiSelectionContext({
        runs,
        runDetailsById: fixture.runDetailsById,
        fallbackRun: fixture.selectedRun,
        selection,
        fileScope
      }),
    [fileScope, fixture.runDetailsById, fixture.selectedRun, runs, selection]
  );
  const {
    selectedRun,
    selectedPhase,
    scopedArtefacts: scopedArtifacts,
    selectedAction,
    navigationCounts
  } = selectionContext;
  const dashboard = buildTuiDashboardReadModel({
    runs,
    selectionContext,
    evidenceSnippets: fixture.evidenceSnippets,
    focusedPane,
    fileScope
  });
  const selectedSafeActionDescription = describeSafeActionIntent(selectedAction);

  function applyNavigation(direction: "up" | "down") {
    setSelection((current) => moveSelectionForFocusedPane({ focusedPane, selection: current, counts: navigationCounts, direction }));
    const message = getNavigationNoticeForFocusedPane(focusedPane);
    setNotice(message ? createInfoNotice(message) : null);
  }

  async function previewOrSubmitSelectedTask() {
    if (!selectedAction) {
      setCommandPreviewState(createIdleCommandPreviewState());
      setNotice(createInfoNotice(selectedSafeActionDescription));
      return;
    }

    if (isSelectTaskPreviewForTask(commandPreviewState, selectedAction.id)) {
      const result = await submitSelectTaskCommand({ controller: commandController, previewState: commandPreviewState });
      setNotice(createInfoNotice(result.notice));
      return;
    }

    const result = await previewSelectTaskCommand({
      controller: commandController,
      taskId: selectedAction.id,
      label: selectedAction.label,
      requestedAt: new Date(0).toISOString()
    });
    setCommandPreviewState(result.previewState);
    setNotice(createInfoNotice(result.notice));
  }

  async function previewOrSubmitCoordinationNote() {
    if (commandPreviewState.status === "previewing" && commandPreviewState.intent.type === "update-coordination-note") {
      const result = await submitCoordinationNoteCommand({ controller: commandController, previewState: commandPreviewState });
      setNotice(createInfoNotice(result.notice));
      return;
    }

    const result = await previewCoordinationNoteCommand({
      controller: commandController,
      note: DEFAULT_COORDINATION_NOTE,
      requestedAt: new Date(0).toISOString()
    });
    setCommandPreviewState(result.previewState);
    setNotice(createInfoNotice(result.notice));
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
        if (selectedCommand?.id === "update-coordination-note") {
          void previewOrSubmitCoordinationNote();
          return;
        }
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
      void previewOrSubmitSelectedTask();
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
      layoutSummary={dashboard.layoutSummary}
      focusBreadcrumb={dashboard.focusBreadcrumb}
      notice={formatNotice(notice)}
      helpLine={HELP_LINE}
    >
      <Box flexDirection="row" marginTop={1}>
        <RunListPane runs={runs} selectedRunIndex={selection.runIndex} focused={focusedPane === "runs"} title={getFocusedPaneTitle("Runs", focusedPane === "runs")} />
        <CurrentRunPane
          run={selectedRun}
          selectedPhaseIndex={selection.phaseIndex}
          focusedPane={focusedPane}
          runContextLines={dashboard.runContextLines}
          runWarningLines={dashboard.runWarningLines}
          phaseDetailLines={dashboard.phaseDetailLines}
        />
        <SafeActionPane actions={selectedRun.safeActions} selectedActionIndex={selection.actionIndex} focused={focusedPane === "actions"} blockedReason={selectedRun.blockedReason} />
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <ArtefactListPane artefacts={scopedArtifacts} selectedArtefactIndex={selection.fileIndex} focused={focusedPane === "artefacts"} title={dashboard.fileScopeLabel} />
        <EvidenceReviewPane
          evidenceLines={dashboard.evidenceLines}
          findings={selectedRun.reviewerFindings}
          selectedFindingIndex={selection.findingIndex}
          findingsFocused={focusedPane === "findings"}
          findingDetailLines={dashboard.findingDetailLines}
        />
      </Box>
      <CommandPreviewPane state={commandPreviewState} />
    </AppChrome>
  );
}
