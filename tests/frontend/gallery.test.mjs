import assert from "node:assert/strict";
import test from "node:test";

import {
  galleryCopyName,
  galleryPalette,
  galleryTheme,
  paletteSlotSignature,
  themeDraftSignature,
  themeEventSignature,
} from "../../custom_components/scene_studio/frontend/gallery.js";

test("a repeated picture palette gets the next free name", () => {
  assert.equal(galleryCopyName("Mantel", []), "Mantel");
  assert.equal(galleryCopyName("Mantel", ["Mantel"]), "Mantel 2");
  assert.equal(galleryCopyName("Mantel", ["Mantel", "Mantel 2"]), "Mantel 3");
});

test("a theme event matches its preset until the palette or brightness changes", () => {
  const sunrise = galleryTheme("daylight").events.sunrise;
  assert.equal(sunrise.palette, "pale-gold");
  const variables = [
    { id: "pal-1", kind: "palette", builtin_id: "pale-gold", slots: [] },
  ];
  const saved = {
    color: { variable_ref: "pal-1" },
    brightness: sunrise.brightness,
    assignment_seed: 0,
  };
  assert.equal(themeEventSignature(saved, variables), themeEventSignature(sunrise));
  assert.equal(
    themeDraftSignature(
      { variable_ref: "pal-1", brightness: sunrise.brightness, assignment_seed: 0 },
      variables
    ),
    themeEventSignature(sunrise)
  );
  assert.notEqual(
    themeEventSignature(
      { ...saved, brightness: sunrise.brightness - 10 },
      variables
    ),
    themeEventSignature(sunrise)
  );
  assert.notEqual(
    themeEventSignature(
      {
        ...saved,
        color: { variable_ref: "pal-1", palette_t: 0.2, palette_r: 1 },
      },
      variables
    ),
    themeEventSignature(sunrise)
  );
  const dawn = galleryTheme("daylight").events.dawn;
  assert.equal(
    themeEventSignature({ color: dawn.color, brightness: dawn.brightness }),
    themeEventSignature(dawn)
  );
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
