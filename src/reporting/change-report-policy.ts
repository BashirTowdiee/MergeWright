import type { ChangeReportPolicy } from "./change-report-types.js";

export const DEFAULT_CHANGE_REPORT_POLICY: ChangeReportPolicy = {
  riskRules: {
    highRiskPaths: [
      "auth/",
      "security/",
      "payment",
      "billing/",
      "database/",
      "migration",
      "terraform/",
      ".github/workflows/",
      "package-lock.json",
      "pnpm-lock.yaml",
      "pnpm-lock.yml",
      "yarn.lock",
      "bun.lockb",
      "go.sum",
      "Cargo.lock",
      "package.json",
      "pyproject.toml",
      "requirements",
      "poetry.lock",
      "Pipfile",
      "Gemfile",
      "pom.xml",
      "build.gradle",
      "gradle.properties",
      ".env",
      "config."
    ],
    mediumRiskPaths: ["src/", "route", "server/", "middleware/", "schema/", "logger", "test/", "tests/", ".test.", ".spec."],
    lowRiskPaths: [".md", "docs/", "README", "CHANGELOG"]
  },
  scopeDrift: {
    enabled: true,
    allowUnlistedTestFiles: false,
    allowUnlistedDocsFiles: false
  },
  readiness: {
    readyMinimumScore: 85,
    needsReviewMinimumScore: 60,
    penalties: {
      failedRun: 40,
      reviewerFail: 35,
      checksFailed: 30,
      checksSkippedWithSourceChanges: 20,
      postWriteReviewPendingOrFailed: 20,
      highRiskFiles: 15,
      mediumRiskFiles: 10,
      scopeDriftWarning: 10,
      nonBlockingReviewerIssue: 5
    }
  }
};
