import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCommandPaletteQuery,
  backspaceCommandPaletteQuery,
  describeCommandPaletteSelection,
  filterCommandPaletteItems,
  formatCommandPaletteLine,
  getCommandPaletteItems
} from "../src/tui/command-palette.js";

test("getCommandPaletteItems returns enabled and disabled preview commands", () => {
  const items = getCommandPaletteItems();
  assert.ok(items.some((item) => item.id === "preview-action" && item.enabled));
  assert.ok(items.some((item) => item.id === "generate-report" && !item.enabled));
});

test("filterCommandPaletteItems filters by id label and description", () => {
  const items = getCommandPaletteItems();
  assert.deepEqual(filterCommandPaletteItems(items, "report").map((item) => item.id), ["generate-report"]);
  assert.deepEqual(filterCommandPaletteItems(items, "scope").map((item) => item.id), ["toggle-file-scope"]);
  assert.equal(filterCommandPaletteItems(items, "").length, items.length);
});

test("appendCommandPaletteQuery appends single character input only", () => {
  assert.equal(appendCommandPaletteQuery("rep", "o"), "repo");
  assert.equal(appendCommandPaletteQuery("rep", "enter"), "rep");
});

test("backspaceCommandPaletteQuery removes final character", () => {
  assert.equal(backspaceCommandPaletteQuery("repo"), "rep");
});

test("formatCommandPaletteLine includes status label", () => {
  assert.equal(
    formatCommandPaletteLine({ id: "sample", label: "Preview command", description: "Preview only.", enabled: false }),
    "disabled Preview command - Preview only."
  );
});

test("describeCommandPaletteSelection handles missing item", () => {
  assert.equal(describeCommandPaletteSelection(undefined), "No command selected.");
});

test("describeCommandPaletteSelection describes enabled command", () => {
  assert.equal(
    describeCommandPaletteSelection({ id: "sample", label: "Preview command", description: "Preview only.", enabled: true }),
    "Preview command: Preview command. Preview only."
  );
});

test("describeCommandPaletteSelection describes disabled command", () => {
  assert.equal(
    describeCommandPaletteSelection({ id: "sample", label: "Preview command", description: "Not ready.", enabled: false }),
    "Disabled command: Preview command. Not ready."
  );
});
