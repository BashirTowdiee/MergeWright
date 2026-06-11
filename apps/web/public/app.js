const API_BASE_URL = (window.__MERGEWRIGHT_API_BASE_URL__ ?? "http://127.0.0.1:3040").replace(/\/$/, "");
const routeContext = window.__MERGEWRIGHT_WEB_ROUTE__ ?? { page: "projects" };
const WORKSPACE_PICKER_ENABLED = window.__MERGEWRIGHT_WORKSPACE_PICKER_ENABLED__ !== false;

function toApiUrl(url) {
  if (typeof url !== "string") {
    return url;
  }
  if (url.startsWith("/api/")) {
    if (API_BASE_URL === "/api" || API_BASE_URL.endsWith("/api")) {
      return url;
    }
    const baseHasApiPrefix = API_BASE_URL.endsWith("/api");
    const routePath = baseHasApiPrefix ? url : url.replace(/^\/api/, "");
    return `${API_BASE_URL}${routePath}`;
  }
  return url;
}

function withProjectQuery(url) {
  const projectId = state.selectedProjectId;
  if (!projectId || typeof url !== "string" || !url.startsWith("/api/")) {
    return url;
  }
  if (url.startsWith("/api/health") || url.startsWith("/api/projects")) {
    return url;
  }
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}projectId=${encodeURIComponent(projectId)}`;
}

const state = {
  projects: [],
  selectedProjectId: undefined,
  selectedProject: undefined,
  selectedProjectHealth: undefined,
  providerInventory: undefined,
  settingsSnapshot: undefined,
  settingsDraftStatus: "not saved",
  policySnapshot: undefined,
  writeSafetyStatus: undefined,
  runs: [],
  filteredRuns: [],
  stagePlans: [],
  selectedStagePlanId: undefined,
  selectedStagePlan: undefined,
  selectedRunId: undefined,
  selectedRun: undefined,
  selectedRunReadiness: undefined,
  selectedRunReview: undefined,
  selectedRunEvidence: undefined,
  selectedRunAuditEvents: [],
  selectedRunPhaseArtifacts: undefined,
  selectedPhaseId: undefined,
  selectedRunComparison: undefined,
  selectedRunArtifacts: [],
  reviews: [],
  selectedReviewId: undefined,
  selectedReviewPrSummary: undefined,
  selectedReviewAuditEvents: [],
  selectedArtifactContent: undefined,
  apiHealthy: false,
  pendingApprovals: [],
  commandEvents: [],
  commandLifecycleEvents: [],
  lastCommandResult: undefined
};

const nodes = {
  links: Array.from(document.querySelectorAll("[data-page-link]")),
  pages: Array.from(document.querySelectorAll(".page")),
  pageTitle: document.getElementById("pageTitle"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  apiHealthStatus: document.getElementById("apiHealthStatus"),
  metricProjectsTotal: document.getElementById("metricProjectsTotal"),
  metricProjectsHealthy: document.getElementById("metricProjectsHealthy"),
  metricProjectsHealthyNote: document.getElementById("metricProjectsHealthyNote"),
  projectDefaultProvider: document.getElementById("projectDefaultProvider"),
  projectRunsRoot: document.getElementById("projectRunsRoot"),
  projectName: document.getElementById("projectName"),
  projectIdLine: document.getElementById("projectIdLine"),
  projectConfigPath: document.getElementById("projectConfigPath"),
  projectWorkspaceRoot: document.getElementById("projectWorkspaceRoot"),
  projectHealthChecks: document.getElementById("projectHealthChecks"),
  projectHealthWarnings: document.getElementById("projectHealthWarnings"),
  projectCrudStatus: document.getElementById("projectCrudStatus"),
  projectSelector: document.getElementById("projectSelector"),
  projectReloadButton: document.getElementById("projectReloadButton"),
  projectDeleteButton: document.getElementById("projectDeleteButton"),
  projectNameInput: document.getElementById("projectNameInput"),
  projectConfigPathInput: document.getElementById("projectConfigPathInput"),
  projectWorkspacePathInput: document.getElementById("projectWorkspacePathInput"),
  projectWorkspaceBrowseButton: document.getElementById("projectWorkspaceBrowseButton"),
  projectCreateButton: document.getElementById("projectCreateButton"),
  projectInitButton: document.getElementById("projectInitButton"),
  projectUpdateButton: document.getElementById("projectUpdateButton"),
  settingsConfigPath: document.getElementById("settingsConfigPath"),
  settingsRunsRoot: document.getElementById("settingsRunsRoot"),
  settingsDefaultProvider: document.getElementById("settingsDefaultProvider"),
  settingsDefaultModel: document.getElementById("settingsDefaultModel"),
  settingsDefaultMode: document.getElementById("settingsDefaultMode"),
  settingsEvidenceRetention: document.getElementById("settingsEvidenceRetention"),
  settingsArtifactRetention: document.getElementById("settingsArtifactRetention"),
  settingsTheme: document.getElementById("settingsTheme"),
  settingsKeyboardShortcuts: document.getElementById("settingsKeyboardShortcuts"),
  settingsSaveStatus: document.getElementById("settingsSaveStatus"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  saveProjectConfigButton: document.getElementById("saveProjectConfigButton"),
  settingsWriteSafetyPill: document.getElementById("settingsWriteSafetyPill"),
  settingsRequireGitRepo: document.getElementById("settingsRequireGitRepo"),
  settingsRequireCleanStart: document.getElementById("settingsRequireCleanStart"),
  settingsManualCommitOnly: document.getElementById("settingsManualCommitOnly"),
  settingsWriteSafetySummary: document.getElementById("settingsWriteSafetySummary"),
  settingsBlockedPaths: document.getElementById("settingsBlockedPaths"),
  settingsProvidersPill: document.getElementById("settingsProvidersPill"),
  settingsProvidersBody: document.getElementById("settingsProvidersBody"),
  teamPendingCount: document.getElementById("teamPendingCount"),
  refreshRunsButton: document.getElementById("refreshRunsButton"),
  navRunsCount: document.getElementById("navRunsCount"),
  navStagePlansCount: document.getElementById("navStagePlansCount"),
  runsFilterInput: document.getElementById("runsFilterInput"),
  metricTotalRuns: document.getElementById("metricTotalRuns"),
  metricReadyRuns: document.getElementById("metricReadyRuns"),
  metricBlockedRuns: document.getElementById("metricBlockedRuns"),
  metricRunningRuns: document.getElementById("metricRunningRuns"),
  runsTableBody: document.getElementById("runsTableBody"),
  metricStagePlansTotal: document.getElementById("metricStagePlansTotal"),
  metricStagePlansRunning: document.getElementById("metricStagePlansRunning"),
  metricStagePlansReady: document.getElementById("metricStagePlansReady"),
  metricStagePlansCompleted: document.getElementById("metricStagePlansCompleted"),
  stagePlansTableBody: document.getElementById("stagePlansTableBody"),
  selectedStagePlanTitle: document.getElementById("selectedStagePlanTitle"),
  selectedStagePlanStatus: document.getElementById("selectedStagePlanStatus"),
  selectedStagePlanSummary: document.getElementById("selectedStagePlanSummary"),
  selectedStagePlanStages: document.getElementById("selectedStagePlanStages"),
  selectedStageCountPill: document.getElementById("selectedStageCountPill"),
  detailReadinessStatus: document.getElementById("detailReadinessStatus"),
  detailReadinessNote: document.getElementById("detailReadinessNote"),
  detailScoreValue: document.getElementById("detailScoreValue"),
  detailRiskValue: document.getElementById("detailRiskValue"),
  detailReviewerVerdict: document.getElementById("detailReviewerVerdict"),
  detailFindingsCount: document.getElementById("detailFindingsCount"),
  detailChecksState: document.getElementById("detailChecksState"),
  detailWarningsCount: document.getElementById("detailWarningsCount"),
  timelineStatusPill: document.getElementById("timelineStatusPill"),
  phaseTimeline: document.getElementById("phaseTimeline"),
  actionsStatusPill: document.getElementById("actionsStatusPill"),
  safeActionsList: document.getElementById("safeActionsList"),
  detailWorkspace: document.getElementById("detailWorkspace"),
  detailRunDir: document.getElementById("detailRunDir"),
  detailProvider: document.getElementById("detailProvider"),
  detailModel: document.getElementById("detailModel"),
  detailAuditEventsPill: document.getElementById("detailAuditEventsPill"),
  detailAuditEventsOutput: document.getElementById("detailAuditEventsOutput"),
  runArtifactScope: document.getElementById("runArtifactScope"),
  clearPhaseFilterButton: document.getElementById("clearPhaseFilterButton"),
  runArtifactsCount: document.getElementById("runArtifactsCount"),
  runArtifactsBody: document.getElementById("runArtifactsBody"),
  artifactPreviewTitle: document.getElementById("artifactPreviewTitle"),
  artifactPreviewMeta: document.getElementById("artifactPreviewMeta"),
  artifactPreviewOutput: document.getElementById("artifactPreviewOutput"),
  resultsStatusPill: document.getElementById("resultsStatusPill"),
  resultsScoreValue: document.getElementById("resultsScoreValue"),
  resultsReviewer: document.getElementById("resultsReviewer"),
  resultsChecks: document.getElementById("resultsChecks"),
  resultsRisk: document.getElementById("resultsRisk"),
  proofOutput: document.getElementById("proofOutput"),
  evidenceMapBody: document.getElementById("evidenceMapBody"),
  reviewVerdictPill: document.getElementById("reviewVerdictPill"),
  reviewFindingsList: document.getElementById("reviewFindingsList"),
  compareRunAInput: document.getElementById("compareRunAInput"),
  compareRunBInput: document.getElementById("compareRunBInput"),
  compareRunsButton: document.getElementById("compareRunsButton"),
  compareStatusPill: document.getElementById("compareStatusPill"),
  compareSummaryOutput: document.getElementById("compareSummaryOutput"),
  compareFilesOutput: document.getElementById("compareFilesOutput"),
  compareChecksOutput: document.getElementById("compareChecksOutput"),
  commandSelect: document.getElementById("commandSelect"),
  commandRunIdInput: document.getElementById("commandRunIdInput"),
  commandStageNameInput: document.getElementById("commandStageNameInput"),
  commandStageIdInput: document.getElementById("commandStageIdInput"),
  commandStagePlanInput: document.getElementById("commandStagePlanInput"),
  commandCompareRunIdInput: document.getElementById("commandCompareRunIdInput"),
  commandModesInput: document.getElementById("commandModesInput"),
  commandConfigInput: document.getElementById("commandConfigInput"),
  commandStopAfterEachStage: document.getElementById("commandStopAfterEachStage"),
  commandAutoCommit: document.getElementById("commandAutoCommit"),
  commandCommitMessageInput: document.getElementById("commandCommitMessageInput"),
  commandReassessDownstream: document.getElementById("commandReassessDownstream"),
  commandExecutionMode: document.getElementById("commandExecutionMode"),
  commandConfirmWrites: document.getElementById("commandConfirmWrites"),
  commandInstructionInput: document.getElementById("commandInstructionInput"),
  commandRiskPill: document.getElementById("commandRiskPill"),
  executeCommandButton: document.getElementById("executeCommandButton"),
  commandPreview: document.getElementById("commandPreview"),
  typedResultOutput: document.getElementById("typedResultOutput"),
  cliSummaryOutput: document.getElementById("cliSummaryOutput"),
  eventsOutput: document.getElementById("eventsOutput"),
  approvalQueuePill: document.getElementById("approvalQueuePill"),
  approvalQueueList: document.getElementById("approvalQueueList"),
  selectedReviewStatusPill: document.getElementById("selectedReviewStatusPill"),
  selectedReviewSelect: document.getElementById("selectedReviewSelect"),
  reviewCommentsList: document.getElementById("reviewCommentsList"),
  reviewCommentInput: document.getElementById("reviewCommentInput"),
  addReviewCommentButton: document.getElementById("addReviewCommentButton"),
  reviewDecisionNoteInput: document.getElementById("reviewDecisionNoteInput"),
  approveReviewButton: document.getElementById("approveReviewButton"),
  requestChangesButton: document.getElementById("requestChangesButton"),
  reviewPrSummaryPill: document.getElementById("reviewPrSummaryPill"),
  reviewPrSummaryOutput: document.getElementById("reviewPrSummaryOutput"),
  reviewAuditPill: document.getElementById("reviewAuditPill"),
  reviewAuditOutput: document.getElementById("reviewAuditOutput"),
  tabs: Array.from(document.querySelectorAll("[data-tab]")),
  tabPanels: Array.from(document.querySelectorAll(".tab-panel"))
};

function showPage(id) {
  for (const page of nodes.pages) {
    page.classList.toggle("active", page.id === id);
  }
  for (const link of nodes.links) {
    link.classList.toggle("active", link.dataset.pageLink === id);
  }
  const page = document.getElementById(id);
  if (page) {
    nodes.pageTitle.textContent = page.dataset.title || "MergeWright";
    nodes.breadcrumbs.textContent = page.dataset.crumb || "MergeWright";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function routeForPage(id) {
  if (id === "projects") return "/projects";
  if (id === "runs") return "/runs";
  if (id === "commands") return "/commands";
  if (id === "settings") return "/settings";
  if (id === "run-detail" && state.selectedRunId) return `/runs/${encodeURIComponent(state.selectedRunId)}`;
  if (id === "results" && state.selectedRunId) return `/results/${encodeURIComponent(state.selectedRunId)}`;
  if (id === "review" && state.selectedRunId) return `/review/${encodeURIComponent(state.selectedRunId)}`;
  return undefined;
}

function navigateToPage(id) {
  const route = routeForPage(id);
  if (!route) {
    showPage(id);
    return;
  }
  window.location.assign(route);
}

function toPillClass(status) {
  const value = String(status || "unknown").toLowerCase();
  if (value === "ready" || value === "passed" || value === "pass") return "green";
  if (value === "failed" || value === "fail") return "red";
  if (value === "running") return "blue";
  return "amber";
}

function formatMode(mode) {
  return String(mode || "unknown")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function riskForCommand(command) {
  if (
    command === "run" ||
    command === "continue-run" ||
    command === "run-stage" ||
    command === "run-stages" ||
    command === "continue-stages" ||
    command === "accept-stage" ||
    command === "fix-stage"
  ) {
    return "medium";
  }
  return "low";
}

function isWriteEnabledMode() {
  return nodes.commandExecutionMode.value === "write-enabled";
}

function appendCommandEvent(line) {
  state.commandEvents.push(line);
  if (state.commandEvents.length > 200) {
    state.commandEvents.splice(0, state.commandEvents.length - 200);
  }
  nodes.eventsOutput.textContent = state.commandEvents.slice(-80).join("\n");
}

function appendLifecycleEvent(event) {
  state.commandLifecycleEvents.push(event);
  if (state.commandLifecycleEvents.length > 500) {
    state.commandLifecycleEvents.splice(0, state.commandLifecycleEvents.length - 500);
  }

  const status = event?.status ?? "event";
  const command = event?.command ?? "unknown";
  const requestId = event?.requestId ? ` [${event.requestId}]` : "";
  const suffix = event?.exitCode !== undefined ? ` exit=${event.exitCode}` : "";
  const error = event?.error ? ` error=${event.error}` : "";
  appendCommandEvent(`${event?.timestamp ?? new Date().toISOString()} ${status}${requestId}: ${command}${suffix}${error}`);
}

async function fetchJson(url, init) {
  const requestUrl = toApiUrl(withProjectQuery(url));
  const response = await fetch(requestUrl, init);
  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.message === "string"
        ? payload.message
        : `API ${response.status}: ${requestUrl}`;
    throw new Error(message);
  }
  return payload;
}

async function refreshApiHealth() {
  try {
    const payload = await fetchJson("/api/health");
    state.apiHealthy = payload.ok === true;
  } catch {
    state.apiHealthy = false;
  }

  nodes.apiHealthStatus.textContent = state.apiHealthy ? "healthy" : "unreachable";
  nodes.apiHealthStatus.style.color = state.apiHealthy ? "#86efac" : "#fda4af";
}

function renderProjectOverview() {
  nodes.metricProjectsTotal.textContent = String(state.projects.length);

  const project = state.selectedProject;
  const health = state.selectedProjectHealth;
  if (!project) {
    nodes.metricProjectsHealthy.textContent = "unknown";
    nodes.metricProjectsHealthyNote.textContent = "project not loaded";
    nodes.projectDefaultProvider.textContent = "-";
    nodes.projectRunsRoot.textContent = "-";
    nodes.projectName.textContent = "-";
    nodes.projectIdLine.textContent = "-";
    nodes.projectConfigPath.textContent = "-";
    nodes.projectWorkspaceRoot.textContent = "-";
    nodes.projectHealthChecks.textContent = "-";
    nodes.projectHealthWarnings.textContent = "none";
    return;
  }

  nodes.projectName.textContent = project.name;
  nodes.projectIdLine.textContent = `id=${project.id}`;
  nodes.projectDefaultProvider.textContent = project.defaultProvider;
  nodes.projectRunsRoot.textContent = project.runsRoot;
  nodes.projectConfigPath.textContent = project.configPath;
  nodes.projectWorkspaceRoot.textContent = project.workspaceRoot;

  if (!health) {
    nodes.metricProjectsHealthy.textContent = "unknown";
    nodes.metricProjectsHealthyNote.textContent = "health unavailable";
    nodes.projectHealthChecks.textContent = "not loaded";
    nodes.projectHealthWarnings.textContent = "none";
    return;
  }

  nodes.metricProjectsHealthy.textContent = health.healthy ? "healthy" : "degraded";
  nodes.metricProjectsHealthyNote.textContent = health.healthy ? "all checks passed" : `${health.warnings.length} warning(s)`;
  const checks = health.checks;
  nodes.projectHealthChecks.textContent = `config=${checks.configPathExists}, workspace=${checks.workspaceRootExists}, runs=${checks.runsRootExists}, stages=${checks.stagesRootExists}, prompts=${checks.promptsRootExists}`;
  nodes.projectHealthWarnings.textContent = health.warnings.length > 0 ? health.warnings.join(" | ") : "none";
  if (nodes.projectSelector) {
    nodes.projectSelector.innerHTML = "";
    for (const entry of state.projects) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = `${entry.name} (${entry.id})`;
      nodes.projectSelector.append(option);
    }
    nodes.projectSelector.value = state.selectedProjectId || "";
  }
  if (nodes.projectNameInput) {
    nodes.projectNameInput.value = project.name || "";
  }
  if (nodes.projectConfigPathInput) {
    nodes.projectConfigPathInput.value = project.configPath || "";
  }
  if (nodes.projectWorkspacePathInput) {
    nodes.projectWorkspacePathInput.value = project.workspaceRoot || "";
  }
}

function renderSettingsOverview() {
  const project = state.selectedProject;
  const settings = state.settingsSnapshot;
  const policy = state.policySnapshot;
  const writeSafety = state.writeSafetyStatus;
  const providers = state.providerInventory?.providers || [];
  const effectiveProvider = settings?.project.defaultProvider || project?.defaultProvider || state.providerInventory?.defaultProvider || "";

  nodes.settingsConfigPath.value = settings?.project.defaultConfigPath || project?.configPath || "config.example.json";
  nodes.settingsRunsRoot.value = settings?.project.runsRoot || project?.runsRoot || "";
  nodes.settingsDefaultModel.value = settings?.project.defaultModel || "gpt-5.5";
  nodes.settingsDefaultMode.value = settings?.project.defaultMode || "preview-first";
  nodes.settingsEvidenceRetention.value = String(settings?.retention.evidenceDays ?? 30);
  nodes.settingsArtifactRetention.value = String(settings?.retention.artifactDays ?? 30);
  nodes.settingsTheme.value = settings?.ui.theme || "system";
  nodes.settingsKeyboardShortcuts.checked = settings?.ui.keyboardShortcuts ?? true;
  if (settings?.project.activeProjectId && state.projects.some((entry) => entry.id === settings.project.activeProjectId)) {
    state.selectedProjectId = settings.project.activeProjectId;
  }
  nodes.settingsSaveStatus.textContent = state.settingsDraftStatus;

  renderSettingsProviderOptions(effectiveProvider);

  if (!policy) {
    nodes.settingsRequireGitRepo.textContent = "policy unavailable";
    nodes.settingsRequireCleanStart.textContent = "policy unavailable";
    nodes.settingsManualCommitOnly.textContent = "policy unavailable";
  } else {
    nodes.settingsRequireGitRepo.textContent = policy.requireGitRepo ? "required" : "not required";
    nodes.settingsRequireCleanStart.textContent = policy.requireCleanStart ? "required" : "not required";
    nodes.settingsManualCommitOnly.textContent = policy.manualCommitOnly ? "enabled" : "disabled";
  }

  if (!writeSafety) {
    nodes.settingsWriteSafetyPill.className = "pill neutral";
    nodes.settingsWriteSafetyPill.textContent = "unavailable";
    nodes.settingsWriteSafetySummary.textContent = "write safety status unavailable";
  } else {
    nodes.settingsWriteSafetyPill.className = `pill ${writeSafety.ok ? "green" : "red"}`;
    nodes.settingsWriteSafetyPill.textContent = writeSafety.ok ? "passing" : "failing";
    nodes.settingsWriteSafetySummary.textContent = `${writeSafety.summary} branch=${writeSafety.branch} state=${writeSafety.workingTreeState}`;
  }

  const blockedPaths = policy?.blockedPaths || [];
  nodes.settingsBlockedPaths.textContent = blockedPaths.length > 0 ? blockedPaths.join(" | ") : "none";

  nodes.settingsProvidersPill.textContent = `${providers.length} providers`;
  nodes.settingsProvidersBody.innerHTML = "";
  if (providers.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5" class="muted">Providers not loaded.</td>';
    nodes.settingsProvidersBody.append(row);
    return;
  }

  for (const provider of providers) {
    const row = document.createElement("tr");

    const id = document.createElement("td");
    id.className = "mono small";
    id.textContent = provider.id;

    const type = document.createElement("td");
    type.textContent = provider.type;

    const command = document.createElement("td");
    command.className = "mono small";
    command.textContent = provider.command;

    const roles = document.createElement("td");
    roles.textContent = (provider.usedByRoles || []).join(", ") || "-";

    const probe = document.createElement("td");
    const probePill = document.createElement("span");
    probePill.className = `pill ${provider.supportsProbe ? "green" : "neutral"}`;
    probePill.textContent = provider.supportsProbe ? "supported" : "n/a";
    probe.append(probePill);

    row.append(id, type, command, roles, probe);
    nodes.settingsProvidersBody.append(row);
  }
}

function renderSettingsProviderOptions(selectedProviderId) {
  const providerIds = (state.providerInventory?.providers || []).map((provider) => provider.id);
  if (selectedProviderId && !providerIds.includes(selectedProviderId)) {
    providerIds.unshift(selectedProviderId);
  }

  nodes.settingsDefaultProvider.innerHTML = "";
  for (const providerId of providerIds) {
    const option = document.createElement("option");
    option.value = providerId;
    option.textContent = providerId;
    nodes.settingsDefaultProvider.append(option);
  }

  if (providerIds.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "no providers";
    nodes.settingsDefaultProvider.append(option);
  }

  nodes.settingsDefaultProvider.value = selectedProviderId || providerIds[0] || "";
}

function applySettingsDefaultsToCommandLauncher() {
  const projectSettings = state.settingsSnapshot?.project;
  if (!projectSettings) {
    return;
  }

  nodes.commandConfigInput.value = projectSettings.defaultConfigPath || nodes.commandConfigInput.value;
  nodes.commandExecutionMode.value = projectSettings.defaultMode || nodes.commandExecutionMode.value;
  updateCommandPreview();
}

function hasActiveProject() {
  return typeof state.selectedProjectId === "string" && state.selectedProjectId.trim().length > 0;
}

async function loadProjects() {
  try {
    const listPayload = await fetchJson("/api/projects");
    state.projects = Array.isArray(listPayload.projects) ? listPayload.projects : [];
  } catch {
    state.projects = [];
  }

  if (state.projects.length === 0) {
    state.selectedProjectId = undefined;
    state.selectedProject = undefined;
    state.selectedProjectHealth = undefined;
    renderProjectOverview();
    return;
  }

  if (!state.selectedProjectId || !state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = state.projects[0].id;
  }

  try {
    const detailPayload = await fetchJson(`/api/projects/${encodeURIComponent(state.selectedProjectId)}`);
    state.selectedProject = detailPayload.project;
  } catch {
    state.selectedProject = undefined;
  }

  try {
    const healthPayload = await fetchJson(`/api/projects/${encodeURIComponent(state.selectedProjectId)}/health`);
    state.selectedProjectHealth = healthPayload.health;
  } catch {
    state.selectedProjectHealth = undefined;
  }

  renderProjectOverview();
  renderSettingsOverview();
}

async function loadSettingsData() {
  if (!hasActiveProject()) {
    state.settingsSnapshot = undefined;
    state.providerInventory = undefined;
    state.policySnapshot = undefined;
    state.writeSafetyStatus = undefined;
    state.settingsDraftStatus = "no project selected";
    renderSettingsOverview();
    return;
  }

  try {
    const settingsPayload = await fetchJson("/api/settings");
    state.settingsSnapshot = settingsPayload.settings;
    state.settingsDraftStatus = "loaded";
  } catch {
    state.settingsSnapshot = undefined;
    state.settingsDraftStatus = "settings unavailable";
  }

  try {
    const providersPayload = await fetchJson("/api/providers");
    state.providerInventory = providersPayload.inventory;
  } catch {
    state.providerInventory = undefined;
  }

  try {
    const policyPayload = await fetchJson("/api/policy");
    state.policySnapshot = policyPayload.policy;
  } catch {
    state.policySnapshot = undefined;
  }

  try {
    const writeSafetyPayload = await fetchJson("/api/safety/write-status");
    state.writeSafetyStatus = writeSafetyPayload.status;
  } catch {
    state.writeSafetyStatus = undefined;
  }

  applySettingsDefaultsToCommandLauncher();
  renderSettingsOverview();
}

async function saveSettings() {
  const payload = {
    settings: {
      project: {
        activeProjectId: state.selectedProjectId || "default",
        defaultConfigPath: nodes.settingsConfigPath.value.trim(),
        runsRoot: nodes.settingsRunsRoot.value.trim(),
        defaultProvider: nodes.settingsDefaultProvider.value.trim(),
        defaultModel: nodes.settingsDefaultModel.value.trim(),
        defaultMode: nodes.settingsDefaultMode.value
      },
      retention: {
        evidenceDays: Number.parseInt(nodes.settingsEvidenceRetention.value, 10),
        artifactDays: Number.parseInt(nodes.settingsArtifactRetention.value, 10)
      },
      ui: {
        theme: nodes.settingsTheme.value,
        keyboardShortcuts: nodes.settingsKeyboardShortcuts.checked
      }
    }
  };

  const result = await fetchJson("/api/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  state.settingsSnapshot = result.settings;
  state.settingsDraftStatus = `saved ${new Date().toLocaleTimeString()}`;
  applySettingsDefaultsToCommandLauncher();
  renderSettingsOverview();
}

async function saveProjectConfig() {
  if (!state.selectedProjectId) {
    throw new Error("No active project selected.");
  }

  const payload = {
    config: {
      runsDir: nodes.settingsRunsRoot.value.trim(),
      defaultProvider: nodes.settingsDefaultProvider.value.trim(),
      defaultModel: nodes.settingsDefaultModel.value.trim()
    }
  };

  const result = await fetchJson(`/api/projects/${encodeURIComponent(state.selectedProjectId)}/config`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  state.selectedProject = result.project;
  state.settingsDraftStatus = `project config saved ${new Date().toLocaleTimeString()}`;
  renderProjectOverview();
  renderSettingsOverview();
}

async function createProject() {
  const name = nodes.projectNameInput.value.trim();
  const configPath = nodes.projectConfigPathInput.value.trim();
  if (!name || !configPath) {
    nodes.projectCrudStatus.textContent = "name + config required";
    return;
  }
  await fetchJson("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project: { name, configPath } })
  });
  nodes.projectCrudStatus.textContent = "project created";
  await loadProjects();
}

async function initAndCreateProject() {
  const name = nodes.projectNameInput.value.trim();
  const workspacePath = nodes.projectWorkspacePathInput.value.trim();
  if (!name || !workspacePath) {
    nodes.projectCrudStatus.textContent = "name + workspace required";
    return;
  }
  await fetchJson("/api/projects/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project: {
        name,
        workspacePath
      }
    })
  });
  nodes.projectCrudStatus.textContent = "project initialized";
  await loadProjects();
}

async function browseWorkspacePath() {
  if (!WORKSPACE_PICKER_ENABLED) {
    nodes.projectCrudStatus.textContent = "Finder picker unavailable in containerized API; enter workspace path manually.";
    return;
  }

  try {
    const payload = await fetchJson("/api/system/select-workspace", {
      method: "POST"
    });
    const workspacePath = typeof payload.workspacePath === "string" ? payload.workspacePath.trim() : "";
    if (!workspacePath) {
      throw new Error("Workspace picker returned an empty path.");
    }
    nodes.projectWorkspacePathInput.value = workspacePath;
    nodes.projectCrudStatus.textContent = "workspace selected";
  } catch (error) {
    const base = error instanceof Error ? error.message : String(error);
    if (base.toLowerCase().includes("cancelled")) {
      nodes.projectCrudStatus.textContent = "workspace selection cancelled";
      return;
    }
    throw new Error(`Browse failed: ${base}. If this route is new, restart the API server.`);
  }
}

async function updateSelectedProject() {
  if (!state.selectedProjectId) {
    nodes.projectCrudStatus.textContent = "no project selected";
    return;
  }
  const payload = {
    project: {
      name: nodes.projectNameInput.value.trim() || undefined,
      configPath: nodes.projectConfigPathInput.value.trim() || undefined
    }
  };
  await fetchJson(`/api/projects/${encodeURIComponent(state.selectedProjectId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  nodes.projectCrudStatus.textContent = "project updated";
  await loadProjects();
}

async function deleteSelectedProject() {
  if (!state.selectedProjectId) {
    nodes.projectCrudStatus.textContent = "no project selected";
    return;
  }
  await fetchJson(`/api/projects/${encodeURIComponent(state.selectedProjectId)}`, {
    method: "DELETE"
  });
  nodes.projectCrudStatus.textContent = "project deleted";
  state.selectedProjectId = undefined;
  await loadProjects();
}

function updateRunMetrics() {
  const runs = state.runs;
  const ready = runs.filter((run) => run.status === "passed" || run.status === "ready").length;
  const blocked = runs.filter((run) => run.status === "blocked" || run.status === "failed").length;
  const running = runs.filter((run) => run.status === "running").length;

  nodes.metricTotalRuns.textContent = String(runs.length);
  nodes.metricReadyRuns.textContent = String(ready);
  nodes.metricBlockedRuns.textContent = String(blocked);
  nodes.metricRunningRuns.textContent = String(running);
  nodes.navRunsCount.textContent = String(runs.length);
}

function updateStagePlanMetrics() {
  const plans = state.stagePlans;
  const running = plans.filter((plan) => plan.status === "running").length;
  const ready = plans.filter((plan) => plan.status === "ready").length;
  const completed = plans.filter((plan) => plan.status === "completed").length;
  nodes.metricStagePlansTotal.textContent = String(plans.length);
  nodes.metricStagePlansRunning.textContent = String(running);
  nodes.metricStagePlansReady.textContent = String(ready);
  nodes.metricStagePlansCompleted.textContent = String(completed);
  nodes.navStagePlansCount.textContent = String(plans.length);
}

function applyRunFilter() {
  const query = (nodes.runsFilterInput.value || "").trim().toLowerCase();
  if (!query) {
    state.filteredRuns = [...state.runs];
  } else {
    state.filteredRuns = state.runs.filter((run) => {
      const haystack = `${run.id} ${run.title} ${run.subtitle} ${run.status} ${run.mode}`.toLowerCase();
      return haystack.includes(query);
    });
  }
  renderRunTable();
}

function renderRunTable() {
  nodes.runsTableBody.innerHTML = "";

  if (state.filteredRuns.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5" class="muted">No runs found.</td>';
    nodes.runsTableBody.append(row);
    return;
  }

  for (const run of state.filteredRuns) {
    const row = document.createElement("tr");
    const isSelected = state.selectedRunId === run.id;
    if (isSelected) {
      row.classList.add("selected");
    }

    const runCell = document.createElement("td");
    const inspectButton = document.createElement("button");
    inspectButton.className = "button-ghost";
    inspectButton.textContent = run.title || run.id;
    inspectButton.addEventListener("click", async () => {
      await selectRun(run.id);
      navigateToPage("run-detail");
    });
    runCell.append(inspectButton);
    const runIdLine = document.createElement("div");
    runIdLine.className = "small muted mono";
    runIdLine.textContent = run.id;
    runCell.append(runIdLine);

    const statusCell = document.createElement("td");
    const statusPill = document.createElement("span");
    statusPill.className = `pill ${toPillClass(run.status)}`;
    statusPill.textContent = run.status;
    statusCell.append(statusPill);

    const modeCell = document.createElement("td");
    modeCell.textContent = formatMode(run.mode);

    const branchCell = document.createElement("td");
    branchCell.className = "mono small";
    branchCell.textContent = run.branch || "-";

    const actionCell = document.createElement("td");
    const continueButton = document.createElement("button");
    continueButton.className = "button-secondary";
    continueButton.textContent = "Continue";
    continueButton.addEventListener("click", () => {
      nodes.commandSelect.value = "continue-run";
      nodes.commandRunIdInput.value = run.id;
      updateCommandPreview();
      navigateToPage("commands");
    });
    actionCell.append(continueButton);

    row.append(runCell, statusCell, modeCell, branchCell, actionCell);
    nodes.runsTableBody.append(row);
  }
}

function renderStagePlansTable() {
  nodes.stagePlansTableBody.innerHTML = "";
  if (state.stagePlans.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5" class="muted">No stage plans discovered.</td>';
    nodes.stagePlansTableBody.append(row);
    return;
  }

  for (const plan of state.stagePlans) {
    const row = document.createElement("tr");
    const planCell = document.createElement("td");
    const inspectButton = document.createElement("button");
    inspectButton.className = "button-ghost";
    inspectButton.textContent = plan.title;
    inspectButton.addEventListener("click", () => {
      void selectStagePlan(plan.id);
    });
    planCell.append(inspectButton);
    const idLine = document.createElement("div");
    idLine.className = "small muted mono";
    idLine.textContent = plan.planId;
    planCell.append(idLine);

    const statusCell = document.createElement("td");
    const statusPill = document.createElement("span");
    statusPill.className = `pill ${toPillClass(plan.status)}`;
    statusPill.textContent = plan.status;
    statusCell.append(statusPill);

    const sourceCell = document.createElement("td");
    sourceCell.textContent = plan.source;

    const stageCell = document.createElement("td");
    stageCell.textContent = String(plan.stageCount);

    const pathCell = document.createElement("td");
    pathCell.className = "mono small";
    pathCell.textContent = plan.path;

    row.append(planCell, statusCell, sourceCell, stageCell, pathCell);
    nodes.stagePlansTableBody.append(row);
  }
}

function renderSelectedStagePlan() {
  const plan = state.selectedStagePlan;
  if (!plan) {
    nodes.selectedStagePlanTitle.textContent = "Stage plan detail";
    nodes.selectedStagePlanStatus.textContent = "none";
    nodes.selectedStagePlanStatus.className = "pill neutral";
    nodes.selectedStagePlanSummary.innerHTML = '<div class="list-item muted">Select a stage plan to inspect details.</div>';
    nodes.selectedStagePlanStages.innerHTML = '<div class="list-item muted">No stages loaded.</div>';
    nodes.selectedStageCountPill.textContent = "0 stages";
    return;
  }

  nodes.selectedStagePlanTitle.textContent = plan.title;
  nodes.selectedStagePlanStatus.textContent = plan.status;
  nodes.selectedStagePlanStatus.className = `pill ${toPillClass(plan.status)}`;
  nodes.selectedStageCountPill.textContent = `${plan.stageCount} stages`;

  nodes.selectedStagePlanSummary.innerHTML = "";
  const fields = [
    ["Plan id", plan.planId],
    ["Goal", plan.goal],
    ["Path", plan.path],
    ["Updated", plan.updatedAt],
    ["Status counts", `pending=${plan.statusCounts.pending}, running=${plan.statusCounts.running}, review_required=${plan.statusCounts.reviewRequired}, accepted=${plan.statusCounts.accepted}, fix_required=${plan.statusCounts.fixRequired}, failed=${plan.statusCounts.failed}, committed=${plan.statusCounts.committed}`]
  ];
  for (const [label, value] of fields) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `<strong>${label}</strong><div class="small muted">${value}</div>`;
    nodes.selectedStagePlanSummary.append(item);
  }

  nodes.selectedStagePlanStages.innerHTML = "";
  for (const stage of plan.stages) {
    const item = document.createElement("div");
    item.className = "list-item";
    const row = document.createElement("div");
    row.className = "row";
    const title = document.createElement("strong");
    title.textContent = `${stage.index}. ${stage.title}`;
    const statusPill = document.createElement("span");
    statusPill.className = `pill ${toPillClass(stage.status)}`;
    statusPill.textContent = stage.status;
    row.append(title, statusPill);
    const meta = document.createElement("div");
    meta.className = "small muted mono";
    meta.textContent = `${stage.id} · dependsOn=${stage.dependsOn.join(",") || "none"} · revision=${stage.revision}`;
    const actions = document.createElement("div");
    actions.className = "toolbar";
    const runButton = document.createElement("button");
    runButton.className = "button-secondary";
    runButton.textContent = "Run stage";
    runButton.addEventListener("click", () => {
      nodes.commandSelect.value = "run-stage";
      nodes.commandStageIdInput.value = stage.id;
      nodes.commandStagePlanInput.value = plan.path;
      updateCommandPreview();
      navigateToPage("commands");
    });
    const fixButton = document.createElement("button");
    fixButton.className = "button-secondary";
    fixButton.textContent = "Fix stage";
    fixButton.addEventListener("click", () => {
      nodes.commandSelect.value = "fix-stage";
      nodes.commandStageIdInput.value = stage.id;
      nodes.commandStagePlanInput.value = plan.path;
      updateCommandPreview();
      navigateToPage("commands");
    });
    actions.append(runButton, fixButton);
    item.append(row, meta, actions);
    nodes.selectedStagePlanStages.append(item);
  }
}

