import test from "node:test";
import assert from "node:assert/strict";
import { formatCommandPaletteLine, getCommandPaletteItems } from "../src/tui/command-palette.js";

test("getCommandPaletteItems returns enabled and disabled preview commands", () => {
  const items = getCommandPaletteItems();
  assert.ok(items.some((item) => item.id === "preview-action" && item.enabled));
  assert.ok(items.some((item) => item.id === "generate-report" && !item.enabled));
});

test("formatCommandPaletteLine includes status label", () => {
  assert.equal(
    formatCommandPaletteLine({ id: "x", label: "Do thing", description: "Preview only.", enabled: false }),
    "disabled Do thing - Preview only."
  );
});
