import assert from "node:assert/strict";
import test from "node:test";
const registry = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = { get: name => registry.get(name), define: (name, ctor) => registry.set(name, ctor) };
await import("../../custom_components/scene_studio/frontend/panel.js");
const methods = registry.get("scene-studio-panel").prototype;

test("circadian-preset readiness uses its own solar key so outgoing wheels finish", () => {
  const panel = { _view: "theme", _previewDate: "2026-02-16", _duskMinimumSeconds: () => 79200, _sunPath: { curve: [1] } };
  panel._chartKey = () => methods._chartKey.call(panel);
  panel._sunPathKey = "theme-sun:2026-02-16:79200";
  assert.equal(methods._sunPathMatchesChart.call(panel), true);
  panel._sunPathKey = "list-sun:2026-02-16:79200";
  assert.equal(methods._sunPathMatchesChart.call(panel), false);
});

test("a cached circadian preview reconciles the shell after becoming ready", async () => {
  const calls = [];
  const panel = {
    _hass: {}, _view: "theme", _previewDate: "2026-02-16", _previewGeneration: 1,
    _themeDraft: {}, _sunPathEl: { hidden: true },
    _duskMinimumSeconds: () => 79200,
    _themeSolarKey: "theme-sun:2026-02-16:79200", _themeSolar: { events: [] },
    _themeRingLight: () => ({ event_states: [] }),
    _drawSunPath: () => calls.push("draw"),
    _syncSharedEditorShell: () => calls.push("shell"),
  };
  await methods._ensureThemeSunPath.call(panel);
  assert.deepEqual(calls, ["draw", "shell"]);
  assert.equal(panel._sunPathKey, panel._themeSolarKey);
});

test("a delayed solar response cannot remount a departed circadian preset", async () => {
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const panel = {
    _hass: { callWS: () => response }, _view: "theme", _previewDate: "2026-02-16", _previewGeneration: 1,
    _themeDraft: {}, _sunPathEl: { hidden: true }, _duskMinimumSeconds: () => 79200,
    _chartKey: () => "theme-sun:2026-02-16:79200",
    _drawSunPath: () => assert.fail("stale preview was drawn"),
  };
  const waiting = methods._ensureThemeSunPath.call(panel);
  panel._view = "palette";
  panel._previewGeneration++;
  finish({ events: [] });
  await waiting;
  assert.equal(panel._sunPathEl.hidden, true);
  assert.equal(panel._themeSolar, undefined);
});

test("assigning an event preset preserves manual overrides even for selected lights", () => {
  const overrides = { "light.a": { dawn: { brightness: 35 } } };
  const panel = {
    _formData: { kind: "circadian", overrides, event_palettes: { noon: { palette_id: "other" } } },
    _editedSolarEventId: () => "dawn", _commitUndo() {}, _stampListPreset() {},
    _saveSoon() {}, _syncSceneUsed() {}, _syncOpenSceneCardFace() {},
    _clearPreviewCache() {}, _patchDialFromSession() {}, _schedulePreview() {},
  };
  methods._applySceneBasePalette.call(panel, { palette: { id: "new" }, seed: 7 }, new Set(["light.a", "light.b"]));
  assert.deepEqual(panel._formData.overrides, overrides);
  assert.deepEqual(panel._formData.event_palettes, { dawn: { palette_id: "new", assignment_seed: 7 }, noon: { palette_id: "other" } });
});

test("event brightness drag uses a fixed gesture base and does not edit shared theme", () => {
  const palette = { id: "p", kind: "palette", slots: Array.from({ length: 5 }, () => ({ color: { color_mode: "rgb", rgb_color: [255, 0, 0] }, brightness: 100 })) };
  const panel = {
    _formData: { kind: "circadian", event_palettes: { dawn: { palette_id: "p" } } },
    _themeDraft: { events: { dawn: { brightness: 20, color: { color_mode: "hs", hs_color: [0, 0] } } } },
    _variables: [palette], _sunPath: { lights: [{ entity_id: "light.a" }] },
    _dialBrightnessLightId: () => null, _eventBrightnessIsLive: () => true, _paintLiveEventBrightness() {},
    _lightEventStoredState: function(light, eventId) { return methods._lightEventStoredState.call(this, light, eventId); },
    _editorLightState: (_id, state) => state,
    _inheritedEventBrightness: function(eventId) { return methods._inheritedEventBrightness.call(this, eventId); },
  };
  methods._writeDialEventBrightness.call(panel, "dawn", 50);
  methods._writeDialEventBrightness.call(panel, "dawn", 80);
  assert.deepEqual(panel._formData.event_palettes.dawn.brightness_adjustment, { scale: 0.8, ceiling: 204 });
  assert.equal(panel._themeDraft.events.dawn.brightness, 20);
  assert.equal(panel._lightEventStoredState({ entity_id: "light.a" }, "dawn").brightness, 80);
});
