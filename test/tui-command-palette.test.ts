import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCommandPaletteQuery,
  backspaceCommandPaletteQuery,
  describeCommandPaletteSelection,
  filterCommandPaletteItems,
  formatCommandPaletteLine,
  getCommandPaletteItems,
  previewCommandPaletteSelection
} from "../src/tui/command-palette.js";

test("getCommandPaletteItems returns enabled and disabled preview commands", () => {
  const items = getCommandPaletteItems();
  assert.ok(items.some((item) => item.id === "preview-action" && item.enabled));
  assert.ok(items.some((item) => item.id === "update-coordination-note" && item.enabled));
  assert.ok(items.some((item) => item.id === "generate-report" && !item.enabled));
});

test("filterCommandPaletteItems filters by id label and description", () => {
  const items = getCommandPaletteItems();
  assert.deepEqual(filterCommandPaletteItems(items, "report").map((item) => item.id), ["generate-report"]);
  assert.deepEqual(filterCommandPaletteItems(items, "scope").map((item) => item.id), ["toggle-file-scope"]);
  assert.deepEqual(filterCommandPaletteItems(items, "coordination").map((item) => item.id), ["update-coordination-note"]);
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
    formatCommandPaletteLine({ id: "preview-action", label: "Preview command", description: "Preview only.", enabled: false }),
    "disabled Preview command - Preview only."
  );
});

test("describeCommandPaletteSelection handles missing item", () => {
  assert.equal(describeCommandPaletteSelection(undefined), "No command selected.");
});

test("describeCommandPaletteSelection describes enabled command", () => {
  assert.equal(
    describeCommandPaletteSelection({ id: "preview-action", label: "Preview command", description: "Preview only.", enabled: true }),
    "Preview command: Preview command. Preview only."
  );
});

test("describeCommandPaletteSelection describes disabled command", () => {
  assert.equal(
    describeCommandPaletteSelection({ id: "generate-report", label: "Preview command", description: "Not ready.", enabled: false }),
    "Disabled command: Preview command. Not ready."
  );
});

test("previewCommandPaletteSelection handles missing item", () => {
  assert.deepEqual(
    previewCommandPaletteSelection({ item: undefined, context: { selectedSafeActionDescription: "action", currentFileScope: "phase" } }),
    { handled: false, message: "No command selected." }
  );
});

test("previewCommandPaletteSelection previews selected safe action", () => {
  assert.deepEqual(
    previewCommandPaletteSelection({
      item: { id: "preview-action", label: "Preview selected safe action", description: "Preview.", enabled: true },
      context: { selectedSafeActionDescription: "Preview only: Generate report would run later.", currentFileScope: "phase" }
    }),
    { handled: true, message: "Preview only: Generate report would run later." }
  );
});

test("previewCommandPaletteSelection previews file scope toggle", () => {
  assert.deepEqual(
    previewCommandPaletteSelection({
      item: { id: "toggle-file-scope", label: "Toggle file scope", description: "Preview.", enabled: true },
      context: { selectedSafeActionDescription: "action", currentFileScope: "phase" }
    }),
    { handled: true, message: "Preview only: file scope would toggle from phase." }
  );
});

test("previewCommandPaletteSelection previews coordination note command", () => {
  assert.deepEqual(
    previewCommandPaletteSelection({
      item: {
        id: "update-coordination-note",
        label: "Update coordination note",
        description: "Previews and submits a service-routed coordination note update.",
        enabled: true
      },
      context: { selectedSafeActionDescription: "action", currentFileScope: "phase" }
    }),
    {
      handled: true,
      message: "Preview command: Update coordination note. Previews and submits a service-routed coordination note update."
    }
  );
});

test("previewCommandPaletteSelection describes disabled command", () => {
  assert.deepEqual(
    previewCommandPaletteSelection({
      item: { id: "generate-report", label: "Generate report", description: "Not ready.", enabled: false },
      context: { selectedSafeActionDescription: "action", currentFileScope: "phase" }
    }),
    { handled: false, message: "Disabled command: Generate report. Not ready." }
  );
});
