import { assertBoolean, assertStringArray } from "../validation.js";

function assertOptionalBooleanWithDefault(value: unknown, field: string, defaultValue: boolean): boolean {
  if (value == null) {
    return defaultValue;
  }
  return assertBoolean(value, field);
}

function assertOptionalStringArrayWithDefault(value: unknown, field: string, defaultValue: string[]): string[] {
  if (value == null) {
    return [...defaultValue];
  }
  const parsed = assertStringArray(value, field);
  for (let i = 0; i < parsed.length; i += 1) {
    if (!parsed[i].trim()) {
      throw new Error(`Invalid config: ${field}[${i}] must be a non-empty string`);
    }
  }
  return parsed;
}

export function parseWriteSafety(raw: Record<string, unknown>) {
  const autoCommit = assertOptionalBooleanWithDefault(raw.autoCommit, "writeSafety.autoCommit", false);
  if (autoCommit) {
    throw new Error("Invalid config: writeSafety.autoCommit must be false");
  }
  const autoPush = assertOptionalBooleanWithDefault(raw.autoPush, "writeSafety.autoPush", false);
  if (autoPush) {
    throw new Error("Invalid config: writeSafety.autoPush must be false");
  }

  return {
    enabled: assertOptionalBooleanWithDefault(raw.enabled, "writeSafety.enabled", false),
    allowedBranches: assertOptionalStringArrayWithDefault(raw.allowedBranches, "writeSafety.allowedBranches", [
      "feature/*",
      "bugfix/*",
      "chore/*"
    ]),
    blockedPaths: assertOptionalStringArrayWithDefault(raw.blockedPaths, "writeSafety.blockedPaths", [
      ".git/",
      ".env",
      ".env.*",
      "*.p12",
      "*.mobileprovision",
      "fastlane/",
      "DistributionKit/"
    ]),
    requireCleanWorkingTree: assertOptionalBooleanWithDefault(
      raw.requireCleanWorkingTree,
      "writeSafety.requireCleanWorkingTree",
      true
    ),
    requireExplicitAllowWrites: assertOptionalBooleanWithDefault(
      raw.requireExplicitAllowWrites,
      "writeSafety.requireExplicitAllowWrites",
      true
    ),
    captureDiffBeforeAfter: assertOptionalBooleanWithDefault(
      raw.captureDiffBeforeAfter,
      "writeSafety.captureDiffBeforeAfter",
      true
    ),
    requireReviewAfterWrites: assertOptionalBooleanWithDefault(
      raw.requireReviewAfterWrites,
      "writeSafety.requireReviewAfterWrites",
      true
    ),
    autoCommit: false as const,
    autoPush: false as const
  };
}
