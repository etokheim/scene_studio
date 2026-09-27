import assert from "node:assert/strict";
import test from "node:test";

import {
  compareScenesForList,
  isGenericLightName,
  lightDisplayName,
  stripAreaPrefix,
} from "../../custom_components/scene_studio/frontend/display_names.js";
import { circularRampBackground } from "../../custom_components/scene_studio/frontend/landing.js";

test("stripAreaPrefix drops a leading area name and its separator", () => {
  assert.equal(stripAreaPrefix("Kitchen Ceiling", "Kitchen"), "Ceiling");
  assert.equal(stripAreaPrefix("Kitchen - Ceiling", "Kitchen"), "Ceiling");
  assert.equal(stripAreaPrefix("kitchen circadian", "Kitchen"), "circadian");
  assert.equal(stripAreaPrefix("Kitchenette lamp", "Kitchen"), "Kitchenette lamp");
  assert.equal(stripAreaPrefix("Kitchen", "Kitchen"), "Kitchen");
  assert.equal(stripAreaPrefix("Hall light", ""), "Hall light");
});

test("lightDisplayName prefers the device when the entity is just Light", () => {
  assert.equal(isGenericLightName("Light"), true);
  assert.equal(
    lightDisplayName({
      friendlyName: "Light",
      deviceName: "Kitchen Ceiling",
      entityId: "light.kitchen_ceiling",
      areaName: "Kitchen",
    }),
    "Ceiling"
  );
  assert.equal(
    lightDisplayName({
      friendlyName: "Reading lamp",
      deviceName: "Other",
      areaName: "Kitchen",
    }),
    "Reading lamp"
  );
});

test("compareScenesForList puts hidden then disabled last", () => {
  const scenes = [
    { scene_name: "B", disabled: true },
    { scene_name: "A" },
    { scene_name: "C", hidden: true },
    { scene_name: "D" },
  ];
  assert.deepEqual(
    [...scenes].sort(compareScenesForList).map((scene) => scene.scene_name),
    ["A", "D", "C", "B"]
  );
});

test("circularRampBackground is a conic of the day", () => {
  const css = circularRampBackground([
    {
      stops: [
        [10, 0, 0],
        [20, 0, 0],
        [30, 0, 0],
        [40, 0, 0],
        [50, 0, 0],
      ],
    },
  ]);
  assert.match(css, /^conic-gradient\(from 180deg,/);
  assert.match(css, /rgb\(10, 0, 0\)/);
  assert.match(css, /rgb\(30, 0, 0\)/);
});
