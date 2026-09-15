/** Palette variables: 5 slots, FNV assignment matching palette.py, polar sample. */

export const PALETTE_SLOT_COUNT = 5;

export function variableIsPalette(variable) {
  return Boolean(variable && (variable.kind === "palette" || variable.slots));
}

export function assignmentSlot(entityId, seed) {
  let h = (2166136261 ^ (Number(seed) || 0)) >>> 0;
  const bytes = new TextEncoder().encode(String(entityId || ""));
  for (const byte of bytes) {
    h ^= byte;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % PALETTE_SLOT_COUNT;
}

export function assignmentTR(entityId, seed) {
  const slot = assignmentSlot(entityId, seed);
  return { t: ((slot + 0.5) / PALETTE_SLOT_COUNT) % 1, r: 1 };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function resolveSlot(palette, index, variables) {
  const slots = [...(palette?.slots || [])];
  while (slots.length < PALETTE_SLOT_COUNT) {
    slots.push({
      color: { color_mode: "hs", hs_color: [0, 0] },
      brightness: 255,
    });
  }
  const slot = slots[index % PALETTE_SLOT_COUNT] || {};
  const ref = slot.variable_ref;
  if (ref) {
    const nested = (variables || []).find((item) => item.id === ref);
    if (!nested || variableIsPalette(nested)) {
      return {
        color_mode: "hs",
        hs_color: [0, 0],
        brightness: 255,
        rgb: [255, 255, 255],
      };
    }
    return {
      ...(nested.color || {}),
      brightness: nested.brightness ?? 255,
    };
  }
  const color = slot.color && typeof slot.color === "object" ? slot.color : slot;
  return {
    ...color,
    brightness: slot.brightness ?? color.brightness ?? 255,
  };
}

function rgbFromColor(color, rgbFn) {
  if (typeof rgbFn === "function") {
    return rgbFn(color);
  }
  if (color?.hs_color) {
    return null;
  }
  return color?.rgb_color || [255, 255, 255];
}

export function samplePaletteWheel(palette, t, r, variables, draftRgb) {
  const turns = ((Number(t) % 1) + 1) % 1;
  const sat = Math.max(0, Math.min(1, Number(r) || 0));
  const scaled = turns * PALETTE_SLOT_COUNT;
  const i0 = Math.floor(scaled) % PALETTE_SLOT_COUNT;
  const i1 = (i0 + 1) % PALETTE_SLOT_COUNT;
  const frac = scaled - Math.floor(scaled);
  const a = resolveSlot(palette, i0, variables);
  const b = resolveSlot(palette, i1, variables);
  const rgbA = rgbFromColor(a, draftRgb) || [255, 255, 255];
  const rgbB = rgbFromColor(b, draftRgb) || [255, 255, 255];
  const rim = [0, 1, 2].map((c) => lerp(rgbA[c], rgbB[c], frac));
  const mixed = rim.map((c) => lerp(255, c, sat)).map(clampByte);
  const bri = Math.round(
    lerp(Number(a.brightness) || 255, Number(b.brightness) || 255, frac)
  );
  return { rgb: mixed, brightness: Math.max(0, Math.min(255, bri)) };
}

export function paletteSwatchCss(palette, variables, draftRgb) {
  const stops = [];
  for (let i = 0; i < PALETTE_SLOT_COUNT; i += 1) {
    const slot = resolveSlot(palette, i, variables);
    const rgb = rgbFromColor(slot, draftRgb) || [200, 200, 200];
    const start = (i / PALETTE_SLOT_COUNT) * 100;
    const end = ((i + 1) / PALETTE_SLOT_COUNT) * 100;
    stops.push(`rgb(${rgb[0]},${rgb[1]},${rgb[2]}) ${start}% ${end}%`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

export function defaultPaletteSlots() {
  const slots = [];
  for (let i = 0; i < PALETTE_SLOT_COUNT; i += 1) {
    slots.push({
      color: {
        color_mode: "hs",
        hs_color: [(i / PALETTE_SLOT_COUNT) * 360, 70],
      },
      brightness: 255,
    });
  }
  return slots;
}
