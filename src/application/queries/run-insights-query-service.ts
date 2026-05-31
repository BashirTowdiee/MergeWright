import { readEvidenceManifestIfExists } from "../../evidence/evidence-store.js";
import type { EvidenceManifest } from "../../evidence/evidence-manifest.js";
import type { ReviewFinding, RunDetail } from "../read-models/run-read-model.js";
import type { RunEvidenceItem, RunEvidenceView, RunReadinessView, RunReviewView } from "../read-models/run-insights-read-model.js";
import type { RunQueryService } from "./run-query-service.js";

export interface RunInsightsQueryService {
  getRunReadiness(runId: string): Promise<RunReadinessView | null>;
  getRunReview(runId: string): Promise<RunReviewView | null>;
  getRunEvidence(runId: string): Promise<RunEvidenceView | null>;
}

export interface DefaultRunInsightsQueryServiceOptions {
  runQueryService: RunQueryService;
}

export class DefaultRunInsightsQueryService implements RunInsightsQueryService {
  private readonly runQueryService: RunQueryService;

  constructor(options: DefaultRunInsightsQueryServiceOptions) {
    this.runQueryService = options.runQueryService;
  }

  async getRunReadiness(runId: string): Promise<RunReadinessView | null> {
    const run = await this.runQueryService.getRun({ runId });
    if (!run) {
      return null;
    }

    const readiness = run.readiness ?? {
      source: "fallback" as const,
      status: "unknown" as const,
      missingEvidenceWarnings: ["No readiness snapshot available for this run."]
    };
    const nextAction = inferNextAction(run);

    return {
      runId: run.id,
      ready: readiness.status === "READY",
      status: readiness.status,
      score: readiness.score,
      risk: readiness.risk,
      checksState: readiness.checksState,
      reviewerVerdict: readiness.reviewerVerdict,
      missingEvidenceWarnings: readiness.missingEvidenceWarnings ?? [],
      blockedReason: run.blockedReason,
      nextAction
    };
  }

  async getRunReview(runId: string): Promise<RunReviewView | null> {
    const run = await this.runQueryService.getRun({ runId });
    if (!run) {
      return null;
    }

    const manifest = await readEvidenceManifestIfExists(run.runDir);
    const [blockingFindings, nonBlockingFindings] = partitionFindings(run.reviewerFindings);
    const reviewerVerdict = run.readiness?.reviewerVerdict ?? "UNKNOWN";

    return {
      runId: run.id,
      verdict: mapReviewVerdict(reviewerVerdict, blockingFindings.length),
      blockingFindings,
      nonBlockingFindings,
      recommendedFixPrompt: manifest?.reviewer?.recommendedFixPrompt,
      testsObservedCount: manifest?.reviewer?.testsObserved?.length,
      acceptanceCriteriaCount: manifest?.acceptance?.criteria?.length
    };
  }

  async getRunEvidence(runId: string): Promise<RunEvidenceView | null> {
    const run = await this.runQueryService.getRun({ runId });
    if (!run) {
      return null;
    }

    const manifest = await readEvidenceManifestIfExists(run.runDir);
    const items = manifest ? buildEvidenceItems(manifest) : buildMissingManifestItems();
    const blockerCount = items.filter((item) => item.blocking && item.status !== "pass").length;
    const warningCount = manifest?.readiness?.warnings?.length ?? 0;

    return {
      runId: run.id,
      available: manifest !== null,
      status: manifest?.status ?? "missing",
      blockerCount,
      warningCount,
      items
    };
  }
}

function inferNextAction(run: RunDetail): RunReadinessView["nextAction"] {
  if (run.readiness?.status === "READY") {
    return "ready-to-merge";
  }

  const enabled = (run.safeActions ?? []).find((action) => action.enabled);
  return enabled ? enabled.id : "inspect-blockers";
}

