/** Built-in picture palettes. Slot colors are room lights for that picture's group. */

const color = (hue, sat, brightness) => ({
  color: { color_mode: "hs", hs_color: [hue, sat] },
  brightness,
});

const temp = (kelvin, brightness) => ({
  color: { color_mode: "color_temp", color_temp_kelvin: kelvin },
  brightness,
});

export const GALLERY_SECTIONS = [
  {
    id: "daylight",
    nameKey: "frontend.gallery.section_daylight",
    name: "Daylight",
    palettes: [
      {
        id: "reading",
        nameKey: "frontend.gallery.reading",
        name: "Reading",
        slots: [
          temp(4295, 210),
          temp(4245, 210),
          temp(4297, 210),
          temp(4369, 210),
          temp(4451, 210),
        ],
      },
      {
        id: "library",
        nameKey: "frontend.gallery.library",
        name: "Library",
        slots: [
          color(29, 47, 210),
          temp(4288, 210),
          temp(4437, 210),
          temp(4281, 210),
          color(28, 46, 210),
        ],
      },
      {
        id: "spring",
        nameKey: "frontend.gallery.spring",
        name: "Spring",
        slots: [
          temp(6500, 210),
          temp(5500, 235),
          temp(4000, 236),
          temp(4616, 210),
          temp(4690, 210),
        ],
      },
      {
        id: "crisp-october",
        nameKey: "frontend.gallery.crisp_october",
        name: "Crisp October",
        slots: [
          temp(2000, 255),
          temp(6500, 228),
          temp(5850, 210),
          color(31, 82, 210),
          color(13, 90, 210),
        ],
      },
      {
        id: "light-in-the-wood",
        nameKey: "frontend.gallery.light_in_the_wood",
        name: "Light in the wood",
        slots: [
          color(52, 65, 210),
          color(50, 51, 210),
          temp(4222, 210),
          temp(4169, 210),
          temp(4241, 210),
        ],
      },
      {
        id: "late-apples",
        nameKey: "frontend.gallery.late_apples",
        name: "Late apples",
        slots: [
          temp(5600, 231),
          color(102, 36, 210),
          color(111, 35, 210),
          temp(6100, 210),
          color(4, 59, 161),
        ],
      },
      {
        id: "rolling-gold",
        nameKey: "frontend.gallery.rolling_gold",
        name: "Rolling gold",
        slots: [
          temp(4007, 210),
          temp(3975, 210),
          color(33, 43, 210),
          color(32, 42, 210),
          temp(4023, 210),
        ],
      },
      {
        id: "hazy-meadow",
        nameKey: "frontend.gallery.hazy_meadow",
        name: "Hazy meadow",
        slots: [
          temp(4508, 210),
          temp(3000, 210),
          temp(4452, 210),
          temp(4480, 210),
          temp(4520, 210),
        ],
      },
      {
        id: "linen-noon",
        nameKey: "frontend.gallery.linen_noon",
        name: "Linen noon",
        slots: [
          temp(4484, 210),
          temp(4239, 210),
          temp(4333, 210),
          temp(4440, 210),
          temp(4591, 210),
        ],
      },
      {
        id: "high-sails",
        nameKey: "frontend.gallery.high_sails",
        name: "High sails",
        slots: [
          temp(4123, 210),
          temp(4120, 210),
          temp(4114, 210),
          temp(4130, 210),
          temp(4149, 210),
        ],
      },
      {
        id: "greenhouse",
        nameKey: "frontend.gallery.greenhouse",
        name: "Greenhouse",
        slots: [
          color(192, 33, 210),
          temp(4774, 210),
          temp(4815, 221),
          temp(4928, 244),
          temp(4965, 224),
        ],
      },
      {
        id: "snow-noon",
        nameKey: "frontend.gallery.snow_noon",
        name: "Snow noon",
        slots: [
          temp(6500, 255),
          temp(5600, 255),
          temp(5850, 207),
          color(220, 51, 210),
          color(215, 74, 210),
        ],
      },
    ],
  },
  {
    id: "cozy",
    nameKey: "frontend.gallery.section_cozy",
    name: "Cozy",
    palettes: [
      {
        id: "golden-hour",
        nameKey: "frontend.gallery.golden_hour",
        name: "Golden hour",
        slots: [
          temp(3400, 140),
          temp(3400, 140),
          temp(3400, 140),
          temp(3400, 140),
          temp(3400, 140),
        ],
      },
      {
        id: "dinner-time",
        nameKey: "frontend.gallery.dinner_time",
        name: "Dinner time",
        slots: [
          temp(3400, 140),
          color(31, 73, 140),
          temp(3400, 140),
          temp(3400, 140),
          color(25, 88, 140),
        ],
      },
      {
        id: "last-of-the-sun",
        nameKey: "frontend.gallery.last_of_the_sun",
        name: "Last of the sun",
        slots: [
          color(212, 49, 143),
          temp(3400, 150),
          temp(3400, 141),
          temp(3400, 140),
          color(222, 67, 140),
        ],
      },
      {
        id: "red-hills",
        nameKey: "frontend.gallery.red_hills",
        name: "Red hills",
        slots: [
          temp(3400, 140),
          temp(3400, 140),
          temp(3400, 140),
          temp(3400, 140),
          temp(3400, 140),
        ],
      },
      {
        id: "african-dusk",
        nameKey: "frontend.gallery.african_dusk",
        name: "African dusk",
        slots: [
          color(37, 77, 140),
          temp(3400, 140),
          temp(3400, 140),
          temp(3400, 153),
          color(34, 77, 161),
        ],
      },
      {
        id: "alpenglow",
        nameKey: "frontend.gallery.alpenglow",
        name: "Alpenglow",
        slots: [
          temp(2550, 140),
          temp(2600, 173),
          temp(2000, 109),
          color(341, 66, 83),
          color(320, 68, 140),
        ],
      },
      {
        id: "palms-at-sunset",
        nameKey: "frontend.gallery.palms_at_sunset",
        name: "Palms at sunset",
        slots: [
          temp(2500, 140),
          temp(2000, 92),
          temp(2700, 140),
          color(12, 66, 113),
          color(274, 73, 140),
        ],
      },
      {
        id: "wool",
        nameKey: "frontend.gallery.wool",
        name: "Wood lamp",
        slots: [
          color(33, 50, 140),
          temp(2750, 157),
          temp(2000, 82),
          color(27, 55, 140),
          temp(2700, 140),
        ],
      },
      {
        id: "low-flame",
        nameKey: "frontend.gallery.low_flame",
        name: "Low flame",
        slots: [
          color(32, 90, 140),
          temp(3400, 140),
          temp(3400, 140),
          temp(3400, 140),
          color(29, 90, 140),
        ],
      },
      {
        id: "lanterns",
        nameKey: "frontend.gallery.lanterns",
        name: "Lanterns",
        slots: [
          temp(3400, 140),
          color(11, 90, 140),
          temp(3400, 140),
          temp(3400, 140),
          color(332, 90, 140),
        ],
      },
    ],
  },
  {
    id: "evening",
    nameKey: "frontend.gallery.section_evening",
    name: "Evening",
    palettes: [
      {
        id: "rain",
        nameKey: "frontend.gallery.rain",
        name: "City rain",
        slots: [
          temp(4500, 120),
          color(203, 66, 120),
          temp(4500, 120),
          temp(4467, 120),
          color(206, 32, 120),
        ],
      },
      {
        id: "blue-hour-reine",
        nameKey: "frontend.gallery.blue_hour_reine",
        name: "Blue hour",
        slots: [
          temp(4500, 172),
          temp(4500, 161),
          temp(4500, 120),
          color(209, 70, 133),
          color(209, 69, 141),
        ],
      },
      {
        id: "train-window",
        nameKey: "frontend.gallery.train_window",
        name: "Train window",
        slots: [
          temp(4370, 120),
          temp(4444, 120),
          temp(4384, 128),
          temp(4303, 120),
          color(32, 33, 120),
        ],
      },
      {
        id: "velvet-dusk",
        nameKey: "frontend.gallery.velvet_dusk",
        name: "Velvet dusk",
        slots: [
          color(262, 39, 125),
          temp(4500, 120),
          temp(4500, 120),
          temp(4500, 128),
          color(253, 39, 135),
        ],
      },
      {
        id: "after-the-rain",
        nameKey: "frontend.gallery.after_the_rain",
        name: "After the rain",
        slots: [
          temp(4449, 120),
          temp(4500, 120),
          color(9, 31, 120),
          color(17, 70, 138),
          temp(4426, 120),
        ],
      },
    ],
  },
  {
    id: "night",
    nameKey: "frontend.gallery.section_night",
    name: "Night",
    palettes: [
      {
        id: "the-lighthouse",
        nameKey: "frontend.gallery.the_lighthouse",
        name: "The lighthouse",
        slots: [
          color(218, 60, 50),
          temp(3200, 51),
          temp(3200, 60),
          temp(3200, 170),
          color(219, 64, 50),
        ],
      },
      {
        id: "starlight",
        nameKey: "frontend.gallery.starlight",
        name: "Starlight",
        slots: [
          temp(6500, 18),
          temp(6500, 26),
          color(227, 91, 40),
          color(7, 83, 45),
          color(324, 95, 43),
        ],
      },
    ],
  },
  {
    id: "party",
    nameKey: "frontend.gallery.section_party",
    name: "Party",
    palettes: [
      {
        id: "neon-alley",
        nameKey: "frontend.gallery.neon_alley",
        name: "Neon alley",
        slots: [
          color(311, 86, 80),
          color(278, 93, 80),
          color(263, 70, 87),
          color(186, 60, 80),
          color(8, 96, 80),
        ],
      },
      {
        id: "wet-neon",
        nameKey: "frontend.gallery.wet_neon",
        name: "Wet neon",
        slots: [
          color(262, 62, 134),
          color(233, 91, 80),
          color(310, 93, 129),
          color(20, 93, 80),
          color(274, 80, 173),
        ],
      },
      {
        id: "magenta-hour",
        nameKey: "frontend.gallery.magenta_hour",
        name: "Magenta hour",
        slots: [
          color(240, 90, 80),
          color(256, 90, 108),
          color(300, 87, 109),
          color(344, 90, 100),
          color(0, 90, 80),
        ],
      },
      {
        id: "cocktail-pink",
        nameKey: "frontend.gallery.cocktail_pink",
        name: "Cocktail pink",
        slots: [
          color(283, 48, 80),
          color(306, 43, 128),
          color(287, 49, 126),
          color(289, 41, 130),
          color(302, 57, 115),
        ],
      },
      {
        id: "carnival-wash",
        nameKey: "frontend.gallery.carnival_wash",
        name: "Carnival wash",
        slots: [
          color(309, 43, 80),
          color(328, 29, 81),
          color(255, 42, 86),
          color(226, 48, 99),
          color(207, 80, 99),
        ],
      },
      {
        id: "club-violet",
        nameKey: "frontend.gallery.club_violet",
        name: "Club violet",
        slots: [
          color(261, 57, 80),
          color(309, 65, 80),
          color(325, 59, 80),
          color(283, 43, 80),
          color(271, 46, 80),
        ],
      },
      {
        id: "fireworks",
        nameKey: "frontend.gallery.fireworks",
        name: "Fireworks",
        slots: [
          color(354, 69, 80),
          color(340, 48, 80),
          color(339, 36, 85),
          color(297, 43, 80),
          color(292, 52, 80),
        ],
      },
    ],
  },
  {
    id: "romantic",
    nameKey: "frontend.gallery.section_romantic",
    name: "Romantic",
    palettes: [
      {
        id: "rose-dusk",
        nameKey: "frontend.gallery.rose_dusk",
        name: "Rose dusk",
        slots: [
          temp(3000, 90),
          color(359, 90, 90),
          temp(3000, 90),
          color(359, 90, 90),
          temp(3000, 90),
        ],
      },
      {
        id: "petal-light",
        nameKey: "frontend.gallery.petal_light",
        name: "Petal light",
        slots: [
          temp(3000, 106),
          temp(3000, 127),
          color(38, 62, 111),
          color(43, 59, 147),
          temp(3000, 128),
        ],
      },
    ],
  },
  {
    id: "sunrise",
    nameKey: "frontend.gallery.section_sunrise",
    name: "Sunrise",
    palettes: [
      {
        id: "the-sky-turns",
        nameKey: "frontend.gallery.the_sky_turns",
        name: "The sky turns",
        slots: [
          color(315, 72, 180),
          color(327, 64, 180),
          temp(4325, 180),
          temp(4420, 180),
          temp(4499, 180),
        ],
      },
      {
        id: "cold-pink",
        nameKey: "frontend.gallery.cold_pink",
        name: "Cold pink",
        slots: [
          temp(4833, 180),
          temp(4856, 180),
          temp(4900, 180),
          color(204, 43, 180),
          color(205, 43, 180),
        ],
      },
      {
        id: "pale-gold",
        nameKey: "frontend.gallery.pale_gold",
        name: "Pale gold",
        slots: [
          temp(3200, 220),
          temp(3600, 230),
          temp(2900, 200),
          temp(6500, 210),
          temp(7500, 190),
        ],
      },
      {
        id: "desert-sunrise",
        nameKey: "frontend.gallery.desert_sunrise",
        name: "Desert sunrise",
        slots: [
          color(24, 47, 180),
          color(23, 45, 180),
          temp(4104, 180),
          temp(4307, 180),
          temp(4384, 180),
        ],
      },
      {
        id: "horizon-line",
        nameKey: "frontend.gallery.horizon_line",
        name: "Horizon line",
        slots: [
          color(31, 50, 180),
          color(32, 51, 180),
          temp(4054, 180),
          temp(4114, 180),
          temp(4156, 180),
        ],
      },
    ],
  },
  {
    id: "neon",
    nameKey: "frontend.gallery.section_neon",
    name: "Neon",
    palettes: [
      {
        id: "neon-rain",
        nameKey: "frontend.gallery.neon_rain",
        name: "Neon rain",
        slots: [
          color(186, 92, 210),
          color(312, 88, 180),
          color(265, 84, 170),
          color(168, 95, 200),
          color(330, 80, 160),
        ],
      },
      {
        id: "aquarium-night",
        nameKey: "frontend.gallery.aquarium_night",
        name: "Aquarium night",
        slots: [
          color(185, 89, 70),
          color(185, 89, 86),
          color(192, 88, 127),
          color(125, 73, 127),
          color(162, 95, 98),
        ],
      },
      {
        id: "signal-violet",
        nameKey: "frontend.gallery.signal_violet",
        name: "Signal violet",
        slots: [
          color(263, 83, 70),
          color(308, 90, 80),
          color(278, 88, 118),
          color(305, 90, 119),
          color(281, 87, 72),
        ],
      },
      {
        id: "ice-and-magenta",
        nameKey: "frontend.gallery.ice_and_magenta",
        name: "Ice and magenta",
        slots: [
          color(21, 69, 76),
          color(13, 70, 70),
          color(337, 58, 74),
          color(350, 47, 123),
          color(15, 59, 120),
        ],
      },
      {
        id: "afterimage",
        nameKey: "frontend.gallery.afterimage",
        name: "Afterimage",
        slots: [
          color(284, 86, 188),
          color(269, 90, 170),
          color(273, 81, 135),
          color(267, 90, 174),
          color(283, 86, 193),
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
