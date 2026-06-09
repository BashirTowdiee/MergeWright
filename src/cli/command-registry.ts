import type { CommandHandler } from "./command-context.js";
import { handleBackfillEvidenceCommand } from "./commands/backfill-evidence.command.js";
import { handleInitProjectCommand } from "./commands/init-project.command.js";
import { handleImportStagePlanCommand } from "./commands/import-stage-plan.command.js";
import { handleProbeOpenCodeCommand } from "./commands/probe-opencode.command.js";
import { handleRunContractCommand } from "./commands/run-contract.command.js";
import { handleCheckWriteSafetyCommand } from "./commands/check-write-safety.command.js";
import { handleRunCommand } from "./commands/run.command.js";
import { handleContinueRunCommand } from "./commands/continue-run.command.js";
import { handleListRunsCommand } from "./commands/list-runs.command.js";
import { handleShowRunCommand } from "./commands/show-run.command.js";
import { handleOpenRunCommand } from "./commands/open-run.command.js";
import { handleCompareRunsCommand } from "./commands/compare-runs.command.js";
import { handleProveCommand } from "./commands/prove.command.js";
import { handleReviewModesCommand } from "./commands/review-modes.command.js";
import { handleReportRunCommand } from "./commands/report-run.command.js";
import { handleTuiCommand } from "./commands/tui.command.js";
import { handleTuiSpikeCommand } from "./commands/tui-spike.command.js";
import { handleRunStageCommand } from "./commands/stage-plan/run-stage.command.js";
import { handleRunStagesCommand } from "./commands/stage-plan/run-stages.command.js";
import { handleContinueStagesCommand } from "./commands/stage-plan/continue-stages.command.js";
import { handleAcceptStageCommand } from "./commands/stage-plan/accept-stage.command.js";
import { handleFixStageCommand } from "./commands/stage-plan/fix-stage.command.js";
import { handleReassessStagePlanCommand } from "./commands/stage-plan/reassess-stage-plan.command.js";

export const commandHandlers = {
  "init-project": handleInitProjectCommand,
  "import-stage-plan": handleImportStagePlanCommand,
  "probe-opencode": handleProbeOpenCodeCommand,
  "run-contract": handleRunContractCommand,
  "check-write-safety": handleCheckWriteSafetyCommand,
  "backfill-evidence": handleBackfillEvidenceCommand,
  "run": handleRunCommand,
  "continue-run": handleContinueRunCommand,
  "list-runs": handleListRunsCommand,
  "show-run": handleShowRunCommand,
  "open-run": handleOpenRunCommand,
  "compare-runs": handleCompareRunsCommand,
  "prove": handleProveCommand,
  "review-modes": handleReviewModesCommand,
  "report-run": handleReportRunCommand,
  "tui": handleTuiCommand,
  "tui-spike": handleTuiSpikeCommand,
  "run-stage": handleRunStageCommand,
  "run-stages": handleRunStagesCommand,
  "continue-stages": handleContinueStagesCommand,
  "accept-stage": handleAcceptStageCommand,
  "fix-stage": handleFixStageCommand,
  "reassess-stage-plan": handleReassessStagePlanCommand
} satisfies Record<string, CommandHandler>;