async function selectStagePlan(stagePlanId) {
  state.selectedStagePlanId = stagePlanId;
  const payload = await fetchJson(`/api/stage-plans/${encodeURIComponent(stagePlanId)}`);
  state.selectedStagePlan = payload.stagePlan;
  renderSelectedStagePlan();
}

async function loadStagePlans() {
  if (!hasActiveProject()) {
    state.stagePlans = [];
    state.selectedStagePlanId = undefined;
    state.selectedStagePlan = undefined;
    updateStagePlanMetrics();
    renderStagePlansTable();
    renderSelectedStagePlan();
    return;
  }

  try {
    const payload = await fetchJson("/api/stage-plans");
    state.stagePlans = Array.isArray(payload.stagePlans) ? payload.stagePlans : [];
  } catch {
    state.stagePlans = [];
  }
  updateStagePlanMetrics();
  renderStagePlansTable();
  if (state.stagePlans.length > 0) {
    if (!state.selectedStagePlanId || !state.stagePlans.some((plan) => plan.id === state.selectedStagePlanId)) {
      await selectStagePlan(state.stagePlans[0].id);
    }
  } else {
    state.selectedStagePlanId = undefined;
    state.selectedStagePlan = undefined;
    renderSelectedStagePlan();
  }
}

function reviewStatusPillClass(status) {
  if (status === "approved") return "green";
  if (status === "changes_requested") return "red";
  if (status === "pending") return "amber";
  if (status === "needs approval") return "amber";
  if (status === "ready") return "blue";
  if (status === "blocked") return "red";
  return "neutral";
}

