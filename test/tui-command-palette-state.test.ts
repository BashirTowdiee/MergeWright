import test from "node:test";
import assert from "node:assert/strict";
import {
  closeCommandPaletteState,
  createClosedCommandPaletteState,
  openCommandPaletteState,
  toggleCommandPaletteState,
  updateCommandPaletteQuery,
  updateCommandPaletteSelectedIndex
} from "../src/tui/command-palette-state.js";

test("createClosedCommandPaletteState creates default closed state", () => {
  assert.deepEqual(createClosedCommandPaletteState(), { open: false, query: "", selectedIndex: 0 });
});

test("openCommandPaletteState opens without clearing existing state", () => {
  assert.deepEqual(openCommandPaletteState({ open: false, query: "rep", selectedIndex: 2 }), { open: true, query: "rep", selectedIndex: 2 });
});

test("closeCommandPaletteState resets transient state", () => {
  assert.deepEqual(closeCommandPaletteState(), { open: false, query: "", selectedIndex: 0 });
});

test("toggleCommandPaletteState opens and closes with reset on close", () => {
  assert.deepEqual(toggleCommandPaletteState({ open: false, query: "rep", selectedIndex: 2 }), { open: true, query: "rep", selectedIndex: 2 });
  assert.deepEqual(toggleCommandPaletteState({ open: true, query: "rep", selectedIndex: 2 }), { open: false, query: "", selectedIndex: 0 });
});

test("updateCommandPaletteQuery resets selected index", () => {
  assert.deepEqual(updateCommandPaletteQuery({ open: true, query: "r", selectedIndex: 2 }, "re"), { open: true, query: "re", selectedIndex: 0 });
});

test("updateCommandPaletteSelectedIndex updates only selected index", () => {
  assert.deepEqual(updateCommandPaletteSelectedIndex({ open: true, query: "re", selectedIndex: 0 }, 1), { open: true, query: "re", selectedIndex: 1 });
});
