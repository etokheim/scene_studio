import assert from "node:assert/strict";
import test from "node:test";
import { editorPath, editorRoute, libraryItemRoute } from "../../custom_components/scene_studio/frontend/editor_routes.js";

test("public paths round-trip scenes and every library editor", () => {
  for (const route of ["", "variables", "new", "edit/abc", "variable/dawn", "palette/preset", "theme/default"]) {
    assert.equal(editorRoute({ pathname: editorPath(route) }), route);
  }
  assert.equal(editorPath("edit/abc"), "/scene_studio/scenes/abc");
  assert.equal(editorRoute({ pathname: "/lovelace" }), null);
});
test("old bookmarks normalize to canonical paths", () => {
  for (const route of ["edit/abc", "variable/dawn", "palette/preset", "theme/default", "variables"]) {
    const parsed = editorRoute({ pathname: "/scene_studio", hash: `#${route}` });
    assert.equal(parsed, route);
    assert.equal(editorRoute({ pathname: editorPath(parsed) }), route);
  }
});
test("all library kinds deselect without changing assignments", () => {
  for (const kind of ["variable", "palette", "theme"]) {
    assert.equal(libraryItemRoute(kind, kind, "id", "id"), "variables");
    assert.equal(libraryItemRoute(kind, kind, "old", "new"), `${kind}/new`);
  }
});
