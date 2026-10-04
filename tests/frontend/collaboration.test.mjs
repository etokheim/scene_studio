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

test("event brightness transforms conflict atomically while separate light fields merge", () => {
  const base = { event_palettes: { dawn: { brightness_adjustment: { scale: 1, ceiling: 255 } } } };
  const mine = structuredClone(base), saved = structuredClone(base);
  mine.event_palettes.dawn.brightness_adjustment.scale = 0.5;
  saved.event_palettes.dawn.brightness_adjustment.ceiling = 128;
  assert.deepEqual(mergeFields(base, mine, saved).conflicts, ["event_palettes.dawn.brightness_adjustment"]);
  const separate = { ...base, overrides: { "light.a": { dawn: { brightness: 70 } } } };
  const result = mergeFields(base, separate, saved);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.value.overrides["light.a"].dawn.brightness, 70);
  assert.equal(result.value.event_palettes.dawn.brightness_adjustment.ceiling, 128);
});

const { mergeCatalogPatch, createCatalogRefresher } = await import("../../custom_components/scene_studio/frontend/collaboration.js");

test("scoped catalog patches retain unrelated objects and remove deleted items", () => {
  const a = { id: "a", scene_name: "A" }, b = { id: "b", scene_name: "B" };
  const catalog = { scenes: [a, b], variables: [{ id: "v" }], themes: [], floors: [{ id: "room" }] };
  const updated = { ...a, scene_name: "Changed" };
  const next = mergeCatalogPatch(catalog, { partial: true, scene_ids: ["a"], variable_ids: [], theme_ids: [], scenes: [updated], variables: [], themes: [] });
  assert.equal(next.scenes.find(s => s.id === "b"), b);
  assert.equal(next.floors, catalog.floors);
  const deleted = mergeCatalogPatch(next, { partial: true, scene_ids: ["a"], variable_ids: ["v"], theme_ids: [], scenes: [], variables: [], themes: [] });
  assert.deepEqual(deleted.scenes, [b]);
  assert.deepEqual(deleted.variables, []);
});

test("refresh bursts coalesce and notices during an in-flight request are drained", async () => {
  const batches = []; let release;
  const refresh = createCatalogRefresher(async events => {
    batches.push(events);
    if (batches.length === 1) await new Promise(resolve => { release = resolve; });
  });
  const waiting = refresh({ kind: "scene", id: "a", action: "save" });
  refresh({ kind: "scene", id: "a", action: "delete" });
  refresh({ kind: "theme", id: "t" });
  await Promise.resolve();
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].action, "delete");
  refresh({ kind: "scene", id: "b" });
  refresh({ kind: "catalog", action: "resync" });
  release(); await waiting;
  assert.deepEqual(batches[1].map(e => e.kind), ["scene", "catalog"]);
  await refresh({ kind: "scene", id: "c" });
  assert.equal(batches.length, 3);
});

test("updating an existing shared item preserves library order", () => {
  const variables = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const patch = { partial: true, scenes: [], scene_ids: [], themes: [], theme_ids: [], variable_ids: ["b"], variables: [{ id: "b", name: "New" }] };
  assert.deepEqual(mergeCatalogPatch({ scenes: [], variables, themes: [] }, patch).variables.map(v => v.id), ["a", "b", "c"]);
});
