import assert from "node:assert/strict";
import test from "node:test";

import {
  PIN_DRAG_THRESHOLD_PX,
  PIN_GROUP_FRAC,
  clusterNearbyPinIds,
  detachedAfterDrag,
  dragIdsForPin,
  pinPressAction,
  splitIdsByWheelMode,
  disksUnsupportedByDrag,
  wheelPillModes,
} from "../../custom_components/circadian_scenes/frontend/color_ui.js";

const supports =
  (caps) =>
  (id, mode) =>
    Boolean(caps[id]?.[mode === "color" ? "hasColor" : "hasTemp"]);

test("nearby same-mode pins cluster; other modes and off pins stay alone", () => {
  const radius = 200;
  const range = radius * PIN_GROUP_FRAC;
  assert.ok(range >= 8);
  const clusters = clusterNearbyPinIds(
    [
      { id: "a", x: 0, y: 0, mode: "color", off: false },
      { id: "b", x: range - 1, y: 0, mode: "color", off: false },
      { id: "c", x: 0, y: 0, mode: "temp", off: false },
      { id: "d", x: 0, y: 0, mode: "color", off: true },
      { id: "e", x: range + 5, y: 0, mode: "color", off: false },
    ],
    radius
  );
  assert.deepEqual(clusters, [["a", "b"], ["c"], ["d"], ["e"]]);
});

test("a grouped pin drag writes every member", () => {
  assert.deepEqual(
    dragIdsForPin({
      sceneId: "a",
      cluster: ["a", "b"],
      detached: new Set(),
      peeledId: null,
      selected: ["a"],
    }),
    ["a", "b"]
  );
});

test("a peeled or detached pin drags alone even inside a former cluster", () => {
  assert.deepEqual(
    dragIdsForPin({
      sceneId: "b",
      cluster: ["a", "b"],
      detached: new Set(),
      peeledId: "b",
      selected: ["b"],
    }),
    ["b"]
  );
  assert.deepEqual(
    dragIdsForPin({
      sceneId: "a",
      cluster: ["a", "b"],
      detached: new Set(["a"]),
      peeledId: "b",
      selected: ["a"],
    }),
    ["a"]
  );
});

test("select all drags the selection, then drops lights the disk cannot drive", () => {
  const selected = ["color-1", "color-2", "temp-1"];
  assert.deepEqual(
    dragIdsForPin({
      sceneId: "color-1",
      cluster: ["color-1"],
      detached: new Set(),
      peeledId: null,
      selected,
    }),
    selected
  );
  const caps = {
    "color-1": { hasColor: true, hasTemp: false },
    "color-2": { hasColor: true, hasTemp: true },
    "temp-1": { hasColor: false, hasTemp: true },
  };
  assert.deepEqual(splitIdsByWheelMode(selected, "color", supports(caps)), {
    keep: ["color-1", "color-2"],
    drop: ["temp-1"],
  });
  assert.deepEqual(splitIdsByWheelMode(selected, "temp", supports(caps)), {
    keep: ["color-2", "temp-1"],
    drop: ["color-1"],
  });
});

test("a short press on a stack fans; a longer move commits", () => {
  assert.equal(
    pinPressAction({ moved: false, travel: PIN_DRAG_THRESHOLD_PX - 1, stacked: true }),
    "fan"
  );
  assert.equal(
    pinPressAction({ moved: true, travel: PIN_DRAG_THRESHOLD_PX, stacked: true }),
    "commit"
  );
  assert.equal(
    pinPressAction({ moved: false, travel: 0, stacked: false }),
    "commit"
  );
});

test("after a drag, only lights that left the selection stay detached", () => {
  assert.deepEqual(
    detachedAfterDrag(["temp-1", "color-1", "color-2"], ["color-1", "color-2"]),
    ["temp-1"]
  );
});

test("the mode pill lists only modes the selected lights support", () => {
  assert.deepEqual(
    wheelPillModes(
      [
        { hasColor: true, hasTemp: false },
        { hasColor: false, hasTemp: false },
      ],
      { hasColor: true, hasTemp: true }
    ),
    ["color"]
  );
  assert.deepEqual(
    wheelPillModes(
      [
        { hasColor: true, hasTemp: false },
        { hasColor: false, hasTemp: true, palette: true },
      ]
    ),
    ["color", "temp", "palette"]
  );
  assert.deepEqual(
    wheelPillModes([], { hasColor: true, hasTemp: true, palette: false }),
    ["color", "temp"]
  );
});

test("a drag fades a disk none of the dragged lights can use", () => {
  const caps = {
    a: { hasColor: true, hasTemp: false },
    b: { hasColor: true, hasTemp: false },
    c: { hasColor: false, hasTemp: true },
  };
  const of = (id) => caps[id];
  assert.deepEqual(disksUnsupportedByDrag([], of), { color: false, temp: false });
  assert.deepEqual(disksUnsupportedByDrag(["a", "b"], of), { color: false, temp: true });
  assert.deepEqual(disksUnsupportedByDrag(["a", "c"], of), { color: false, temp: false });
  assert.deepEqual(disksUnsupportedByDrag(["c"], of), { color: true, temp: false });
});
