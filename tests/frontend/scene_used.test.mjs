import assert from "node:assert/strict";
import test from "node:test";

import { colorPresetShownForCaps } from "../../custom_components/scene_studio/frontend/palette.js";
import {
  sceneLibraryUses,
  scenePresetUses,
  scenesUsingLibraryItem,
} from "../../custom_components/scene_studio/frontend/scene_used.js";

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

test("a simple scene counts color presets, not its base scene preset", () => {
  const uses = scenePresetUses({
    scene: {
      kind: "simple",
      palette_id: "spring",
      lights: {
        "light.a": { variable_ref: "spring" },
        "light.b": { variable_ref: "dawn" },
      },
    },
    variables: [
      { id: "spring", kind: "palette", slots: [{ variable_ref: "dawn" }] },
      { id: "dawn", kind: "color", name: "Dawn" },
    ],
  });
  assert.deepEqual(uses.palettes, []);
  assert.deepEqual(uses.colors, [{ kind: "variable", id: "dawn" }]);
});

test("a circadian scene counts event palettes and direct color presets", () => {
  const uses = scenePresetUses({
    scene: {
      kind: "circadian",
      theme_id: "default",
      event_palettes: {
        noon: { palette_id: "wool" },
        dusk: { palette_id: "wool" },
        dawn: { palette_id: "rain" },
      },
      overrides: {
        "light.bed": { noon: { variable_ref: "dawn" } },
      },
    },
    variables: [
      { id: "wool", kind: "palette", slots: [{ variable_ref: "warm" }] },
      { id: "rain", kind: "palette", slots: [] },
      { id: "dawn", kind: "color", name: "Dawn" },
      { id: "warm", kind: "color", name: "Warm" },
    ],
  });
  assert.deepEqual(
    uses.palettes.map((item) => item.id),
    ["wool", "rain"]
  );
  assert.deepEqual(uses.colors, [{ kind: "variable", id: "dawn" }]);
});

test("a color preset is hidden when no selected light can use it", () => {
  const color = { id: "dawn", kind: "color", color: { color_mode: "hs", hs_color: [20, 80] } };
  const temp = {
    id: "warm",
    kind: "color",
    color: { color_mode: "color_temp", color_temp_kelvin: 2700 },
  };
  assert.equal(colorPresetShownForCaps(color, { anyColor: false, anyTemp: true }), false);
  assert.equal(colorPresetShownForCaps(temp, { anyColor: false, anyTemp: true }), true);
  assert.equal(colorPresetShownForCaps(color, { anyColor: true, anyTemp: false }), true);
  assert.equal(colorPresetShownForCaps(temp, { anyColor: true, anyTemp: false }), false);
  assert.equal(colorPresetShownForCaps(color, { anyColor: true, anyTemp: true }), true);
  assert.equal(colorPresetShownForCaps(temp, { anyColor: true, anyTemp: true }), true);
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