function getSelectedReview() {
  if (!state.selectedReviewId) {
    return undefined;
  }
  return state.reviews.find((review) => review.id === state.selectedReviewId);
}

function ensureSelectedReview() {
  if (state.reviews.length === 0) {
    state.selectedReviewId = undefined;
    return;
  }
  if (!state.selectedReviewId || !state.reviews.some((review) => review.id === state.selectedReviewId)) {
    const pending = state.reviews.find((review) => review.status === "pending" || review.status === "changes_requested");
    state.selectedReviewId = (pending || state.reviews[0]).id;
  }
}

function renderReviewThread() {
  ensureSelectedReview();
  const review = getSelectedReview();

  nodes.selectedReviewSelect.innerHTML = "";
  if (state.reviews.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No reviews";
    option.value = "";
    nodes.selectedReviewSelect.append(option);
    nodes.selectedReviewStatusPill.className = "pill neutral";
    nodes.selectedReviewStatusPill.textContent = "none";
    nodes.reviewCommentsList.innerHTML = '<div class="list-item muted">No review selected.</div>';
    return;
  }

  for (const item of state.reviews) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.title} (${item.status})`;
    option.selected = item.id === state.selectedReviewId;
    nodes.selectedReviewSelect.append(option);
  }

  if (!review) {
    nodes.selectedReviewStatusPill.className = "pill neutral";
    nodes.selectedReviewStatusPill.textContent = "none";
    nodes.reviewCommentsList.innerHTML = '<div class="list-item muted">No review selected.</div>';
    return;
  }

  nodes.selectedReviewStatusPill.className = `pill ${reviewStatusPillClass(review.status)}`;
  nodes.selectedReviewStatusPill.textContent = review.status;

  nodes.reviewCommentsList.innerHTML = "";
  const summary = document.createElement("div");
  summary.className = "list-item";
  summary.innerHTML = `<strong>${review.title}</strong><p class="small muted">run=${review.runId} · readiness=${review.readinessStatus} · reviewer=${review.reviewerVerdict} · checks=${review.checksState}</p>`;
  nodes.reviewCommentsList.append(summary);

  if ((review.blockers || []).length > 0) {
    const blockerItem = document.createElement("div");
    blockerItem.className = "list-item";
    blockerItem.innerHTML = `<strong>Blockers (${review.blockers.length})</strong><p class="small muted">${review.blockers.join(" | ")}</p>`;
    nodes.reviewCommentsList.append(blockerItem);
  }

  for (const comment of review.comments || []) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `<strong>${comment.author}</strong><p>${comment.message}</p><p class="small muted mono">${comment.createdAt}</p>`;
    nodes.reviewCommentsList.append(item);
  }

  if ((review.comments || []).length === 0) {
    const empty = document.createElement("div");
    empty.className = "list-item muted";
    empty.textContent = "No comments yet.";
    nodes.reviewCommentsList.append(empty);
  }

  if (review.decision) {
    const decision = document.createElement("div");
    decision.className = "list-item";
    decision.innerHTML = `<strong>Decision: ${review.decision.decision}</strong><p class="small muted">${review.decision.author}${review.decision.note ? ` · ${review.decision.note}` : ""}</p><p class="small muted mono">${review.decision.decidedAt}</p>`;
    nodes.reviewCommentsList.append(decision);
  }
}

function renderReviewSupportPanels() {
  const review = getSelectedReview();
  if (!review) {
    nodes.reviewPrSummaryPill.className = "pill neutral";
    nodes.reviewPrSummaryPill.textContent = "not loaded";
    nodes.reviewPrSummaryOutput.textContent = "Select a review to load PR summary preview.";
    nodes.reviewAuditPill.className = "pill neutral";
    nodes.reviewAuditPill.textContent = "0 events";
    nodes.reviewAuditOutput.textContent = "Select a review to load audit trail.";
    return;
  }

  const hasSummary = typeof state.selectedReviewPrSummary === "string" && state.selectedReviewPrSummary.trim().length > 0;
  nodes.reviewPrSummaryPill.className = `pill ${hasSummary ? "green" : "amber"}`;
  nodes.reviewPrSummaryPill.textContent = hasSummary ? "loaded" : "missing";
  nodes.reviewPrSummaryOutput.textContent = hasSummary
    ? state.selectedReviewPrSummary
    : "No pr-summary artifact found for this run.";

  const events = state.selectedReviewAuditEvents || [];
  nodes.reviewAuditPill.className = `pill ${events.length > 0 ? "blue" : "neutral"}`;
  nodes.reviewAuditPill.textContent = `${events.length} events`;
  nodes.reviewAuditOutput.textContent =
    events.length > 0
      ? events
          .map((event) => {
            const suffix = event.error ? ` error=${event.error}` : event.exitCode !== undefined ? ` exit=${event.exitCode}` : "";
            return `${event.timestamp} ${event.status}: ${event.command}${suffix}`;
          })
          .join("\n")
      : "No audit events found for this run.";
}

async function loadSelectedReviewContext() {
  const review = getSelectedReview();
  if (!review) {
    state.selectedReviewPrSummary = undefined;
    state.selectedReviewAuditEvents = [];
    renderReviewSupportPanels();
    return;
  }

  state.selectedReviewPrSummary = undefined;
  state.selectedReviewAuditEvents = [];

  try {
    const artifactsPayload = await fetchJson(`/api/runs/${encodeURIComponent(review.runId)}/artifacts`);
    const artifacts = Array.isArray(artifactsPayload.artifacts) ? artifactsPayload.artifacts : [];
    const prSummaryArtifact =
      artifacts.find((artifact) => artifact.id === "pr-summary") ||
      artifacts.find((artifact) => typeof artifact.path === "string" && artifact.path.toLowerCase().includes("pr-summary")) ||
      artifacts.find((artifact) => typeof artifact.title === "string" && artifact.title.toLowerCase().includes("pr summary"));
    if (prSummaryArtifact?.id) {
      const contentPayload = await fetchJson(
        `/api/runs/${encodeURIComponent(review.runId)}/artifacts/${encodeURIComponent(prSummaryArtifact.id)}/content?maxBytes=64000`
      );
      if (typeof contentPayload.content === "string") {
        state.selectedReviewPrSummary = contentPayload.content;
      }
    }
  } catch {
    state.selectedReviewPrSummary = undefined;
  }

  try {
    const eventsPayload = await fetchJson(`/api/runs/${encodeURIComponent(review.runId)}/events?limit=40`);
    state.selectedReviewAuditEvents = Array.isArray(eventsPayload.events) ? eventsPayload.events : [];
  } catch {
    state.selectedReviewAuditEvents = [];
  }

  renderReviewSupportPanels();
}

async function loadReviews() {
  if (!hasActiveProject()) {
    state.reviews = [];
    state.selectedReviewId = undefined;
    state.selectedReviewPrSummary = undefined;
    state.selectedReviewAuditEvents = [];
    renderReviewThread();
    renderReviewSupportPanels();
    renderApprovalQueue();
    return;
  }

  try {
    const payload = await fetchJson("/api/reviews");
    state.reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
  } catch {
    state.reviews = [];
  }

  ensureSelectedReview();
  renderReviewThread();
  await loadSelectedReviewContext();
  renderApprovalQueue();
}

async function addSelectedReviewComment() {
  const review = getSelectedReview();
  const message = nodes.reviewCommentInput.value.trim();
  if (!review || !message) {
    return;
  }

  const payload = await fetchJson(`/api/reviews/${encodeURIComponent(review.id)}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ author: "operator", message })
  });

  const updated = payload.review;
  state.reviews = state.reviews.map((item) => (item.id === updated.id ? updated : item));
  state.selectedReviewId = updated.id;
  nodes.reviewCommentInput.value = "";
  renderReviewThread();
  await loadSelectedReviewContext();
  renderApprovalQueue();
}

