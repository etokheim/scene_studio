import assert from "node:assert/strict";
import test from "node:test";

import {
  binaryDragPreview,
  binaryWheelPreview,
  groupSelectionAfterClick,
  groupTitleStickState,
  lightTileColorGroup,
  lightTileGroupOrder,
  proportionalFillPercent,
  relativeFillPercent,
  selectAllDisplayedFill,
  selectAllOnOffState,
  selectAllTileAction,
  tileSelectionAfterClick,
} from "../../custom_components/circadian_scenes/frontend/light_tiles.js";

const ids = ["a", "b", "c", "d"];

test("color mode buckets follow the strip order", () => {
  assert.deepEqual(lightTileGroupOrder(), [
    "color",
    "temp",
    "white",
    "brightness",
    "onoff",
  ]);
  assert.equal(lightTileColorGroup({ color_mode: "hs" }), "color");
  assert.equal(lightTileColorGroup({ color_mode: "xy" }), "color");
  assert.equal(lightTileColorGroup({ rgb_color: [1, 2, 3] }), "color");
  assert.equal(lightTileColorGroup({ color_mode: "color_temp" }), "temp");
  assert.equal(lightTileColorGroup({ color_temp_kelvin: 2700 }), "temp");
  assert.equal(lightTileColorGroup({ color_mode: "white" }), "white");
  assert.equal(lightTileColorGroup({ color_mode: "brightness" }), "brightness");
  assert.equal(lightTileColorGroup({ color_mode: "onoff" }), "onoff");
  assert.equal(
    lightTileColorGroup(
      { color_mode: "onoff" },
      { known: true, hasColor: false, hasTemp: false, onOff: true }
    ),
    "onoff"
  );
  assert.equal(lightTileColorGroup({ color_mode: "rgbw" }), "color");
  assert.equal(lightTileColorGroup({ color_mode: "rgbww" }), "color");
  assert.equal(
    lightTileColorGroup({ color_mode: "hs", color_temp_kelvin: 2700 }),
    "color"
  );
  assert.equal(lightTileColorGroup({}), "brightness");
  const palettes = new Set(["pal-1"]);
  assert.equal(
    lightTileColorGroup({ variable_ref: "pal-1", color_mode: "hs" }, undefined, palettes),
    "palette:pal-1"
  );
  assert.equal(
    lightTileColorGroup({ variable_ref: "other", color_mode: "hs" }, undefined, palettes),
    "color"
  );
  assert.equal(
    lightTileColorGroup(
      { variable_ref: "pal-1", color_mode: "hs" },
      { known: true, hasColor: false, hasTemp: true },
      palettes
    ),
    "temp"
  );
  assert.equal(
    lightTileColorGroup(
      { variable_ref: "pal-1", color_mode: "brightness" },
      { known: true, hasColor: false, hasTemp: false },
      palettes
    ),
    "brightness"
  );
  assert.equal(
    lightTileColorGroup(
      { variable_ref: "pal-1", color_mode: "onoff" },
      { known: true, hasColor: false, hasTemp: false, onOff: true },
      palettes
    ),
    "onoff"
  );
  assert.deepEqual(lightTileGroupOrder(["palette:b", "palette:a"]), [
    "palette:b",
    "palette:a",
    "color",
    "temp",
    "white",
    "brightness",
    "onoff",
  ]);
  assert.equal(
    lightTileColorGroup(
      { color_mode: "color_temp", color_temp_kelvin: 2286 },
      { known: true, hasColor: false, hasTemp: false }
    ),
    "brightness"
  );
  assert.equal(
    lightTileColorGroup(
      { color_mode: "white" },
      { known: true, hasColor: false, hasTemp: false }
    ),
    "white"
  );
  assert.equal(
    lightTileColorGroup(
      { color_mode: "color_temp", color_temp_kelvin: 2180 },
      { known: true, hasColor: true, hasTemp: true }
    ),
    "temp"
  );
});

