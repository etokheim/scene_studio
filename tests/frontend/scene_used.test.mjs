import assert from "node:assert/strict";
import test from "node:test";

import { sceneLibraryUses } from "../../custom_components/circadian_scenes/frontend/scene_used.js";

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
    ["default", "wool", "dawn-var", "warm"]
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
