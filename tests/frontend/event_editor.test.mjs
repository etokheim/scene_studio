import assert from "node:assert/strict";
import test from "node:test";
import { EventGuidance, eventSourceChanged, lightOverrideRows } from "../../custom_components/scene_studio/frontend/event_editor.js";

function clock() {
  let now = 0, id = 0;
  const jobs = new Map();
  return {
    setTimeout(fn, delay) { const key = ++id; jobs.set(key, { at: now + delay, fn }); return key; },
    clearTimeout(key) { jobs.delete(key); },
    advance(delay) {
      const end = now + delay;
      while (true) {
        const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at; jobs.delete(next[0]); next[1].fn();
      }
      now = end;
    },
    get pending() { return jobs.size; },
  };
}

test("event guidance holds three seconds after fade-in, pulses once, and fades away", () => {
  const timers = clock(), calls = [];
  const guidance = new EventGuidance({ timers, show: () => calls.push("show"), hide: immediate => calls.push(immediate ? "remove" : "fade"), pulse: () => calls.push("pulse"), reducedMotion: () => false });
  guidance.show(); calls.length = 0;
  timers.advance(1279); assert.deepEqual(calls, []);
  timers.advance(1); assert.deepEqual(calls, ["pulse"]);
  timers.advance(1999); assert.deepEqual(calls, ["pulse"]);
  timers.advance(1); assert.deepEqual(calls, ["pulse", "fade"]);
  timers.advance(280); assert.deepEqual(calls, ["pulse", "fade", "remove"]);
  assert.equal(timers.pending, 0);
});

test("repeated attempts replace one lifecycle; event selection/navigation cancels pending pulse and cleanup", () => {
  const timers = clock(), calls = [];
  const guidance = new EventGuidance({ timers, show: () => calls.push("show"), hide: immediate => calls.push(immediate ? "remove" : "fade"), pulse: () => calls.push("pulse"), reducedMotion: () => false });
  guidance.show(); timers.advance(1000); guidance.show();
  assert.equal(timers.pending, 2);
  timers.advance(1000); assert.equal(calls.includes("pulse"), false);
  guidance.cancel(); assert.equal(timers.pending, 0);
  calls.length = 0; timers.advance(10000); assert.deepEqual(calls, []);
});

test("reduced motion retains notification timing without pulsing", () => {
  const timers = clock(), calls = [];
  const guidance = new EventGuidance({ timers, show() {}, hide: immediate => calls.push(immediate), pulse: () => assert.fail("motion"), reducedMotion: () => true });
  guidance.show(); timers.advance(3560);
  assert.deepEqual(calls, [true, false, true]);
});

const theme = { events: { dawn: { color: { color_mode: "color_temp", color_temp_kelvin: 2700 }, brightness: 100 } } };
test("source reset appears for a different preset or adjustment, not a randomization seed", () => {
  assert.equal(eventSourceChanged({ event_palettes: { dawn: { assignment_seed: 9 } } }, theme, "dawn"), false);
  assert.equal(eventSourceChanged({ event_palettes: { dawn: { brightness_adjustment: { scale: .5, ceiling: 255 } } } }, theme, "dawn"), true);
  assert.equal(eventSourceChanged({ event_palettes: { dawn: { palette_id: "p" } } }, theme, "dawn"), true);
  assert.equal(eventSourceChanged({ event_palettes: { dawn: { palette_id: "p", assignment_seed: 9 } } }, { events: { dawn: { color: { variable_ref: "p" } } } }, "dawn"), false);
});

test("override summaries compare current adjusted inheritance and leave other lights/events intact", () => {
  const scene = { event_palettes: { dawn: { brightness_adjustment: { scale: .5, ceiling: 255 } } }, overrides: { "light.a": { dawn: { brightness: 80, effect: "rainbow" }, noon: { brightness: 10 } }, "light.b": { noon: { brightness: 20 } } } };
  const original = structuredClone(scene);
  const rows = lightOverrideRows(scene, theme, "dawn", [], (_id, state) => state);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].before.brightness, 50);
  assert.equal(rows[0].after.brightness, 80);
  assert.deepEqual(rows[0].fields, ["brightness", "effect"]);
  assert.deepEqual(scene, original);
});

test("override summary colors use capability adaptation and treat color as one field", () => {
  const scene = { overrides: { "light.a": { dawn: { color_mode: "rgb", rgb_color: [255, 0, 0], brightness: 80 } } } };
  const rows = lightOverrideRows(scene, theme, "dawn", [], (_id, state) => ({ state: state.state, brightness: state.brightness }));
  assert.deepEqual(rows[0].fields, ["brightness", "color"]);
  assert.equal(rows[0].before.color_mode, undefined);
  assert.equal(rows[0].after.color_mode, undefined);
});
