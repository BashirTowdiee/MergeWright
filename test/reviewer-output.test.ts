import test from "node:test";
import assert from "node:assert/strict";
import { parseReviewerOutput } from "../src/reviewer-output.js";

function wrapVerdict(json: string): string {
  return `Header\n\n\
\`\`\`json reviewer-verdict
${json}
\`\`\`\n\nFooter`;
}

test("valid PASS", () => {
  const parsed = parseReviewerOutput(
    wrapVerdict(`{
  "verdict": "PASS",
  "blockingIssues": [],
  "nonBlockingIssues": []
}`)
  );

  assert.deepEqual(parsed, {
    verdict: "PASS",
    blockingIssues: [],
    nonBlockingIssues: []
  });
});

test("valid FAIL", () => {
  const parsed = parseReviewerOutput(
    wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [
    {
      "severity": "high",
      "summary": "Request logging includes request bodies by default",
      "files": ["src/app.ts"]
    }
  ],
  "nonBlockingIssues": []
}`)
  );

  assert.equal(parsed.verdict, "FAIL");
  assert.equal(parsed.blockingIssues.length, 1);
  assert.equal(parsed.blockingIssues[0].severity, "high");
});

test("valid PASS with acceptance criteria mapping", () => {
  const parsed = parseReviewerOutput(
    wrapVerdict(`{
  "verdict": "PASS",
  "blockingIssues": [],
  "nonBlockingIssues": [],
  "acceptanceCriteria": [
    {
      "criterion": "CLI help shows mergewright",
      "status": "pass",
      "evidence": "Verified with npm run mergewright -- --help"
    }
  ]
}`)
  );

  assert.deepEqual(parsed.acceptanceCriteria, [
    {
      criterion: "CLI help shows mergewright",
      status: "pass",
      evidence: "Verified with npm run mergewright -- --help"
    }
  ]);
});

test("valid FAIL with reviewer verdict v2 fields", () => {
  const parsed = parseReviewerOutput(
    wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [
    { "severity": "high", "summary": "critical", "files": ["src/a.ts"] }
  ],
  "nonBlockingIssues": [],
  "evidenceChecked": [
    { "artefact": "write-audit/builder/summary.json", "status": "verified", "note": "contains changed files" },
    { "artefact": "reviewer-output-last-message.md", "status": "inconclusive" }
  ],
  "acceptanceCriteria": [
    { "criterion": "criterion-a", "status": "fail", "evidence": "missing route test" }
  ],
  "testsObserved": [
    { "test": "npm test", "outcome": "fail", "evidence": "1 failing test" },
    { "test": "npm run build", "outcome": "pass" }
  ],
  "riskLevel": "high",
  "recommendedFixPrompt": "Add tests for route auth and rerun npm test."
}`)
  );

  assert.equal(parsed.verdict, "FAIL");
  assert.equal(parsed.evidenceChecked?.length, 2);
  assert.equal(parsed.testsObserved?.length, 2);
  assert.equal(parsed.riskLevel, "high");
  assert.equal(parsed.recommendedFixPrompt, "Add tests for route auth and rerun npm test.");
});

test("missing reviewer verdict block", () => {
  assert.throws(() => parseReviewerOutput("no block"), {
    message: 'Reviewer output parse error: missing required fenced block "```json reviewer-verdict".'
  });
});

test("malformed JSON", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        "```json reviewer-verdict\n{\n  \"verdict\": \"PASS\",\n  \"blockingIssues\": [],\n\n```"
      ),
    {
      message: /Reviewer output parse error: malformed reviewer verdict JSON\./
    }
  );
});

test("invalid verdict", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "MAYBE",
  "blockingIssues": [],
  "nonBlockingIssues": []
}`)
      ),
    {
      message: 'Reviewer output parse error: "verdict" must be "PASS" or "FAIL".'
    }
  );
});

test("invalid severity", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [
    {
      "severity": "critical",
      "summary": "x",
      "files": ["a.ts"]
    }
  ],
  "nonBlockingIssues": []
}`)
      ),
    {
      message: 'Reviewer output parse error: blockingIssues[0].severity must be "low", "medium", or "high".'
    }
  );
});

