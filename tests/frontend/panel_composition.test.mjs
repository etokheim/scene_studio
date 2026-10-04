import assert from "node:assert/strict";
import test from "node:test";
import { installPanelMethods } from "../../custom_components/scene_studio/frontend/panel_composition.js";
import { editorHistoryMethods } from "../../custom_components/scene_studio/frontend/editor_history.js";

test("method owners retain the panel receiver and non-enumerable class descriptors", () => {
  class Panel { save(value) { this.saved = value; } }
  installPanelMethods(Panel.prototype, { interaction: { change(value) { this.save(value); } } });
  const panel = new Panel();
  panel.change(42);
  assert.equal(panel.saved, 42);
  assert.equal(Object.getOwnPropertyDescriptor(Panel.prototype, "change").enumerable, false);
  assert.equal(Object.getOwnPropertyDescriptor(Panel.prototype, "change").writable, true);
});

test("duplicate owners fail before installing any methods", () => {
  const prototype = { existing() {} };
  assert.throws(() => installPanelMethods(prototype, {
    first: { fresh() {} }, second: { existing() {} },
  }), /Duplicate panel method existing/);
  assert.equal(prototype.fresh, undefined);
  assert.throws(() => installPanelMethods({}, {
    first: { change() {} }, second: { change() {} },
  }), /Duplicate panel method change/);
});

test("history snapshots are isolated from later draft edits", () => {
  const panel = { _formData: { lights: { a: { brightness: 50 } } },
    _nativeDrafts: {}, _themeDraft: { events: {} }, _variableDraft: null };
  const snapshot = editorHistoryMethods._snapshotSession.call(panel);
  panel._formData.lights.a.brightness = 80;
  panel._themeDraft.events.dawn = {};
  assert.equal(snapshot.form.lights.a.brightness, 50);
  assert.deepEqual(snapshot.theme.events, {});
});

test("undo retains the destination and own edit rather than remote replacement", () => {
  const entry = { session: { form: { name: "before" } }, target: { editId: "scene" } };
  const panel = { _undoStack: [entry], _redoStack: [], _historyRestoring: false,
    _finishSimpleUndo() {}, _sameHistoryTarget: () => true,
    _snapshotSession: () => ({ form: { name: "after" } }),
    _restoreHistory(item, direction) { this.restored = [item, direction]; },
    _syncUndoButtons() {}, _historyTarget: () => ({ editId: "different" }) };
  editorHistoryMethods._undo.call(panel);
  assert.equal(panel._redoStack[0].target.editId, "scene");
  assert.deepEqual(panel._redoStack[0].after.form, { name: "after" });
  assert.deepEqual(panel.restored, [entry, "before"]);
});

test("the registered panel exposes each owner's original methods directly", async () => {
  const registry = new Map();
  globalThis.HTMLElement = class {};
  globalThis.customElements = { get: name => registry.get(name), define: (name, value) => registry.set(name, value) };
  await import("../../custom_components/scene_studio/frontend/panel.js");
  const prototype = registry.get("scene-studio-panel").prototype;
  const owners = ["editor_history", "panel_dialogs", "preview_controller", "preview_timeline",
    "dial_sky", "dial_interaction", "dial_renderer", "dial_light_strip",
    "circadian_editor", "panel_catalog", "library_editor"];
  const names = new Set();
  for (const owner of owners) {
    const module = await import(`../../custom_components/scene_studio/frontend/${owner}.js`);
    const methods = Object.values(module)[0];
    for (const [name, fn] of Object.entries(methods)) {
      assert.equal(names.has(name), false, `${name} has more than one owner`);
      names.add(name);
      assert.equal(prototype[name], fn, `${owner}.${name} lost its original call path`);
      assert.equal(Object.getOwnPropertyDescriptor(prototype, name).enumerable, false);
    }
  }
  assert.ok(names.size > 300);
});
