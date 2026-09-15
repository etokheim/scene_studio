/* Color wheel, draft RGB/HS/temp helpers, and Helland kelvin→RGB.
   Extracted from panel.js (no bundler; HA loads as ES modules). */

import {
  assignmentTR,
  paletteSwatchCss,
  samplePaletteWheel,
  variableIsPalette,
} from "./palette.js";

const HUE_WHEEL_RENDER = 600;
const HUE_COLOR_PRESETS = [
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#5ac8fa",
  "#007aff",
  "#5856d6",
  "#af52de",
];
const HUE_TEMP_PRESETS = [2200, 2700, 3000, 4000, 5000, 6500];
const HUE_PIN_PATH =
  "M 24,0 C 10.745166,0 0,10.575951 0,23.622046 0,39.566928 21,57.578739 22.05,58.346457 L 24,60 25.95,58.346457 C 27,57.578739 48,39.566928 48,23.622046 48,10.575951 37.254834,0 24,0 Z";
const HUE_DOT_PATH = "M6 0A6 6 0 006 12 6 6 0 006 0Z";
const HUE_DOT_OUTLINE_PATH = "M8 0A8 8 0 008 16 8 8 0 008 0Z";
/* Cosmetic path density only — lerp math is unchanged (same samples as runtime). */
const HUE_PATH_STEPS = 72;
/* Same-mode HS: near-constant sat → denser polar samples (~deg per step). */
const HUE_PATH_HS_DEG_PER_STEP = 2.5;
const HUE_PATH_HS_SAT_EPS = 0.03;
const WHEEL_PEEK_FRAC = 0.1;
/* Mixed stack: kelvin ring is 2× the post-75%-shrink band (~9.5% → ~19%). */
const WHEEL_MIXED_INNER_FRAC = 1 - (1 - 0.62) * 0.25 * 2;
const WHEEL_MIXED_GAP_FRAC = 0;
const _hueWheelImageCache = new Map();

function hueLinearScale(t, min, max) {
  return (max - min) * t + min;
}

function hueCurveScale(t, min, max) {
  let addon = 0;
  const coef = max / min / 65;
  if (t <= 0.1) {
    addon = hueLinearScale(t * 10, 0, coef);
  } else if (t <= 0.97) {
    addon = coef - hueLinearScale((t - 0.1) / 0.9, 0, 2 * coef);
  } else {
    addon = -coef + hueLinearScale((t - 0.97) / 0.03, 0, coef);
  }
  return (Math.pow(max / min, Math.pow(t, 1.55)) + addon) * min;
}

function inverseHueCurveScale(targetValue, min, max) {
  const epsilon = 0.0001;
  let low = 0;
  let high = 1;
  let t = 0.5;
  while (high - low > epsilon) {
    const midValue = hueCurveScale(t, min, max);
    if (midValue < targetValue) {
      low = t;
    } else {
      high = t;
    }
    t = (low + high) / 2;
  }
  return t;
}

function xy2polar(x, y) {
  return [Math.sqrt(x * x + y * y), Math.atan2(y, x)];
}

function polar2xy(r, phi) {
  return [r * Math.cos(phi), r * Math.sin(phi)];
}

function rad2deg(rad) {
  return ((rad + Math.PI) / (2 * Math.PI)) * 360;
}

function deg2rad(deg) {
  return (deg / 360) * 2 * Math.PI - Math.PI;
}

function hueFromDeg(deg) {
  deg -= 70;
  if (deg < 0) {
    deg += 360;
  }
  return deg;
}

function degFromHue(hue) {
  hue += 70;
  if (hue > 360) {
    hue -= 360;
  }
  return hue;
}

function saturationFromR(r, radius) {
  const exp = 1.9;
  const saturation = Math.pow(r, exp) / Math.pow(radius, exp);
  return saturation > 1 ? 1 : saturation;
}

function rFromSaturation(saturation, radius) {
  const exp = 1.9;
  return Math.pow(saturation * Math.pow(radius, exp), 1 / exp);
}

function fixHSValue(value, r, radius, hue, fixPoint, lower, maxOffset = 5) {
  const precondition = lower
    ? r > radius / 2
    : r < (3 * radius) / 4 && r > radius / 4;
  if (
    precondition &&
    hue >= fixPoint - maxOffset &&
    hue <= fixPoint + maxOffset
  ) {
    let offset = fixPoint - hue;
    if (offset < 0) {
      offset = -offset;
    }
    offset = maxOffset - offset;
    value += lower ? -offset / 360 : offset / 360;
  }
  return value;
}

function hsValue(hue, r, radius) {
  let value = 0.95;
  value = fixHSValue(value, r, radius, hue, 60, true);
  value = fixHSValue(value, r, radius, hue, 180, true);
  value = fixHSValue(value, r, radius, hue, 240, false);
  value = fixHSValue(value, r, radius, hue, 300, true);
  return value > 1 ? 1 : value;
}

