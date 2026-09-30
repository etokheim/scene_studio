import assert from "node:assert/strict";
import test from "node:test";

import { defaultOnPreference, mobileSceneOnboarding, sceneRailCatalogKey, showNoAreasMessage } from "../../custom_components/scene_studio/frontend/panel_state.js";

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

test("onboarding replaces Live edit only in an empty mobile Scenes tab", () => {
  assert.equal(mobileSceneOnboarding(true, "scenes", 0), true);
  assert.equal(mobileSceneOnboarding(true, "library", 0), false);
  assert.equal(mobileSceneOnboarding(false, "scenes", 0), false);
  assert.equal(mobileSceneOnboarding(false, "library", 0), false);
  assert.equal(mobileSceneOnboarding(true, "scenes", 1), false);
});

test("an empty scene list must repaint when its areas arrive", () => {
  const floors = [{ id: "floor", areas: [{ id: "kitchen", name: "Kitchen" }] }];
  assert.notEqual(sceneRailCatalogKey([], []), sceneRailCatalogKey(floors, []));
  assert.equal(sceneRailCatalogKey(floors, []), sceneRailCatalogKey(structuredClone(floors), []));
  assert.notEqual(sceneRailCatalogKey(floors, [{ id: "scene", area: "kitchen" }]),
    sceneRailCatalogKey(floors, [{ id: "scene", area: "bedroom" }]));
});
