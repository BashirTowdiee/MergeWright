import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStageContractScopeBlocker,
  buildStageContractScopeWarning,
  evaluateStageContractScope
} from "../src/reporting/stage-contract-scope.js";

test("evaluateStageContractScope supports exact path and missing contract", () => {
  const missing = evaluateStageContractScope({
    contract: null,
    changedFiles: ["src/a.ts"],
    untrackedFiles: []
  });
  assert.deepEqual(missing, { forbiddenMatches: [], outOfScopeMatches: [] });

  const exact = evaluateStageContractScope({
    contract: {
      objective: "x",
      allowedPaths: ["src/**"],
      forbiddenPaths: ["package-lock.json"],
      requiredCommands: [],
      requiredEvidence: [],
      acceptanceCriteria: [],
      reviewChecklist: []
    },
    changedFiles: ["package-lock.json"],
    untrackedFiles: []
  });
  assert.deepEqual(exact.forbiddenMatches, ["package-lock.json"]);
});

test("evaluateStageContractScope supports glob and nested path matching", () => {
  const evaluated = evaluateStageContractScope({
    contract: {
      objective: "x",
      allowedPaths: ["src/providers/**"],
      forbiddenPaths: ["**/*.secret"],
      requiredCommands: [],
      requiredEvidence: [],
      acceptanceCriteria: [],
      reviewChecklist: []
    },
    changedFiles: ["src/providers/adapter/index.ts", "src/credentials.secret"],
    untrackedFiles: []
  });
  assert.deepEqual(evaluated.forbiddenMatches, ["src/credentials.secret"]);
  assert.deepEqual(evaluated.outOfScopeMatches, ["src/credentials.secret"]);
});

test("evaluateStageContractScope evaluates deleted-like changed paths and warnings", () => {
  const evaluated = evaluateStageContractScope({
    contract: {
      objective: "x",
      allowedPaths: ["src/**"],
      forbiddenPaths: ["src/deleted.ts"],
      requiredCommands: [],
      requiredEvidence: [],
      acceptanceCriteria: [],
      reviewChecklist: []
    },
    changedFiles: ["src/deleted.ts"],
    untrackedFiles: []
  });

  assert.deepEqual(evaluated.forbiddenMatches, ["src/deleted.ts"]);
  assert.equal(buildStageContractScopeBlocker(evaluated.forbiddenMatches)?.includes("src/deleted.ts"), true);
  assert.equal(buildStageContractScopeWarning(evaluated.outOfScopeMatches), null);
});