test("a plain click on the only selected light clears it", () => {
  const next = tileSelectionAfterClick({
    ids,
    selected: ["c"],
    anchorId: "c",
    entityId: "c",
    shiftKey: false,
    toggleKey: false,
  });
  assert.deepEqual(next, { selected: [], anchorId: null });
});

test("plain click replaces the selection and moves the anchor", () => {
  const next = tileSelectionAfterClick({
    ids,
    selected: ["a", "b"],
    anchorId: "a",
    entityId: "c",
    shiftKey: false,
    toggleKey: false,
  });
  assert.deepEqual(next, { selected: ["c"], anchorId: "c" });
});

test("cmd/ctrl click toggles one id and keeps strip order", () => {
  const added = tileSelectionAfterClick({
    ids,
    selected: ["a"],
    anchorId: "a",
    entityId: "c",
    shiftKey: false,
    toggleKey: true,
  });
  assert.deepEqual(added.selected, ["a", "c"]);
  assert.equal(added.anchorId, "c");
  const removed = tileSelectionAfterClick({
    ids,
    selected: added.selected,
    anchorId: added.anchorId,
    entityId: "a",
    shiftKey: false,
    toggleKey: true,
  });
  assert.deepEqual(removed.selected, ["c"]);
  assert.equal(removed.anchorId, "a");
});

test("shift click selects the inclusive range and keeps the anchor", () => {
  const forward = tileSelectionAfterClick({
    ids,
    selected: ["b"],
    anchorId: "b",
    entityId: "d",
    shiftKey: true,
    toggleKey: false,
  });
  assert.deepEqual(forward.selected, ["b", "c", "d"]);
  assert.equal(forward.anchorId, "b");
  const backward = tileSelectionAfterClick({
    ids,
    selected: ["d"],
    anchorId: "d",
    entityId: "b",
    shiftKey: true,
    toggleKey: false,
  });
  assert.deepEqual(backward.selected, ["b", "c", "d"]);
  assert.equal(backward.anchorId, "d");
});

test("shift without an anchor does not invent a range", () => {
  const plain = tileSelectionAfterClick({
    ids,
    selected: ["a", "b"],
    anchorId: null,
    entityId: "d",
    shiftKey: true,
    toggleKey: false,
  });
  assert.deepEqual(plain, { selected: ["d"], anchorId: "d" });
  const toggled = tileSelectionAfterClick({
    ids,
    selected: ["a"],
    anchorId: "missing",
    entityId: "c",
    shiftKey: true,
    toggleKey: true,
  });
  assert.deepEqual(toggled.selected, ["a", "c"]);
  assert.equal(toggled.anchorId, "c");
});

test("shift wins over cmd/ctrl when the anchor is in the strip", () => {
  const next = tileSelectionAfterClick({
    ids,
    selected: ["a"],
    anchorId: "a",
    entityId: "c",
    shiftKey: true,
    toggleKey: true,
  });
  assert.deepEqual(next.selected, ["a", "b", "c"]);
  assert.equal(next.anchorId, "a");
});

test("a group click selects that group, and again removes it", () => {
  const selected = groupSelectionAfterClick({
    ids: ["b", "c"],
    selected: ["a"],
    toggleKey: false,
  });
  assert.deepEqual(selected, { selected: ["b", "c"], anchorId: "b" });
  const cleared = groupSelectionAfterClick({
    ids: ["b", "c"],
    selected: ["a", "b", "c"],
    toggleKey: false,
  });
  assert.deepEqual(cleared, { selected: ["a"], anchorId: "a" });
});

test("cmd or shift on a group adds it, or removes it when it is all selected", () => {
  const added = groupSelectionAfterClick({
    ids: ["c", "d"],
    selected: ["a"],
    toggleKey: true,
  });
  assert.deepEqual(added, { selected: ["a", "c", "d"], anchorId: "c" });
  const removed = groupSelectionAfterClick({
    ids: ["c", "d"],
    selected: added.selected,
    toggleKey: true,
  });
  assert.deepEqual(removed, { selected: ["a"], anchorId: "a" });
});

