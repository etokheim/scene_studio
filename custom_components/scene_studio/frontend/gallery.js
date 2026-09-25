/** Built-in picture palettes. Colors are sampled from the photo in gallery/. */

const slot = (hue, sat, brightness) => ({
  color: { color_mode: "hs", hs_color: [hue, sat] },
  brightness,
});

export const GALLERY_SECTIONS = [
  {
    id: "hearth",
    nameKey: "frontend.gallery.section_hearth",
    name: "Hearth",
    palettes: [
      {
        id: "ember",
        nameKey: "frontend.gallery.ember",
        name: "Mantel",
        slots: [
          slot(35, 11, 245),
          slot(193, 23, 197),
          slot(198, 10, 219),
          slot(329, 25, 171),
          slot(348, 8, 140),
        ],
      },
      {
        id: "wool",
        nameKey: "frontend.gallery.wool",
        name: "Wood lamp",
        slots: [
          slot(26, 58, 152),
          slot(29, 73, 245),
          slot(30, 45, 139),
          slot(45, 25, 130),
          slot(165, 32, 125),
        ],
      },
    ],
  },
  {
    id: "study",
    nameKey: "frontend.gallery.section_study",
    name: "Study",
    palettes: [
      {
        id: "armchair",
        nameKey: "frontend.gallery.armchair",
        name: "Shade",
        slots: [
          slot(42, 31, 245),
          slot(233, 41, 125),
          slot(250, 46, 138),
          slot(271, 40, 147),
          slot(356, 40, 194),
        ],
      },
      {
        id: "shelves",
        nameKey: "frontend.gallery.shelves",
        name: "Stacks",
        slots: [
          slot(21, 73, 125),
          slot(24, 54, 245),
          slot(39, 21, 243),
          slot(42, 9, 153),
          slot(40, 4, 230),
        ],
      },
    ],
  },
  {
    id: "dayroom",
    nameKey: "frontend.gallery.section_dayroom",
    name: "Dayroom",
    palettes: [
      {
        id: "linen",
        nameKey: "frontend.gallery.linen",
        name: "Blue room",
        slots: [
          slot(29, 24, 201),
          slot(180, 8, 140),
          slot(203, 19, 245),
          slot(208, 39, 208),
          slot(216, 91, 158),
        ],
      },
      {
        id: "last-light",
        nameKey: "frontend.gallery.last_light",
        name: "Sill",
        slots: [
          slot(17, 44, 136),
          slot(20, 54, 125),
          slot(32, 43, 182),
          slot(40, 8, 230),
          slot(43, 6, 245),
        ],
      },
      {
        id: "noon",
        nameKey: "frontend.gallery.noon",
        name: "Open field",
        slots: [
          slot(68, 58, 125),
          slot(209, 42, 245),
          slot(213, 62, 232),
          slot(215, 77, 212),
          slot(216, 87, 190),
        ],
      },
    ],
  },
  {
    id: "small-hours",
    nameKey: "frontend.gallery.section_small_hours",
    name: "Small hours",
    palettes: [
      {
        id: "blue-hour",
        nameKey: "frontend.gallery.blue_hour",
        name: "Harbor",
        slots: [
          slot(28, 49, 179),
          slot(30, 35, 228),
          slot(36, 60, 125),
          slot(216, 79, 194),
          slot(216, 68, 245),
        ],
      },
      {
        id: "rain",
        nameKey: "frontend.gallery.rain",
        name: "Wet glass",
        slots: [
          slot(16, 74, 174),
          slot(25, 85, 245),
          slot(199, 98, 222),
          slot(207, 70, 180),
          slot(221, 41, 125),
        ],
      },
      {
        id: "candle",
        nameKey: "frontend.gallery.candle",
        name: "Low flame",
        slots: [
          slot(38, 65, 125),
          slot(41, 29, 245),
          slot(45, 40, 192),
          slot(47, 52, 158),
          slot(36, 18, 220),
        ],
      },
    ],
  },
];

export function gallerySections() {
  return GALLERY_SECTIONS;
}

const byId = new Map(
  GALLERY_SECTIONS.flatMap((section) => section.palettes).map((item) => [item.id, item])
);

export function galleryPalette(id) {
  return byId.get(id) || null;
}

export function galleryAsPalette(id) {
  const item = galleryPalette(id);
  if (!item) {
    return null;
  }
  return {
    id: item.id,
    kind: "palette",
    name: item.name,
    slots: item.slots,
  };
}

export function galleryCoverUrl(id) {
  return new URL(`./gallery/${id}.jpg`, import.meta.url).href;
}

export function galleryCopyName(base, names) {
  const taken = new Set(names || []);
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base} ${n}`)) {
    n += 1;
  }
  return `${base} ${n}`;
}

export function paletteSlotSignature(slot) {
  if (!slot || typeof slot !== "object") {
    return "";
  }
  if (slot.variable_ref) {
    return `ref:${slot.variable_ref}`;
  }
  const color = slot.color && typeof slot.color === "object" ? slot.color : slot;
  const hs = Array.isArray(color.hs_color)
    ? color.hs_color.map((n) => Math.round(Number(n)))
    : null;
  const kelvin =
    color.color_temp_kelvin == null ? null : Math.round(Number(color.color_temp_kelvin));
  const brightness = Math.round(Number(slot.brightness ?? color.brightness ?? 255));
  return JSON.stringify({
    mode: color.color_mode || "",
    hs,
    kelvin,
    brightness,
  });
}
