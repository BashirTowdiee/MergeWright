import test from "node:test";
import assert from "node:assert/strict";
import {
  closeOverlay,
  isCommandPaletteOverlayOpen,
  isHelpOverlayOpen,
  isOverlayOpen,
  toggleOverlay
} from "../src/tui/overlay-state.js";

test("toggleOverlay opens requested overlay", () => {
  assert.equal(toggleOverlay("none", "help"), "help");
  assert.equal(toggleOverlay("none", "command-palette"), "command-palette");
});

test("toggleOverlay closes active target overlay", () => {
  assert.equal(toggleOverlay("help", "help"), "none");
  assert.equal(toggleOverlay("command-palette", "command-palette"), "none");
});

test("toggleOverlay switches between overlays", () => {
  assert.equal(toggleOverlay("help", "command-palette"), "command-palette");
  assert.equal(toggleOverlay("command-palette", "help"), "help");
});

test("closeOverlay returns no overlay", () => {
  assert.equal(closeOverlay(), "none");
});

test("overlay predicates identify active overlay", () => {
  assert.equal(isOverlayOpen("none"), false);
  assert.equal(isOverlayOpen("help"), true);
  assert.equal(isHelpOverlayOpen("help"), true);
  assert.equal(isHelpOverlayOpen("command-palette"), false);
  assert.equal(isCommandPaletteOverlayOpen("command-palette"), true);
  assert.equal(isCommandPaletteOverlayOpen("help"), false);
});
