import assert from "node:assert/strict";
import test from "node:test";
import { bindLightTileBrightness } from "../../custom_components/scene_studio/frontend/light_tiles.js";

globalThis.window = globalThis;
globalThis.document = new EventTarget();
function input(type, props) { const ev = new Event(type, { cancelable: true }); Object.assign(ev, props); return ev; }
function harness() {
  const tile = new EventTarget(), hit = new EventTarget();
  tile.classList = { add() {}, remove() {} }; tile.releasePointerCapture = () => {};
  let blocked = 0;
  bindLightTileBrightness(tile, hit, {
    isEditable: () => false, onBlocked: () => { blocked++; },
    getBrightness: () => assert.fail("no event may be resolved"),
    setBrightness: () => assert.fail("no edit may be saved"),
    onDragEnd: () => assert.fail("blocked drag must not commit"),
  });
  return { tile, hit, get blocked() { return blocked; } };
}
test("blocked touch brightness preserves horizontal scrolling and only warns on vertical intent", () => {
  const h = harness();
  h.hit.dispatchEvent(input("pointerdown", { pointerId: 1, clientX: 20, clientY: 20, button: 0 }));
  const horizontal = input("pointermove", { pointerId: 1, clientX: 50, clientY: 22 });
  document.dispatchEvent(horizontal);
  assert.equal(horizontal.defaultPrevented, false); assert.equal(h.blocked, 0);
  document.dispatchEvent(input("pointerup", { pointerId: 1 }));
  h.hit.dispatchEvent(input("pointerdown", { pointerId: 2, clientX: 20, clientY: 20, button: 0 }));
  document.dispatchEvent(input("pointermove", { pointerId: 2, clientX: 22, clientY: 50 }));
  assert.equal(h.blocked, 1);
});
test("horizontal wheel remains available while vertical wheel warns without editing", () => {
  const h = harness();
  const horizontal = input("wheel", { deltaX: 30, deltaY: 0 }); h.tile.dispatchEvent(horizontal);
  assert.equal(horizontal.defaultPrevented, false); assert.equal(h.blocked, 0);
  const fresh = harness(); fresh.tile.dispatchEvent(input("wheel", { deltaX: 0, deltaY: 20 }));
  assert.equal(fresh.blocked, 1);
});

test("wheel brightness finishes one gesture so autosave and subsequent undo frames can proceed", async () => {
  const tile = new EventTarget(), hit = new EventTarget(), writes = [];
  tile.classList = { add() {}, remove() {} };
  let completed = 0;
  bindLightTileBrightness(tile, hit, { isEditable: () => true, getBrightness: () => 120, setBrightness: (value, options) => writes.push({ value, ...options }), onDragEnd: () => { completed++; } });
  tile.dispatchEvent(input("wheel", { deltaX: 0, deltaY: 20 }));
  tile.dispatchEvent(input("wheel", { deltaX: 0, deltaY: 20 }));
  assert.equal(writes.length, 2);
  assert.equal(writes[0].history, true); assert.equal(writes[1].history, false);
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(completed, 1);
  tile.dispatchEvent(input("wheel", { deltaX: 0, deltaY: 20 }));
  assert.equal(writes[2].history, true);
});
