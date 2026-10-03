import assert from "node:assert/strict";
import test from "node:test";
import { circadianPreviewTheme } from "../../custom_components/scene_studio/frontend/card_preview.js";

test("whole-day thumbnails prefer scene event images without changing the theme", () => {
  const theme = { events: { dawn: { brightness: 20, color: { variable_ref: "theme-dawn" } }, noon: { brightness: 255, color: { variable_ref: "theme-noon" } } } };
  const effective = circadianPreviewTheme({ event_palettes: { dawn: { palette_id: "scene-dawn" } } }, theme);
  assert.equal(effective.events.dawn.color.variable_ref, "scene-dawn");
  assert.equal(effective.events.dawn.brightness, undefined);
  assert.equal(effective.events.noon.color.variable_ref, "theme-noon");
  assert.equal(theme.events.dawn.color.variable_ref, "theme-dawn");
});