async function decideSelectedReview(decision) {
  const review = getSelectedReview();
  if (!review) {
    return;
  }

  const note = nodes.reviewDecisionNoteInput.value.trim();
  const payload = await fetchJson(`/api/reviews/${encodeURIComponent(review.id)}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision, author: "operator", note: note || undefined })
  });

  const updated = payload.review;
  state.reviews = state.reviews.map((item) => (item.id === updated.id ? updated : item));
  state.selectedReviewId = updated.id;
  nodes.reviewDecisionNoteInput.value = "";
  renderReviewThread();
  await loadSelectedReviewContext();
  renderApprovalQueue();
}

function renderApprovalQueue() {
  const items = [];
  for (const review of state.reviews) {
    items.push({
      title: review.title,
      status: review.status,
      detail: `run=${review.runId} · readiness=${review.readinessStatus} · blockers=${review.blockerCount}`
    });
  }

  for (const pending of state.pendingApprovals) {
    items.push({
      title: pending.title,
      status: "needs approval",
      detail: pending.detail
    });
  }

  const latestFailedCommand = [...state.commandLifecycleEvents].reverse().find((event) => event.status === "failed");
  if (latestFailedCommand) {
    items.push({
      title: "Latest failed command",
      status: "blocked",
      detail: `${latestFailedCommand.command} failed${latestFailedCommand.error ? `: ${latestFailedCommand.error}` : "."}`
    });
  }

  const pendingCount =
    state.reviews.filter((review) => review.status === "pending" || review.status === "changes_requested").length +
    state.pendingApprovals.length +
    (latestFailedCommand ? 1 : 0);
  nodes.teamPendingCount.textContent = String(pendingCount);
  nodes.approvalQueuePill.textContent = `${pendingCount} pending`;
  nodes.approvalQueueList.innerHTML = "";
  if (items.length === 0) {
    nodes.approvalQueueList.innerHTML = '<div class="list-item muted">No pending approvals.</div>';
    return;
  }

  for (const item of items) {
    const node = document.createElement("div");
    node.className = "list-item";

    const row = document.createElement("div");
    row.className = "row";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const pill = document.createElement("span");
    pill.className = `pill ${item.status === "blocked" ? "red" : reviewStatusPillClass(item.status)}`;
    pill.textContent = item.status;
    row.append(title, pill);

    const detail = document.createElement("p");
    detail.className = "small muted";
    detail.textContent = item.detail;
    node.append(row, detail);
    nodes.approvalQueueList.append(node);
  }
}

async function loadRuns() {
  if (!hasActiveProject()) {
    state.runs = [];
    state.filteredRuns = [];
    state.selectedRunId = undefined;
    state.selectedRun = undefined;
    state.selectedRunReadiness = undefined;
    state.selectedRunReview = undefined;
    state.selectedRunEvidence = undefined;
    state.selectedRunPhaseArtifacts = undefined;
    state.selectedRunArtifacts = [];
    state.selectedArtifactContent = undefined;
    updateRunMetrics();
    applyRunFilter();
    renderRunDetail();
    return;
  }

  const payload = await fetchJson("/api/runs");
  state.runs = Array.isArray(payload.runs) ? payload.runs : [];
  updateRunMetrics();
  applyRunFilter();

  if (state.runs.length > 0 && !state.selectedRunId) {
    await selectRun(state.runs[0].id);
  }
}

function renderRunDetail() {
  const run = state.selectedRun;

  if (!run) {
    nodes.detailReadinessStatus.textContent = "unknown";
    nodes.detailReadinessNote.textContent = "No run selected";
    nodes.detailScoreValue.textContent = "n/a";
    nodes.detailRiskValue.textContent = "risk unknown";
    nodes.detailReviewerVerdict.textContent = "UNKNOWN";
    nodes.detailFindingsCount.textContent = "0 findings";
    nodes.detailChecksState.textContent = "unknown";
    nodes.detailWarningsCount.textContent = "0 warnings";
    nodes.timelineStatusPill.textContent = "unknown";
    nodes.timelineStatusPill.className = "pill amber";
    nodes.phaseTimeline.innerHTML = "";
    nodes.safeActionsList.innerHTML = "";
    nodes.detailWorkspace.textContent = "-";
    nodes.detailRunDir.textContent = "-";
    nodes.detailProvider.textContent = "-";
    nodes.detailModel.textContent = "-";
    nodes.detailAuditEventsPill.textContent = "0 events";
    nodes.detailAuditEventsPill.className = "pill neutral";
    nodes.detailAuditEventsOutput.textContent = "No run selected.";
    nodes.runArtifactScope.textContent = "all phases";
    nodes.runArtifactScope.className = "pill neutral";
    nodes.runArtifactsCount.textContent = "0";
    nodes.runArtifactsBody.innerHTML = '<tr><td colspan="5" class="muted">No run selected.</td></tr>';
    nodes.artifactPreviewTitle.textContent = "Artifact preview";
    nodes.artifactPreviewMeta.textContent = "not loaded";
    nodes.artifactPreviewMeta.className = "pill neutral";
    nodes.artifactPreviewOutput.textContent = "Select an artifact row to load content preview.";
    nodes.proofOutput.textContent = "No proof generated yet.";
    nodes.evidenceMapBody.innerHTML = "";
    nodes.reviewFindingsList.innerHTML = '<div class="list-item muted">No reviewer findings.</div>';
    renderComparePanel(undefined);
    renderApprovalQueue();
    return;
  }

  const readinessStatus = run.readiness?.status || "unknown";
  const scoreValue = Number.isFinite(run.readiness?.score) ? String(run.readiness.score) : "n/a";

  nodes.detailReadinessStatus.textContent = readinessStatus;
  nodes.detailReadinessNote.textContent = run.blockedReason || "No blocker";
  nodes.detailScoreValue.textContent = `${scoreValue}${scoreValue === "n/a" ? "" : "/100"}`;
  nodes.detailRiskValue.textContent = `risk ${run.readiness?.risk || "unknown"}`;
  nodes.detailReviewerVerdict.textContent = run.readiness?.reviewerVerdict || "UNKNOWN";
  nodes.detailFindingsCount.textContent = `${(run.reviewerFindings || []).length} findings`;
  nodes.detailChecksState.textContent = run.readiness?.checksState || "unknown";
  nodes.detailWarningsCount.textContent = `${(run.warnings || []).length} warnings`;

  nodes.timelineStatusPill.textContent = readinessStatus;
  nodes.timelineStatusPill.className = `pill ${toPillClass(readinessStatus)}`;

  renderPhases(run.phases || []);
  renderSafeActions(run.safeActions || []);

  nodes.detailWorkspace.textContent = run.workspaceRoot || "-";
  nodes.detailRunDir.textContent = run.runDir || "-";
  nodes.detailProvider.textContent = run.provider || "-";
  nodes.detailModel.textContent = run.model || "-";
  renderRunAuditPanel(state.selectedRunAuditEvents || []);

  const visibleArtifacts = getVisibleRunArtifacts();
  renderRunArtifacts(visibleArtifacts);
  renderResultsPanel(run, state.selectedRunReadiness, state.selectedRunEvidence);
  renderReviewPanel(run, state.selectedRunReview);
  renderComparePanel(state.selectedRunComparison);
  renderApprovalQueue();
}

function renderPhases(phases) {
  nodes.phaseTimeline.innerHTML = "";

  for (const phase of phases) {
    const card = document.createElement("div");
    card.className = "phase";
    card.style.cursor = "pointer";
    if (state.selectedPhaseId === phase.id) {
      card.style.borderColor = "#2563eb";
      card.style.boxShadow = "0 0 0 2px rgba(37,99,235,0.15)";
    }
    card.addEventListener("click", () => {
      state.selectedPhaseId = state.selectedPhaseId === phase.id ? undefined : phase.id;
      renderRunDetail();
    });
    const title = document.createElement("h3");
    title.textContent = phase.label;
    const summary = document.createElement("p");
    summary.textContent = phase.summary || phase.blockedReason || `status: ${phase.status}`;
    const meta = document.createElement("div");
    meta.className = "small muted";
    meta.textContent = `${phase.status} · ${(phase.artefactIds || []).length} artefacts`;
    card.append(title, summary, meta);
    nodes.phaseTimeline.append(card);
  }
}

function renderSafeActions(actions) {
  nodes.safeActionsList.innerHTML = "";
  nodes.actionsStatusPill.textContent = actions.some((action) => action.enabled) ? "available" : "blocked";
  nodes.actionsStatusPill.className = `pill ${actions.some((action) => action.enabled) ? "green" : "amber"}`;

  for (const action of actions) {
    const item = document.createElement("div");
    item.className = "list-item";

    const row = document.createElement("div");
    row.className = "row";
    const name = document.createElement("strong");
    name.textContent = action.label;
    const risk = document.createElement("span");
    risk.className = `pill ${action.risk === "high" ? "red" : action.risk === "medium" ? "amber" : "blue"}`;
    risk.textContent = `${action.risk} risk`;
    row.append(name, risk);

    const note = document.createElement("p");
    note.className = "small muted";
    note.textContent = action.enabled ? "Enabled" : action.blockedReason || "Blocked";

    item.append(row, note);
    nodes.safeActionsList.append(item);
  }
}

function renderRunAuditPanel(events) {
  nodes.detailAuditEventsPill.className = `pill ${events.length > 0 ? "blue" : "neutral"}`;
  nodes.detailAuditEventsPill.textContent = `${events.length} events`;
  nodes.detailAuditEventsOutput.textContent =
    events.length > 0
      ? events
          .map((event) => {
            const parts = [event.occurredAt, event.type];
            if (event.stageId) {
              parts.push(`stage=${event.stageId}`);
            }
            if (event.executorId) {
              parts.push(`executor=${event.executorId}`);
            }
            const payload =
              event.payload && Object.keys(event.payload).length > 0
                ? ` ${JSON.stringify(event.payload)}`
                : "";
            return `${parts.join(" ")}${payload}`;
          })
          .join("\n")
      : "No audited-flow events found for this run.";
}

function getSelectedPhaseLabel() {
  if (!state.selectedPhaseId || !state.selectedRunPhaseArtifacts?.phases) {
    return undefined;
  }
  return state.selectedRunPhaseArtifacts.phases.find((phase) => phase.id === state.selectedPhaseId)?.label;
}

function getVisibleRunArtifacts() {
  if (!state.selectedPhaseId) {
    return [...state.selectedRunArtifacts];
  }

  const phaseView = state.selectedRunPhaseArtifacts?.phases?.find((phase) => phase.id === state.selectedPhaseId);
  if (phaseView) {
    return [...phaseView.artifacts];
  }

  return state.selectedRunArtifacts.filter((artifact) => artifact.phaseId === state.selectedPhaseId);
}

function renderRunArtifacts(artifacts) {
  nodes.runArtifactsBody.innerHTML = "";
  nodes.runArtifactsCount.textContent = String(artifacts.length);
  const selectedPhaseLabel = getSelectedPhaseLabel();
  if (selectedPhaseLabel) {
    nodes.runArtifactScope.textContent = `phase: ${selectedPhaseLabel}`;
    nodes.runArtifactScope.className = "pill blue";
  } else {
    nodes.runArtifactScope.textContent = "all phases";
    nodes.runArtifactScope.className = "pill neutral";
  }

  if (artifacts.length === 0) {
    nodes.runArtifactsBody.innerHTML = '<tr><td colspan="5" class="muted">No artefacts found for this run.</td></tr>';
    nodes.artifactPreviewTitle.textContent = "Artifact preview";
    nodes.artifactPreviewMeta.textContent = "not available";
    nodes.artifactPreviewMeta.className = "pill neutral";
    nodes.artifactPreviewOutput.textContent = "No artifacts are available for this run.";
    return;
  }

  for (const artifact of artifacts) {
    const row = document.createElement("tr");

    const title = document.createElement("td");
    const inspectButton = document.createElement("button");
    inspectButton.className = "button-ghost";
    inspectButton.textContent = artifact.title || artifact.id;
    inspectButton.addEventListener("click", () => {
      void loadArtifactPreview(artifact.id);
    });
    title.append(inspectButton);

    const kind = document.createElement("td");
    const kindPill = document.createElement("span");
    kindPill.className = `pill ${artifact.kind === "json" ? "blue" : artifact.kind === "markdown" ? "green" : "neutral"}`;
    kindPill.textContent = artifact.kind || "text";
    kind.append(kindPill);

    const phase = document.createElement("td");
    phase.textContent = artifact.phaseId || "-";

    const path = document.createElement("td");
    path.className = "mono small";
    path.textContent = artifact.path || "-";

    const size = document.createElement("td");
    size.textContent = Number.isFinite(artifact.sizeBytes) ? `${artifact.sizeBytes} B` : "-";

    row.append(title, kind, phase, path, size);
    nodes.runArtifactsBody.append(row);
  }
}

async function loadArtifactPreview(artifactId) {
  if (!state.selectedRunId) {
    return;
  }

  nodes.artifactPreviewTitle.textContent = artifactId;
  nodes.artifactPreviewMeta.textContent = "loading";
  nodes.artifactPreviewMeta.className = "pill blue";
  nodes.artifactPreviewOutput.textContent = "Loading artifact content...";

  try {
    const payload = await fetchJson(
      `/api/runs/${encodeURIComponent(state.selectedRunId)}/artifacts/${encodeURIComponent(artifactId)}/content?maxBytes=256000`
    );
    state.selectedArtifactContent = payload;
    nodes.artifactPreviewTitle.textContent = payload.artifact?.title || artifactId;
    nodes.artifactPreviewMeta.textContent = payload.truncated ? `truncated @ ${payload.maxBytes} B` : "full content";
    nodes.artifactPreviewMeta.className = `pill ${payload.truncated ? "amber" : "green"}`;
    nodes.artifactPreviewOutput.textContent = payload.content || "";
  } catch (error) {
    nodes.artifactPreviewMeta.textContent = "failed";
    nodes.artifactPreviewMeta.className = "pill red";
    nodes.artifactPreviewOutput.textContent = error instanceof Error ? error.message : String(error);
  }
}

function renderResultsPanel(run, readinessView, evidenceView) {
  const readinessStatus = readinessView?.status || run.readiness?.status || "unknown";
  const score = Number.isFinite(readinessView?.score)
    ? String(readinessView.score)
    : Number.isFinite(run.readiness?.score)
      ? String(run.readiness.score)
      : "n/a";
  const nextAction = readinessView?.nextAction || inferNextAction(run);
  const risk = readinessView?.risk || run.readiness?.risk || "unknown";
  const reviewerVerdict = readinessView?.reviewerVerdict || run.readiness?.reviewerVerdict || "UNKNOWN";
  const checksState = readinessView?.checksState || run.readiness?.checksState || "unknown";
  const blockedReason = readinessView?.blockedReason || run.blockedReason || "none";

  nodes.resultsStatusPill.textContent = readinessStatus;
  nodes.resultsStatusPill.className = `pill ${toPillClass(readinessStatus)}`;
  nodes.resultsScoreValue.textContent = score;
  nodes.resultsReviewer.textContent = reviewerVerdict;
  nodes.resultsChecks.textContent = checksState;
  nodes.resultsRisk.textContent = risk;

  const proofLines = [
    "Merge Readiness Proof",
    `- run id: ${run.id}`,
    `- ready: ${readinessView ? readinessView.ready : readinessStatus === "READY"}`,
    `- status: ${readinessStatus}`,
    `- score: ${score}`,
    `- risk: ${risk}`,
    `- reviewer verdict: ${reviewerVerdict}`,
    `- checks: ${checksState}`,
    `- next action: ${nextAction}`,
    `- blockers: ${blockedReason}`
  ];
  nodes.proofOutput.textContent = proofLines.join("\n");

  nodes.evidenceMapBody.innerHTML = "";
  if (evidenceView?.items?.length) {
    for (const item of evidenceView.items) {
      addEvidenceRow(item.label, item.status, item.note || (item.sourcePath ? `source=${item.sourcePath}` : ""));
    }
  } else {
    addEvidenceRow("Readiness", readinessStatus, `source=${run.readiness?.source || "unknown"}`);
    addEvidenceRow("Checks", run.readiness?.checksState || "unknown", `warnings=${(run.warnings || []).length}`);
    addEvidenceRow("Reviewer", run.readiness?.reviewerVerdict || "UNKNOWN", `findings=${(run.reviewerFindings || []).length}`);
    addEvidenceRow("Artifacts", String((run.artefacts || []).length), run.runDir || "-");
  }
}

function inferNextAction(run) {
  if (run.readiness?.status === "READY") {
    return "ready-to-merge";
  }

  const enabled = (run.safeActions || []).find((action) => action.enabled);
  return enabled ? enabled.id : "inspect-blockers";
}

function addEvidenceRow(name, status, notes) {
  const row = document.createElement("tr");
  const nameCell = document.createElement("td");
  const statusCell = document.createElement("td");
  const notesCell = document.createElement("td");

  nameCell.textContent = name;
  const pill = document.createElement("span");
  pill.className = `pill ${toPillClass(status)}`;
  pill.textContent = status;
  statusCell.append(pill);
  notesCell.textContent = notes;

  row.append(nameCell, statusCell, notesCell);
  nodes.evidenceMapBody.append(row);
}

function renderReviewPanel(run, reviewView) {
  const verdict = reviewView?.verdict || run.readiness?.reviewerVerdict || "UNKNOWN";
  nodes.reviewVerdictPill.textContent = verdict;
  nodes.reviewVerdictPill.className = `pill ${toPillClass(verdict)}`;

  nodes.reviewFindingsList.innerHTML = "";
  const findings = reviewView
    ? [...(reviewView.blockingFindings || []), ...(reviewView.nonBlockingFindings || [])]
    : run.reviewerFindings || [];
  if (findings.length === 0) {
    nodes.reviewFindingsList.innerHTML = '<div class="list-item muted">No reviewer findings for this run.</div>';
    return;
  }

  for (const finding of findings) {
    const item = document.createElement("div");
    item.className = "list-item";
    const title = document.createElement("strong");
    title.textContent = `${String(finding.severity || "unknown").toUpperCase()} · ${finding.message}`;
    const source = document.createElement("div");
    source.className = "small muted mono";
    source.textContent = finding.sourceArtefactId || "reviewer-output";
    item.append(title, source);
    nodes.reviewFindingsList.append(item);
  }

  if (reviewView?.recommendedFixPrompt) {
    const fixPromptItem = document.createElement("div");
    fixPromptItem.className = "list-item";
    const heading = document.createElement("strong");
    heading.textContent = "Recommended fix prompt";
    const content = document.createElement("p");
    content.className = "small muted";
    content.textContent = reviewView.recommendedFixPrompt;
    fixPromptItem.append(heading, content);
    nodes.reviewFindingsList.append(fixPromptItem);
  }
}

function renderComparePanel(comparison) {
  if (!comparison) {
    nodes.compareStatusPill.className = "pill neutral";
    nodes.compareStatusPill.textContent = "not loaded";
    nodes.compareSummaryOutput.textContent = "Pick two runs and click Compare.";
    nodes.compareFilesOutput.textContent = "No data.";
    nodes.compareChecksOutput.textContent = "No data.";
    return;
  }

  nodes.compareStatusPill.className = `pill ${comparison.deltas.score >= 0 ? "green" : "amber"}`;
  nodes.compareStatusPill.textContent = comparison.deltas.score >= 0 ? "improved" : "regressed";

  nodes.compareSummaryOutput.textContent = [
    `run A: ${comparison.runA.runId}`,
    `run B: ${comparison.runB.runId}`,
    `readiness: ${comparison.runA.status} -> ${comparison.runB.status}`,
    `score: ${comparison.runA.score} -> ${comparison.runB.score} (delta ${formatSigned(comparison.deltas.score)})`,
    `risk: ${comparison.runA.risk} -> ${comparison.runB.risk} (${comparison.deltas.risk})`,
    `reviewer: ${comparison.runA.reviewerVerdict} -> ${comparison.runB.reviewerVerdict}`,
    `checks: ${comparison.runA.checksState} -> ${comparison.runB.checksState}`,
    `changed files: ${comparison.runA.changedFileCount} -> ${comparison.runB.changedFileCount} (delta ${formatSigned(comparison.deltas.changedFileCount)})`
  ].join("\n");

  nodes.compareFilesOutput.textContent = [
    `only in run A (${comparison.changedFiles.onlyInA.length}):`,
    ...(comparison.changedFiles.onlyInA.length > 0 ? comparison.changedFiles.onlyInA.map((file) => `- ${file}`) : ["- none"]),
    "",
    `only in run B (${comparison.changedFiles.onlyInB.length}):`,
    ...(comparison.changedFiles.onlyInB.length > 0 ? comparison.changedFiles.onlyInB.map((file) => `- ${file}`) : ["- none"]),
    "",
    `in both: ${comparison.changedFiles.inBothCount}`
  ].join("\n");

  nodes.compareChecksOutput.textContent = [
    `failed checks only in run A (${comparison.checks.failedOnlyInA.length}):`,
    ...(comparison.checks.failedOnlyInA.length > 0 ? comparison.checks.failedOnlyInA.map((check) => `- ${check}`) : ["- none"]),
    "",
    `failed checks only in run B (${comparison.checks.failedOnlyInB.length}):`,
    ...(comparison.checks.failedOnlyInB.length > 0 ? comparison.checks.failedOnlyInB.map((check) => `- ${check}`) : ["- none"]),
    "",
    `acceptance regressions (${comparison.acceptance.regressions.length}):`,
    ...(comparison.acceptance.regressions.length > 0 ? comparison.acceptance.regressions.map((item) => `- ${item}`) : ["- none"]),
    "",
    `acceptance improvements (${comparison.acceptance.improvements.length}):`,
    ...(comparison.acceptance.improvements.length > 0 ? comparison.acceptance.improvements.map((item) => `- ${item}`) : ["- none"])
  ].join("\n");
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value);
}

async function loadRunComparison() {
  const runA = nodes.compareRunAInput.value.trim();
  const runB = nodes.compareRunBInput.value.trim();

  if (!runA || !runB) {
    state.selectedRunComparison = undefined;
    renderComparePanel(undefined);
    return;
  }

  if (runA === runB) {
    state.selectedRunComparison = undefined;
    nodes.compareStatusPill.className = "pill red";
    nodes.compareStatusPill.textContent = "invalid";
    nodes.compareSummaryOutput.textContent = "Run A and Run B must be different run ids.";
    nodes.compareFilesOutput.textContent = "No data.";
    nodes.compareChecksOutput.textContent = "No data.";
    return;
  }

  nodes.compareStatusPill.className = "pill blue";
  nodes.compareStatusPill.textContent = "loading";
  nodes.compareSummaryOutput.textContent = "Loading comparison...";

  try {
    const payload = await fetchJson(`/api/runs/compare?runA=${encodeURIComponent(runA)}&runB=${encodeURIComponent(runB)}`);
    state.selectedRunComparison = payload.comparison;
    renderComparePanel(state.selectedRunComparison);
  } catch (error) {
    state.selectedRunComparison = undefined;
    nodes.compareStatusPill.className = "pill red";
    nodes.compareStatusPill.textContent = "failed";
    nodes.compareSummaryOutput.textContent = error instanceof Error ? error.message : String(error);
    nodes.compareFilesOutput.textContent = "No data.";
    nodes.compareChecksOutput.textContent = "No data.";
  }
}

function syncCompareRunInputs() {
  if (!state.selectedRunId) {
    return;
  }

  if (!nodes.compareRunAInput.value || nodes.compareRunAInput.value === state.selectedRunComparison?.runA?.runId) {
    nodes.compareRunAInput.value = state.selectedRunId;
  }

  const candidate = state.runs.find((run) => run.id !== state.selectedRunId)?.id;
  if ((!nodes.compareRunBInput.value || nodes.compareRunBInput.value === state.selectedRunId) && candidate) {
    nodes.compareRunBInput.value = candidate;
  }
}

async function selectRun(runId) {
  state.selectedRunId = runId;
  nodes.commandRunIdInput.value = runId;
  state.selectedArtifactContent = undefined;
  state.selectedRunReadiness = undefined;
  state.selectedRunReview = undefined;
  state.selectedRunEvidence = undefined;
  state.selectedRunAuditEvents = [];
  state.selectedRunPhaseArtifacts = undefined;
  state.selectedPhaseId = undefined;
  renderRunTable();

  const [runPayload, artifactPayload] = await Promise.all([
    fetchJson(`/api/runs/${encodeURIComponent(runId)}`),
    fetchJson(`/api/runs/${encodeURIComponent(runId)}/artifacts`)
  ]);
  state.selectedRun = runPayload.run;
  state.selectedRunArtifacts = Array.isArray(artifactPayload.artifacts) ? artifactPayload.artifacts : [];

  try {
    const readinessPayload = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/readiness`);
    state.selectedRunReadiness = readinessPayload.readiness;
  } catch {
    state.selectedRunReadiness = undefined;
  }

  try {
    const reviewPayload = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/review`);
    state.selectedRunReview = reviewPayload.review;
  } catch {
    state.selectedRunReview = undefined;
  }

  try {
    const evidencePayload = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/evidence`);
    state.selectedRunEvidence = evidencePayload.evidence;
  } catch {
    state.selectedRunEvidence = undefined;
  }

  try {
    const auditPayload = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/audit-events`);
    state.selectedRunAuditEvents = Array.isArray(auditPayload.events) ? auditPayload.events : [];
  } catch {
    state.selectedRunAuditEvents = [];
  }

  try {
    const phaseArtifactsPayload = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/phase-artifacts`);
    state.selectedRunPhaseArtifacts = phaseArtifactsPayload.phaseArtifacts;
  } catch {
    state.selectedRunPhaseArtifacts = undefined;
  }

  syncCompareRunInputs();
  await loadRunComparison();
  await loadRecentCliEvents(runId);
  renderRunDetail();
  const visibleArtifacts = getVisibleRunArtifacts();
  if (visibleArtifacts.length > 0) {
    await loadArtifactPreview(visibleArtifacts[0].id);
  }
}

