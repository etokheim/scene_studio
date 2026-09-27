import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateMeshWarp,
  meshColors,
  meshGradientPlan,
  meshPresetIndex,
  scaledCardRgb,
  solveMeshWarp,
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

test("one color is a flat fill and the warp stays put when only brightness changes", () => {
  assert.deepEqual(meshGradientPlan([]), {
    flat: true,
    color: [35, 35, 35],
    corners: null,
    preset: 0,
  });
  assert.equal(meshGradientPlan([{ rgb: [12, 80, 220] }]).flat, true);
  const withOff = meshGradientPlan([
    { entity_id: "light.a", rgb: [255, 40, 20] },
    { entity_id: "light.b", rgb: [0, 0, 0] },
    { entity_id: "light.c", rgb: [20, 80, 220] },
  ]);
  assert.equal(withOff.flat, false);
  assert.ok(withOff.corners.every((rgb) => rgb.some((channel) => channel > 0)));
  const dots = [
    { entity_id: "light.a", rgb: [255, 0, 0] },
    { entity_id: "light.b", rgb: [0, 255, 0] },
    { entity_id: "light.c", rgb: [0, 0, 255] },
  ];
  const dimmed = dots.map((dot) => ({
    ...dot,
    rgb: dot.rgb.map((channel) => Math.round(channel / 2)),
  }));
  assert.equal(meshPresetIndex(dots), meshPresetIndex(dimmed));
  assert.equal(meshGradientPlan(dots).preset, meshGradientPlan(dimmed).preset);
  assert.notEqual(meshPresetIndex(dots), meshPresetIndex([
    { entity_id: "light.kitchen", rgb: [1, 2, 3] },
    { entity_id: "light.bedroom", rgb: [4, 5, 6] },
  ]));
});

test("warp weights reconstruct each source point at its destination", () => {
  const sources = [
    [-0.85, -0.9],
    [-0.322, 0.538],
    [0.669, -0.772],
    [0.95, 0.9],
    [-0.053, 0.484],
    [0.797, -0.205],
    [0.031, 0.494],
  ];
  const dests = [
    [-0.85, -0.9],
    [-0.95, 0.9],
    [-0.934, -0.5],
    [0.95, 0.9],
    [-0.625, 0.225],
    [0.544, -0.134],
    [-0.649, -0.061],
  ];
  const weights = solveMeshWarp(sources, dests);
  dests.forEach((dest, index) => {
    const warped = evaluateMeshWarp(dest, dests, weights);
    assert.ok(Math.abs(warped[0] - sources[index][0]) < 1e-6);
    assert.ok(Math.abs(warped[1] - sources[index][1]) < 1e-6);
  });
  const plan = meshGradientPlan([
    { entity_id: "light.a", rgb: [255, 40, 20] },
    { entity_id: "light.b", rgb: [20, 80, 220] },
    { entity_id: "light.c", rgb: [240, 180, 40] },
    { entity_id: "light.d", rgb: [40, 180, 90] },
  ]);
  assert.equal(plan.flat, false);
  assert.equal(plan.corners.length, 4);
  assert.ok(plan.preset >= 0 && plan.preset < 4);
});
