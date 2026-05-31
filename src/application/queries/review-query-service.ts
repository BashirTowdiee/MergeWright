import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReviewDecisionView, ReviewItemView } from "../read-models/review-read-model.js";
import type { ReviewFinding, RunDetail } from "../read-models/run-read-model.js";
import type { RunQueryService } from "./run-query-service.js";

interface StoredReviewStateFile {
  readonly version: 1;
  readonly reviews: Record<string, StoredReviewEntry>;
}

interface StoredReviewEntry {
  readonly comments: StoredReviewComment[];
  readonly decision?: StoredReviewDecision;
}

interface StoredReviewComment {
  readonly id: string;
  readonly author: string;
  readonly message: string;
  readonly createdAt: string;
}

interface StoredReviewDecision {
  readonly decision: "approved" | "changes_requested";
  readonly author: string;
  readonly note?: string;
  readonly decidedAt: string;
}

export interface AddReviewCommentInput {
  readonly author?: string;
  readonly message: string;
}

export interface DecideReviewInput {
  readonly decision: "approved" | "changes_requested";
  readonly author?: string;
  readonly note?: string;
}

export interface ReviewQueryService {
  listReviews(): Promise<ReviewItemView[]>;
  addComment(reviewId: string, input: AddReviewCommentInput): Promise<ReviewItemView | null>;
  decideReview(reviewId: string, input: DecideReviewInput): Promise<ReviewItemView | null>;
}

export interface DefaultReviewQueryServiceOptions {
  readonly runQueryService: RunQueryService;
  readonly runsRoot: string;
}

export class DefaultReviewQueryService implements ReviewQueryService {
  private readonly runQueryService: RunQueryService;
  private readonly statePath: string;

  constructor(options: DefaultReviewQueryServiceOptions) {
    this.runQueryService = options.runQueryService;
    this.statePath = path.resolve(options.runsRoot, "reviews", "review-state.json");
  }

  async listReviews(): Promise<ReviewItemView[]> {
    const [runs, state] = await Promise.all([this.runQueryService.listRuns(), this.readState()]);

    const details = await Promise.all(runs.map(async (run) => this.runQueryService.getRun({ runId: run.id })));
    const reviews = details
      .filter((run): run is RunDetail => run !== null)
      .map((run) => this.toReviewItem(run, state.reviews[run.id]))
      .filter((review) => shouldIncludeReview(review, state.reviews[review.runId]));

    reviews.sort(compareReviews);
    return reviews;
  }

