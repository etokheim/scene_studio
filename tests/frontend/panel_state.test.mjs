import assert from "node:assert/strict";
import test from "node:test";

import { defaultOnPreference, showNoAreasMessage } from "../../custom_components/scene_studio/frontend/panel_state.js";

test("areas are reported absent only after a successful empty catalog", () => {
  assert.equal(showNoAreasMessage(false, []), false);
  assert.equal(showNoAreasMessage(true, [{ id: "floor", areas: [{ id: "kitchen" }] }]), false);
  assert.equal(showNoAreasMessage(true, []), true);
});

test("removing a local Live edit preference restores its on default", () => {
  assert.equal(defaultOnPreference("0"), false);
  assert.equal(defaultOnPreference("false"), false);
  assert.equal(defaultOnPreference("1"), true);
  assert.equal(defaultOnPreference(null), true);
});