function updateCommandPreview() {
  const command = nodes.commandSelect.value;
  const runId = nodes.commandRunIdInput.value.trim() || "<run-id>";
  const config = nodes.commandConfigInput.value.trim() || "config.example.json";
  const mode = nodes.commandExecutionMode.value;
  const stageName = nodes.commandStageNameInput.value.trim() || "<stage-name>";
  const stageId = nodes.commandStageIdInput.value.trim() || "<stage-id>";
  const stagePlan = nodes.commandStagePlanInput.value.trim() || "<stage-plan-path>";
  const compareRunId = nodes.commandCompareRunIdInput.value.trim() || "<run-id-b>";
  const modes = nodes.commandModesInput.value.trim() || "architecture,tests,docs,maintainability";
  const commitMessage = nodes.commandCommitMessageInput.value.trim();
  const stopAfterEachStageSuffix = nodes.commandStopAfterEachStage.checked ? " \\\n  --stop-after-each-stage" : "";
  const autoCommitSuffix = nodes.commandAutoCommit.checked ? " \\\n  --auto-commit" : "";
  const commitMessageSuffix = commitMessage ? ` \\\n  --commit-message "${commitMessage}"` : "";
  const reassessSuffix = nodes.commandReassessDownstream.checked ? " \\\n  --reassess-downstream" : "";

  const map = {
    "continue-run": `npm run mergewright -- continue-run ${runId} \\\n  --config ${config} \\\n  --execute-reviewer \\\n  --run-checks`,
    "run": `npm run mergewright -- run ${stageName} \\\n  --config ${config} \\\n  --execute-planner \\\n  --execute-reviewer \\\n  --run-checks \\\n  --dry-run`,
    "prove": `npm run mergewright -- prove ${runId} --config ${config}`,
    "report-run": `npm run mergewright -- report-run ${runId} --config ${config}`,
    "compare-runs": `npm run mergewright -- compare-runs ${runId} ${compareRunId} --config ${config}`,
    "review-modes": `npm run mergewright -- review-modes ${runId} --config ${config} --modes ${modes}`,
    "check-write-safety": `npm run mergewright -- check-write-safety --config ${config}`,
    "probe-opencode": `npm run mergewright -- probe-opencode --config ${config} --validate-readonly-contract --json`,
    "run-stage": `npm run mergewright -- run-stage ${stageId} \\\n  --stage-plan ${stagePlan} \\\n  --config ${config}`,
    "run-stages": `npm run mergewright -- run-stages \\\n  --stage-plan ${stagePlan} \\\n  --config ${config}${stopAfterEachStageSuffix}`,
    "continue-stages": `npm run mergewright -- continue-stages \\\n  --stage-plan ${stagePlan} \\\n  --config ${config}`,
    "accept-stage": `npm run mergewright -- accept-stage ${stageId} \\\n  --stage-plan ${stagePlan}${autoCommitSuffix}${commitMessageSuffix}`,
    "fix-stage": `npm run mergewright -- fix-stage ${stageId} \\\n  --stage-plan ${stagePlan} \\\n  --config ${config} \\\n  --feedback "${nodes.commandInstructionInput.value.trim() || "<feedback>"}"${reassessSuffix}`,
    "reassess-stage-plan": `npm run mergewright -- reassess-stage-plan \\\n  --stage-plan ${stagePlan} \\\n  --from ${stageId} \\\n  --config ${config}`
  };

  nodes.commandPreview.textContent = map[command] || "Unsupported command";
  const risk = riskForCommand(command);
  nodes.commandRiskPill.className = `pill ${risk === "medium" ? "amber" : "blue"}`;
  nodes.commandRiskPill.textContent = `${risk} risk`;
  nodes.executeCommandButton.textContent = mode === "preview-first" ? "Preview command" : "Execute command";
}

