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
