import assert from "node:assert/strict";
import test from "node:test";
const registry = new Map();
globalThis.HTMLElement = class {};
globalThis.customElements = { get: name => registry.get(name), define: (name, ctor) => registry.set(name, ctor) };
await import("../../custom_components/scene_studio/frontend/panel.js");
const methods = registry.get("scene-studio-panel").prototype;

test("circadian-preset readiness uses its own solar key so outgoing wheels finish", () => {
  const panel = { _view: "theme", _previewDate: "2026-02-16", _duskMinimumSeconds: () => 79200, _dawnMaximumSeconds: () => 21600, _sunPath: { curve: [1] } };
  panel._chartKey = () => methods._chartKey.call(panel);
  panel._sunPathKey = "theme-sun:2026-02-16:79200:21600";
  assert.equal(methods._sunPathMatchesChart.call(panel), true);
  panel._sunPathKey = "list-sun:2026-02-16:79200:21600";
  assert.equal(methods._sunPathMatchesChart.call(panel), false);
});

test("a cached circadian preview reconciles the shell after becoming ready", async () => {
  const calls = [];
  const panel = {
    _hass: {}, _view: "theme", _previewDate: "2026-02-16", _previewGeneration: 1,
    _themeDraft: {}, _sunPathEl: { hidden: true },
    _duskMinimumSeconds: () => 79200, _dawnMaximumSeconds: () => 21600,
    _themeSolarKey: "theme-sun:2026-02-16:79200:21600", _themeSolar: { events: [] },
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
    _themeDraft: {}, _sunPathEl: { hidden: true }, _duskMinimumSeconds: () => 79200, _dawnMaximumSeconds: () => 21600,
    _chartKey: () => "theme-sun:2026-02-16:79200:21600",
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
    _view: "edit", _formData: { kind: "circadian", event_palettes: { dawn: { palette_id: "p" } } },
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

test("event wheels contain only members resolved for the chosen event and refresh on preset replacement", () => {
  const palette = id => ({ id, kind: "palette", slots: Array.from({ length: 5 }, () => ({ color: { color_mode: "rgb", rgb_color: id === "red" ? [255, 0, 0] : [0, 0, 255] }, brightness: 100 })) });
  const panel = {
    _sunPath: { lights: [{ entity_id: "light.a", name: "A" }, { entity_id: "light.removed", removed: true }, { entity_id: "light.suggested", suggested: true }, { entity_id: "theme:default", theme_ring: true }] },
    _formData: { kind: "circadian", event_palettes: { dawn: { palette_id: "red" }, dusk: { palette_id: "blue" } } },
    _themeDraft: { events: { dawn: { brightness: 20, color: {} }, dusk: { brightness: 30, color: {} } } },
    _variables: [palette("red"), palette("blue")], _editorLightState: (_id, state) => state,
    _lightEventStoredState: function(light, eventId) { return methods._lightEventStoredState.call(this, light, eventId); },
  };
  const dawn = methods._eventWheelRows.call(panel, "dawn");
  assert.deepEqual(dawn.map(row => row.id), ["light.a"]);
  assert.deepEqual(dawn[0].draft.rgb_color, [255, 0, 0]);
  assert.deepEqual(methods._eventWheelRows.call(panel, "dusk")[0].draft.rgb_color, [0, 0, 255]);
  panel._formData.event_palettes.dawn = { palette_id: "blue" };
  const replaced = methods._eventWheelRows.call(panel, "dawn");
  assert.deepEqual(replaced[0].draft.rgb_color, [0, 0, 255]);
  replaced[0].draft.brightness = 12;
  assert.equal(replaced[0].savedDraft.brightness, 100);
  assert.equal(panel._formData.overrides, undefined);
});

test("event randomization persists one seed for every inherited light without touching overrides or other events", () => {
  const adjustment = { scale: 0.7, ceiling: 178.5 };
  const overrides = { "light.a": { dawn: { brightness: 31 } }, "light.b": { dawn: { color_mode: "rgb", rgb_color: [5, 6, 7] } } };
  const calls = [];
  const panel = {
    _formData: { event_palettes: { dawn: { palette_id: "p", assignment_seed: 12, brightness_adjustment: adjustment }, dusk: { palette_id: "other", assignment_seed: 99 } }, overrides },
    _themeDraft: { events: { dawn: { assignment_seed: 4 } } },
    _variables: [{ id: "p", kind: "palette", slots: [{}] }],
    _commitUndo: () => calls.push("undo"), _refreshInheritedLightDrafts: () => calls.push("refresh"),
    _clearPreviewCache() {}, _patchDialFromSession() {}, _syncOpenSceneCardFace() {}, _schedulePreview() {}, _saveSoon: () => calls.push("save"),
  };
  const random = Math.random;
  try { Math.random = () => 0.5; assert.equal(methods._randomizeSceneEvent.call(panel, "dawn"), true); }
  finally { Math.random = random; }
  assert.equal(panel._formData.event_palettes.dawn.assignment_seed, 2147483647);
  assert.deepEqual(panel._formData.event_palettes.dawn.brightness_adjustment, adjustment);
  assert.deepEqual(panel._formData.event_palettes.dusk, { palette_id: "other", assignment_seed: 99 });
  assert.deepEqual(panel._formData.overrides, overrides);
  assert.equal(panel._themeDraft.events.dawn.assignment_seed, 4);
  assert.deepEqual(calls, ["undo", "refresh", "save"]);
});

test("durable settings refresh mounted controls without replacing the sidebar", () => {
  let syncs = 0;
  const live = { control: { isConnected: true }, sync: () => syncs++ };
  const panel = { _settingsBindings: [live, { control: { isConnected: false }, sync: () => assert.fail("detached control updated") }] };
  methods._adoptSettings.call(panel, { automatic_updates_enabled: false, always_follow_scene: ["light.missing"] });
  assert.equal(panel._settings.automatic_updates_enabled, false);
  assert.equal(panel._settings.respect_manual_changes, true);
  assert.deepEqual(panel._settings.always_follow_scene, ["light.missing"]);
  assert.deepEqual(panel._settingsBindings, [live]);
  assert.equal(syncs, 1);
});


test("editor capability adaptation removes unsupported chromatic preview values", () => {
  for (const mode of ["hs", "xy", "rgb", "rgbw", "rgbww"]) {
    const panel = { _hass: { states: { "light.temp": { attributes: { supported_color_modes: ["color_temp"] } } } } };
    panel._lightModeFlags = id => methods._lightModeFlags.call(panel, id);
    assert.deepEqual(methods._editorLightState.call(panel, "light.temp", { state: "on", brightness: 45, effect: "none", color_mode: mode, rgb_color: [255, 0, 0], hs_color: [0, 100] }), { state: "on", brightness: 45, effect: "none" });
    const temperature = { state: "on", brightness: 45, color_mode: "color_temp", color_temp_kelvin: 2700 };
    assert.deepEqual(methods._editorLightState.call(panel, "light.temp", temperature), temperature);
  }
});


test("responsive toolbar replacement finds controls in a detached readout", () => {
  const calls = [];
  const old = { replaceWith: node => calls.push(["replace", node]), remove: () => calls.push("remove") };
  const host = { querySelectorAll: () => [old], append: () => assert.fail("duplicate controls appended") };
  const strip = {};
  methods._replaceSceneUsed.call({ shadowRoot: { querySelectorAll: () => [] } }, host, strip);
  assert.deepEqual(calls, [["replace", strip]]);
});


test("event brightness without a scene preset never writes the shared circadian preset", () => {
  const theme = { events: { dawn: { brightness: 100, color: { color_mode: "color_temp", color_temp_kelvin: 2700 } } } };
  const panel = { _view: "edit", _formData: { kind: "circadian" }, _themeDraft: theme,
    _dialBrightnessLightId: () => null, _inheritedEventBrightness: () => 100,
    _eventBrightnessIsLive: () => false, _patchDialFromSession() {}, _syncThemePreviewSurfaces() {}, _saveSoon() {},
    _writeThemeEventFromDraft: () => assert.fail("shared preset changed") };
  methods._writeDialEventBrightness.call(panel, "dawn", 50);
  assert.deepEqual(panel._formData.event_palettes.dawn, { brightness_adjustment: { scale: 0.5, ceiling: 127.5 } });
  assert.equal(theme.events.dawn.brightness, 100);
});

test("circadian tile edits are blocked until an event is selected", () => {
  let hints = 0;
  const scene = { kind: "circadian", overrides: {} };
  const panel = { _formData: scene, _sidebarEventId: null, _eventGuidance: { show() { hints++; } }, _sunPath: { events: [{ id: "dawn" }] } };
  panel._requireCircadianEvent = () => methods._requireCircadianEvent.call(panel);
  methods._selectCircadianLight.call(panel, "light.a");
  methods._resetCircadianLight.call(panel, "light.a");
  methods._toggleLegendLightPower.call(panel, "light.a");
  assert.equal(hints, 3);
  assert.deepEqual(scene.overrides, {});
  assert.equal(panel._legendSelectedIds, undefined);
});

test("circadian selection shares normal click, range, toggle, and touch multiselect semantics", () => {
  const panel = { _requireCircadianEvent: () => true, _circadianMemberIds: () => ["light.a", "light.b", "light.c"], _syncClockLightSelection() {}, shadowRoot: { querySelector: () => null } };
  const pick = (id, ev = {}) => methods._selectCircadianLight.call(panel, id, ev, { open: false });
  pick("light.a"); assert.deepEqual([...panel._legendSelectedIds], ["light.a"]);
  pick("light.c", { shiftKey: true }); assert.deepEqual([...panel._legendSelectedIds], ["light.a", "light.b", "light.c"]);
  pick("light.b", { ctrlKey: true }); assert.deepEqual([...panel._legendSelectedIds], ["light.a", "light.c"]);
  pick("light.c"); assert.deepEqual([...panel._legendSelectedIds], ["light.a"]);
  pick("light.a"); assert.deepEqual([...panel._legendSelectedIds], []);
  panel._circadianTouchSelect = true;
  pick("light.a"); pick("light.b"); assert.deepEqual([...panel._legendSelectedIds], ["light.a", "light.b"]);
});

test("light reset removes only the selected event and retains shared presets and other lights", () => {
  const theme = { events: { dawn: { brightness: 100 } } };
  const scene = { overrides: { "light.a": { dawn: { brightness: 40, effect: "rainbow" }, noon: { brightness: 80 } }, "light.b": { dawn: { brightness: 30 } } }, event_palettes: { dawn: { palette_id: "p" } } };
  let refreshed = false;
  const panel = { _formData: scene, _themeDraft: theme, _sidebarEventId: "dawn", _requireCircadianEvent: () => true, _commitUndo() {}, _refreshCircadianEvent: () => { refreshed = true; } };
  panel._deleteLightEventOverride = (...args) => methods._deleteLightEventOverride.call(panel, ...args);
  methods._resetCircadianLight.call(panel, "light.a");
  assert.deepEqual(scene.overrides, { "light.a": { noon: { brightness: 80 } }, "light.b": { dawn: { brightness: 30 } } });
  assert.deepEqual(scene.event_palettes, { dawn: { palette_id: "p" } });
  assert.deepEqual(theme.events.dawn, { brightness: 100 });
  assert.equal(refreshed, true);
});

test("binary event tiles display On and Off without depending on a percentage", () => {
  const panel = { _formData: { kind: "circadian" }, _themeDraft: {}, _lightModeFlags: () => ({ onOff: true }), _lightEventStoredState: () => ({ state: "on" }) };
  assert.equal(methods._dialEventBrightness.call(panel, "dawn", "light.a"), 255);
  panel._lightEventStoredState = () => ({ state: "off" });
  assert.equal(methods._dialEventBrightness.call(panel, "dawn", "light.a"), 0);
});

test("event power can resume an explicit Off override without removing other fields", () => {
  const scene = { overrides: { "light.a": { dawn: { state: "off", brightness: 80, effect: "rainbow" } } } };
  const panel = { _formData: scene, _sidebarEventId: "dawn", _sunPath: { events: [{ id: "dawn" }] }, _requireCircadianEvent: () => true, _dialEventBrightness: () => 0, _commitUndo() { assert.equal(scene.overrides['light.a'].dawn.state, "off"); }, _refreshCircadianEvent() {} };
  panel._writeLightEventOverride = (...args) => methods._writeLightEventOverride.call(panel, ...args);
  methods._toggleLegendLightPower.call(panel, "light.a");
  assert.deepEqual(scene.overrides['light.a'].dawn, { state: "on", brightness: 255, effect: "rainbow" });
});

test("interrupted event openings do not remount obsolete sidebar content", async () => {
  const waits = [];
  const panel = {
    _view: "edit", _sunPath: { events: [{ id: "dawn" }, { id: "noon" }] },
    _themeDraft: { name: "Default" }, _currentHash: () => "edit/s", _t: (_key, fallback) => fallback,
    _themeEventDraft: () => ({ brightness: 100 }),
    _eventWheelRows: () => [{ id: "light.a" }],
    _legendSelectedIds: new Set(["light.a", "light.removed"]),
    _openSceneSidebar: () => new Promise(resolve => waits.push(resolve)),
    _setSidebarEvent: () => assert.fail("stale event mounted"),
  };
  const first = methods._openThemeEventSidebar.call(panel, { id: "dawn" });
  const second = methods._openThemeEventSidebar.call(panel, { id: "noon" });
  waits[0]({}); await first;
  waits[1](null); await second;
  assert.deepEqual([...panel._legendSelectedIds], ["light.a"]);
  assert.equal(panel._eventSidebarOwner, undefined);
});

test("closing a circadian sidebar retains event and light selection", () => {
  const host = new EventTarget(); host.remove = () => {};
  const panel = { _view: "edit", _formData: { kind: "circadian" }, _sidebarEventId: "dawn", _legendSelectedIds: new Set(["light.a"]), shadowRoot: { querySelector: () => host }, _setSidebarEvent: () => assert.fail("event cleared"), _setSidebarLight: () => assert.fail("lights cleared"), _setSidebarDocked() {} };
  methods._closeSceneSidebar.call(panel);
  assert.equal(panel._sidebarEventId, "dawn");
  assert.deepEqual([...panel._legendSelectedIds], ["light.a"]);
});

test("the first inherited-event brightness undo snapshot contains no incomplete assignment", () => {
  let before;
  const panel = {
    _view: "edit", _formData: { kind: "circadian" }, _eventBrightnessIsLive: () => false,
    _inheritedEventBrightness: () => 100, _commitUndo() { before = structuredClone(this._formData); },
    _patchDialFromSession() {}, _syncThemePreviewSurfaces() {}, _saveSoon() {},
  };
  methods._writeDialEventBrightness.call(panel, "dawn", 50, { lightId: null, history: true });
  assert.equal(before.event_palettes, undefined);
  assert.deepEqual(panel._formData.event_palettes.dawn.brightness_adjustment, { scale: .5, ceiling: 127.5 });
});

test("collaborative scene saves refresh the open event editor without resetting its selection", async () => {
  const base = { kind: "circadian", overrides: {} };
  const saved = { kind: "circadian", overrides: { "light.a": { dawn: { brightness: 80 } } } };
  let refreshes = 0;
  const panel = {
    isConnected: true, _collabRefreshGeneration: 0, _view: "edit", _editId: "s",
    _sceneBase: base, _formData: structuredClone(base), _sceneRevision: "old",
    _sidebarEventId: "dawn", _legendSelectedIds: new Set(["light.a"]),
    _hass: { callWS: async () => ({ scenes: [{ id: "s", revision: "new", form: saved }] }) },
    _applyAreaCatalog() {}, _rebaseSceneHistory() {}, _syncAppBarTitle() {},
    _patchDialFromSession() {}, _syncSceneUsed() {}, _snapshotSession: () => ({}),
    _refreshInheritedLightDrafts() { refreshes++; assert.equal(this._formData.overrides['light.a'].dawn.brightness, 80); },
  };
  await methods._receiveSavedChange.call(panel, { kind: "scene" });
  assert.equal(panel._error, undefined);
  assert.equal(refreshes, 1);
  assert.equal(panel._sidebarEventId, "dawn");
  assert.deepEqual([...panel._legendSelectedIds], ["light.a"]);
});

test("brightness painting does not regroup the light strip", () => {
  const panel = {
    _lightNameLabels: [],
    _placeLegendModeGroups: () => assert.fail("brightness-only updates must not restructure tiles"),
  };
  for (let i = 0; i < 30; i++) methods._updateLightNameBrightness.call(panel, i);
});

test("Select all does not make an unchanged circadian legend ungrouped", () => {
  const selectAll = { classList: { contains: key => key === "select-all-tile" }, style: {} };
  const strip = { _groupSignature: "", children: [selectAll], querySelectorAll: () => [selectAll] };
  const panel = { _lightNameLabels: [], _variables: [] };
  // Any rebuild would require geometry/DOM APIs absent from this strip.
  methods._placeLegendModeGroups.call(panel, strip);
});

test("Select all names include total membership before and after selecting lights", () => {
  const panel = { _t: (_key, fallback, args) => fallback.replace(/\{(\w+)\}/g, (_match, name) => args[name]) };
  assert.equal(methods._selectAllCaption.call(panel, 35), "Select all (35)");
  assert.equal(methods._selectAllCaption.call(panel, 35, 2), "2 of 35 selected");
  assert.equal(methods._selectAllCaption.call(panel, 35, 35), "35 of 35 selected");
});

test("Reset all is one event-local undo frame and retains the event source and other events", () => {
  const scene = { event_palettes: { dawn: { palette_id: "p", assignment_seed: 7, brightness_adjustment: { scale: 0.5 } } }, overrides: { a: { dawn: { brightness: 20 }, noon: { effect: "saved" } }, b: { dawn: { rgb_color: [1, 2, 3] } } } };
  const source = structuredClone(scene.event_palettes);
  let undo = 0, refresh = 0;
  const panel = { _formData: scene, _sidebarEventId: "dawn", _requireCircadianEvent: () => true, _commitUndo: () => undo++, _refreshCircadianEvent: () => refresh++ };
  panel._deleteLightEventOverride = (id, eventId) => methods._deleteLightEventOverride.call(panel, id, eventId);
  methods._resetCircadianEventLightOverrides.call(panel);
  assert.equal(undo, 1); assert.equal(refresh, 1);
  assert.deepEqual(scene.event_palettes, source);
  assert.deepEqual(scene.overrides, { a: { noon: { effect: "saved" } } });
  methods._resetCircadianEventLightOverrides.call(panel);
  assert.equal(undo, 1); assert.equal(refresh, 1);
});

test("dial cleanup removes unreferenced horizons but retains only the owned exit pixels", () => {
  const live = { remove() { this.removed = true; } };
  const orphan = { remove() { this.removed = true; } };
  const outgoing = { remove() { this.removed = true; } };
  const panel = { shadowRoot: { querySelectorAll: () => [live, orphan, outgoing] }, _outgoingStageLayer: { contains: node => node === outgoing } };
  methods._clearClockBackgrounds.call(panel, { keepOverlay: true });
  assert.equal(live.removed, true); assert.equal(orphan.removed, true);
  assert.equal(outgoing.removed, undefined);
  methods._clearClockBackgrounds.call(panel);
  assert.equal(outgoing.removed, true);
});

test("parking a non-circadian editor removes horizons even without a sun-path reference", () => {
  let cleared = false;
  const panel = { _parkPageBanners() {}, _editorMotionKind: () => "none", _clearClockBackgrounds: options => { assert.equal(options.keepOverlay, true); cleared = true; } };
  methods._parkSunPath.call(panel);
  assert.equal(cleared, true);
  cleared = false;
  panel._editorMotionKind = () => "dial";
  methods._parkSunPath.call(panel);
  assert.equal(cleared, false);
});


test("clicking a selected scene event deselects instead of reopening its editor", async () => {
  const calls = [];
  const panel = { _view: "edit", _sidebarEventId: "dawn",
    _clearSelectedSolarEvent: () => calls.push("clear"),
    _toggleThemeEventSidebar: () => calls.push("open") };
  await methods._toggleEventSceneDialog.call(panel, { id: "dawn" });
  await methods._toggleEventSceneDialog.call(panel, { id: "noon" });
  assert.deepEqual(calls, ["clear", "open"]);
});

test("moving preview time clears the event even without scene playback", () => {
  const calls = [];
  const panel = { _clearSelectedSolarEvent: () => calls.push("clear"), _scenePlayActive: () => false };
  methods._stopScenePlayBecauseTimeChanged.call(panel);
  assert.deepEqual(calls, ["clear"]);
});

test("event deselection closes its editor while preserving shared light selection", () => {
  const selected = new Set(["light.a"]);
  const panel = { _sidebarEventId: "dawn", _legendSelectedIds: selected,
    _setSidebarEvent(id) { this._sidebarEventId = id; },
    _closeSceneSidebar(options) { assert.deepEqual(options, { animate: true, clearSelection: false }); } };
  methods._clearSelectedSolarEvent.call(panel);
  assert.equal(panel._sidebarEventId, null);
  assert.equal(panel._legendSelectedIds, selected);
});

test("ordinary editor refresh paints the card from resolved destination drafts", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../../custom_components/scene_studio/frontend/simple_editor.js", import.meta.url), "utf8");
  const body = source.match(/const refreshFromPanel = \(\) => \{([\s\S]*?)\n  \};/)[1];
  const calls = [];
  const panel = { _simpleMembershipLists: () => ({ members: ["light.new"], removed: [] }) };
  const refresh = new Function("panel", "ensureDraft", "paintCard", "syncTiles", "wheel", "revealLightActionsNow", "tiles", `let members=[], removedMembers=[], selectedIds=new Set(); ${body}`);
  refresh(panel, id => calls.push(`resolve:${id}`), () => calls.push("card"), () => calls.push("tiles"), { sync() {} }, () => {}, {});
  assert.deepEqual(calls, ["resolve:light.new", "card", "tiles"]);
});


test("Select all before event selection uses the current preview instead of a null event", () => {
  const light = { entity_id: "light.a" };
  const panel = { _sidebarEventId: null, _sunPath: { lights: [light] },
    _clockSunIdleSeconds: () => 123,
    _clockLegendTileLook(row, seconds) { assert.equal(row, light); assert.equal(seconds, 123); return { fillPct: 40 }; },
    _dialEventBrightness(event, id) { assert.equal(event, "dawn"); assert.equal(id, "light.a"); return 200; } };
  assert.equal(methods._circadianSelectionBrightness.call(panel, "light.a"), 102);
  panel._sidebarEventId = "dawn";
  assert.equal(methods._circadianSelectionBrightness.call(panel, "light.a"), 200);
});
