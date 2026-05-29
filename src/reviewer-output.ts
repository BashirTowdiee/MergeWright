export type ReviewerVerdict = "PASS" | "FAIL";

export interface ReviewerIssue {
  severity: "low" | "medium" | "high";
  summary: string;
  files: string[];
}

export type ReviewerAcceptanceCriterionStatus = "pass" | "fail" | "unknown";

export interface ReviewerAcceptanceCriterionResult {
  criterion: string;
  status: ReviewerAcceptanceCriterionStatus;
  evidence?: string;
}

export interface ReviewerDecision {
  verdict: ReviewerVerdict;
  blockingIssues: ReviewerIssue[];
  nonBlockingIssues: ReviewerIssue[];
  acceptanceCriteria?: ReviewerAcceptanceCriterionResult[];
}

const VERDICT_BLOCK_REGEX = /```json reviewer-verdict\s*\n([\s\S]*?)\n```/g;

export function parseReviewerOutput(markdown: string): ReviewerDecision {
  const matches = [...markdown.matchAll(VERDICT_BLOCK_REGEX)];

  if (matches.length === 0) {
    throw new Error('Reviewer output parse error: missing required fenced block "```json reviewer-verdict".');
  }
  if (matches.length > 1) {
    throw new Error('Reviewer output parse error: multiple "json reviewer-verdict" fenced blocks found; expected exactly one.');
  }

  const jsonContent = matches[0][1];
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Reviewer output parse error: malformed reviewer verdict JSON. ${msg}`);
  }

  return validateReviewerDecision(parsed);
}

function validateReviewerDecision(value: unknown): ReviewerDecision {
  if (!isRecord(value)) {
    throw new Error("Reviewer output parse error: reviewer verdict JSON must be an object.");
  }

  const verdict = value.verdict;
  if (verdict !== "PASS" && verdict !== "FAIL") {
    throw new Error('Reviewer output parse error: "verdict" must be "PASS" or "FAIL".');
  }

  if (!Array.isArray(value.blockingIssues)) {
    throw new Error('Reviewer output parse error: "blockingIssues" must be an array.');
  }
  if (!Array.isArray(value.nonBlockingIssues)) {
    throw new Error('Reviewer output parse error: "nonBlockingIssues" must be an array.');
  }

  const blockingIssues = value.blockingIssues.map((issue, index) => validateIssue(issue, `blockingIssues[${index}]`));
  const nonBlockingIssues = value.nonBlockingIssues.map((issue, index) =>
    validateIssue(issue, `nonBlockingIssues[${index}]`)
  );
  const acceptanceCriteria = validateAcceptanceCriteria(value.acceptanceCriteria);

  if (verdict === "FAIL" && blockingIssues.length === 0) {
    throw new Error('Reviewer output parse error: "FAIL" verdict requires at least one blocking issue.');
  }
  if (verdict === "PASS" && acceptanceCriteria?.some((item) => item.status !== "pass")) {
    throw new Error('Reviewer output parse error: "PASS" verdict requires all acceptanceCriteria statuses to be "pass".');
  }

  return {
    verdict,
    blockingIssues,
    nonBlockingIssues,
    ...(acceptanceCriteria ? { acceptanceCriteria } : {})
  };
}

function validateIssue(value: unknown, path: string): ReviewerIssue {
  if (!isRecord(value)) {
    throw new Error(`Reviewer output parse error: ${path} must be an object.`);
  }

  const { severity, summary, files } = value;

  if (severity !== "low" && severity !== "medium" && severity !== "high") {
    throw new Error(`Reviewer output parse error: ${path}.severity must be "low", "medium", or "high".`);
  }

  if (typeof summary !== "string" || summary.trim().length === 0) {
    throw new Error(`Reviewer output parse error: ${path}.summary must be a non-empty string.`);
  }

  if (!Array.isArray(files) || !files.every((file) => typeof file === "string")) {
    throw new Error(`Reviewer output parse error: ${path}.files must be an array of strings.`);
  }

  return {
    severity,
    summary: summary.trim(),
    files
  };
}

function validateAcceptanceCriteria(value: unknown): ReviewerAcceptanceCriterionResult[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error('Reviewer output parse error: "acceptanceCriteria" must be an array when provided.');
  }
  return value.map((entry, index) => validateAcceptanceCriterionResult(entry, `acceptanceCriteria[${index}]`));
}

function validateAcceptanceCriterionResult(value: unknown, path: string): ReviewerAcceptanceCriterionResult {
  if (!isRecord(value)) {
    throw new Error(`Reviewer output parse error: ${path} must be an object.`);
  }

  const criterion = value.criterion;
  const status = value.status;
  const evidence = value.evidence;

  if (typeof criterion !== "string" || criterion.trim().length === 0) {
    throw new Error(`Reviewer output parse error: ${path}.criterion must be a non-empty string.`);
  }
  if (status !== "pass" && status !== "fail" && status !== "unknown") {
    throw new Error(`Reviewer output parse error: ${path}.status must be "pass", "fail", or "unknown".`);
  }
  if (evidence !== undefined && (typeof evidence !== "string" || evidence.trim().length === 0)) {
    throw new Error(`Reviewer output parse error: ${path}.evidence must be a non-empty string when provided.`);
  }

  return {
    criterion: criterion.trim(),
    status,
    ...(typeof evidence === "string" ? { evidence: evidence.trim() } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
