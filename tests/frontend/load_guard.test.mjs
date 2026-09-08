import assert from "node:assert/strict";
import test from "node:test";

import { panelLoadIsCurrent } from "../../custom_components/circadian_scenes/frontend/load_guard.js";

test("accepts only the matching generation and route", () => {
  const current = { generation: 4, view: "edit", sceneId: "scene-b" };
  assert.equal(panelLoadIsCurrent({ ...current }, current), true);
  assert.equal(
    panelLoadIsCurrent({ ...current, generation: 3 }, current),
    false
  );
  assert.equal(
    panelLoadIsCurrent({ ...current, sceneId: "scene-a" }, current),
    false
  );
  assert.equal(
    panelLoadIsCurrent({ ...current, view: "list", sceneId: null }, current),
    false
  );
});
