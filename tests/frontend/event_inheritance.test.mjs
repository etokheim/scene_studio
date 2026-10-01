import assert from "node:assert/strict";
import test from "node:test";
import { resolveEventDraft, eventOverrideAfterEdit } from "../../custom_components/scene_studio/frontend/event_inheritance.js";
const palette = { id: "p", kind: "palette", slots: Array.from({ length: 5 }, () => ({ color: { color_mode: "rgb", rgb_color: [255, 0, 0] }, brightness: 100 })) };
const theme = { events: { dawn: { color: { color_mode: "color_temp", color_temp_kelvin: 2700 }, brightness: 20 } } };
const scene = { event_palettes: { dawn: { palette_id: "p", assignment_seed: 2 } } };

test("brightness-only and color-only overrides keep other event-preset fields inherited", () => {
  const bright = resolveEventDraft({ ...scene, overrides: { "light.a": { dawn: { brightness: 40 } } } }, theme, "dawn", "light.a", [palette]);
  assert.deepEqual(bright.rgb_color, [255, 0, 0]);
  assert.equal(bright.brightness, 40);
  const color = resolveEventDraft({ ...scene, overrides: { "light.a": { dawn: { color_mode: "color_temp", color_temp_kelvin: 4000 } } } }, theme, "dawn", "light.a", [palette]);
  assert.equal(color.color_temp_kelvin, 4000);
  assert.equal(color.brightness, 100);
  assert.equal(color.rgb_color, undefined);
});

test("manual edits save only changed fields and preserve preexisting overrides", () => {
  const base = resolveEventDraft(scene, theme, "dawn", "light.a", [palette]);
  assert.deepEqual(eventOverrideAfterEdit({}, base, { ...base, brightness: 80 }), { brightness: 80 });
  assert.deepEqual(eventOverrideAfterEdit({ effect: "rainbow" }, base, { ...base, brightness: 80 }), { effect: "rainbow", brightness: 80 });
  const color = eventOverrideAfterEdit({ brightness: 50 }, base, { state: "on", brightness: 100, color_mode: "color_temp", color_temp_kelvin: 4000 });
  assert.deepEqual(color, { brightness: 50, color_mode: "color_temp", color_temp_kelvin: 4000 });
});

test("a zero-brightness preset stays at zero instead of becoming 255", () => {
  const dark = structuredClone(palette);
  dark.slots.forEach(slot => { slot.brightness = 0; });
  assert.equal(resolveEventDraft(scene, theme, "dawn", "light.a", [dark]).brightness, 0);
});
