import assert from "node:assert/strict";
import test from "node:test";

import {
  lightPointLayout,
  lightPointRadius,
  meshColors,
  scaledCardRgb,
} from "../../custom_components/scene_studio/frontend/card_mesh.js";

test("card dots scale chromatic rgb by brightness", () => {
  assert.deepEqual(
    scaledCardRgb([200, 100, 0], { state: "on", brightness: 128 }),
    [100, 50, 0]
  );
  assert.deepEqual(
    scaledCardRgb([200, 100, 0], { state: "off", brightness: 255 }),
    [0, 0, 0]
  );
  assert.deepEqual(
    scaledCardRgb([200, 100, 0], { state: "on", brightness: 0 }),
    [0, 0, 0]
  );
  assert.deepEqual(scaledCardRgb(null, { state: "on", brightness: 255 }), [0, 0, 0]);
});

test("mesh colors reject malformed values and deduplicate", () => {
  assert.deepEqual(
    meshColors([
      { rgb: [255, 0, 0] },
      { rgb: [255, 0, 0] },
      { rgb: ["0", 255, 0] },
      { rgb: null },
    ]),
    [
      [255, 0, 0],
      [0, 255, 0],
    ]
  );
});

test("empty and single-color cards are a flat fill", () => {
  assert.deepEqual(lightPointLayout([]), { base: [35, 35, 35], points: [] });
  assert.deepEqual(lightPointLayout([[12, 80, 220]]), {
    base: [12, 80, 220],
    points: [],
  });
});

test("each unique color is a circle at a stable scatter", () => {
  const colors = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];
  const layout = lightPointLayout(colors);
  assert.deepEqual(layout.base, colors[0]);
  assert.equal(layout.points.length, 3);
  const expected = [
    [0.4, 0.2],
    [0.8, 0],
    [0, 0.5],
  ];
  layout.points.forEach((point, index) => {
    assert.deepEqual(point.rgb, colors[index]);
    assert.deepEqual([point.x, point.y], expected[index]);
    assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
    assert.equal(point.radius, lightPointRadius(point.x, point.y));
    const farthest = Math.max(
      Math.hypot(point.x, point.y),
      Math.hypot(1 - point.x, point.y),
      Math.hypot(point.x, 1 - point.y),
      Math.hypot(1 - point.x, 1 - point.y)
    );
    assert.equal(point.radius, farthest / 2);
  });
  assert.deepEqual(lightPointLayout(colors), layout);
});
