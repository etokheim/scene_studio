import assert from "node:assert/strict";
import test from "node:test";

import {
  lightTileColorGroup,
  lightTileGroupOrder,
  tileSelectionAfterClick,
} from "../../custom_components/circadian_scenes/frontend/light_tiles.js";

const ids = ["a", "b", "c", "d"];

test("color mode buckets follow the strip order", () => {
  assert.deepEqual(lightTileGroupOrder(), ["color", "temp", "white", "brightness"]);
  assert.equal(lightTileColorGroup({ color_mode: "hs" }), "color");
  assert.equal(lightTileColorGroup({ color_mode: "xy" }), "color");
  assert.equal(lightTileColorGroup({ rgb_color: [1, 2, 3] }), "color");
  assert.equal(lightTileColorGroup({ color_mode: "color_temp" }), "temp");
  assert.equal(lightTileColorGroup({ color_temp_kelvin: 2700 }), "temp");
  assert.equal(lightTileColorGroup({ color_mode: "white" }), "white");
  assert.equal(lightTileColorGroup({ color_mode: "brightness" }), "brightness");
  assert.equal(lightTileColorGroup({ color_mode: "onoff" }), "brightness");
  assert.equal(lightTileColorGroup({}), "brightness");
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
