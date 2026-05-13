import test from "node:test";
import assert from "node:assert/strict";
import { parseReviewToFixOutput } from "../src/review-to-fix-output.js";

test("valid PROCEED parses with rationale", () => {
  const parsed = parseReviewToFixOutput("## DECISION\nPROCEED\n\n## RATIONALE\nLooks safe to proceed.");
  assert.equal(parsed.decision, "PROCEED");
  assert.equal(parsed.rationale, "Looks safe to proceed.");
  assert.equal(parsed.finalFixPrompt, undefined);
});

test("valid FIX_REQUIRED parses with rationale and multiline fix prompt", () => {
  const parsed = parseReviewToFixOutput(
    "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nDeterministic bug remains.\n\n## FINAL FIX PROMPT\nLine one\n\n- bullet\nLine three"
  );
  assert.equal(parsed.decision, "FIX_REQUIRED");
  assert.equal(parsed.rationale, "Deterministic bug remains.");
  assert.equal(parsed.finalFixPrompt, "Line one\n\n- bullet\nLine three");
});

test("missing DECISION fails", () => {
  assert.throws(() => parseReviewToFixOutput("## RATIONALE\nabc"), {
    message: 'Review-to-fix output parse error: missing required heading "## DECISION".'
  });
});

test("unsupported decision fails", () => {
  assert.throws(() => parseReviewToFixOutput("## DECISION\nMAYBE\n\n## RATIONALE\nabc"), {
    message: 'Review-to-fix output parse error: unsupported decision "MAYBE".'
  });
});

test("missing RATIONALE fails", () => {
  assert.throws(() => parseReviewToFixOutput("## DECISION\nPROCEED"), {
    message: 'Review-to-fix output parse error: missing required heading "## RATIONALE".'
  });
});

test("empty rationale fails", () => {
  assert.throws(() => parseReviewToFixOutput("## DECISION\nPROCEED\n\n## RATIONALE\n\n  \n"), {
    message: "Review-to-fix output parse error: RATIONALE is empty."
  });
});

test("FIX_REQUIRED without FINAL FIX PROMPT fails", () => {
  assert.throws(() => parseReviewToFixOutput("## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nabc"), {
    message: 'Review-to-fix output parse error: missing required heading "## FINAL FIX PROMPT" for FIX_REQUIRED decision.'
  });
});

test("FIX_REQUIRED with empty FINAL FIX PROMPT fails", () => {
  assert.throws(
    () => parseReviewToFixOutput("## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nabc\n\n## FINAL FIX PROMPT\n\n \n"),
    {
      message: "Review-to-fix output parse error: FINAL FIX PROMPT is empty for FIX_REQUIRED decision."
    }
  );
});

test("PROCEED with non-empty FINAL FIX PROMPT fails", () => {
  assert.throws(
    () => parseReviewToFixOutput("## DECISION\nPROCEED\n\n## RATIONALE\nabc\n\n## FINAL FIX PROMPT\nDo work"),
    {
      message: "Review-to-fix output parse error: FINAL FIX PROMPT must be empty or omitted when DECISION is PROCEED."
    }
  );
});

test("duplicate headings fail", () => {
  assert.throws(() => parseReviewToFixOutput("## DECISION\nPROCEED\n\n## DECISION\nPROCEED\n\n## RATIONALE\nabc"), {
    message: 'Review-to-fix output parse error: duplicate heading "## DECISION".'
  });
});

test("duplicate RATIONALE fails", () => {
  assert.throws(
    () => parseReviewToFixOutput("## DECISION\nPROCEED\n\n## RATIONALE\nabc\n\n## RATIONALE\ndef"),
    {
      message: 'Review-to-fix output parse error: duplicate heading "## RATIONALE".'
    }
  );
});

test("duplicate FINAL FIX PROMPT fails", () => {
  assert.throws(
    () =>
      parseReviewToFixOutput(
        "## DECISION\nFIX_REQUIRED\n\n## RATIONALE\nabc\n\n## FINAL FIX PROMPT\nfix one\n\n## FINAL FIX PROMPT\nfix two"
      ),
    {
      message: 'Review-to-fix output parse error: duplicate heading "## FINAL FIX PROMPT".'
    }
  );
});

test("invalid heading order fails", () => {
  assert.throws(() => parseReviewToFixOutput("## RATIONALE\nabc\n\n## DECISION\nPROCEED"), {
    message: 'Review-to-fix output parse error: heading order invalid; "## RATIONALE" appears before "## DECISION".'
  });
});

test("FINAL FIX PROMPT before RATIONALE fails", () => {
  assert.throws(
    () => parseReviewToFixOutput("## DECISION\nFIX_REQUIRED\n\n## FINAL FIX PROMPT\nfix\n\n## RATIONALE\nabc"),
    {
      message: 'Review-to-fix output parse error: heading order invalid; "## FINAL FIX PROMPT" appears before "## RATIONALE".'
    }
  );
});

test("extra non-empty content after DECISION token fails", () => {
  assert.throws(() => parseReviewToFixOutput("## DECISION\nPROCEED\nextra\n\n## RATIONALE\nabc"), {
    message: "Review-to-fix output parse error: extra unexpected content in DECISION section."
  });
});