function buildGatewayPayload() {
  const command = nodes.commandSelect.value;
  const runId = nodes.commandRunIdInput.value.trim();
  const writeEnabled = isWriteEnabledMode();

  if (command === "run") {
    return {
      command,
      stageName: nodes.commandStageNameInput.value.trim(),
      preset: "plan",
      dryRun: !writeEnabled,
      allowWrites: writeEnabled,
      executePlanner: true,
      executeBuilder: writeEnabled,
      executeReviewer: true,
      runChecks: true
    };
  }

  if (command === "continue-run") {
    return {
      command,
      runId,
      dryRun: !writeEnabled,
      allowWrites: writeEnabled,
      executeBuilder: writeEnabled,
      executeReviewer: true,
      runChecks: true
    };
  }

  if (command === "prove") {
    return { command, runId };
  }

  if (command === "report-run") {
    return { command, runId };
  }

  if (command === "compare-runs") {
    return {
      command,
      runIdA: runId,
      runIdB: nodes.commandCompareRunIdInput.value.trim()
    };
  }

  if (command === "review-modes") {
    return {
      command,
      runId,
      modes: nodes.commandModesInput.value.trim()
    };
  }

  if (command === "check-write-safety") {
    return {
      command
    };
  }

  if (command === "probe-opencode") {
    return {
      command,
      validateReadonlyContract: true
    };
  }

  if (command === "run-stage") {
    return {
      command,
      stageId: nodes.commandStageIdInput.value.trim(),
      stagePlanArg: nodes.commandStagePlanInput.value.trim(),
      allowWrites: writeEnabled,
      dryRun: !writeEnabled
    };
  }

  if (command === "run-stages") {
    return {
      command,
      stagePlanArg: nodes.commandStagePlanInput.value.trim(),
      stopAfterEachStage: nodes.commandStopAfterEachStage.checked,
      allowWrites: writeEnabled,
      dryRun: !writeEnabled
    };
  }

  if (command === "continue-stages") {
    return {
      command,
      stagePlanArg: nodes.commandStagePlanInput.value.trim(),
      allowWrites: writeEnabled,
      dryRun: !writeEnabled
    };
  }

  if (command === "accept-stage") {
    return {
      command,
      stageId: nodes.commandStageIdInput.value.trim(),
      stagePlanArg: nodes.commandStagePlanInput.value.trim(),
      autoCommit: nodes.commandAutoCommit.checked,
      commitMessage: nodes.commandCommitMessageInput.value.trim() || undefined
    };
  }

  if (command === "fix-stage") {
    return {
      command,
      stageId: nodes.commandStageIdInput.value.trim(),
      stagePlanArg: nodes.commandStagePlanInput.value.trim(),
      feedback: nodes.commandInstructionInput.value.trim(),
      allowWrites: writeEnabled,
      streamCodex: false,
      reassessDownstream: nodes.commandReassessDownstream.checked
    };
  }

  if (command === "reassess-stage-plan") {
    return {
      command,
      stagePlanArg: nodes.commandStagePlanInput.value.trim(),
      sourceStageId: nodes.commandStageIdInput.value.trim(),
      dryRun: !writeEnabled
    };
  }

  throw new Error(`Unsupported command: ${command}`);
}