  async addComment(reviewId: string, input: AddReviewCommentInput): Promise<ReviewItemView | null> {
    const runId = reviewId.trim();
    const message = input.message.trim();
    if (!runId || !message) {
      return null;
    }

    const run = await this.runQueryService.getRun({ runId });
    if (!run) {
      return null;
    }

    const state = await this.readState();
    const existing = state.reviews[runId] ?? { comments: [] };
    const now = new Date().toISOString();
    const comment: StoredReviewComment = {
      id: `comment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      author: (input.author?.trim() || "operator").slice(0, 120),
      message: message.slice(0, 4000),
      createdAt: now
    };

    state.reviews[runId] = {
      comments: [...existing.comments, comment],
      decision: existing.decision
    };
    await this.writeState(state);

    return this.toReviewItem(run, state.reviews[runId]);
  }

  async decideReview(reviewId: string, input: DecideReviewInput): Promise<ReviewItemView | null> {
    const runId = reviewId.trim();
    if (!runId) {
      return null;
    }

    const run = await this.runQueryService.getRun({ runId });
    if (!run) {
      return null;
    }

    const state = await this.readState();
    const existing = state.reviews[runId] ?? { comments: [] };
    const decision: StoredReviewDecision = {
      decision: input.decision,
      author: (input.author?.trim() || "operator").slice(0, 120),
      note: normalizeOptionalText(input.note, 2000),
      decidedAt: new Date().toISOString()
    };

    state.reviews[runId] = {
      comments: existing.comments,
      decision
    };
    await this.writeState(state);

    return this.toReviewItem(run, state.reviews[runId]);
  }

  private async readState(): Promise<StoredReviewStateFile> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoredReviewStateFile>;
      if (parsed?.version === 1 && parsed.reviews && typeof parsed.reviews === "object") {
        return {
          version: 1,
          reviews: sanitizeReviews(parsed.reviews as Record<string, unknown>)
        };
      }
    } catch {
      // fall through to default
    }
    return { version: 1, reviews: {} };
  }

  private async writeState(state: StoredReviewStateFile): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(state, null, 2), "utf8");
  }

  private toReviewItem(run: RunDetail, stored: StoredReviewEntry | undefined): ReviewItemView {
    const comments = stored?.comments ?? [];
    const blockers = collectBlockers(run);
    const decision = stored?.decision ? toDecisionView(stored.decision) : undefined;
    const readinessStatus = run.readiness?.status ?? "unknown";
    const reviewerVerdict = run.readiness?.reviewerVerdict ?? "UNKNOWN";
    const checksState = run.readiness?.checksState ?? "unknown";

    return {
      id: run.id,
      runId: run.id,
      title: run.title || run.id,
      status: deriveReviewStatus({ readinessStatus, decision }),
      readinessStatus,
      reviewerVerdict,
      checksState,
      blockerCount: blockers.length,
      blockers,
      commentCount: comments.length,
      updatedAt: computeUpdatedAt(comments, decision),
      comments,
      decision
    };
  }
}

function compareReviews(a: ReviewItemView, b: ReviewItemView): number {
  const priority = (review: ReviewItemView): number => {
    if (review.status === "pending") return 0;
    if (review.status === "changes_requested") return 1;
    if (review.status === "ready") return 2;
    return 3;
  };

  const priorityDelta = priority(a) - priority(b);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return b.updatedAt.localeCompare(a.updatedAt);
}

function deriveReviewStatus(input: {
  readinessStatus: ReviewItemView["readinessStatus"];
  decision?: ReviewDecisionView;
}): ReviewItemView["status"] {
  if (input.decision?.decision === "approved") {
    return "approved";
  }
  if (input.decision?.decision === "changes_requested") {
    return "changes_requested";
  }
  if (input.readinessStatus === "READY") {
    return "ready";
  }
  return "pending";
}

function collectBlockers(run: RunDetail): string[] {
  const blockers: string[] = [];
  if (run.blockedReason?.trim()) {
    blockers.push(run.blockedReason.trim());
  }

  for (const finding of run.reviewerFindings) {
    if (isBlockingSeverity(finding)) {
      blockers.push(finding.message.trim());
    }
  }

  return Array.from(new Set(blockers.filter((value) => value.length > 0)));
}

function isBlockingSeverity(finding: ReviewFinding): boolean {
  return finding.severity === "critical" || finding.severity === "high";
}

function computeUpdatedAt(comments: readonly StoredReviewComment[], decision?: ReviewDecisionView): string {
  const stamps = [
    ...comments.map((comment) => comment.createdAt),
    decision?.decidedAt
  ].filter((value): value is string => Boolean(value));

  if (stamps.length === 0) {
    return new Date().toISOString();
  }

  stamps.sort((a, b) => b.localeCompare(a));
  return stamps[0];
}

function normalizeOptionalText(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.slice(0, maxLength);
}

function shouldIncludeReview(review: ReviewItemView, stored: StoredReviewEntry | undefined): boolean {
  if (review.status === "pending" || review.status === "changes_requested") {
    return true;
  }
  if ((stored?.comments.length ?? 0) > 0) {
    return true;
  }
  return stored?.decision !== undefined;
}

function toDecisionView(input: StoredReviewDecision): ReviewDecisionView {
  return {
    decision: input.decision,
    author: input.author,
    note: input.note,
    decidedAt: input.decidedAt
  };
}

function sanitizeReviews(input: Record<string, unknown>): Record<string, StoredReviewEntry> {
  const result: Record<string, StoredReviewEntry> = {};

  for (const [runId, rawEntry] of Object.entries(input)) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }
    const entry = rawEntry as { comments?: unknown; decision?: unknown };
    const comments = Array.isArray(entry.comments)
      ? entry.comments
          .filter((item): item is StoredReviewComment => {
            if (!item || typeof item !== "object") {
              return false;
            }
            const comment = item as Partial<StoredReviewComment>;
            return (
              typeof comment.id === "string" &&
              typeof comment.author === "string" &&
              typeof comment.message === "string" &&
              typeof comment.createdAt === "string"
            );
          })
          .map((comment) => ({
            id: comment.id,
            author: comment.author,
            message: comment.message,
            createdAt: comment.createdAt
          }))
      : [];

    const decision = sanitizeDecision(entry.decision);
    result[runId] = decision ? { comments, decision } : { comments };
  }

  return result;
}

function sanitizeDecision(input: unknown): StoredReviewDecision | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const candidate = input as Partial<StoredReviewDecision>;
  if (
    (candidate.decision !== "approved" && candidate.decision !== "changes_requested") ||
    typeof candidate.author !== "string" ||
    typeof candidate.decidedAt !== "string"
  ) {
    return undefined;
  }
  return {
    decision: candidate.decision,
    author: candidate.author,
    note: typeof candidate.note === "string" ? candidate.note : undefined,
    decidedAt: candidate.decidedAt
  };
}
