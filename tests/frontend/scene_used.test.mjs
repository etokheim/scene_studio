import assert from "node:assert/strict";
import test from "node:test";

import {
  sceneLibraryUses,
  scenesUsingLibraryItem,
} from "../../custom_components/circadian_scenes/frontend/scene_used.js";

test("a circadian scene lists its theme, palette, and linked variable", () => {
  const uses = sceneLibraryUses({
    scene: {
      kind: "circadian",
      theme_id: "default",
      overrides: {
        "light.bed": { dawn: { variable_ref: "wool" } },
      },
    },
    themes: [{ id: "default", events: { noon: { color: { variable_ref: "dawn-var" } } } }],
    variables: [
      { id: "dawn-var", kind: "color", name: "Dawn" },
      { id: "wool", kind: "palette", name: "Wood lamp", slots: [{ variable_ref: "warm" }] },
      { id: "warm", kind: "color", name: "Warm" },
      { id: "unused", kind: "color", name: "Unused" },
    ],
  });
  assert.deepEqual(
    uses.map((item) => item.id),
    ["default", "dawn-var", "warm"]
  );
});

test("a simple scene lists its palette and not a theme", () => {
  const uses = sceneLibraryUses({
    scene: {
      kind: "simple",
      palette_id: "spring",
      lights: { "light.a": { variable_ref: "spring" } },
    },
    themes: [{ id: "default", events: {} }],
    variables: [{ id: "spring", kind: "palette", slots: [] }],
  });
  assert.deepEqual(uses, [{ kind: "palette", id: "spring" }]);
});

test("a circadian scene lists each solar event palette", () => {
  const uses = sceneLibraryUses({
    scene: {
      kind: "circadian",
      theme_id: "default",
      event_palettes: { noon: { palette_id: "wool" } },
    },
    themes: [{ id: "default", events: {} }],
    variables: [{ id: "wool", kind: "palette", slots: [] }],
  });
  assert.deepEqual(
    uses.map((item) => `${item.kind}:${item.id}`),
    ["theme:default", "palette:wool"]
  );
});

test("a library item lists the scenes that use it", () => {
  const scenes = [
    { id: "day", kind: "circadian", theme_id: "default", scene_name: "Day" },
    { id: "party", kind: "simple", palette_id: "wool", scene_name: "Party" },
  ];
  const variables = [{ id: "wool", kind: "palette", slots: [] }];
  const themes = [{ id: "default", events: {} }];
  assert.deepEqual(
    scenesUsingLibraryItem({
      kind: "theme",
      id: "default",
      scenes,
      themes,
      variables,
    }).map((scene) => scene.id),
    ["day"]
  );
  assert.deepEqual(
    scenesUsingLibraryItem({
      kind: "palette",
      id: "wool",
      scenes,
      themes,
      variables,
    }).map((scene) => scene.id),
    ["party"]
  );
});