async function executeGatewayCommand() {
  const command = nodes.commandSelect.value;
  const mode = nodes.commandExecutionMode.value;
  const risk = riskForCommand(command);
  const writeEnabled = isWriteEnabledMode();
  const requiresWriteMode = command === "accept-stage" || command === "fix-stage";

  if (mode === "preview-first") {
    const previewPayload = {
      requestId: `preview-${new Date().toISOString()}`,
      command: buildGatewayPayload()
    };
    const response = await fetch(toApiUrl("/api/cli/commands/preview"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(previewPayload)
    });
    const previewResult = await response.json();
    nodes.typedResultOutput.textContent = JSON.stringify(previewResult, null, 2);
    nodes.cliSummaryOutput.textContent = Array.isArray(previewResult.summaryLines)
      ? previewResult.summaryLines.join("\n")
      : "Preview generated.";
    if (typeof previewResult.risk === "string") {
      nodes.commandRiskPill.className = `pill ${previewResult.risk === "high" ? "red" : previewResult.risk === "medium" ? "amber" : "blue"}`;
      nodes.commandRiskPill.textContent = `${previewResult.risk} risk`;
    }
    appendCommandEvent(`${new Date().toISOString()} command preview generated: ${command}`);
    return;
  }

  if (requiresWriteMode && !writeEnabled) {
    const summary = `${command} requires write-enabled execution mode.`;
    nodes.typedResultOutput.textContent = JSON.stringify(
      {
        ok: false,
        code: "WRITE_MODE_REQUIRED",
        reason: summary
      },
      null,
      2
    );
    nodes.cliSummaryOutput.textContent = summary;
    appendCommandEvent(`${new Date().toISOString()} write-enabled mode required for ${command}`);
    return;
  }

  if (writeEnabled && risk !== "low" && !nodes.commandConfirmWrites.checked) {
    const summary = "Medium-risk command requires confirmation.";
    nodes.typedResultOutput.textContent = JSON.stringify(
      {
        ok: false,
        code: "CONFIRMATION_REQUIRED",
        reason: summary,
        details: { risk, requiresConfirmation: true }
      },
      null,
      2
    );
    nodes.cliSummaryOutput.textContent = summary;
    appendCommandEvent(`${new Date().toISOString()} confirmation required for write-enabled ${command}`);
    state.pendingApprovals = [
      {
        title: `${command} command`,
        detail: `${command} is waiting for write confirmation.`
      }
    ];
    renderApprovalQueue();
    return;
  }

  const payload = {
    requestId: `web-${new Date().toISOString()}`,
    command: buildGatewayPayload()
  };

  const startedAt = new Date().toISOString();
  const response = await fetch(toApiUrl("/api/cli/commands"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  state.lastCommandResult = result;
  state.pendingApprovals = [];
  nodes.typedResultOutput.textContent = JSON.stringify(result, null, 2);
  nodes.cliSummaryOutput.textContent = [
    ...(Array.isArray(result.summaryLines) ? result.summaryLines : []),
    result.error ? `Error: ${result.error}` : ""
  ]
    .filter((line) => line)
    .join("\n");

  const events = [
    `${startedAt} command requested: ${payload.command.command}`,
    `${new Date().toISOString()} response status: ${response.status}`,
    `${new Date().toISOString()} exitCode: ${result.exitCode}`
  ];
  for (const eventLine of events) {
    appendCommandEvent(eventLine);
  }
  renderApprovalQueue();

  if (result.command === "run" || result.command === "continue-run" || result.command === "report-run") {
    await loadRuns();
  }
  if (
    result.command === "run-stage" ||
    result.command === "run-stages" ||
    result.command === "continue-stages" ||
    result.command === "accept-stage" ||
    result.command === "fix-stage" ||
    result.command === "reassess-stage-plan"
  ) {
    await loadStagePlans();
  }

  await loadReviews();

  if (payload.command.runId) {
    await selectRun(payload.command.runId);
    navigateToPage("run-detail");
  } else {
    await loadRecentCliEvents();
  }
}

function startCliEventStream() {
  if (typeof EventSource === "undefined") {
    appendCommandEvent(`${new Date().toISOString()} live event stream unavailable in this browser.`);
    return;
  }

  const stream = new EventSource(toApiUrl("/api/cli/events"));
  stream.onmessage = (message) => {
    try {
      const payload = JSON.parse(message.data);
      if (payload?.status === "connected") {
        appendCommandEvent(`${payload.timestamp} live event stream connected.`);
        return;
      }
      appendLifecycleEvent(payload);
      renderApprovalQueue();
    } catch {
      appendCommandEvent(`${new Date().toISOString()} received non-JSON live event.`);
    }
  };

  stream.onerror = () => {
    appendCommandEvent(`${new Date().toISOString()} live event stream disconnected; reconnecting.`);
  };
}

async function loadRecentCliEvents(runId) {
  try {
    const payload =
      runId && runId.trim()
        ? await fetchJson(`/api/runs/${encodeURIComponent(runId)}/events?limit=80`)
        : await fetchJson("/api/cli/events/recent?limit=80");
    const events = Array.isArray(payload.events) ? payload.events : [];
    state.commandEvents = [];
    state.commandLifecycleEvents = [];

    for (const event of events) {
      appendLifecycleEvent(event);
    }
  } catch {
    appendCommandEvent(`${new Date().toISOString()} failed to load recent command events.`);
  }
}

function wireTabs() {
  for (const tab of nodes.tabs) {
    tab.addEventListener("click", () => {
      for (const item of nodes.tabs) {
        item.classList.toggle("active", item === tab);
      }
      for (const panel of nodes.tabPanels) {
        panel.classList.toggle("active", panel.id === tab.dataset.tab);
      }
    });
  }
}

function wireEvents() {
  if (nodes.projectWorkspaceBrowseButton && !WORKSPACE_PICKER_ENABLED) {
    nodes.projectWorkspaceBrowseButton.disabled = true;
    nodes.projectWorkspaceBrowseButton.title = "Finder picker unavailable in containerized API.";
  }

  for (const link of nodes.links) {
    link.addEventListener("click", () => navigateToPage(link.dataset.pageLink));
  }

  nodes.refreshRunsButton.addEventListener("click", () => {
    void (async () => {
      await refreshApiHealth();
      await loadProjects();
      await loadSettingsData();
      await loadRuns();
      await loadStagePlans();
      await loadReviews();
      await loadRecentCliEvents(state.selectedRunId);
      renderApprovalQueue();
    })().catch((error) => {
      nodes.typedResultOutput.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    });
  });

  nodes.runsFilterInput.addEventListener("input", applyRunFilter);
  nodes.projectReloadButton?.addEventListener("click", () => {
    void loadProjects().catch((error) => {
      nodes.projectCrudStatus.textContent = error instanceof Error ? error.message : String(error);
    });
  });
  nodes.projectSelector?.addEventListener("change", () => {
    state.selectedProjectId = nodes.projectSelector.value || undefined;
    void (async () => {
      await loadProjects();
      await loadSettingsData();
      await loadRuns();
      await loadStagePlans();
      await loadReviews();
    })().catch((error) => {
      nodes.projectCrudStatus.textContent = error instanceof Error ? error.message : String(error);
    });
  });
  nodes.projectCreateButton?.addEventListener("click", () => {
    void createProject().catch((error) => {
      nodes.projectCrudStatus.textContent = error instanceof Error ? error.message : String(error);
    });
  });
  nodes.projectInitButton?.addEventListener("click", () => {
    void initAndCreateProject().catch((error) => {
      nodes.projectCrudStatus.textContent = error instanceof Error ? error.message : String(error);
    });
  });
  nodes.projectWorkspaceBrowseButton?.addEventListener("click", () => {
    void browseWorkspacePath().catch((error) => {
      nodes.projectCrudStatus.textContent = error instanceof Error ? error.message : String(error);
    });
  });
  nodes.projectUpdateButton?.addEventListener("click", () => {
    void updateSelectedProject().catch((error) => {
      nodes.projectCrudStatus.textContent = error instanceof Error ? error.message : String(error);
    });
  });
  nodes.projectDeleteButton?.addEventListener("click", () => {
    void deleteSelectedProject().catch((error) => {
      nodes.projectCrudStatus.textContent = error instanceof Error ? error.message : String(error);
    });
  });
  nodes.saveSettingsButton.addEventListener("click", () => {
    void saveSettings().catch((error) => {
      state.settingsDraftStatus = "save failed";
      renderSettingsOverview();
      nodes.typedResultOutput.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    });
  });
  nodes.saveProjectConfigButton?.addEventListener("click", () => {
    void saveProjectConfig().catch((error) => {
      state.settingsDraftStatus = "project config save failed";
      renderSettingsOverview();
      nodes.typedResultOutput.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    });
  });
  nodes.selectedReviewSelect.addEventListener("change", () => {
    void (async () => {
      state.selectedReviewId = nodes.selectedReviewSelect.value || undefined;
      renderReviewThread();
      await loadSelectedReviewContext();
    })().catch((error) => {
      nodes.typedResultOutput.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    });
  });
  nodes.addReviewCommentButton.addEventListener("click", () => {
    void addSelectedReviewComment().catch((error) => {
      nodes.typedResultOutput.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    });
  });
  nodes.approveReviewButton.addEventListener("click", () => {
    void decideSelectedReview("approved").catch((error) => {
      nodes.typedResultOutput.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    });
  });
  nodes.requestChangesButton.addEventListener("click", () => {
    void decideSelectedReview("changes_requested").catch((error) => {
      nodes.typedResultOutput.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    });
  });
  nodes.clearPhaseFilterButton.addEventListener("click", () => {
    state.selectedPhaseId = undefined;
    renderRunDetail();
  });
  nodes.compareRunAInput.addEventListener("input", () => {
    state.selectedRunComparison = undefined;
    renderComparePanel(undefined);
  });
  nodes.compareRunBInput.addEventListener("input", () => {
    state.selectedRunComparison = undefined;
    renderComparePanel(undefined);
  });
  nodes.compareRunsButton.addEventListener("click", () => {
    void loadRunComparison();
  });

  nodes.commandSelect.addEventListener("change", updateCommandPreview);
  nodes.commandRunIdInput.addEventListener("input", updateCommandPreview);
  nodes.commandStageNameInput.addEventListener("input", updateCommandPreview);
  nodes.commandStageIdInput.addEventListener("input", updateCommandPreview);
  nodes.commandStagePlanInput.addEventListener("input", updateCommandPreview);
  nodes.commandCompareRunIdInput.addEventListener("input", updateCommandPreview);
  nodes.commandModesInput.addEventListener("input", updateCommandPreview);
  nodes.commandConfigInput.addEventListener("input", updateCommandPreview);
  nodes.commandStopAfterEachStage.addEventListener("change", updateCommandPreview);
  nodes.commandAutoCommit.addEventListener("change", updateCommandPreview);
  nodes.commandCommitMessageInput.addEventListener("input", updateCommandPreview);
  nodes.commandInstructionInput.addEventListener("input", updateCommandPreview);
  nodes.commandReassessDownstream.addEventListener("change", updateCommandPreview);
  nodes.commandExecutionMode.addEventListener("change", updateCommandPreview);
  nodes.commandConfirmWrites.addEventListener("change", updateCommandPreview);

  nodes.executeCommandButton.addEventListener("click", () => {
    void executeGatewayCommand().catch((error) => {
      nodes.typedResultOutput.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
    });
  });
}

async function boot() {
  wireEvents();
  wireTabs();
  updateCommandPreview();
  renderComparePanel(undefined);
  await refreshApiHealth();
  await loadProjects();
  await loadSettingsData();
  await loadRuns();
  await loadStagePlans();
  await loadReviews();
  if (routeContext?.runId) {
    await selectRun(routeContext.runId);
  }
  showPage(routeContext?.page ?? "projects");
  await loadRecentCliEvents(routeContext?.runId ?? state.selectedRunId);
  startCliEventStream();
  renderApprovalQueue();
}

void boot().catch((error) => {
  nodes.typedResultOutput.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
});
