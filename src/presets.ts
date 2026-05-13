export const PIPELINE_PRESETS = ["plan", "build", "review", "fix-plan", "full-readonly"] as const;

export type PipelinePreset = (typeof PIPELINE_PRESETS)[number];

export interface ExecutionOptions {
  executePlanner: boolean;
  executeBuilder: boolean;
  executeReviewer: boolean;
  planFix: boolean;
  executeFix: boolean;
  runChecks: boolean;
}

const PRESET_OPTIONS: Record<PipelinePreset, ExecutionOptions> = {
  plan: {
    executePlanner: true,
    executeBuilder: false,
    executeReviewer: false,
    planFix: false,
    executeFix: false,
    runChecks: false
  },
  build: {
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: false,
    planFix: false,
    executeFix: false,
    runChecks: false
  },
  review: {
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: false,
    executeFix: false,
    runChecks: false
  },
  "fix-plan": {
    executePlanner: true,
    executeBuilder: false,
    executeReviewer: true,
    planFix: true,
    executeFix: false,
    runChecks: false
  },
  "full-readonly": {
    executePlanner: true,
    executeBuilder: true,
    executeReviewer: true,
    planFix: true,
    executeFix: true,
    runChecks: true
  }
};

export function resolvePipelinePreset(preset?: string): ExecutionOptions {
  if (!preset) {
    return {
      executePlanner: false,
      executeBuilder: false,
      executeReviewer: false,
      planFix: false,
      executeFix: false,
      runChecks: false
    };
  }
  if (!isPipelinePreset(preset)) {
    throw new Error(`Unknown preset "${preset}". Supported presets: ${PIPELINE_PRESETS.join(", ")}.`);
  }
  return { ...PRESET_OPTIONS[preset] };
}

function isPipelinePreset(value: string): value is PipelinePreset {
  return PIPELINE_PRESETS.some((preset) => preset === value);
}
