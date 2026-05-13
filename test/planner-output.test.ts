import test from "node:test";
import assert from "node:assert/strict";
import { parsePlannerOutput } from "../src/planner-output.js";

test("valid BUILD extraction", () => {
  const parsed = parsePlannerOutput("## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nDo the thing");
  assert.equal(parsed.decision, "BUILD");
  assert.equal(parsed.finalBuilderPrompt, "Do the thing");
});

test("multiline prompt preserved", () => {
  const parsed = parsePlannerOutput(
    "## DECISION\n\nBUILD\n\n## FINAL BUILDER PROMPT\nLine one\n\n- bullet\nLine three"
  );

  assert.equal(parsed.finalBuilderPrompt, "Line one\n\n- bullet\nLine three");
});

test("builder prompt section before decision fails", () => {
  assert.throws(() => parsePlannerOutput("## FINAL BUILDER PROMPT\nabc\n\n## DECISION\nBUILD"), {
    message: 'Planner output parse error: heading order invalid; "## FINAL BUILDER PROMPT" appears before "## DECISION".'
  });
});

test("duplicate decision heading fails", () => {
  assert.throws(() => parsePlannerOutput("## DECISION\nBUILD\n\n## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nabc"), {
    message: 'Planner output parse error: duplicate heading "## DECISION".'
  });
});

test("duplicate final builder prompt heading fails", () => {
  assert.throws(
    () =>
      parsePlannerOutput("## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\nabc\n\n## FINAL BUILDER PROMPT\ndef"),
    {
      message: 'Planner output parse error: duplicate heading "## FINAL BUILDER PROMPT".'
    }
  );
});

test("extra non-empty content in decision section fails", () => {
  assert.throws(() => parsePlannerOutput("## DECISION\nBUILD\nunexpected\n## FINAL BUILDER PROMPT\nabc"), {
    message: "Planner output parse error: extra unexpected content in DECISION section."
  });
});

test("missing decision heading", () => {
  assert.throws(() => parsePlannerOutput("## FINAL BUILDER PROMPT\nabc"), {
    message: 'Planner output parse error: missing required heading "## DECISION".'
  });
});

test("unsupported decision", () => {
  assert.throws(() => parsePlannerOutput("## DECISION\nREVIEW\n\n## FINAL BUILDER PROMPT\nabc"), {
    message: 'Planner output parse error: unsupported decision "REVIEW"; Stage C supports only BUILD.'
  });
});

test("missing final builder prompt heading", () => {
  assert.throws(() => parsePlannerOutput("## DECISION\nBUILD\n"), {
    message: 'Planner output parse error: missing required heading "## FINAL BUILDER PROMPT".'
  });
});

test("empty final builder prompt", () => {
  assert.throws(() => parsePlannerOutput("## DECISION\nBUILD\n\n## FINAL BUILDER PROMPT\n\n  \n"), {
    message: "Planner output parse error: FINAL BUILDER PROMPT is empty."
  });
});
