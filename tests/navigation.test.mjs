import test from "node:test";
import assert from "node:assert/strict";
import { sectionForView, viewFromSearch, searchForView } from "../lib/navigation.mjs";

test("Grouped views keep their parent menu active", () => {
  assert.equal(sectionForView("missing"), "attendance");
  assert.equal(sectionForView("qrcards"), "students");
});

test("Grouped links round-trip and keep old bookmarks compatible", () => {
  for (const view of ["overview", "scanner", "attendance", "missing", "students", "qrcards", "reports", "settings", "guide"]) {
    assert.equal(viewFromSearch(searchForView(view)), view);
    assert.equal(viewFromSearch("?tab=" + view), view);
  }
  assert.equal(searchForView("attendance", "?tab=students&view=qrcards&other=keep"), "?tab=attendance&other=keep");
  assert.equal(viewFromSearch("?tab=students&view=missing"), "students");
  assert.equal(viewFromSearch("?tab=unknown"), "overview");
});