function partitionFindings(findings: readonly ReviewFinding[]): [ReviewFinding[], ReviewFinding[]] {
  const blocking: ReviewFinding[] = [];
  const nonBlocking: ReviewFinding[] = [];

  for (const finding of findings) {
    if (finding.severity === "critical" || finding.severity === "high") {
      blocking.push(finding);
    } else {
      nonBlocking.push(finding);
    }
  }

  return [blocking, nonBlocking];
}

function mapReviewVerdict(reviewerVerdict: string, blockingCount: number): RunReviewView["verdict"] {
  if (reviewerVerdict === "PASS") {
    return "PASS";
  }
  if (reviewerVerdict === "FAIL") {
    return "FAIL";
  }
  if (blockingCount > 0) {
    return "FAIL";
  }
  return "UNKNOWN";
}

function buildEvidenceItems(manifest: EvidenceManifest): RunEvidenceItem[] {
  const changedCount = manifest.git.changedFiles.length + manifest.git.untrackedFiles.length;
  const checksStatus = manifest.checks?.status;
  const reviewerVerdict = manifest.reviewer?.verdict;
  const acceptanceStatus = manifest.acceptance?.status;
  const writeSafetyStatus = manifest.writeSafety?.status;
  const postWriteReviewStatus = manifest.postWriteReview?.status;

  return [
    {
      id: "manifest",
      label: "Evidence manifest",
      status: "pass",
      blocking: true,
      note: `status=${manifest.status}`,
      sourcePath: "evidence.json"
    },
    {
      id: "git-diff",
      label: "Changed files evidence",
      status: changedCount > 0 ? "pass" : "missing",
      blocking: true,
      note: `changed=${changedCount}`
    },
    {
      id: "checks",
      label: "Checks evidence",
      status: checksStatus === "passed" ? "pass" : checksStatus === "failed" ? "fail" : checksStatus ? "unknown" : "missing",
      blocking: true,
      note: checksStatus ? `status=${checksStatus}` : "checks summary missing"
    },
    {
      id: "reviewer",
      label: "Reviewer verdict evidence",
      status: reviewerVerdict === "PASS" ? "pass" : reviewerVerdict === "FAIL" ? "fail" : reviewerVerdict ? "unknown" : "missing",
      blocking: true,
      note: reviewerVerdict ? `verdict=${reviewerVerdict}` : "reviewer verdict missing"
    },
    {
      id: "acceptance",
      label: "Acceptance criteria evidence",
      status:
        acceptanceStatus === "pass"
          ? "pass"
          : acceptanceStatus === "fail"
            ? "fail"
            : acceptanceStatus
              ? "unknown"
              : "missing",
      blocking: true,
      note: acceptanceStatus ? `status=${acceptanceStatus}` : "acceptance mapping missing"
    },
    {
      id: "write-safety",
      label: "Write safety evidence",
      status:
        writeSafetyStatus === "passed"
          ? "pass"
          : writeSafetyStatus === "failed"
            ? "fail"
            : writeSafetyStatus
              ? "unknown"
              : "missing",
      blocking: false,
      note: writeSafetyStatus ? `status=${writeSafetyStatus}` : "write safety summary missing",
      sourcePath: manifest.writeSafety?.artefactPath
    },
    {
      id: "post-write-review",
      label: "Post-write review evidence",
      status:
        postWriteReviewStatus === "passed"
          ? "pass"
          : postWriteReviewStatus === "failed"
            ? "fail"
            : postWriteReviewStatus
              ? "unknown"
              : "missing",
      blocking: false,
      note: postWriteReviewStatus ? `status=${postWriteReviewStatus}` : "post-write review summary missing",
      sourcePath: manifest.postWriteReview?.artefactPath
    }
  ];
}

function buildMissingManifestItems(): RunEvidenceItem[] {
  return [
    {
      id: "manifest",
      label: "Evidence manifest",
      status: "missing",
      blocking: true,
      note: "evidence.json not found"
    }
  ];
}
