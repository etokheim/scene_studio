import assert from "node:assert/strict";
import test from "node:test";

import { sceneEventPaletteId } from "../../custom_components/scene_studio/frontend/palette.js";

test("a scene palette wins only for its assigned solar event", () => {
  const scene = {
    theme_id: "shared",
    event_palettes: {
      dawn: { palette_id: "private-dawn", assignment_seed: 7 },
    },
  };
  assert.equal(sceneEventPaletteId(scene, "dawn"), "private-dawn");
  assert.equal(sceneEventPaletteId(scene, "noon"), null);
  assert.equal(sceneEventPaletteId({}, "dawn"), null);
});
