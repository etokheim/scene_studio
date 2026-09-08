import assert from "node:assert/strict";
import test from "node:test";

import {
  meshColors,
  sampleMeshColor,
} from "../../custom_components/circadian_scenes/frontend/card_mesh.js";

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

test("empty and single-color meshes are invariant", () => {
  assert.deepEqual(sampleMeshColor([], 0.4, 0.6), [35, 35, 35]);
  for (const point of [
    [0, 0],
    [0.5, 0.5],
    [1, 1],
  ]) {
    assert.deepEqual(sampleMeshColor([[12, 80, 220]], ...point), [12, 80, 220]);
  }
});

test("mesh samples vertices and interpolates inside triangles", () => {
  const colors = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];
  assert.deepEqual(sampleMeshColor(colors, 0, 0), [255, 0, 0]);
  const middle = sampleMeshColor(colors, 0.15, 0.2);
  assert.ok(middle.every((channel) => channel >= 0 && channel <= 255));
  assert.notDeepEqual(middle, colors[0]);
  assert.deepEqual(sampleMeshColor(colors, 0.15, 0.2), middle);
});
