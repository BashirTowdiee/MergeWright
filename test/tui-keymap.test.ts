import test from "node:test";
import assert from "node:assert/strict";
import { formatKeyBinding, TUI_KEY_BINDINGS } from "../src/tui/keymap.js";

test("TUI keymap includes global help binding", () => {
  assert.ok(TUI_KEY_BINDINGS.some((binding) => binding.key === "?" && binding.description === "toggle help"));
});

test("formatKeyBinding pads key labels", () => {
  assert.equal(formatKeyBinding({ key: "?", description: "toggle help", scope: "global" }), "?            toggle help");
});
