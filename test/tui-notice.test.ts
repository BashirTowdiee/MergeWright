import test from "node:test";
import assert from "node:assert/strict";
import { createInfoNotice, formatNotice, getNoticePrefix } from "../src/tui/notice.js";

test("createInfoNotice creates an info notice", () => {
  assert.deepEqual(createInfoNotice("Ready"), { tone: "info", message: "Ready" });
});

test("formatNotice formats notices with tone prefix", () => {
  assert.equal(formatNotice({ tone: "info", message: "Ready" }), "INFO Ready");
  assert.equal(formatNotice({ tone: "success", message: "Done" }), "OK Done");
  assert.equal(formatNotice({ tone: "warning", message: "Check this" }), "WARN Check this");
  assert.equal(formatNotice({ tone: "error", message: "Failed" }), "ERROR Failed");
});

test("formatNotice handles null notice", () => {
  assert.equal(formatNotice(null), "");
});

test("getNoticePrefix returns stable labels", () => {
  assert.equal(getNoticePrefix("info"), "INFO");
  assert.equal(getNoticePrefix("success"), "OK");
  assert.equal(getNoticePrefix("warning"), "WARN");
  assert.equal(getNoticePrefix("error"), "ERROR");
});
