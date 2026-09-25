import assert from "node:assert/strict";
import test from "node:test";

import {
  PIN_DRAG_THRESHOLD_PX,
  PIN_GROUP_FRAC,
  clusterNearbyPinIds,
  dropTargetIds,
  detachedAfterDrag,
  dragIdsForPin,
  pinPressAction,
  splitIdsByWheelMode,
  disksUnsupportedByDrag,
  lightCanUsePalette,
  focusedDiskGeom,
  wheelPillModes,
  wheelStandIn,
  groupRingPoints,
  kelvinTrackDragPoint,
  diskHop,
  placeTempInAnnulus,
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

test("a drag highlights only the pins a drop would join", () => {
  const radius = 200;
  const placed = [
    { id: "drag", x: 0, y: 0, mode: "color", off: false },
    { id: "near", x: 10, y: 0, mode: "color", off: false },
    { id: "other-mode", x: 0, y: 0, mode: "temp", off: false },
    { id: "off", x: 0, y: 0, mode: "color", off: true },
    { id: "far", x: 80, y: 0, mode: "color", off: false },
  ];
  assert.deepEqual(dropTargetIds(placed, radius, ["drag"]), ["near"]);
  assert.deepEqual(dropTargetIds(placed, radius, []), []);
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

test("an open group spreads around a circle in the middle of the wheel", () => {
  const radius = 200;
  const points = groupRingPoints(4, radius);
  assert.equal(points.length, 4);
  const ring = radius * 0.42;
  for (const point of points) {
    const dist = Math.hypot(point.x - radius, point.y - radius);
    assert.ok(Math.abs(dist - ring) < 0.01);
  }
  assert.ok(points[0].y < radius);
  assert.notEqual(points[0].x, points[1].x);
  assert.equal(groupRingPoints(0, radius).length, 0);
  assert.throws(() => groupRingPoints(2, 0));
});

test("a full kelvin disk keeps the drop's horizontal offset", () => {
  const centered = placeTempInAnnulus(4000, 0, 100, 2000, 6500, 1, null);
  const held = placeTempInAnnulus(4000, 0, 100, 2000, 6500, 1, 60);
  assert.equal(centered.x, 0);
  assert.equal(held.y, centered.y);
  assert.ok(held.x > 40);
  assert.throws(() => placeTempInAnnulus(4000, 0, 100, 2000, 6500, 1, Number.NaN));
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
    "select"
  );
});

test("after a drag, only lights that left the selection stay detached", () => {
  assert.deepEqual(
    detachedAfterDrag(["temp-1", "color-1", "color-2"], ["color-1", "color-2"]),
    ["temp-1"]
  );
});

test("the mode pill lists every wheel disk and marks unsupported ones", () => {
  assert.deepEqual(
    wheelPillModes(
      [
        { hasColor: true, hasTemp: false },
        { hasColor: false, hasTemp: false },
      ],
      { hasColor: true, hasTemp: true }
    ),
    [
      { mode: "color", supported: true },
      { mode: "temp", supported: false },
    ]
  );
  assert.deepEqual(
    wheelPillModes(
      [
        { hasColor: true, hasTemp: false },
        { hasColor: false, hasTemp: true, palette: true },
      ],
      { hasColor: true, hasTemp: true, palette: true }
    ),
    [
      { mode: "color", supported: true },
      { mode: "temp", supported: true },
      { mode: "palette", supported: true },
    ]
  );
  assert.deepEqual(
    wheelPillModes([], { hasColor: true, hasTemp: true, palette: false }),
    [
      { mode: "color", supported: true },
      { mode: "temp", supported: true },
    ]
  );
});

test("brightness and on/off selections replace the disks", () => {
  assert.equal(wheelStandIn([]), "disks");
  assert.equal(
    wheelStandIn([{ hasColor: true, hasTemp: false, onOffOnly: false }]),
    "disks"
  );
  assert.equal(
    wheelStandIn([{ hasColor: false, hasTemp: false, onOffOnly: false }]),
    "slider"
  );
  assert.equal(
    wheelStandIn([{ hasColor: false, hasTemp: false, onOffOnly: true }]),
    "switch"
  );
  assert.equal(
    wheelStandIn([
      { hasColor: false, hasTemp: false, onOffOnly: true },
      { hasColor: false, hasTemp: false, onOffOnly: false },
    ]),
    "both"
  );
});

test("an outer kelvin drag stays on the track and resists the color disk", () => {
  const radius = 200;
  const inner = 160;
  const outer = 200;
  const mid = (inner + outer) / 2;
  const onTrack = kelvinTrackDragPoint({
    x: radius + mid,
    y: radius,
    radius,
    inner,
    outer,
    colorOuter: inner,
    colorLive: true,
    tempMin: 2000,
    tempMax: 6500,
    canColor: true,
    hyst: 8,
  });
  assert.ok(onTrack);
  assert.ok(Math.abs(Math.hypot(onTrack.x - radius, onTrack.y - radius) - mid) < 1.5);

  const pulled = kelvinTrackDragPoint({
    x: radius + 168,
    y: radius,
    radius,
    inner,
    outer,
    colorOuter: inner,
    colorLive: true,
    tempMin: 2000,
    tempMax: 6500,
    canColor: true,
    hyst: 8,
  });
  const pulledR = Math.hypot(pulled.x - radius, pulled.y - radius);
  assert.ok(pulledR < mid - 0.5);
  assert.ok(pulledR > 168);

  const blocked = kelvinTrackDragPoint({
    x: radius + 168,
    y: radius,
    radius,
    inner,
    outer,
    colorOuter: inner,
    colorLive: true,
    tempMin: 2000,
    tempMax: 6500,
    canColor: false,
    hyst: 8,
  });
  assert.ok(Math.abs(Math.hypot(blocked.x - radius, blocked.y - radius) - mid) < 1.5);
  assert.equal(
    kelvinTrackDragPoint({
      x: radius,
      y: radius,
      radius,
      inner: 0,
      outer: radius,
      colorLive: false,
      tempMin: 2000,
      tempMax: 6500,
    }),
    null
  );
  const left = kelvinTrackDragPoint({
    x: radius - mid,
    y: radius,
    radius,
    inner,
    outer,
    colorOuter: inner,
    colorLive: true,
    tempMin: 2000,
    tempMax: 6500,
    canColor: false,
    hyst: 8,
  });
  assert.ok(left.x < radius);
  assert.ok(Math.abs(Math.hypot(left.x - radius, left.y - radius) - mid) < 1.5);
  const aboveRight = kelvinTrackDragPoint({
    x: radius + 100,
    y: radius - 200,
    radius,
    inner,
    outer,
    colorOuter: inner,
    colorLive: true,
    tempMin: 2000,
    tempMax: 6500,
    canColor: false,
    hyst: 8,
  });
  const dx = aboveRight.x - radius;
  const dy = aboveRight.y - radius;
  assert.ok(Math.abs(Math.hypot(dx, dy) - mid) < 1.5);
  assert.ok(Math.abs(Math.atan2(dy, dx) - Math.atan2(-200, 100)) < 0.02);
  assert.ok(Math.abs(dy - -200) > 10);
  const three = kelvinTrackDragPoint({
    x: radius + 40,
    y: radius,
    radius,
    inner,
    outer,
    colorLive: false,
    tempMin: 2000,
    tempMax: 6500,
    canColor: false,
  });
  assert.ok(Math.abs(three.y - radius) < 1.5);
});

test("an overlapped kelvin track reaches both temperature ends", () => {
  const radius = 200;
  const inner = 162;
  const outer = 200;
  const mid = (inner + outer) / 2;
  const ends = [
    { y: radius - outer, kelvin: 2000 },
    { y: radius + outer, kelvin: 6535 },
  ];
  for (const end of ends) {
    const pin = kelvinTrackDragPoint({
      x: radius,
      y: end.y,
      radius,
      inner,
      outer,
      colorLive: false,
      tempMin: 2000,
      tempMax: 6535,
      canColor: false,
    });
    assert.equal(pin.kelvin, end.kelvin);
    assert.ok(Math.abs(Math.hypot(pin.x - radius, pin.y - radius) - mid) < 1.5);
  }
});

test("a pin resists at every disk edge and hops one disk at a time", () => {
  const geom = focusedDiskGeom(200, {
    showTemp: true,
    showColor: true,
    showPalette: true,
    focus: "color",
    innerFrac: 0.81,
  });
  const hyst = 8;
  const canUse = () => true;
  const paletteOuter = geom.palette.outer;
  assert.equal(diskHop(geom, "temp", paletteOuter - hyst + 1, hyst, canUse), "temp");
  assert.equal(diskHop(geom, "temp", paletteOuter - hyst - 1, hyst, canUse), "palette");
  const colorOuter = geom.color.outer;
  assert.equal(diskHop(geom, "palette", colorOuter - hyst + 1, hyst, canUse), "palette");
  assert.equal(diskHop(geom, "palette", colorOuter - hyst - 1, hyst, canUse), "color");
  assert.equal(diskHop(geom, "color", colorOuter + hyst - 1, hyst, canUse), "color");
  assert.equal(diskHop(geom, "color", colorOuter + hyst + 1, hyst, canUse), "palette");
  assert.equal(
    diskHop(geom, "palette", paletteOuter + hyst + 1, hyst, canUse),
    "temp"
  );
  assert.equal(
    diskHop(geom, "temp", colorOuter - hyst + 1, hyst, (name) => name !== "palette"),
    "temp"
  );
  assert.equal(
    diskHop(geom, "temp", colorOuter - hyst - 1, hyst, (name) => name !== "palette"),
    "color"
  );
});

test("a drag fades a disk none of the dragged lights can use", () => {
  const caps = {
    a: { hasColor: true, hasTemp: false, canPalette: true },
    b: { hasColor: true, hasTemp: false, canPalette: true },
    c: { hasColor: false, hasTemp: true, canPalette: false },
    d: { hasColor: false, hasTemp: true, canPalette: true },
  };
  const of = (id) => caps[id];
  assert.deepEqual(disksUnsupportedByDrag([], of), {
    color: false,
    temp: false,
    palette: false,
  });
  assert.deepEqual(disksUnsupportedByDrag(["a", "b"], of), {
    color: false,
    temp: true,
    palette: false,
  });
  assert.deepEqual(disksUnsupportedByDrag(["a", "c"], of), {
    color: false,
    temp: false,
    palette: false,
  });
  assert.deepEqual(disksUnsupportedByDrag(["c"], of), {
    color: true,
    temp: false,
    palette: true,
  });
  assert.deepEqual(disksUnsupportedByDrag(["d"], of), {
    color: true,
    temp: false,
    palette: false,
  });
});

test("a color bulb can join any palette; a temperature bulb only an all-kelvin one", () => {
  const mixed = {
    kind: "palette",
    slots: [
      { color: { color_mode: "hs", hs_color: [20, 80] } },
      { color: { color_mode: "color_temp", color_temp_kelvin: 2700 } },
      { color: { color_mode: "hs", hs_color: [200, 70] } },
      { color: { color_mode: "color_temp", color_temp_kelvin: 4000 } },
      { color: { color_mode: "hs", hs_color: [40, 60] } },
    ],
  };
  const kelvin = {
    kind: "palette",
    slots: Array.from({ length: 5 }, () => ({
      color: { color_mode: "color_temp", color_temp_kelvin: 2700 },
    })),
  };
  const colorBulb = { hasColor: true, hasTemp: true };
  const rgbOnly = { hasColor: true, hasTemp: false };
  const tempBulb = { hasColor: false, hasTemp: true };
  const colorOnly = {
    kind: "palette",
    slots: Array.from({ length: 5 }, () => ({
      color: { color_mode: "hs", hs_color: [20, 80] },
    })),
  };
  assert.equal(lightCanUsePalette(colorBulb, mixed, []), true);
  assert.equal(lightCanUsePalette(rgbOnly, mixed, []), false);
  assert.equal(lightCanUsePalette(rgbOnly, colorOnly, []), true);
  assert.equal(lightCanUsePalette(tempBulb, mixed, []), false);
  assert.equal(lightCanUsePalette(tempBulb, kelvin, []), true);
  assert.equal(lightCanUsePalette({ hasColor: false, hasTemp: false }, kelvin, []), false);
});

test("palette sits inside the kelvin ring when no light is in color mode", () => {
  const radius = 200;
  const innerFrac = 0.81;
  const geom = focusedDiskGeom(radius, {
    showTemp: true,
    showColor: false,
    showPalette: true,
    focus: "palette",
    innerFrac,
  });
  assert.equal(geom.temp.outer, radius);
  assert.ok(geom.temp.inner > geom.palette.outer - 1);
  assert.ok(geom.palette.outer < radius - 1);
  assert.ok(geom.palette.inner <= 1);
  assert.ok(geom.color.outer - geom.color.inner < 2);
});

test("three disks keep kelvin outside and the focused disk innermost", () => {
  const radius = 200;
  const innerFrac = 0.81;
  const colorFront = focusedDiskGeom(radius, {
    showTemp: true,
    showColor: true,
    showPalette: true,
    focus: "color",
    innerFrac,
  });
  assert.equal(colorFront.front, "color");
  assert.equal(colorFront.temp.outer, radius);
  assert.ok(colorFront.palette.outer < colorFront.temp.inner + 1);
  assert.ok(colorFront.color.outer < colorFront.palette.outer);
  assert.ok(colorFront.color.inner <= 1);
  const paletteFront = focusedDiskGeom(radius, {
    showTemp: true,
    showColor: true,
    showPalette: true,
    focus: "palette",
    innerFrac,
  });
  assert.equal(paletteFront.front, "palette");
  assert.ok(paletteFront.palette.outer < paletteFront.color.outer);
  assert.equal(paletteFront.temp.outer, radius);
});
