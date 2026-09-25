import assert from "node:assert/strict";
import test from "node:test";

import {
  galleryCopyName,
  galleryPalette,
  paletteSlotSignature,
} from "../../custom_components/scene_studio/frontend/gallery.js";

test("a repeated picture palette gets the next free name", () => {
  assert.equal(galleryCopyName("Mantel", []), "Mantel");
  assert.equal(galleryCopyName("Mantel", ["Mantel"]), "Mantel 2");
  assert.equal(galleryCopyName("Mantel", ["Mantel", "Mantel 2"]), "Mantel 3");
});

test("a palette slot matches its built-in color until something changes", () => {
  const source = galleryPalette("wool");
  assert.ok(source);
  const slot = source.slots[0];
  assert.equal(paletteSlotSignature(slot), paletteSlotSignature(structuredClone(slot)));
  assert.notEqual(
    paletteSlotSignature(slot),
    paletteSlotSignature({ ...slot, brightness: slot.brightness - 10 })
  );
  assert.equal(paletteSlotSignature({ variable_ref: "other" }), "ref:other");
});