test("missing blockingIssues", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "PASS",
  "nonBlockingIssues": []
}`)
      ),
    {
      message: 'Reviewer output parse error: "blockingIssues" must be an array.'
    }
  );
});

test("missing nonBlockingIssues", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "PASS",
  "blockingIssues": []
}`)
      ),
    {
      message: 'Reviewer output parse error: "nonBlockingIssues" must be an array.'
    }
  );
});

test("empty issue summary", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [
    {
      "severity": "high",
      "summary": "   ",
      "files": ["a.ts"]
    }
  ],
  "nonBlockingIssues": []
}`)
      ),
    {
      message: "Reviewer output parse error: blockingIssues[0].summary must be a non-empty string."
    }
  );
});

test("files is not an array", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [
    {
      "severity": "high",
      "summary": "x",
      "files": "src/a.ts"
    }
  ],
  "nonBlockingIssues": []
}`)
      ),
    {
      message: "Reviewer output parse error: blockingIssues[0].files must be an array of strings."
    }
  );
});

test("multiple reviewer verdict blocks", () => {
  const text = `${wrapVerdict('{"verdict":"PASS","blockingIssues":[],"nonBlockingIssues":[]}')}\n\
\`\`\`json reviewer-verdict
{"verdict":"PASS","blockingIssues":[],"nonBlockingIssues":[]}
\`\`\``;

  assert.throws(() => parseReviewerOutput(text), {
    message:
      'Reviewer output parse error: multiple "json reviewer-verdict" fenced blocks found; expected exactly one.'
  });
});

test("non-verdict json block is ignored when single reviewer-verdict block exists", () => {
  const text = `\`\`\`json
{"note":"regular json block"}
\`\`\`

\`\`\`json reviewer-verdict
{
  "verdict": "PASS",
  "blockingIssues": [],
  "nonBlockingIssues": []
}
\`\`\``;

  const parsed = parseReviewerOutput(text);
  assert.deepEqual(parsed, {
    verdict: "PASS",
    blockingIssues: [],
    nonBlockingIssues: []
  });
});

test("invalid non-object issue entry fails", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [null],
  "nonBlockingIssues": []
}`)
      ),
    {
      message: "Reviewer output parse error: blockingIssues[0] must be an object."
    }
  );
});

test("acceptanceCriteria must be an array when provided", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "PASS",
  "blockingIssues": [],
  "nonBlockingIssues": [],
  "acceptanceCriteria": "bad"
}`)
      ),
    {
      message: 'Reviewer output parse error: "acceptanceCriteria" must be an array when provided.'
    }
  );
});

test("PASS verdict rejects fail or unknown acceptance criteria statuses", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "PASS",
  "blockingIssues": [],
  "nonBlockingIssues": [],
  "acceptanceCriteria": [
    { "criterion": "A", "status": "unknown" }
  ]
}`)
      ),
    {
      message: 'Reviewer output parse error: "PASS" verdict requires all acceptanceCriteria statuses to be "pass".'
    }
  );
});

test("evidenceChecked must be an array when provided", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [{"severity":"high","summary":"x","files":["a.ts"]}],
  "nonBlockingIssues": [],
  "evidenceChecked": "bad"
}`)
      ),
    {
      message: 'Reviewer output parse error: "evidenceChecked" must be an array when provided.'
    }
  );
});

test("testsObserved entry rejects unsupported outcome", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [{"severity":"high","summary":"x","files":["a.ts"]}],
  "nonBlockingIssues": [],
  "testsObserved": [{"test":"npm test","outcome":"flaky"}]
}`)
      ),
    {
      message: 'Reviewer output parse error: testsObserved[0].outcome must be "pass", "fail", "not_run", or "unknown".'
    }
  );
});

test("riskLevel rejects unsupported value", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [{"severity":"high","summary":"x","files":["a.ts"]}],
  "nonBlockingIssues": [],
  "riskLevel": "critical"
}`)
      ),
    {
      message: 'Reviewer output parse error: "riskLevel" must be "low", "medium", or "high" when provided.'
    }
  );
});

test("recommendedFixPrompt must be non-empty when provided", () => {
  assert.throws(
    () =>
      parseReviewerOutput(
        wrapVerdict(`{
  "verdict": "FAIL",
  "blockingIssues": [{"severity":"high","summary":"x","files":["a.ts"]}],
  "nonBlockingIssues": [],
  "recommendedFixPrompt": "   "
}`)
      ),
    {
      message: 'Reviewer output parse error: "recommendedFixPrompt" must be a non-empty string when provided.'
    }
  );
});
