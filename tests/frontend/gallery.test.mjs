import assert from "node:assert/strict";
import test from "node:test";

import {
  galleryCopyName,
  galleryPalette,
  galleryTheme,
  paletteMatchesGallery,
  paletteSlotSignature,
  themeDraftSignature,
  themeEventSignature,
  themeMatchesGallery,
} from "../../custom_components/scene_studio/frontend/gallery.js";

test("the default starter matches refs to the five seed colors", () => {
  const preset = galleryTheme("default");
  assert.equal(preset.seed, true);
  const events = {};
  for (const id of ["dawn", "sunrise", "noon", "sunset", "dusk"]) {
    events[id] = {
      color: { variable_ref: `default_${id}` },
      brightness: preset.events[id].brightness,
    };
  }
  assert.equal(themeMatchesGallery({ builtin_id: "default", events }, []), true);
  events.noon = { ...events.noon, brightness: 1 };
  assert.equal(themeMatchesGallery({ builtin_id: "default", events }, []), false);
});

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

test("reset stays hidden until a copied preset changes", () => {
  const wool = galleryPalette("wool");
  assert.equal(paletteMatchesGallery({ builtin_id: "wool", slots: wool.slots }), true);
  const changed = structuredClone(wool.slots);
  changed[0] = { ...changed[0], brightness: changed[0].brightness - 10 };
  assert.equal(paletteMatchesGallery({ builtin_id: "wool", slots: changed }), false);
  assert.equal(paletteMatchesGallery({ slots: [] }), true);

  const daylight = galleryTheme("daylight");
  const draft = {
    builtin_id: "daylight",
    events: {
      dawn: { color: daylight.events.dawn.color, brightness: daylight.events.dawn.brightness },
      sunrise: daylight.events.sunrise,
      noon: daylight.events.noon,
      sunset: daylight.events.sunset,
      dusk: daylight.events.dusk,
    },
  };
  assert.equal(themeMatchesGallery(draft, []), true);
  assert.equal(
    themeMatchesGallery(
      {
        ...draft,
        events: {
          ...draft.events,
          dawn: { ...draft.events.dawn, brightness: draft.events.dawn.brightness - 10 },
        },
      },
      []
    ),
    false
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