function hsv2rgb(hue, saturation, value) {
  const chroma = value * saturation;
  const hue1 = hue / 60;
  const x = chroma * (1 - Math.abs((hue1 % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hue1 >= 0 && hue1 <= 1) {
    [r1, g1, b1] = [chroma, x, 0];
  } else if (hue1 >= 1 && hue1 <= 2) {
    [r1, g1, b1] = [x, chroma, 0];
  } else if (hue1 >= 2 && hue1 <= 3) {
    [r1, g1, b1] = [0, chroma, x];
  } else if (hue1 >= 3 && hue1 <= 4) {
    [r1, g1, b1] = [0, x, chroma];
  } else if (hue1 >= 4 && hue1 <= 5) {
    [r1, g1, b1] = [x, 0, chroma];
  } else if (hue1 >= 5 && hue1 <= 6) {
    [r1, g1, b1] = [chroma, 0, x];
  }
  const m = value - chroma;
  return [
    Math.round(255 * (r1 + m)),
    Math.round(255 * (g1 + m)),
    Math.round(255 * (b1 + m)),
  ];
}

function rgb2hsv(r, g, b) {
  const rabs = r / 255;
  const gabs = g / 255;
  const babs = b / 255;
  const v = Math.max(rabs, gabs, babs);
  const diff = v - Math.min(rabs, gabs, babs);
  const diffc = (c) => (v - c) / 6 / diff + 1 / 2;
  let h = 0;
  let s = 0;
  if (diff !== 0) {
    s = diff / v;
    const rr = diffc(rabs);
    const gg = diffc(gabs);
    const bb = diffc(babs);
    if (rabs === v) {
      h = bb - gg;
    } else if (gabs === v) {
      h = 1 / 3 + rr - bb;
    } else {
      h = 2 / 3 + gg - rr;
    }
    if (h < 0) {
      h += 1;
    } else if (h > 1) {
      h -= 1;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100) / 100, Math.round(v * 100) / 100];
}

function hueTempToRgb(kelvin) {
  const start = 2000;
  const tres = 4200;
  const end = 6500;
  const startRgb = [255, 180, 55];
  const tresRgb = [255, 255, 255];
  const endRgb = [190, 228, 243];
  let k = kelvin;
  if (k < start) {
    k = start;
  }
  if (k > end) {
    k = end;
  }
  if (k < tres) {
    const t = (k - start) / (tres - start);
    return [
      Math.round(hueLinearScale(t, startRgb[0], tresRgb[0])),
      Math.round(hueLinearScale(t, startRgb[1], tresRgb[1])),
      Math.round(hueLinearScale(t, startRgb[2], tresRgb[2])),
    ];
  }
  const t = (k - tres) / (end - tres);
  return [
    Math.round(hueLinearScale(t, tresRgb[0], endRgb[0])),
    Math.round(hueLinearScale(t, tresRgb[1], endRgb[1])),
    Math.round(hueLinearScale(t, tresRgb[2], endRgb[2])),
  ];
}

/** Tanner Helland daylight curve — same as color_math.kelvin_to_rgb. */
function kelvinToRgb(kelvin) {
  const temp = Math.max(1000, Math.min(Number(kelvin) || 0, 40000)) / 100;
  let red;
  let green;
  let blue;
  if (temp <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    red = 329.698727446 * (temp - 60) ** -0.1332047592;
    green = 288.1221695283 * (temp - 60) ** -0.0755148492;
  }
  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }
  return [
    Math.max(0, Math.min(255, Math.round(red))),
    Math.max(0, Math.min(255, Math.round(green))),
    Math.max(0, Math.min(255, Math.round(blue))),
  ];
}

function hexToRgb(hex) {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function rgbCss([r, g, b]) {
  return `rgb(${r}, ${g}, ${b})`;
}

function pinForeground(rgb) {
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return luminance > 192 ? "rgba(0,0,0,0.7)" : "#fff";
}

function draftWheelMode(draft, hasColor, hasTemp) {
  // Honor stored color_mode first (YAML / HA snapshots).
  const mode = draft?.color_mode;
  if (mode === "color_temp" && draft?.color_temp_kelvin != null) {
    return hasTemp ? "temp" : "color";
  }
  if (
    mode === "hs" ||
    mode === "rgb" ||
    mode === "rgbw" ||
    mode === "rgbww" ||
    mode === "xy"
  ) {
    return hasColor ? "color" : "temp";
  }
  if (
    draft?.rgb_color ||
    draft?.hs_color ||
    draft?.rgbw_color ||
    draft?.rgbww_color
  ) {
    return hasColor ? "color" : "temp";
  }
  if (draft?.color_temp_kelvin != null) {
    return hasTemp ? "temp" : "color";
  }
  return hasColor ? "color" : "temp";
}

function lightWheelCaps(attrs) {
  const supported = attrs?.supported_color_modes || [];
  const hasColor = supported.some((mode) =>
    ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode)
  );
  const hasTemp =
    supported.includes("color_temp") ||
    supported.includes("rgbww") ||
    attrs?.min_color_temp_kelvin != null;
  if (!supported.length) {
    return { hasColor: true, hasTemp: true };
  }
  return { hasColor, hasTemp };
}

function rgbwToRgb(rgbw) {
  const r = Number(rgbw[0]) || 0;
  const g = Number(rgbw[1]) || 0;
  const b = Number(rgbw[2]) || 0;
  const white = Number(rgbw[3]) || 0;
  return [
    Math.round(Math.max(0, Math.min(255, r + white))),
    Math.round(Math.max(0, Math.min(255, g + white))),
    Math.round(Math.max(0, Math.min(255, b + white))),
  ];
}

function rgbwwToRgb(rgbww) {
  const r = Number(rgbww[0]) || 0;
  const g = Number(rgbww[1]) || 0;
  const b = Number(rgbww[2]) || 0;
  const cold = Number(rgbww[3]) || 0;
  const warm = Number(rgbww[4]) || 0;
  return [
    Math.round(Math.max(0, Math.min(255, r + cold * 0.86 + warm))),
    Math.round(Math.max(0, Math.min(255, g + cold * 0.9 + warm * 0.7))),
    Math.round(Math.max(0, Math.min(255, b + cold + warm * 0.35))),
  ];
}

function scaleRgbChannels(rgb, brightness) {
  const max = Math.max(rgb[0], rgb[1], rgb[2]);
  if (max <= 0) {
    return [brightness, brightness, brightness];
  }
  const t = brightness / max;
  return [
    Math.round(rgb[0] * t),
    Math.round(rgb[1] * t),
    Math.round(rgb[2] * t),
  ];
}

function chromaticRgbFromDraft(draft) {
  let rgb;
  if (draft?.rgbww_color) {
    rgb = draft.rgbww_color.slice(0, 3);
  } else if (draft?.rgbw_color) {
    rgb = draft.rgbw_color.slice(0, 3);
  } else if (draft?.rgb_color) {
    rgb = draft.rgb_color;
  } else if (draft?.hs_color) {
    return hsv2rgb(draft.hs_color[0], draft.hs_color[1] / 100, 1);
  } else {
    return null;
  }
  const max = Math.max(rgb[0], rgb[1], rgb[2]);
  if (max <= 0) {
    return [0, 0, 0];
  }
  return [
    Math.round((rgb[0] * 255) / max),
    Math.round((rgb[1] * 255) / max),
    Math.round((rgb[2] * 255) / max),
  ];
}

function colorBrightnessFromDraft(draft) {
  if (draft?.state === "off") {
    return 0;
  }
  if (draft?.rgbww_color) {
    return Math.max(draft.rgbww_color[0], draft.rgbww_color[1], draft.rgbww_color[2]);
  }
  if (draft?.rgbw_color) {
    return Math.max(draft.rgbw_color[0], draft.rgbw_color[1], draft.rgbw_color[2]);
  }
  if (draft?.rgb_color) {
    return Math.max(draft.rgb_color[0], draft.rgb_color[1], draft.rgb_color[2]);
  }
  if (draft?.hs_color) {
    return 255;
  }
  return 0;
}

function whiteBrightnessFromDraft(draft) {
  if (draft?.state === "off") {
    return 0;
  }
  if (draft?.rgbww_color) {
    return Math.max(draft.rgbww_color[3], draft.rgbww_color[4]);
  }
  if (draft?.rgbw_color) {
    return draft.rgbw_color[3] || 0;
  }
  return 0;
}

function setColorBrightnessOnDraft(draft, brightness, whiteKind) {
  const value = Math.round(Math.max(0, Math.min(255, brightness)));
  if (whiteKind === "rgbww") {
    const current = draft.rgbww_color || [
      ...(chromaticRgbFromDraft(draft) || draftRgb(draft)),
      0,
      0,
    ];
    const rgb = scaleRgbChannels(current.slice(0, 3), value);
    draft.rgbww_color = [rgb[0], rgb[1], rgb[2], current[3] || 0, current[4] || 0];
    draft.rgb_color = undefined;
    draft.rgbw_color = undefined;
    draft.hs_color = undefined;
    draft.color_temp_kelvin = undefined;
  } else if (whiteKind === "rgbw") {
    const current = draft.rgbw_color || [
      ...(chromaticRgbFromDraft(draft) || draftRgb(draft)),
      0,
    ];
    const rgb = scaleRgbChannels(current.slice(0, 3), value);
    draft.rgbw_color = [rgb[0], rgb[1], rgb[2], current[3] || 0];
    draft.rgb_color = undefined;
    draft.rgbww_color = undefined;
    draft.hs_color = undefined;
    draft.color_temp_kelvin = undefined;
  }
  if (value > 0 || whiteBrightnessFromDraft(draft) > 0) {
    draft.state = "on";
  }
}

function setWhiteBrightnessOnDraft(draft, brightness, whiteKind) {
  const value = Math.round(Math.max(0, Math.min(255, brightness)));
  if (whiteKind === "rgbww") {
    const current = draft.rgbww_color || [0, 0, 0, 0, 0];
    const max = Math.max(current[3] || 0, current[4] || 0);
    let cw;
    let ww;
    if (max <= 0) {
      cw = value;
      ww = value;
    } else {
      cw = Math.round(((current[3] || 0) * value) / max);
      ww = Math.round(((current[4] || 0) * value) / max);
    }
    draft.rgbww_color = [current[0], current[1], current[2], cw, ww];
    draft.rgb_color = undefined;
    draft.rgbw_color = undefined;
    draft.hs_color = undefined;
    draft.color_temp_kelvin = undefined;
  } else if (whiteKind === "rgbw") {
    const current = draft.rgbw_color || [0, 0, 0, 0];
    draft.rgbw_color = [current[0], current[1], current[2], value];
    draft.rgb_color = undefined;
    draft.rgbww_color = undefined;
    draft.hs_color = undefined;
    draft.color_temp_kelvin = undefined;
  }
  if (value > 0 || colorBrightnessFromDraft(draft) > 0) {
    draft.state = "on";
  }
}

function draftRgb(draft) {
  if (draft?.rgbww_color) {
    return rgbwwToRgb(draft.rgbww_color);
  }
  if (draft?.rgbw_color) {
    return rgbwToRgb(draft.rgbw_color);
  }
  if (draft?.rgb_color) {
    return draft.rgb_color;
  }
  if (draft?.hs_color) {
    return hsv2rgb(draft.hs_color[0], draft.hs_color[1] / 100, 1);
  }
  if (draft?.color_temp_kelvin != null) {
    // Match Python kelvin_to_rgb (Helland) so scrub/morph rings match Astral.
    // hueTempToRgb stays for the temp wheel chrome only.
    return kelvinToRgb(draft.color_temp_kelvin);
  }
  return [255, 214, 170];
}

function applyColorToDraft(draft, rgb, hsv) {
  draft.color_temp_kelvin = undefined;
  draft.state = "on";
  if (draft.rgbww_color) {
    const colorBri =
      Math.max(draft.rgbww_color[0], draft.rgbww_color[1], draft.rgbww_color[2]) ||
      255;
    const scaled = scaleRgbChannels(rgb, colorBri);
    draft.rgbww_color = [
      scaled[0],
      scaled[1],
      scaled[2],
      draft.rgbww_color[3],
      draft.rgbww_color[4],
    ];
    draft.rgb_color = undefined;
    draft.rgbw_color = undefined;
    draft.hs_color = undefined;
    draft.color_mode = "rgbww";
    return;
  }
  if (draft.rgbw_color) {
    const colorBri =
      Math.max(draft.rgbw_color[0], draft.rgbw_color[1], draft.rgbw_color[2]) ||
      255;
    const scaled = scaleRgbChannels(rgb, colorBri);
    draft.rgbw_color = [scaled[0], scaled[1], scaled[2], draft.rgbw_color[3]];
    draft.rgb_color = undefined;
    draft.rgbww_color = undefined;
    draft.hs_color = undefined;
    draft.color_mode = "rgbw";
    return;
  }
  // HS only for chromatic scenes — matches light.turn_on exclusivity and
  // avoids reopen as RGB when kelvin was intended after a later mode flip.
  draft.hs_color = [hsv[0], Math.round(hsv[1] * 100)];
  draft.rgb_color = undefined;
  draft.rgbw_color = undefined;
  draft.rgbww_color = undefined;
  draft.color_mode = "hs";
}

function applyTempToDraft(draft, kelvin) {
  draft.color_temp_kelvin = Math.round(kelvin);
  draft.color_mode = "color_temp";
  draft.rgb_color = undefined;
  draft.hs_color = undefined;
  draft.rgbw_color = undefined;
  draft.rgbww_color = undefined;
  draft.state = "on";
}

function colorPayloadFromDraft(draft) {
  if (!draft) {
    return { color_mode: "color_temp", color_temp_kelvin: 3000 };
  }
  if (draft.color_mode === "hs" || (draft.hs_color && draft.color_mode !== "color_temp")) {
    if (draft.hs_color) {
      return { color_mode: "hs", hs_color: [...draft.hs_color] };
    }
  }
  if (draft.rgb_color && draft.color_mode === "rgb") {
    return { color_mode: "rgb", rgb_color: [...draft.rgb_color] };
  }
  if (draft.color_temp_kelvin != null) {
    return {
      color_mode: "color_temp",
      color_temp_kelvin: Number(draft.color_temp_kelvin),
    };
  }
  if (draft.hs_color) {
    return { color_mode: "hs", hs_color: [...draft.hs_color] };
  }
  if (draft.rgb_color) {
    return { color_mode: "rgb", rgb_color: [...draft.rgb_color] };
  }
  return { color_mode: "color_temp", color_temp_kelvin: 3000 };
}

function draftUsesPalette(draft, getPalette) {
  const ref = draft?.variable_ref;
  if (!ref || typeof getPalette !== "function") {
    return false;
  }
  const variable = (getPalette() || []).find((item) => item.id === ref);
  return variableIsPalette(variable);
}

function applyVariableToDraft(draft, variable, { entityId, seed, catalog } = {}) {
  if (!draft || !variable) {
    return;
  }
  draft.color_temp_kelvin = undefined;
  draft.rgb_color = undefined;
  draft.hs_color = undefined;
  draft.rgbw_color = undefined;
  draft.rgbww_color = undefined;
  draft.variable_ref = variable.id;
  if (variableIsPalette(variable)) {
    delete draft.palette_t;
    delete draft.palette_r;
    const { t, r } = assignmentTR(entityId || "", seed || 0);
    const sampled = samplePaletteWheel(
      variable,
      t,
      r,
      catalog || [],
      draftRgb
    );
    draft.hs_color = undefined;
    draft.rgb_color = sampled.rgb;
    draft.color_mode = "rgb";
    draft.brightness = sampled.brightness;
  } else {
    delete draft.palette_t;
    delete draft.palette_r;
    Object.assign(draft, variable.color || {});
    const brightness = Number(variable.brightness);
    if (Number.isFinite(brightness)) {
      draft.brightness = brightness;
    }
  }
  draft.state = Number(draft.brightness) > 0 ? "on" : "off";
}

function swatchRgb(color, brightness) {
  const rgb = draftRgb(color || {});
  const f = Math.max(0, Math.min(1, (Number(brightness) || 0) / 255));
  return [
    Math.round(rgb[0] * f),
    Math.round(rgb[1] * f),
    Math.round(rgb[2] * f),
  ];
}

function variableSwatchCss(variable, catalog) {
  if (variableIsPalette(variable)) {
    return paletteSwatchCss(variable, catalog || [], draftRgb);
  }
  const rgb = swatchRgb(variable?.color, variable?.brightness);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** Nearest Helland kelvin in [min,max] to an RGB (for RGB→temp mode convert). */
function approxKelvinFromRgb(rgb, tempMin, tempMax) {
  const minK = Math.round(Number(tempMin) || 2000);
  const maxK = Math.round(Number(tempMax) || 6500);
  let best = Math.round((minK + maxK) / 2);
  let bestDist = Infinity;
  for (let kelvin = minK; kelvin <= maxK; kelvin += 25) {
    const sample = kelvinToRgb(kelvin);
    const dist =
      (sample[0] - rgb[0]) ** 2 +
      (sample[1] - rgb[1]) ** 2 +
      (sample[2] - rgb[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = kelvin;
    }
  }
  return best;
}

function kelvinForTempConvert(draft, tempMin, tempMax) {
  if (draft?.color_temp_kelvin != null) {
    return Math.round(draft.color_temp_kelvin);
  }
  return approxKelvinFromRgb(draftRgb(draft), tempMin, tempMax);
}

function inferDraftColorKind(draft) {
  if (draft?.color_mode === "color_temp" && draft?.color_temp_kelvin != null) {
    return "temp";
  }
  if (draft?.color_mode === "rgbww" || draft?.rgbww_color) {
    return "rgbww";
  }
  if (draft?.color_mode === "rgbw" || draft?.rgbw_color) {
    return "rgbw";
  }
  // Prefer HS over RGB: applyColorToDraft writes HS, and RGB channel lerp of
  // complements bows through white — not the rim path users expect.
  if (draft?.color_mode === "hs" || draft?.hs_color) {
    return "hs";
  }
  if (draft?.color_mode === "rgb" || draft?.rgb_color) {
    return "rgb";
  }
  if (draft?.color_temp_kelvin != null) {
    return "temp";
  }
  return null;
}

/** Short active-draft readout for the wheel chrome. */
function formatWheelReadout(draft, wheelMode) {
  if (!draft || draft.state === "off") {
    return "Off";
  }
  if (wheelMode === "temp") {
    const kelvin = draft.color_temp_kelvin;
    if (kelvin == null) {
      return "Color temperature";
    }
    return `${Math.round(kelvin)} K`;
  }
  const kind = inferDraftColorKind(draft);
  if (kind === "hs" && draft.hs_color) {
    return `HS · ${Math.round(draft.hs_color[0])}°, ${Math.round(draft.hs_color[1])}%`;
  }
  if (kind === "rgb" && draft.rgb_color) {
    const [r, g, b] = draft.rgb_color;
    return `RGB · ${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
  }
  if (kind === "rgbw") {
    return "RGBW";
  }
  if (kind === "rgbww") {
    return "RGBWW";
  }
  if (kind === "temp" && draft.color_temp_kelvin != null) {
    return `${Math.round(draft.color_temp_kelvin)} K`;
  }
  return "Color";
}

/** HS for chromatic drafts (native hs, else from rgb). Null for temp / missing. */
function draftHs(draft) {
  if (draft?.hs_color) {
    return [draft.hs_color[0], draft.hs_color[1] / 100];
  }
  if (draft?.rgb_color) {
    const hsv = rgb2hsv(
      draft.rgb_color[0],
      draft.rgb_color[1],
      draft.rgb_color[2]
    );
    return [hsv[0], hsv[1]];
  }
  return null;
}

function collapseSceneCycle(sequence) {
  const ids = [];
  for (const id of sequence || []) {
    if (!id) {
      continue;
    }
    if (!ids.length || ids[ids.length - 1] !== id) {
      ids.push(id);
    }
  }
  if (ids.length > 1 && ids[0] === ids[ids.length - 1]) {
    ids.pop();
  }
  return ids;
}

function lerpNumber(from, to, t) {
  return from + (to - from) * t;
}

function interpolateDraftSample(fromDraft, toDraft, t) {
  const fromKind = inferDraftColorKind(fromDraft);
  const toKind = inferDraftColorKind(toDraft);
  // Same kind: channel-native lerp. Chromatic HS/RGB (incl. mixed): hue+sat on
  // the wheel rim. Temp / rgbw / rgbww still RGB-lerp across kinds.
  if (fromKind && toKind && fromKind === toKind) {
    if (fromKind === "temp") {
      const fromK = fromDraft?.color_temp_kelvin;
      const toK = toDraft?.color_temp_kelvin;
      const start = fromK != null ? fromK : toK;
      const end = toK != null ? toK : fromK;
      if (start == null || end == null) {
        return { rgb: draftRgb(t < 0.5 ? fromDraft : toDraft) };
      }
      const kelvin = lerpNumber(start, end, t);
      return { kelvin, rgb: hueTempToRgb(kelvin) };
    }
    if (fromKind === "hs" || fromKind === "rgb") {
      const start = draftHs(fromDraft);
      const end = draftHs(toDraft);
      if (!start || !end) {
        return { rgb: draftRgb(t < 0.5 ? fromDraft : toDraft) };
      }
      const hs = [
        lerpNumber(start[0], end[0], t),
        lerpNumber(start[1], end[1], t),
      ];
      return { hs: [hs[0], hs[1] * 100], rgb: hsv2rgb(hs[0], hs[1], 1) };
    }
    if (fromKind === "rgbw" && fromDraft?.rgbw_color && toDraft?.rgbw_color) {
      const rgbw = fromDraft.rgbw_color.map((value, index) =>
        lerpNumber(value, toDraft.rgbw_color[index], t)
      );
      return { rgb: rgbwToRgb(rgbw) };
    }
    if (fromKind === "rgbww" && fromDraft?.rgbww_color && toDraft?.rgbww_color) {
      const rgbww = fromDraft.rgbww_color.map((value, index) =>
        lerpNumber(value, toDraft.rgbww_color[index], t)
      );
      return { rgb: rgbwwToRgb(rgbww) };
    }
  }
  // Cross-mode chromatic (hs↔rgb): stay on the rim like same-kind HS.
  const fromHs = draftHs(fromDraft);
  const toHs = draftHs(toDraft);
  if (fromHs && toHs) {
    const hs = [
      lerpNumber(fromHs[0], toHs[0], t),
      lerpNumber(fromHs[1], toHs[1], t),
    ];
    return { hs: [hs[0], hs[1] * 100], rgb: hsv2rgb(hs[0], hs[1], 1) };
  }
  const start = draftRgb(fromDraft);
  const end = draftRgb(toDraft);
  return {
    rgb: [
      lerpNumber(start[0], end[0], t),
      lerpNumber(start[1], end[1], t),
      lerpNumber(start[2], end[2], t),
    ],
  };
}

/** Steps for a wheel-path edge (cosmetic denser than runtime; same lerp). */
function huePathStepCount(fromDraft, toDraft, wheelMode) {
  if (wheelMode !== "color") {
    return HUE_PATH_STEPS;
  }
  const fromHs = draftHs(fromDraft);
  const toHs = draftHs(toDraft);
  if (!fromHs || !toHs) {
    return HUE_PATH_STEPS;
  }
  const hueDelta = Math.abs(toHs[0] - fromHs[0]);
  const satDelta = Math.abs(toHs[1] - fromHs[1]);
  if (satDelta <= HUE_PATH_HS_SAT_EPS) {
    // Near-constant sat: follow the rim with ~2.5° chords.
    return Math.max(
      HUE_PATH_STEPS,
      Math.ceil(Math.max(hueDelta, 1) / HUE_PATH_HS_DEG_PER_STEP)
    );
  }
  // Sat-varying HS: denser samples before Catmull-Rom stroke.
  return Math.max(HUE_PATH_STEPS, 96);
}

function huePathEdgeIsVaryingHs(fromDraft, toDraft, wheelMode) {
  if (wheelMode !== "color") {
    return false;
  }
  const fromHs = draftHs(fromDraft);
  const toHs = draftHs(toDraft);
  if (!fromHs || !toHs) {
    return false;
  }
  return Math.abs(toHs[1] - fromHs[1]) > HUE_PATH_HS_SAT_EPS;
}

/** Sample the same lerp as runtime onto wheel coordinates. */
function sampleHuePathEdge(
  fromDraft,
  toDraft,
  wheelMode,
  radius,
  tempMin,
  tempMax,
  geom
) {
  const steps = huePathStepCount(fromDraft, toDraft, wheelMode);
  const pts = [];
  for (let step = 0; step <= steps; step += 1) {
    const sample = interpolateDraftSample(fromDraft, toDraft, step / steps);
    const point = geom
      ? wheelPointForGeom(sample, geom, tempMin, tempMax, radius)
      : wheelPointForSample(sample, wheelMode, radius, tempMin, tempMax);
    if (point) {
      pts.push(point);
    }
  }
  return pts;
}

function polylinePathD(pts) {
  return pts
    .map(
      (pt, index) =>
        `${index ? "L" : "M"}${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`
    )
    .join(" ");
}

const GRAPH_DAY_SECONDS = 24 * 3600;

function wrapDaySeconds(seconds) {
  return (
    ((Number(seconds) % GRAPH_DAY_SECONDS) + GRAPH_DAY_SECONDS) %
    GRAPH_DAY_SECONDS
  );
}

function unwrapSegmentSeconds(fromSec, toSec) {
  const from = wrapDaySeconds(fromSec);
  let to = wrapDaySeconds(toSec);
  if (to <= from) {
    to += GRAPH_DAY_SECONDS;
  }
  return { from, to, span: to - from };
}

function stepsForClockSpan(span) {
  return Math.max(8, Math.min(36, Math.round(span / 600) || 8));
}

/**
 * Closed brightness loop in clock space: seconds and brightness both lerp
 * linearly between knots (same as runtime). Sample polar so dusk→dawn follows
 * the rim instead of a Cartesian chord.
 */
function polarEaseClosedPathD(knots, pointAt) {
  if (!knots?.length) {
    return "";
  }
  if (knots.length === 1) {
    const pt = pointAt(knots[0].seconds, knots[0].bri);
    return `M${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
  }
  const pts = [];
  const n = knots.length;
  for (let i = 0; i < n; i += 1) {
    const from = knots[i];
    const to = knots[(i + 1) % n];
    const { from: a, span } = unwrapSegmentSeconds(from.seconds, to.seconds);
    const steps = stepsForClockSpan(span);
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const bri = from.bri + (to.bri - from.bri) * t;
      pts.push(pointAt(wrapDaySeconds(a + span * t), bri));
    }
  }
  if (pts.length < 2) {
    return "";
  }
  return `${pts
    .map(
      (pt, index) =>
        `${index ? "L" : "M"}${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`
    )
    .join(" ")} Z`;
}

function linearGraphRuns(knots, { closed = true } = {}) {
  const n = knots.length;
  if (n === 1) {
    return [[{ sec: wrapDaySeconds(knots[0].seconds), bri: knots[0].bri }]];
  }
  if (n < 2) {
    return [];
  }
  const runs = [];
  let run = [];
  const flush = () => {
    if (run.length) {
      runs.push(run);
      run = [];
    }
  };
  const push = (sec, bri) => {
    const last = run[run.length - 1];
    if (last && last.sec === sec && last.bri === bri) {
      return;
    }
    run.push({ sec, bri });
  };
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i += 1) {
    const from = knots[i];
    const to = knots[(i + 1) % n];
    const { from: a, span } = unwrapSegmentSeconds(from.seconds, to.seconds);
    if (!run.length) {
      push(wrapDaySeconds(from.seconds), from.bri);
    }
    const toUnwrapped = a + span;
    if (toUnwrapped > GRAPH_DAY_SECONDS) {
      const tMid = (GRAPH_DAY_SECONDS - a) / span;
      const briMid = from.bri + (to.bri - from.bri) * tMid;
      push(GRAPH_DAY_SECONDS, briMid);
      flush();
      push(0, briMid);
    }
    if (toUnwrapped === GRAPH_DAY_SECONDS) {
      push(GRAPH_DAY_SECONDS, to.bri);
      flush();
      push(0, to.bri);
    } else {
      push(wrapDaySeconds(to.seconds), to.bri);
    }
  }
  flush();
  return runs;
}

function dayGraphPathD(knots, xOfSec, yOfBri, plotBottom) {
  // Close dusk→dawn so fill covers 00:00 and 24:00. xOf must map 86400 to
  // the right edge (not 0), or this chord fills above the curve.
  const runs = linearGraphRuns(knots, { closed: knots.length > 1 });
  if (!runs.length) {
    return { stroke: "", fill: "" };
  }
  const stroke = runs
    .map((pts) =>
      pts
        .map((pt, index) => {
          const x = xOfSec(pt.sec).toFixed(1);
          const y = yOfBri(pt.bri).toFixed(1);
          return `${index ? "L" : "M"}${x} ${y}`;
        })
        .join(" ")
    )
    .join(" ");
  const fill = runs
    .map((pts) => {
      if (pts.length < 2) {
        return "";
      }
      const firstX = xOfSec(pts[0].sec).toFixed(1);
      const lastX = xOfSec(pts[pts.length - 1].sec).toFixed(1);
      const top = pts
        .map((pt, index) => {
          const x = xOfSec(pt.sec).toFixed(1);
          const y = yOfBri(pt.bri).toFixed(1);
          return `${index ? "L" : "M"}${x} ${y}`;
        })
        .join(" ");
      return `${top} L${lastX} ${plotBottom.toFixed(1)} L${firstX} ${plotBottom.toFixed(1)} Z`;
    })
    .filter(Boolean)
    .join(" ");
  return { stroke, fill };
}

/** Uniform Catmull-Rom → cubic Bezier path (cosmetic stroke only). */
function catmullRomPathD(pts) {
  if (pts.length < 2) {
    return "";
  }
  if (pts.length === 2) {
    return polylinePathD(pts);
  }
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Closed uniform Catmull-Rom → cubic Bezier (wraps last→first). */
function closedCatmullRomPathD(pts) {
  if (pts.length < 3) {
    return catmullRomPathD(pts);
  }
  const n = pts.length;
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function huePathStrokeD(pts, smooth) {
  return smooth && pts.length >= 3 ? catmullRomPathD(pts) : polylinePathD(pts);
}

function colorWheelXY(hue, saturation, radius) {
  const phi = deg2rad(degFromHue(hue));
  const r = rFromSaturation(saturation, radius);
  const [x, y] = polar2xy(r, phi);
  return { x, y };
}

function wheelPointForSample(sample, wheelMode, radius, tempMin, tempMax) {
  if (wheelMode === "temp") {
    if (sample.kelvin == null) {
      return null;
    }
    const coords = coordinatesForTemp(sample.kelvin, radius, tempMin, tempMax);
    return { x: coords.x + radius, y: coords.y + radius, rgb: sample.rgb };
  }
  let hue;
  let saturation;
  if (sample.hs) {
    hue = sample.hs[0];
    saturation = sample.hs[1] / 100;
  } else {
    const hsv = rgb2hsv(sample.rgb[0], sample.rgb[1], sample.rgb[2]);
    hue = hsv[0];
    saturation = hsv[1];
  }
  const coords = colorWheelXY(hue, saturation, radius);
  return { x: coords.x + radius, y: coords.y + radius, rgb: sample.rgb };
}

function hueColorAt(x, y, radius) {
  const [r, phi] = xy2polar(x, y);
  if (r - 2 > radius) {
    return null;
  }
  const hue = hueFromDeg(rad2deg(phi));
  const saturation = saturationFromR(r, radius);
  const value = hsValue(hue, r, radius);
  return { rgb: hsv2rgb(hue, saturation, value), hsv: [hue, saturation, value] };
}

function hueTempAt(x, y, radius, tempMin, tempMax) {
  const [r] = xy2polar(x, y);
  if (r - 2 > radius) {
    return null;
  }
  const rowLength = 2 * radius;
  const n = (y + radius) / rowLength;
  const kelvin = Math.round(hueCurveScale(n, tempMin, tempMax));
  return { rgb: hueTempToRgb(kelvin), kelvin };
}

function coordinatesForColor(hue, saturation, radius) {
  const phi = deg2rad(degFromHue(hue));
  const r = rFromSaturation(saturation, radius);
  const [x, y] = polar2xy(r, phi);
  return { x: Math.round(x), y: Math.round(y) };
}

function coordinatesForTemp(kelvin, radius, tempMin, tempMax) {
  let k = kelvin;
  if (k < tempMin) {
    k = tempMin;
  } else if (k > tempMax) {
    k = tempMax;
  }
  const n = inverseHueCurveScale(k, tempMin, tempMax);
  const y = Math.round(n * 2 * radius - radius);
  const maxX = Math.ceil(Math.sqrt(Math.max(0, radius * radius - y * y)));
  return { x: 0, y, maxX };
}

function limitToWheel(x, y, radius) {
  const dx = x - radius;
  const dy = y - radius;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius || dist === 0) {
    return { x, y };
  }
  const scale = radius / dist;
  return { x: radius + dx * scale, y: radius + dy * scale };
}

function cssFrac(el, name, fallback) {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) {
    return fallback;
  }
  if (raw.endsWith("%")) {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n / 100 : fallback;
  }
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function pinStackKind(scenes, hasColor, hasTemp, capsOf) {
  if (!hasColor) {
    return "temp-only";
  }
  if (!hasTemp) {
    return "color-only";
  }
  let color = 0;
  let temp = 0;
  for (const scene of scenes || []) {
    if (!scene?.draft) {
      continue;
    }
    const caps = capsOf(scene);
    const mode = draftWheelMode(scene.draft, caps.hasColor, caps.hasTemp);
    if (mode === "temp") {
      temp += 1;
    } else {
      color += 1;
    }
  }
  if (color && temp) {
    return "mixed";
  }
  if (temp && !color) {
    return "temp";
  }
  return "color";
}

function wheelStackGeom(radius, kind, peekFrac, mixedInnerFrac, gapFrac) {
  const peek = Math.max(4, radius * peekFrac);
  const gap = Math.max(0, radius * (gapFrac || 0));
  if (kind === "color-only") {
    return {
      kind,
      color: { inner: 0, outer: radius },
      temp: { inner: radius, outer: radius },
      front: "color",
    };
  }
  if (kind === "temp-only") {
    return {
      kind,
      color: { inner: radius, outer: radius },
      temp: { inner: 0, outer: radius },
      front: "temp",
    };
  }
  if (kind === "color") {
    const outer = radius - peek;
    return {
      kind,
      color: { inner: 0, outer },
      temp: { inner: outer, outer: radius },
      front: "color",
    };
  }
  if (kind === "temp") {
    const outer = radius - peek;
    return {
      kind,
      color: { inner: outer, outer: radius },
      temp: { inner: 0, outer },
      front: "temp",
    };
  }
  const colorOuter = radius * mixedInnerFrac;
  return {
    kind,
    color: { inner: 0, outer: colorOuter },
    temp: { inner: colorOuter + gap, outer: radius },
    front: "color",
  };
}

function bandLive(band) {
  return band && band.outer > band.inner + 1;
}

function clampRelToAnnulus(x, y, inner, outer) {
  const r = Math.hypot(x, y);
  if (outer <= inner) {
    return { x: 0, y: 0 };
  }
  if (r < 1e-6) {
    return inner > 0 ? { x: inner, y: 0 } : { x: 0, y: 0 };
  }
  let nr = r;
  if (r > outer) {
    nr = outer;
  } else if (r < inner) {
    nr = inner;
  }
  const scale = nr / r;
  return { x: x * scale, y: y * scale };
}

function placeColorInAnnulus(hue, saturation, inner, outer) {
  const coords = coordinatesForColor(hue, saturation, outer);
  return clampRelToAnnulus(coords.x, coords.y, inner, outer);
}

function placeTempInAnnulus(kelvin, inner, outer, tempMin, tempMax) {
  const coords = coordinatesForTemp(kelvin, outer, tempMin, tempMax);
  if (!(inner > 0)) {
    return { x: coords.x, y: coords.y };
  }
  // Resting pins sit on the band centerline (not the inner rim). Drag still
  // samples the full annulus via limitToAnnulus.
  const mid = (inner + outer) / 2;
  let y = coords.y;
  const maxY = Math.max(0, mid - 0.5);
  y = Math.max(-maxY, Math.min(maxY, y));
  const x = Math.sqrt(Math.max(0, mid * mid - y * y));
  return { x, y };
}

function limitToAnnulus(x, y, cx, inner, outer) {
  const rel = clampRelToAnnulus(x - cx, y - cx, inner, outer);
  return { x: cx + rel.x, y: cx + rel.y };
}

function wheelPointForGeom(sample, geom, tempMin, tempMax, radius) {
  const cx = radius;
  const isTemp = sample.kelvin != null && sample.hs == null;
  if (isTemp && bandLive(geom.temp)) {
    const rel = placeTempInAnnulus(
      sample.kelvin,
      geom.temp.inner,
      geom.temp.outer,
      tempMin,
      tempMax
    );
    return { x: cx + rel.x, y: cx + rel.y, rgb: sample.rgb };
  }
  if (!bandLive(geom.color) || !sample.rgb) {
    return null;
  }
  let hue;
  let saturation;
  if (sample.hs) {
    hue = sample.hs[0];
    saturation = sample.hs[1] / 100;
  } else {
    const hsv = rgb2hsv(sample.rgb[0], sample.rgb[1], sample.rgb[2]);
    hue = hsv[0];
    saturation = hsv[1];
  }
  const rel = placeColorInAnnulus(hue, saturation, geom.color.inner, geom.color.outer);
  return { x: cx + rel.x, y: cx + rel.y, rgb: sample.rgb };
}

function annulusMask(innerFrac, outerFrac) {
  const inner = Math.max(0, Math.min(100, innerFrac * 100));
  const outer = Math.max(0, Math.min(100, outerFrac * 100));
  return `radial-gradient(farthest-side, transparent ${inner}%, #000 ${inner}%, #000 ${outer}%, transparent ${outer}%)`;
}

function drawHueWheelImage(mode, tempMin, tempMax) {
  const key =
    mode === "temp"
      ? `temp:${HUE_WHEEL_RENDER}:${tempMin}:${tempMax}`
      : `color:${HUE_WHEEL_RENDER}`;
  const cached = _hueWheelImageCache.get(key);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = HUE_WHEEL_RENDER;
  canvas.height = HUE_WHEEL_RENDER;
  const ctx = canvas.getContext("2d");
  const radius = HUE_WHEEL_RENDER / 2;
  const image = ctx.createImageData(HUE_WHEEL_RENDER, HUE_WHEEL_RENDER);
  const data = image.data;
  for (let x = -radius; x < radius; x++) {
    for (let y = -radius; y < radius; y++) {
      const sample =
        mode === "color"
          ? hueColorAt(x, y, radius)
          : hueTempAt(x, y, radius, tempMin, tempMax);
      if (!sample) {
        continue;
      }
      const adjustedX = x + radius;
      const adjustedY = y + radius;
      const index = (adjustedX + adjustedY * HUE_WHEEL_RENDER) * 4;
      data[index] = sample.rgb[0];
      data[index + 1] = sample.rgb[1];
      data[index + 2] = sample.rgb[2];
      data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL();
  _hueWheelImageCache.set(key, url);
  return url;
}

function paletteTRFromRel(x, y, radius) {
  const dist = Math.hypot(x, y);
  const r = radius <= 0 ? 0 : Math.min(1, dist / radius);
  let t = (Math.atan2(y, x) + Math.PI / 2) / (2 * Math.PI);
  if (t < 0) {
    t += 1;
  }
  return { t, r };
}

function relFromPaletteTR(t, r, radius) {
  const turns = ((Number(t) % 1) + 1) % 1;
  const sat = Math.max(0, Math.min(1, Number(r) || 0));
  const phi = turns * 2 * Math.PI - Math.PI / 2;
  const rad = sat * radius;
  return { x: rad * Math.cos(phi), y: rad * Math.sin(phi) };
}

function drawPaletteWheelImage(palette, catalog) {
  const key = `palette:${palette?.id}:${JSON.stringify(palette?.slots || [])}`;
  const cached = _hueWheelImageCache.get(key);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = HUE_WHEEL_RENDER;
  canvas.height = HUE_WHEEL_RENDER;
  const ctx = canvas.getContext("2d");
  const radius = HUE_WHEEL_RENDER / 2;
  const image = ctx.createImageData(HUE_WHEEL_RENDER, HUE_WHEEL_RENDER);
  const data = image.data;
  for (let x = -radius; x < radius; x += 1) {
    for (let y = -radius; y < radius; y += 1) {
      if (Math.hypot(x, y) - 2 > radius) {
        continue;
      }
      const { t, r } = paletteTRFromRel(x, y, radius);
      const sampled = samplePaletteWheel(palette, t, r, catalog, draftRgb);
      const index = (x + radius + (y + radius) * HUE_WHEEL_RENDER) * 4;
      data[index] = sampled.rgb[0];
      data[index + 1] = sampled.rgb[1];
      data[index + 2] = sampled.rgb[2];
      data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL();
  _hueWheelImageCache.set(key, url);
  return url;
}

function createLightBrightnessGraph({
  title: headingText = "Brightness",
  subtitle = "0–100% by solar event",
  getPoints,
  onSelect,
  onAdd,
  onBrightness,
  onDragEnd,
}) {
  // Full-bleed plot — 0/100% live in the heading subtext, not axis labels.
  // Height stays fixed in CSS (120px); viewBox width tracks the element so
  // circles stay round when the sidebar grows (no aspect-ratio lock).
  // Extra PAD_B leaves room for a second label row when dawn/sunrise (etc.)
  // sit too close for one line.
  const HEIGHT = 120;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 30;
  const PLOT_H = HEIGHT - PAD_T - PAD_B;
  const LABEL_Y0 = HEIGHT - 4;
  const LABEL_Y1 = HEIGHT - 15;
  const LABEL_GAP = 3;
  // Ignore small pointer jitter so a tap can select without writing brightness.
  const DRAG_THRESHOLD_PX = 10;
  // Mid-segment color stops between events (same lerp as the hue-wheel path).
  const GRADIENT_STEPS_PER_SEGMENT = 8;
  let plotW = 300 - PAD_L - PAD_R;
  let viewW = 300;

  const el = document.createElement("div");
  el.className = "light-brightness-graph";
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Brightness by solar event, 0 to 100 percent");

  const heading = document.createElement("div");
  heading.className = "light-brightness-graph-heading";
  const title = document.createElement("div");
  title.className = "light-brightness-graph-title";
  title.textContent = headingText;
  const sub = document.createElement("div");
  sub.className = "light-brightness-graph-sub";
  const defaultSubtitle = subtitle;
  sub.textContent = defaultSubtitle;
  heading.append(title, sub);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${viewW} ${HEIGHT}`);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const gradient = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "linearGradient"
  );
  const gradientId = `light-bri-grad-${Math.random().toString(36).slice(2, 9)}`;
  gradient.setAttribute("id", gradientId);
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.setAttribute("x1", String(PAD_L));
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("x2", String(PAD_L + plotW));
  gradient.setAttribute("y2", "0");
  defs.appendChild(gradient);

  const frame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  frame.setAttribute("class", "bg-frame");
  frame.setAttribute("x", String(PAD_L));
  frame.setAttribute("y", String(PAD_T));
  frame.setAttribute("width", String(plotW));
  frame.setAttribute("height", String(PLOT_H));
  frame.setAttribute("rx", "6");

  const fillArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
  fillArea.setAttribute("class", "fill-area");
  fillArea.setAttribute("fill", `url(#${gradientId})`);

  const curve = document.createElementNS("http://www.w3.org/2000/svg", "path");
  curve.setAttribute("class", "curve");

  const handlesLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  handlesLayer.setAttribute("class", "handles");

  svg.append(defs, frame, fillArea, curve, handlesLayer);
  // Plot wrapper: title keeps pan-y scroll; plot locks touch + HA sheet dismiss
  // (ha-bottom-sheet SWIPE_LOCKED_CLASSES includes volume-slider-container).
  const plot = document.createElement("div");
  plot.className = "light-brightness-graph-plot volume-slider-container";
  plot.appendChild(svg);
  el.append(heading, plot);

  const fireSheetSliderLock = (active) => {
    el.dispatchEvent(
      new CustomEvent(
        active ? "slider-interaction-start" : "slider-interaction-stop",
        { bubbles: true, composed: true }
      )
    );
  };

  let drag = null;
  let dragNode = null;

  const applyLayout = (widthPx) => {
    viewW = Math.max(Math.round(widthPx) || 300, 120);
    plotW = Math.max(viewW - PAD_L - PAD_R, 40);
    svg.setAttribute("viewBox", `0 0 ${viewW} ${HEIGHT}`);
    frame.setAttribute("width", String(plotW));
    gradient.setAttribute("x2", String(PAD_L + plotW));
  };

  const xOf = (seconds) => {
    const s = Number(seconds);
    if (s >= GRAPH_DAY_SECONDS) {
      return PAD_L + plotW;
    }
    return PAD_L + (wrapDaySeconds(s) / GRAPH_DAY_SECONDS) * plotW;
  };
  const yOf = (brightness) =>
    PAD_T + PLOT_H * (1 - Math.max(0, Math.min(255, brightness)) / 255);
  const brightnessFromY = (clientY) => {
    const rect = svg.getBoundingClientRect();
    const scaleY = HEIGHT / (rect.height || HEIGHT);
    const y = (clientY - rect.top) * scaleY;
    const t = 1 - (y - PAD_T) / PLOT_H;
    return Math.round(Math.max(0, Math.min(1, t)) * 255);
  };
  // ~10px UI font; prefer overestimate so labels deconflict early.
  const estimateLabelWidth = (text) => Math.max(24, String(text).length * 6.2);

  /** Keep dots on true time; stagger / nudge labels when names would collide. */
  const layoutHandleLabels = (coords) => {
    const laid = coords.map((c, index) => ({
      index,
      x: c.x,
      y: LABEL_Y0,
      w: estimateLabelWidth(c.point.name),
      name: c.point.name,
    }));
    laid.sort((a, b) => a.x - b.x);
    const overlaps = (a, b) =>
      a.y === b.y && Math.abs(a.x - b.x) < (a.w + b.w) / 2 + LABEL_GAP;
    for (let i = 1; i < laid.length; i++) {
      const prev = laid[i - 1];
      const cur = laid[i];
      if (overlaps(prev, cur)) {
        cur.y = prev.y === LABEL_Y0 ? LABEL_Y1 : LABEL_Y0;
      }
    }
    // Same-row neighbors that still collide (e.g. three close events): nudge.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < laid.length; i++) {
        const prev = laid[i - 1];
        const cur = laid[i];
        if (!overlaps(prev, cur)) {
          continue;
        }
        const need = (prev.w + cur.w) / 2 + LABEL_GAP;
        const mid = (prev.x + cur.x) / 2;
        prev.x = mid - need / 2;
        cur.x = mid + need / 2;
      }
    }
    for (const item of laid) {
      const half = item.w / 2;
      item.x = Math.max(PAD_L + half, Math.min(PAD_L + plotW - half, item.x));
    }
    const out = new Array(coords.length);
    for (const item of laid) {
      out[item.index] = item;
    }
    return out;
  };

  const unbindWindowDrag = () => {
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerUp);
  };

  const onWindowPointerMove = (ev) => {
    if (!drag || drag.pointerId !== ev.pointerId) {
      return;
    }
    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;
    if (!drag.moved) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        return;
      }
      drag.moved = true;
    }
    const brightness = brightnessFromY(ev.clientY);
    const pct = Math.round((brightness * 100) / 255);
    sub.textContent = `${pct}%`;
    onBrightness(drag.sceneId, brightness);
  };

  const onWindowPointerUp = (ev) => {
    endDrag(ev);
  };

  const appendGradientStop = (offsetPct, rgb) => {
    const stop = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "stop"
    );
    stop.setAttribute("offset", `${offsetPct.toFixed(2)}%`);
    stop.setAttribute(
      "stop-color",
      `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    );
    gradient.appendChild(stop);
  };

  const paintGeometry = (points) => {
    gradient.replaceChildren();
    const members = points.filter((point) => point.member);
    if (!points.length) {
      fillArea.setAttribute("d", "");
      curve.setAttribute("d", "");
      return [];
    }
    const plotBottom = PAD_T + PLOT_H;
    if (members.length === 1) {
      appendGradientStop(0, members[0].rgb);
      appendGradientStop(100, members[0].rgb);
    } else if (members.length > 1) {
      const stops = [];
      const n = members.length;
      for (let index = 0; index < n; index += 1) {
        const from = members[index];
        const to = members[(index + 1) % n];
        const { from: a, span } = unwrapSegmentSeconds(from.seconds, to.seconds);
        for (let step = 0; step <= GRADIENT_STEPS_PER_SEGMENT; step += 1) {
          if (index > 0 && step === 0) {
            continue;
          }
          const t = step / GRADIENT_STEPS_PER_SEGMENT;
          const sample =
            from.draft && to.draft
              ? interpolateDraftSample(from.draft, to.draft, t)
              : {
                  rgb: [
                    Math.round(from.rgb[0] + (to.rgb[0] - from.rgb[0]) * t),
                    Math.round(from.rgb[1] + (to.rgb[1] - from.rgb[1]) * t),
                    Math.round(from.rgb[2] + (to.rgb[2] - from.rgb[2]) * t),
                  ],
                };
          const sec = wrapDaySeconds(a + span * t);
          stops.push({
            offset: (sec / GRAPH_DAY_SECONDS) * 100,
            rgb: sample.rgb,
          });
        }
      }
      stops.sort((left, right) => left.offset - right.offset);
      for (const stop of stops) {
        appendGradientStop(stop.offset, stop.rgb);
      }
    }
    if (members.length) {
      const knots = members.map((point) => ({
        seconds: point.seconds,
        bri: point.brightness,
      }));
      const { stroke, fill } = dayGraphPathD(
        knots,
        xOf,
        yOf,
        plotBottom
      );
      fillArea.setAttribute("d", fill);
      curve.setAttribute("d", stroke);
    } else {
      fillArea.setAttribute("d", "");
      curve.setAttribute("d", "");
    }
    return points.map((point) => ({
      x: xOf(point.seconds),
      y: point.member ? yOf(point.brightness) : plotBottom,
      point,
    }));
  };

  const syncDragVisual = () => {
    const points = [...getPoints()];
    const coords = paintGeometry(points);
    for (const node of handlesLayer.querySelectorAll(".handle")) {
      const match = coords.find((c) => c.point.eventId === node.dataset.eventId);
      if (!match) {
        continue;
      }
      node.classList.toggle("active", Boolean(match.point.active));
      node.classList.toggle("add", !match.point.member);
      for (const circle of node.querySelectorAll("circle")) {
        circle.setAttribute("cx", match.x.toFixed(1));
        circle.setAttribute("cy", match.y.toFixed(1));
      }
      const plus = node.querySelector(".handle-plus");
      if (plus) {
        plus.setAttribute("x", match.x.toFixed(1));
        plus.setAttribute("y", match.y.toFixed(1));
      }
      const fill = node.querySelector(".handle-fill");
      if (fill) {
        const [r, g, b] = match.point.rgb;
        fill.setAttribute("fill", `rgb(${r},${g},${b})`);
        fill.style.display = match.point.member ? "" : "none";
      }
    }
  };

  const endDrag = (ev) => {
    if (!drag || (ev && drag.pointerId !== ev.pointerId)) {
      return;
    }
    const node = dragNode;
    const pointerId = drag.pointerId;
    const moved = drag.moved;
    drag = null;
    dragNode = null;
    unbindWindowDrag();
    fireSheetSliderLock(false);
    sub.textContent = defaultSubtitle;
    if (ev && node) {
      try {
        node.releasePointerCapture(pointerId);
      } catch (_err) {
        /* already released */
      }
    }
    sync();
    if (moved) {
      onDragEnd?.();
    }
  };

  const sync = () => {
    if (drag) {
      syncDragVisual();
      return;
    }
    const points = [...getPoints()];
    handlesLayer.replaceChildren();
    const coords = paintGeometry(points);
    if (!points.length) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const labelLayout = layoutHandleLabels(coords);
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      const labelPos = labelLayout[i];
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const classes = ["handle"];
      if (c.point.active) {
        classes.push("active");
      }
      if (!c.point.member) {
        classes.push("add");
      }
      group.setAttribute("class", classes.join(" "));
      group.dataset.eventId = c.point.eventId;
      group.dataset.sceneId = c.point.sceneId;
      const hit = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      hit.setAttribute("class", "handle-hit");
      hit.setAttribute("cx", c.x.toFixed(1));
      hit.setAttribute("cy", c.y.toFixed(1));
      hit.setAttribute("r", "14");
      const fill = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      fill.setAttribute("class", "handle-fill");
      fill.setAttribute("cx", c.x.toFixed(1));
      fill.setAttribute("cy", c.y.toFixed(1));
      fill.setAttribute("r", "5");
      const [r, gCh, b] = c.point.rgb;
      fill.setAttribute("fill", `rgb(${r},${gCh},${b})`);
      if (!c.point.member) {
        fill.style.display = "none";
      }
      const dot = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      dot.setAttribute("class", "handle-dot");
      dot.setAttribute("cx", c.x.toFixed(1));
      dot.setAttribute("cy", c.y.toFixed(1));
      dot.setAttribute("r", "7");
      const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      label.setAttribute("class", "handle-label");
      label.setAttribute("x", labelPos.x.toFixed(1));
      label.setAttribute("y", String(labelPos.y));
      label.textContent = c.point.name;
      group.append(hit, dot, fill);
      if (!c.point.member) {
        const plus = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );
        plus.setAttribute("class", "handle-plus");
        plus.setAttribute("x", c.x.toFixed(1));
        plus.setAttribute("y", c.y.toFixed(1));
        plus.textContent = "+";
        group.appendChild(plus);
        group.setAttribute(
          "aria-label",
          `Add to ${c.point.name}`
        );
        group.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          onAdd?.(c.point.sceneId, c.point.eventId);
        });
      } else {
        group.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          // Window listeners so release outside the SVG still ends the drag
          // (SVG setPointerCapture alone is flaky across the sidebar chrome).
          unbindWindowDrag();
          try {
            group.setPointerCapture(ev.pointerId);
          } catch (_err) {
            /* capture optional when window listeners are bound */
          }
          dragNode = group;
          drag = {
            sceneId: c.point.sceneId,
            eventId: c.point.eventId,
            pointerId: ev.pointerId,
            startX: ev.clientX,
            startY: ev.clientY,
            moved: false,
          };
          fireSheetSliderLock(true);
          window.addEventListener("pointermove", onWindowPointerMove);
          window.addEventListener("pointerup", onWindowPointerUp);
          window.addEventListener("pointercancel", onWindowPointerUp);
          onSelect(c.point.eventId);
          // Do not write brightness until the pointer moves past the threshold.
        });
      }
      group.appendChild(label);
      handlesLayer.appendChild(group);
    }
  };

  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver((entries) => {
          const width = entries[0]?.contentRect?.width;
          if (!(width > 0)) {
            return;
          }
          applyLayout(width);
          sync();
        })
      : null;
  resizeObserver?.observe(el);
  // First paint before layout may be 0 — sync again after mount.
  requestAnimationFrame(() => {
    applyLayout(el.clientWidth || 300);
    sync();
  });

  sync();
  return {
    el,
    sync,
    disconnect: () => {
      resizeObserver?.disconnect();
      unbindWindowDrag();
      drag = null;
      dragNode = null;
    },
  };
}

function createSceneColorWheel({
  hasColor,
  hasTemp,
  tempMin,
  tempMax,
  getState,
  onSelect,
  onChange,
  getPalette,
  onAddPalette,
  getCapabilities,
  getAssignmentSeed,
  getAssignmentEntityId,
  onRandomizeSeed,
}) {
  // Polar HSV + kelvin disks stacked (peek / mixed). Pins live on their mode.
  const stage = document.createElement("div");
  stage.className = "hue-wheel-stage";
  const canvasWrap = document.createElement("div");
  canvasWrap.className = "hue-wheel-canvas volume-slider-container";
  const glow = document.createElement("canvas");
  glow.className = "hue-wheel-glow";
  glow.setAttribute("aria-hidden", "true");
  glow.width = HUE_WHEEL_RENDER;
  glow.height = HUE_WHEEL_RENDER;
  const bgTemp = document.createElement("canvas");
  bgTemp.className = "hue-wheel-layer hue-wheel-temp";
  bgTemp.width = HUE_WHEEL_RENDER;
  bgTemp.height = HUE_WHEEL_RENDER;
  const bgColor = document.createElement("canvas");
  bgColor.className = "hue-wheel-layer hue-wheel-color";
  bgColor.width = HUE_WHEEL_RENDER;
  bgColor.height = HUE_WHEEL_RENDER;
  const bgPalette = document.createElement("canvas");
  bgPalette.className = "hue-wheel-layer hue-wheel-palette";
  bgPalette.width = HUE_WHEEL_RENDER;
  bgPalette.height = HUE_WHEEL_RENDER;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "hue-wheel-svg");
  svg.innerHTML = `
    <defs>
      <filter id="se-dot-shadow">
        <feDropShadow dx="0" dy="0.5" stdDeviation="1" flood-opacity="1"></feDropShadow>
      </filter>
      <filter id="se-active-shadow">
        <feOffset dx="0" dy="-10" />
        <feGaussianBlur stdDeviation="7" result="offset-blur"/>
        <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
        <feFlood flood-color="#0005" flood-opacity=".95" result="color"/>
        <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
        <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
        <feDropShadow dx="0" dy="1.0" stdDeviation="2.0" flood-opacity="1"></feDropShadow>
      </filter>
    </defs>
  `;
  const pathLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  pathLayer.setAttribute("class", "hue-wheel-paths");
  svg.appendChild(pathLayer);
  canvasWrap.append(glow, bgTemp, bgColor, bgPalette, svg);
  const floatReadout = document.createElement("div");
  floatReadout.className = "hue-wheel-float-readout";
  floatReadout.hidden = true;
  floatReadout.setAttribute("aria-live", "polite");
  canvasWrap.appendChild(floatReadout);
  const chrome = document.createElement("div");
  chrome.className = "hue-wheel-chrome";
  const presets = document.createElement("div");
  presets.className = "hue-presets";
  const presetTrack = document.createElement("div");
  presetTrack.className = "hue-presets-track";
  presetTrack.setAttribute("role", "list");
  presets.appendChild(presetTrack);
  chrome.append(presets);
  const modePill = document.createElement("div");
  modePill.className = "wheel-mode-pill";
  const randomizeBtn = document.createElement("button");
  randomizeBtn.type = "button";
  randomizeBtn.className = "wheel-palette-randomize";
  randomizeBtn.hidden = true;
  randomizeBtn.textContent = "Randomize";
  randomizeBtn.addEventListener("click", () => onRandomizeSeed?.());
  canvasWrap.appendChild(modePill);
  chrome.append(randomizeBtn);
  stage.append(canvasWrap, chrome);

  const markers = new Map();
  let drag = null;
  let glideTimer;
  let painted = { color: false, temp: false };
  let lastGeomKey = "";

  const capsOf = (scene) => {
    const extra =
      typeof getCapabilities === "function" ? getCapabilities(scene) : null;
    return {
      hasColor: extra?.hasColor ?? hasColor,
      hasTemp: extra?.hasTemp ?? hasTemp,
    };
  };

  const emitChange = (meta = {}) => {
    onChange?.({
      dragging: Boolean(drag),
      ...meta,
    });
  };

  const showFloatReadout = (draft, x, y, wheelMode) => {
    floatReadout.hidden = false;
    floatReadout.textContent = formatWheelReadout(draft, wheelMode);
    floatReadout.style.left = `${x}px`;
    floatReadout.style.top = `${y}px`;
  };

  const hideFloatReadout = () => {
    floatReadout.hidden = true;
  };

  const radiusPx = () => canvasWrap.clientWidth / 2;
  let uiMode = null;

  const paletteCatalog = () =>
    typeof getPalette === "function" ? getPalette() || [] : [];

  const paletteForDraft = (draft) =>
    paletteCatalog().find((item) => item.id === draft?.variable_ref);

  const entityIdOf = (scene) =>
    typeof getAssignmentEntityId === "function"
      ? getAssignmentEntityId(scene)
      : scene?.id;

  const seedNow = () =>
    typeof getAssignmentSeed === "function" ? Number(getAssignmentSeed()) || 0 : 0;

  const showingPalette = () => {
    const { scenes, activeId } = getState();
    const draft = scenes.find((row) => row.id === activeId)?.draft;
    if (uiMode === "color" || uiMode === "temp") {
      return false;
    }
    return variableIsPalette(paletteForDraft(draft));
  };

  const currentGeom = () => {
    const radius = radiusPx();
    const { scenes } = getState();
    if (showingPalette()) {
      return wheelStackGeom(radius, "color-only", 0, 1, 0);
    }
    const kind = pinStackKind(scenes, hasColor, hasTemp, capsOf);
    return wheelStackGeom(
      radius,
      kind,
      cssFrac(stage, "--wheel-peek", WHEEL_PEEK_FRAC),
      cssFrac(stage, "--wheel-mixed-inner", WHEEL_MIXED_INNER_FRAC),
      cssFrac(stage, "--wheel-mixed-gap", WHEEL_MIXED_GAP_FRAC)
    );
  };

  const drawImageTo = (canvas, url) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, HUE_WHEEL_RENDER, HUE_WHEEL_RENDER);
      ctx.drawImage(img, 0, 0);
    };
    img.src = url;
  };

  const paintWheels = () => {
    if (hasColor && !painted.color) {
      drawImageTo(bgColor, drawHueWheelImage("color", tempMin, tempMax));
      painted.color = true;
    }
    if (hasTemp && !painted.temp) {
      drawImageTo(bgTemp, drawHueWheelImage("temp", tempMin, tempMax));
      painted.temp = true;
    }
  };

  const paintGlow = (front) => {
    const url = drawHueWheelImage(
      front === "color" && hasTemp ? "temp" : hasColor ? "color" : "temp",
      tempMin,
      tempMax
    );
    const img = new Image();
    img.onload = () => {
      const glowCtx = glow.getContext("2d");
      glowCtx.clearRect(0, 0, HUE_WHEEL_RENDER, HUE_WHEEL_RENDER);
      glowCtx.drawImage(img, 0, 0);
    };
    img.src = url;
  };

  const applyLayer = (el, band, radius, isFront) => {
    const live = bandLive(band);
    el.classList.toggle("is-front", Boolean(isFront && live));
    el.classList.toggle("is-back", Boolean(!isFront && live));
    el.hidden = !live;
    if (!live || !radius) {
      el.style.webkitMaskImage = "";
      el.style.maskImage = "";
      el.style.transform = "";
      return;
    }
    const innerFrac = band.inner / radius;
    const outerFrac = band.outer / radius;
    if (band.inner <= 1 && band.outer < radius - 1) {
      // Scale the full disk so the rim matches the inner overlay (do not also
      // mask — mask is pre-transform and would shrink twice).
      el.style.webkitMaskImage = "none";
      el.style.maskImage = "none";
      el.style.transform = `scale(${band.outer / radius})`;
    } else {
      el.style.transform = "";
      el.style.webkitMaskImage = annulusMask(innerFrac, outerFrac);
      el.style.maskImage = annulusMask(innerFrac, outerFrac);
    }
  };

  const layoutLayers = (geom) => {
    const radius = radiusPx();
    if (!radius) {
      return;
    }
    const key = `${geom.kind}|${geom.color.inner}|${geom.color.outer}|${geom.temp.inner}|${geom.temp.outer}`;
    const stacked = bandLive(geom.color) && bandLive(geom.temp);
    canvasWrap.classList.toggle("is-stacked", stacked);
    applyLayer(bgColor, geom.color, radius, geom.front === "color");
    applyLayer(bgTemp, geom.temp, radius, geom.front === "temp");
    const pal = showingPalette();
    bgPalette.hidden = !pal;
    bgColor.hidden = pal || !hasColor || !bandLive(geom.color);
    bgTemp.hidden = pal || !hasTemp || !bandLive(geom.temp);
    if (pal) {
      bgPalette.classList.add("is-front");
      bgPalette.style.transform = "";
      bgPalette.style.webkitMaskImage = "";
      bgPalette.style.maskImage = "";
      const { scenes, activeId } = getState();
      const draft = scenes.find((row) => row.id === activeId)?.draft;
      const variable = paletteForDraft(draft);
      if (variable) {
        drawImageTo(bgPalette, drawPaletteWheelImage(variable, paletteCatalog()));
        paintGlow("color");
      }
      lastGeomKey = "";
    } else {
      bgPalette.classList.remove("is-front");
      if (key !== lastGeomKey) {
        lastGeomKey = key;
        paintGlow(geom.front);
      }
    }
  };

  const markerOffset = (active) =>
    active ? { x: 24, y: 60 } : { x: 6, y: 6 };

  const placeMarker = (marker, x, y, active) => {
    const offset = markerOffset(active);
    marker.g.style.transform = `translate(${x - offset.x}px, ${y - offset.y}px)`;
    marker.g.style.transformOrigin = `${x}px ${y}px`;
    marker.x = x;
    marker.y = y;
  };

  const positionForDraft = (draft, markerMode, geom, radius, entityId) => {
    const cx = radius;
    const variable = paletteForDraft(draft);
    if (showingPalette() && variableIsPalette(variable)) {
      const auto = assignmentTR(entityId || "", seedNow());
      const t = draft.palette_t ?? auto.t;
      const r = draft.palette_r ?? auto.r;
      const rel = relFromPaletteTR(t, r, geom.color.outer || radius);
      const sampled = samplePaletteWheel(
        variable,
        t,
        r,
        paletteCatalog(),
        draftRgb
      );
      return { x: cx + rel.x, y: cx + rel.y, rgb: sampled.rgb };
    }
    if (markerMode === "color") {
      const mixed = draftRgb(draft);
      const chromatic = chromaticRgbFromDraft(draft) || mixed;
      const hsv = rgb2hsv(chromatic[0], chromatic[1], chromatic[2]);
      const rel = placeColorInAnnulus(
        hsv[0],
        hsv[1],
        geom.color.inner,
        geom.color.outer
      );
      return { x: cx + rel.x, y: cx + rel.y, rgb: mixed };
    }
    const kelvin = draft.color_temp_kelvin ?? 2700;
    const rel = placeTempInAnnulus(
      kelvin,
      geom.temp.inner,
      geom.temp.outer,
      tempMin,
      tempMax
    );
    return { x: cx + rel.x, y: cx + rel.y, rgb: hueTempToRgb(kelvin) };
  };

  const applyAtBand = (draft, x, y, radius, mode, band) => {
    const limited = limitToAnnulus(x, y, radius, band.inner, band.outer);
    const cx = limited.x - radius;
    const cy = limited.y - radius;
    const variable = paletteForDraft(draft);
    if (showingPalette() && variableIsPalette(variable)) {
      const { t, r } = paletteTRFromRel(cx, cy, band.outer);
      draft.palette_t = t;
      draft.palette_r = r;
      const sampled = samplePaletteWheel(
        variable,
        t,
        r,
        paletteCatalog(),
        draftRgb
      );
      draft.color_temp_kelvin = undefined;
      draft.hs_color = undefined;
      draft.rgb_color = sampled.rgb;
      draft.color_mode = "rgb";
      return limited;
    }
    if (mode === "color") {
      const sample = hueColorAt(cx, cy, band.outer);
      if (sample) {
        applyColorToDraft(draft, sample.rgb, sample.hsv);
      }
    } else {
      const sample = hueTempAt(cx, cy, band.outer, tempMin, tempMax);
      if (sample) {
        applyTempToDraft(draft, sample.kelvin);
      }
    }
    return limited;
  };

  const regionAt = (x, y, geom, radius) => {
    const r = Math.hypot(x - radius, y - radius);
    const inColor =
      bandLive(geom.color) && r <= geom.color.outer + 2 && r >= geom.color.inner - 2;
    const inTemp =
      bandLive(geom.temp) && r <= geom.temp.outer + 2 && r >= geom.temp.inner - 2;
    if (inColor && inTemp) {
      return geom.front;
    }
    if (inColor) {
      return "color";
    }
    if (inTemp) {
      return "temp";
    }
    if (r <= radius + 2) {
      return geom.front;
    }
    return null;
  };

  const maybeConvertDrag = (item, x, y, geom, radius, pinMode) => {
    const caps = capsOf(item);
    const r = Math.hypot(x - radius, y - radius);
    const hyst = Math.max(6, radius * cssFrac(stage, "--wheel-peek", WHEEL_PEEK_FRAC) * 0.45);
    if (pinMode === "color" && caps.hasTemp && bandLive(geom.temp)) {
      const intoTemp =
        r > geom.color.outer + hyst &&
        r >= geom.temp.inner - hyst &&
        r <= geom.temp.outer + 2;
      if (intoTemp) {
        return "temp";
      }
    }
    if (pinMode === "temp" && caps.hasColor && bandLive(geom.color)) {
      const intoColorDisk =
        r < geom.temp.inner - hyst &&
        r <= geom.color.outer + hyst &&
        r >= geom.color.inner;
      const intoColorPeek =
        r > geom.temp.outer + hyst &&
        r <= geom.color.outer + 2 &&
        r >= geom.color.inner - 2;
      if (intoColorDisk || intoColorPeek) {
        return "color";
      }
    }
    return pinMode;
  };

  // After a peek swap the pointer still sits on the new outer rim, which is
  // the other wheel — require an interior visit before converting again.
  const pointerInModeInterior = (r, geom, pinMode) => {
    const band = pinMode === "color" ? geom.color : geom.temp;
    if (!bandLive(band)) {
      return false;
    }
    const width = band.outer - band.inner;
    const peek = Math.max(
      4,
      radiusPx() * cssFrac(stage, "--wheel-peek", WHEEL_PEEK_FRAC)
    );
    const pad = Math.min(width * 0.35, Math.max(8, peek * 0.5));
    return r >= band.inner + pad && r <= band.outer - pad;
  };

  const convertDraftTo = (draft, next, caps) => {
    delete draft.variable_ref;
    delete draft.palette_t;
    delete draft.palette_r;
    if (next === "color") {
      if (!caps.hasColor) {
        return false;
      }
      const rgb = draftRgb(draft);
      const hsv = rgb2hsv(rgb[0], rgb[1], rgb[2]);
      applyColorToDraft(draft, rgb, hsv);
      return true;
    }
    if (!caps.hasTemp) {
      return false;
    }
    applyTempToDraft(draft, kelvinForTempConvert(draft, tempMin, tempMax));
    return true;
  };

  const syncModePill = () => {
    modePill.replaceChildren();
    const { scenes, activeId } = getState();
    const item = scenes.find((row) => row.id === activeId);
    const draft = item?.draft;
    const palVar = paletteForDraft(draft);
    const pal = variableIsPalette(palVar);
    const modes = [];
    if (hasColor) {
      modes.push("color");
    }
    if (hasTemp) {
      modes.push("temp");
    }
    if (pal) {
      modes.push("palette");
    }
    modePill.hidden = modes.length < 2;
    randomizeBtn.hidden = !pal || typeof onRandomizeSeed !== "function";
    if (modePill.hidden) {
      return;
    }
    const caps = capsOf(item || {});
    const current = showingPalette()
      ? "palette"
      : uiMode === "color" || uiMode === "temp"
        ? uiMode
        : draftWheelMode(draft, caps.hasColor, caps.hasTemp);
    for (const mode of modes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `wheel-mode-dot wheel-mode-${mode}`;
      btn.setAttribute("aria-pressed", mode === current ? "true" : "false");
      if (mode === current) {
        btn.classList.add("active");
      }
      if (mode === "color") {
        btn.style.background =
          "conic-gradient(#ff3b30, #ffcc00, #34c759, #007aff, #af52de, #ff3b30)";
      } else if (mode === "temp") {
        btn.style.background =
          "linear-gradient(135deg, #ffb347 0%, #fff4e0 55%, #c9e4ff 100%)";
      } else {
        btn.style.background = paletteSwatchCss(
          palVar,
          paletteCatalog(),
          draftRgb
        );
      }
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (mode === "palette") {
          uiMode = "palette";
          sync();
          return;
        }
        const wasPalette = variableIsPalette(paletteForDraft(item?.draft));
        uiMode = mode;
        if (wasPalette && item?.draft) {
          convertDraftTo(item.draft, mode, capsOf(item));
          emitChange({ dragging: false });
        }
        sync();
      });
      modePill.appendChild(btn);
    }
  };

  const updatePresetOverflow = () => {
    const maxScroll = presetTrack.scrollWidth - presetTrack.clientWidth;
    presets.classList.toggle(
      "can-scroll-end",
      maxScroll > 1 && presetTrack.scrollLeft < maxScroll - 1
    );
  };

  const syncPresets = () => {
    presetTrack.replaceChildren();
    const { scenes, activeId } = getState();
    const active = scenes.find((item) => item.id === activeId);
    const palette = typeof getPalette === "function" ? getPalette() || [] : [];
    presetTrack.setAttribute("aria-label", "Variables");
    for (const variable of palette) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hue-preset";
      btn.setAttribute("role", "listitem");
      btn.title = variable.name;
      btn.style.background = variableSwatchCss(variable, palette);
      if (active?.draft?.variable_ref === variable.id) {
        btn.classList.add("active");
      }
      btn.addEventListener("click", () => {
        if (!active?.draft) {
          return;
        }
        applyVariableToDraft(active.draft, variable, {
          entityId: entityIdOf(active),
          seed: seedNow(),
          catalog: palette,
        });
        uiMode = variableIsPalette(variable) ? "palette" : null;
        const marker = markers.get(active.id);
        if (marker) {
          marker.g.classList.add("glide");
          clearTimeout(glideTimer);
          glideTimer = setTimeout(() => marker.g.classList.remove("glide"), 450);
        }
        emitChange({ dragging: false, fromPalette: true });
        sync();
      });
      presetTrack.appendChild(btn);
    }
    if (typeof onAddPalette === "function") {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "hue-preset add";
      add.setAttribute("role", "listitem");
      add.title = "Add variable";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", "mdi:plus");
      add.appendChild(icon);
      add.addEventListener("click", async () => {
        if (!active?.draft) {
          return;
        }
        const saved = await onAddPalette(active.draft);
        if (!saved) {
          return;
        }
        applyVariableToDraft(active.draft, saved, {
          entityId: entityIdOf(active),
          seed: seedNow(),
          catalog: paletteCatalog(),
        });
        emitChange({ dragging: false, fromPalette: true });
        sync();
      });
      presetTrack.appendChild(add);
    }
    requestAnimationFrame(updatePresetOverflow);
  };

  const sync = () => {
    syncModePill();
    const radius = radiusPx();
    const { scenes, activeId } = getState();
    const geom = radius
      ? currentGeom()
      : wheelStackGeom(
          1,
          pinStackKind(scenes, hasColor, hasTemp, capsOf),
          WHEEL_PEEK_FRAC,
          WHEEL_MIXED_INNER_FRAC,
          WHEEL_MIXED_GAP_FRAC
        );
    layoutLayers(geom);
    const seen = new Set();
    for (const scene of scenes) {
      seen.add(scene.id);
      let marker = markers.get(scene.id);
      if (!marker) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "gm");
        const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
        outline.setAttribute("class", "marker-outline");
        outline.setAttribute("d", HUE_DOT_OUTLINE_PATH);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "marker");
        const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        hit.setAttribute("cx", "6");
        hit.setAttribute("cy", "6");
        hit.setAttribute("r", "12");
        hit.setAttribute("fill", "transparent");
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("class", "icon text");
        icon.setAttribute("x", "24");
        icon.setAttribute("y", "24");
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("dominant-baseline", "middle");
        g.append(outline, path, hit, icon);
        marker = { g, path, outline, hit, icon, sceneId: scene.id };
        markers.set(scene.id, marker);
        g.addEventListener("pointerdown", (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          const { scenes: now, activeId: current } = getState();
          const item = now.find((row) => row.id === scene.id);
          if (!item) {
            return;
          }
          if (scene.id !== current) {
            onSelect(scene.id);
          }
          const caps = capsOf(item);
          const markerMode = draftWheelMode(item.draft, caps.hasColor, caps.hasTemp);
          const pt = pointFromEvent(ev);
          startDrag(
            ev,
            scene.id,
            pt.x - (marker.x ?? radiusPx()),
            pt.y - (marker.y ?? radiusPx()),
            markerMode
          );
          g.classList.add("drag");
        });
        svg.appendChild(g);
      }
      const active = scene.id === activeId;
      const caps = capsOf(scene);
      const markerMode = draftWheelMode(scene.draft, caps.hasColor, caps.hasTemp);
      marker.path.setAttribute("d", active ? HUE_PIN_PATH : HUE_DOT_PATH);
      marker.g.classList.toggle("active", active);
      marker.icon.textContent = String(scene.index);
      marker.hit.style.display = active ? "none" : "";
      if (!radius) {
        continue;
      }
      const pos = positionForDraft(
        scene.draft,
        markerMode,
        geom,
        radius,
        entityIdOf(scene)
      );
      marker.g.style.color = rgbCss(pos.rgb);
      marker.icon.style.fill = pinForeground(pos.rgb);
      placeMarker(marker, pos.x, pos.y, active);
      if (active) {
        svg.appendChild(marker.g);
      }
    }
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.g.remove();
        markers.delete(id);
      }
    }
    syncPath(geom, radius);
    syncPresets();
    if (!drag) {
      hideFloatReadout();
    }
  };

  const syncPath = (geom, radius) => {
    pathLayer.replaceChildren();
    if (!radius || showingPalette()) {
      return;
    }
    const { scenes, sequence } = getState();
    const byId = new Map(scenes.map((item) => [item.id, item]));
    const cycle = collapseSceneCycle(sequence || scenes.map((item) => item.id));
    if (cycle.length < 2) {
      return;
    }
    const edgeCount = cycle.length === 2 ? 1 : cycle.length;
    const edges = [];
    for (let index = 0; index < edgeCount; index += 1) {
      const from = byId.get(cycle[index]);
      const to = byId.get(cycle[(index + 1) % cycle.length]);
      if (!from || !to) {
        continue;
      }
      const fromKind = inferDraftColorKind(from.draft);
      const toKind = inferDraftColorKind(to.draft);
      const pathMode =
        fromKind === "temp" && toKind === "temp" ? "temp" : "color";
      const pts = sampleHuePathEdge(
        from.draft,
        to.draft,
        pathMode,
        radius,
        tempMin,
        tempMax,
        geom
      );
      if (pts.length >= 2) {
        edges.push({
          pts,
          smooth: huePathEdgeIsVaryingHs(from.draft, to.draft, pathMode),
        });
      }
    }
    const ns = "http://www.w3.org/2000/svg";
    for (const edge of edges) {
      const under = document.createElementNS(ns, "path");
      under.setAttribute("class", "hue-path-under");
      under.setAttribute("d", huePathStrokeD(edge.pts, edge.smooth));
      pathLayer.appendChild(under);
    }
    for (const edge of edges) {
      const mid = document.createElementNS(ns, "path");
      mid.setAttribute("class", "hue-path-mid");
      mid.setAttribute("d", huePathStrokeD(edge.pts, edge.smooth));
      pathLayer.appendChild(mid);
    }
    for (const edge of edges) {
      const { pts } = edge;
      for (let index = 1; index < pts.length; index += 1) {
        const start = pts[index - 1];
        const end = pts[index];
        const seg = document.createElementNS(ns, "path");
        seg.setAttribute("class", "hue-path-seg");
        seg.setAttribute(
          "d",
          `M${start.x.toFixed(2)} ${start.y.toFixed(2)} L${end.x.toFixed(2)} ${end.y.toFixed(2)}`
        );
        seg.setAttribute(
          "stroke",
          rgbCss([
            Math.round((start.rgb[0] + end.rgb[0]) / 2),
            Math.round((start.rgb[1] + end.rgb[1]) / 2),
            Math.round((start.rgb[2] + end.rgb[2]) / 2),
          ])
        );
        pathLayer.appendChild(seg);
      }
    }
  };

  const pointFromEvent = (ev) => {
    const rect = canvasWrap.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };

  const onPointerMove = (ev) => {
    if (!drag || ev.pointerId !== drag.pointerId) {
      return;
    }
    const radius = radiusPx();
    if (!radius) {
      return;
    }
    const { scenes, activeId } = getState();
    const item = scenes.find((row) => row.id === (drag.sceneId || activeId));
    if (!item) {
      return;
    }
    const geom = currentGeom();
    const pt = pointFromEvent(ev);
    const x = pt.x - drag.grabX;
    const y = pt.y - drag.grabY;
    const r = Math.hypot(x - radius, y - radius);
    let pinMode = drag.mode;
    if (drag.mustEnterHome && pointerInModeInterior(r, geom, pinMode)) {
      drag.mustEnterHome = false;
    }
    if (!drag.mustEnterHome && !showingPalette()) {
      const nextMode = maybeConvertDrag(item, x, y, geom, radius, pinMode);
      if (nextMode !== pinMode) {
        pinMode = nextMode;
        drag.mode = nextMode;
        drag.mustEnterHome = true;
      }
    }
    const band = pinMode === "color" ? geom.color : geom.temp;
    if (!bandLive(band)) {
      return;
    }
    const limited = applyAtBand(item.draft, x, y, radius, pinMode, band);
    const marker = markers.get(item.id);
    if (marker) {
      marker.g.style.color = rgbCss(draftRgb(item.draft));
      marker.icon.style.fill = pinForeground(draftRgb(item.draft));
      placeMarker(marker, limited.x, limited.y, true);
    }
    showFloatReadout(item.draft, limited.x, limited.y, pinMode);
    const nextGeom = currentGeom();
    layoutLayers(nextGeom);
    for (const scene of scenes) {
      if (scene.id === item.id) {
        continue;
      }
      const other = markers.get(scene.id);
      if (!other) {
        continue;
      }
      const caps = capsOf(scene);
      const otherMode = draftWheelMode(scene.draft, caps.hasColor, caps.hasTemp);
      const pos = positionForDraft(
        scene.draft,
        otherMode,
        nextGeom,
        radius,
        entityIdOf(scene)
      );
      other.g.style.color = rgbCss(pos.rgb);
      other.icon.style.fill = pinForeground(pos.rgb);
      placeMarker(other, pos.x, pos.y, false);
    }
    syncPath(nextGeom, radius);
    emitChange({ dragging: true, fromPalette: showingPalette() });
  };

  const onPointerUp = (ev) => {
    if (!drag || ev.pointerId !== drag.pointerId) {
      return;
    }
    const marker = markers.get(drag.sceneId);
    marker?.g.classList.remove("drag");
    marker?.g.classList.add("boing");
    setTimeout(() => marker?.g.classList.remove("boing"), 200);
    drag = null;
    hideFloatReadout();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    stage.dispatchEvent(
      new CustomEvent("slider-interaction-stop", {
        bubbles: true,
        composed: true,
      })
    );
    emitChange({ dragging: false, final: true });
    sync();
  };

  const startDrag = (ev, sceneId, grabX = 0, grabY = 0, mode = "color") => {
    drag = {
      sceneId,
      pointerId: ev.pointerId,
      grabX,
      grabY,
      mode,
      mustEnterHome: false,
    };
    stage.dispatchEvent(
      new CustomEvent("slider-interaction-start", {
        bubbles: true,
        composed: true,
      })
    );
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  svg.addEventListener("pointerdown", (ev) => {
    const radius = radiusPx();
    if (!radius) {
      return;
    }
    const pt = pointFromEvent(ev);
    const dist = Math.hypot(pt.x - radius, pt.y - radius);
    if (dist > radius) {
      return;
    }
    const { scenes, activeId } = getState();
    const item = scenes.find((row) => row.id === activeId);
    if (!item) {
      return;
    }
    ev.preventDefault();
    const geom = currentGeom();
    const caps = capsOf(item);
    let pinMode = draftWheelMode(item.draft, caps.hasColor, caps.hasTemp);
    if (!showingPalette()) {
      const hit = regionAt(pt.x, pt.y, geom, radius);
      if (hit && hit !== pinMode) {
        if (convertDraftTo(item.draft, hit, caps)) {
          pinMode = hit;
        }
      }
    } else {
      pinMode = "color";
    }
    startDrag(ev, item.id, 0, 0, pinMode);
    const band = pinMode === "color" ? geom.color : geom.temp;
    if (!bandLive(band)) {
      return;
    }
    const limited = applyAtBand(item.draft, pt.x, pt.y, radius, pinMode, band);
    const marker = markers.get(item.id);
    marker?.g.classList.add("drag", "active");
    if (marker) {
      placeMarker(marker, limited.x, limited.y, true);
    }
    showFloatReadout(item.draft, limited.x, limited.y, pinMode);
    layoutLayers(currentGeom());
    syncPath(currentGeom(), radius);
    emitChange({ dragging: true, fromPalette: showingPalette() });
  });

  const setMode = (next, { convertDraft = false } = {}) => {
    if (next === "palette") {
      uiMode = "palette";
      sync();
      return;
    }
    if (next === "color" && !hasColor) {
      return;
    }
    if (next === "temp" && !hasTemp) {
      return;
    }
    uiMode = next;
    if (convertDraft) {
      const { scenes, activeId } = getState();
      const item = scenes.find((row) => row.id === activeId);
      if (item?.draft) {
        const caps = capsOf(item);
        const current = draftWheelMode(item.draft, caps.hasColor, caps.hasTemp);
        if (current !== next && convertDraftTo(item.draft, next, caps)) {
          emitChange({ dragging: false });
        }
      }
    }
    sync();
  };

  const layoutGlow = () => {
    if (!glow.parentElement || glow.parentElement === canvasWrap) {
      return;
    }
    const host = glow.parentElement;
    const wr = canvasWrap.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    if (wr.width < 8 || hr.width < 8) {
      return;
    }
    glow.style.left = `${wr.left - hr.left}px`;
    glow.style.top = `${wr.top - hr.top}px`;
    glow.style.width = `${wr.width}px`;
    glow.style.height = `${wr.height}px`;
  };

  const attachGlow = (host) => {
    if (!host) {
      if (glow.parentElement !== canvasWrap) {
        canvasWrap.insertBefore(glow, canvasWrap.firstChild);
      }
      glow.style.left = "";
      glow.style.top = "";
      glow.style.width = "";
      glow.style.height = "";
      return layoutGlow;
    }
    host.appendChild(glow);
    layoutGlow();
    return layoutGlow;
  };

  const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
    sync();
    updatePresetOverflow();
    layoutGlow();
  });
  ro?.observe(canvasWrap);
  ro?.observe(presets);
  presetTrack.addEventListener("scroll", updatePresetOverflow, { passive: true });
  paintWheels();

  const disconnect = () => {
    ro?.disconnect();
    clearTimeout(glideTimer);
    if (drag) {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      drag = null;
    }
    if (glow.parentElement !== canvasWrap) {
      canvasWrap.insertBefore(glow, canvasWrap.firstChild);
    }
  };

  return { el: stage, setMode, sync, syncPresets, attachGlow, disconnect };
}

function medianNumber(values) {
  const sorted = values
    .filter((value) => value != null && Number.isFinite(Number(value)))
    .map(Number)
    .sort((left, right) => left - right);
  if (!sorted.length) {
    return null;
  }
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function circularMeanHue(hues) {
  let x = 0;
  let y = 0;
  for (const hue of hues) {
    const rad = (Number(hue) * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  const deg = (Math.atan2(y / hues.length, x / hues.length) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function lightDraftFingerprint(draft) {
  return JSON.stringify({
    state: draft?.state || "off",
    brightness: draft?.brightness ?? null,
    color_mode: draft?.color_mode ?? null,
    color_temp_kelvin: draft?.color_temp_kelvin ?? null,
    rgb_color: draft?.rgb_color ?? null,
    hs_color: draft?.hs_color ?? null,
    rgbw_color: draft?.rgbw_color ?? null,
    rgbww_color: draft?.rgbww_color ?? null,
    effect: draft?.effect ?? null,
    variable_ref: draft?.variable_ref ?? null,
    palette_t: draft?.palette_t ?? null,
    palette_r: draft?.palette_r ?? null,
    assignment_seed: draft?.assignment_seed ?? null,
  });
}

export {
  hueLinearScale,
  hueCurveScale,
  inverseHueCurveScale,
  xy2polar,
  polar2xy,
  rad2deg,
  deg2rad,
  hueFromDeg,
  degFromHue,
  saturationFromR,
  rFromSaturation,
  fixHSValue,
  hsValue,
  hsv2rgb,
  rgb2hsv,
  hueTempToRgb,
  kelvinToRgb,
  hexToRgb,
  rgbCss,
  pinForeground,
  draftWheelMode,
  lightWheelCaps,
  rgbwToRgb,
  rgbwwToRgb,
  scaleRgbChannels,
  chromaticRgbFromDraft,
  colorBrightnessFromDraft,
  whiteBrightnessFromDraft,
  setColorBrightnessOnDraft,
  setWhiteBrightnessOnDraft,
  draftRgb,
  applyColorToDraft,
  applyTempToDraft,
  applyVariableToDraft,
  colorPayloadFromDraft,
  swatchRgb,
  variableSwatchCss,
  approxKelvinFromRgb,
  formatWheelReadout,
  inferDraftColorKind,
  draftHs,
  collapseSceneCycle,
  lerpNumber,
  interpolateDraftSample,
  colorWheelXY,
  wheelPointForSample,
  huePathStepCount,
  sampleHuePathEdge,
  polylinePathD,
  catmullRomPathD,
  closedCatmullRomPathD,
  polarEaseClosedPathD,
  huePathStrokeD,
  hueColorAt,
  hueTempAt,
  coordinatesForColor,
  coordinatesForTemp,
  limitToWheel,
  drawHueWheelImage,
  createLightBrightnessGraph,
  createSceneColorWheel,
  medianNumber,
  circularMeanHue,
  lightDraftFingerprint,
  HUE_WHEEL_RENDER,
  HUE_COLOR_PRESETS,
  HUE_TEMP_PRESETS,
  HUE_PIN_PATH,
  HUE_DOT_PATH,
  HUE_DOT_OUTLINE_PATH,
  HUE_PATH_STEPS,
};
