import assert from "node:assert/strict";
import test from "node:test";

import { mergeFields, patchInPlace, railCatalogChanges, reconcileSaveResponse, useSavedField } from "../../custom_components/scene_studio/frontend/collaboration.js";

test("a collaborator's scene edit refreshes its card without replacing the rail", () => {
  const before = {
    floors: [{ id: "floor", areas: [{ id: "area" }] }],
    scenes: [{ id: "scene", area: "area", kind: "simple", scene_name: "Before" }],
    themes: [], variables: [],
  };
  const renamed = { ...before, scenes: [{ ...before.scenes[0], scene_name: "After" }] };
  const change = railCatalogChanges(before, renamed);
  assert.equal(change.rebuild, false);
  assert.deepEqual([...change.sceneIds], ["scene"]);
  assert.equal(change.sharedChanged, false);
  assert.equal(railCatalogChanges(before, { ...before, scenes: [{ ...renamed.scenes[0], area: "elsewhere" }] }).rebuild, true);
});

test("late save response brings remote fields into an unchanged draft", () => {
  assert.deepEqual(
    reconcileSaveResponse({ name: "A", description: "old" }, { name: "A", description: "old" }, { name: "A", description: "new" }),
    { value: { name: "A", description: "new" }, conflicts: [], changedDuringSave: false }
  );
});

test("late save response preserves a newer local field and detects overlap", () => {
  assert.deepEqual(
    reconcileSaveResponse({ name: "A", description: "old" }, { name: "mine", description: "old" }, { name: "A", description: "theirs" }),
    { value: { name: "mine", description: "theirs" }, conflicts: [], changedDuringSave: true }
  );
  assert.deepEqual(
    reconcileSaveResponse({ name: "A" }, { name: "mine" }, { name: "theirs" }).conflicts,
    ["name"]
  );
});

test("independent light and event fields merge without losing either edit", () => {
  const base = { overrides: { "light.a": { dawn: { brightness: 100 } } } };
  const local = { overrides: { "light.a": { dawn: { brightness: 120 } } } };
  const saved = { overrides: { "light.a": { dawn: { brightness: 100 }, noon: { brightness: 180 } } } };
  assert.deepEqual(mergeFields(base, local, saved), {
    value: { overrides: { "light.a": { dawn: { brightness: 120 }, noon: { brightness: 180 } } } },
    conflicts: [],
  });
});

test("a color value and membership are indivisible conflict fields", () => {
  const base = { color: { rgb_color: [1, 2, 3] }, membership: { include: ["light.a"], exclude: [] } };
  const local = { color: { rgb_color: [3, 2, 1] }, membership: { include: ["light.b"], exclude: [] } };
  const saved = { color: { rgb_color: [4, 2, 1] }, membership: { include: ["light.c"], exclude: [] } };
  const result = mergeFields(base, local, saved);
  assert.deepEqual(result.conflicts, ["color", "membership"]);
  assert.deepEqual(useSavedField(result.value, saved, "color").color, saved.color);
});

test("two editors can add different events for one new light", () => {
  const result = mergeFields(
    { overrides: {} },
    { overrides: { "light.a": { dawn: { brightness: 100 } } } },
    { overrides: { "light.a": { noon: { brightness: 200 } } } }
  );
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(Object.keys(result.value.overrides["light.a"]).sort(), ["dawn", "noon"]);
});

test("remote values update mounted editor objects without replacing references", () => {
  const draft = { lights: { "light.a": { brightness: 100 } }, membership: { include: ["light.a"] } };
  const lights = draft.lights;
  const light = lights["light.a"];
  const include = draft.membership.include;
  patchInPlace(draft, { lights: { "light.a": { brightness: 120 } }, membership: { include: ["light.b"] } });
  assert.equal(draft.lights, lights);
  assert.equal(draft.lights["light.a"], light);
  assert.equal(draft.membership.include, include);
  assert.equal(light.brightness, 120);
  assert.deepEqual(include, ["light.b"]);
});