test("cmd/ctrl click can clear the last selected id", () => {
  const next = tileSelectionAfterClick({
    ids,
    selected: ["b"],
    anchorId: "b",
    entityId: "b",
    shiftKey: false,
    toggleKey: true,
  });
  assert.deepEqual(next.selected, []);
  assert.equal(next.anchorId, "b");
});

test("select all scales each light with the shown average", () => {
  assert.equal(proportionalFillPercent(100, 75, 37.5), 50);
  assert.equal(proportionalFillPercent(50, 75, 37.5), 25);
  assert.equal(proportionalFillPercent(0, 75, 37.5), 0);
  assert.equal(proportionalFillPercent(80, 40, 80), 100);
  assert.equal(proportionalFillPercent(10, 0, 40), 40);
});

test("select all keeps each light's brightness offset", () => {
  assert.equal(relativeFillPercent(20, 30), 50);
  assert.equal(relativeFillPercent(80, 30), 100);
  assert.equal(relativeFillPercent(20, 30) === relativeFillPercent(80, 30), false);
  assert.equal(relativeFillPercent(10, -40), 0);
  assert.equal(selectAllTileAction(0), "all");
  assert.equal(selectAllTileAction(1), "all");
  assert.equal(selectAllTileAction(2), "clear");
});

test("select all brightness ignores on/off lights and flips them at 50%", () => {
  assert.equal(selectAllDisplayedFill([20, 40]), 30);
  assert.equal(selectAllDisplayedFill([80]), 80);
  assert.equal(selectAllDisplayedFill([]), null);
  assert.equal(selectAllOnOffState(50), "on");
  assert.equal(selectAllOnOffState(49), "off");
  assert.throws(() => selectAllDisplayedFill([Number.NaN]));
  assert.throws(() => selectAllOnOffState(Number.NaN));
});

test("on/off drag resists and snaps across halfway", () => {
  const held = binaryDragPreview({ startFill: 0, deltaPct: 40 });
  assert.equal(held.snapOn, false);
  assert.equal(held.snapOff, false);
  assert.ok(held.preview < 50);
  const on = binaryDragPreview({ startFill: 0, deltaPct: 100 });
  assert.equal(on.snapOn, true);
  const off = binaryDragPreview({ startFill: 100, deltaPct: -100 });
  assert.equal(off.snapOff, true);
  const wheeled = binaryWheelPreview({ startFill: 0, stepPct: 40 });
  assert.equal(wheeled.snapOn, true);
  const shortWheel = binaryWheelPreview({ startFill: 0, stepPct: 10 });
  assert.equal(shortWheel.snapOn, false);
});

test("group title ramp stays off until the title sticks", () => {
  const resting = groupTitleStickState({
    naturalLeft: 80,
    labelLeft: 80,
    labelRight: 108,
    innerRight: 400,
  });
  assert.deepEqual(resting, {
    shift: 0,
    stuck: false,
    extra: 0,
    rampLeft: 0,
    radius: 23,
  });
  const jitter = groupTitleStickState({
    naturalLeft: 80.4,
    labelLeft: 80,
    labelRight: 108,
    innerRight: 400,
  });
  assert.equal(jitter.stuck, false);
  assert.equal(jitter.extra, 0);
  const stuck = groupTitleStickState({
    naturalLeft: 40,
    labelLeft: 80,
    labelRight: 108,
    innerRight: 400,
  });
  assert.equal(stuck.stuck, true);
  assert.equal(stuck.shift, 40);
  assert.equal(stuck.extra, 40);
  assert.equal(stuck.rampLeft, 0);
  assert.equal(stuck.radius, 0);
  const early = groupTitleStickState({
    naturalLeft: 74,
    labelLeft: 80,
    labelRight: 108,
    innerRight: 400,
  });
  assert.equal(early.shift, 6);
  assert.equal(early.rampLeft, 6);
  assert.equal(early.radius, 23);
  const ending = groupTitleStickState({
    naturalLeft: -20,
    labelLeft: 8,
    labelRight: 36,
    innerRight: 50,
  });
  assert.equal(ending.extra, 14);
});
