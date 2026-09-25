/* Color wheel, draft RGB/HS/temp helpers, and Helland kelvin→RGB.
   Extracted from panel.js (no bundler; HA loads as ES modules). */

import {
  PALETTE_SLOT_COUNT,
  assignmentTR,
  paletteIsMixed,
  paletteIsTemperatureOnly,
  paletteSwatchCss,
  resolveSlot,
  samplePaletteWheel,
  variableIsPalette,
} from "./palette.js";
import { MODE_COLOR_ICON, MODE_TEMP_ICON } from "./hue_mode_icons.js";

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
/** Pin tip in the path. The body hangs below this point (rotated 180°). */
const PIN_TIP_X = 24;
const PIN_TIP_Y = 60;
const ACTIVE_PIN_BODY = PIN_TIP_Y;
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
const _hueWheelCanvasCache = new Map();

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

const PIN_GROUP_FRAC = 0.1;
const PIN_DRAG_THRESHOLD_PX = 8;

function clusterNearbyPinIds(placed, radius) {
  const range = Math.max(8, radius * PIN_GROUP_FRAC);
  const used = new Set();
  const clusters = [];
  for (const item of placed) {
    if (used.has(item.id)) {
      continue;
    }
    if (item.off) {
      used.add(item.id);
      clusters.push([item.id]);
      continue;
    }
    const group = [item.id];
    used.add(item.id);
    for (const other of placed) {
      if (used.has(other.id) || other.off || other.mode !== item.mode) {
        continue;
      }
      if (Math.hypot(other.x - item.x, other.y - item.y) <= range) {
        group.push(other.id);
        used.add(other.id);
      }
    }
    clusters.push(group);
  }
  return clusters;
}

/** Other pins that would join `dragIds` if the pointer were released at these positions. */
function dropTargetIds(placed, radius, dragIds) {
  const moving = new Set(dragIds || []);
  if (!moving.size) {
    return [];
  }
  const targets = [];
  for (const group of clusterNearbyPinIds(placed, radius)) {
    if (!group.some((id) => moving.has(id))) {
      continue;
    }
    for (const id of group) {
      if (!moving.has(id)) {
        targets.push(id);
      }
    }
  }
  return targets;
}

/** Which drafts a pin drag writes. Peeled/detached pins move alone; a multi-selection moves together; otherwise a spatial cluster moves together. */
function dragIdsForPin({ sceneId, cluster, detached, peeledId, selected }) {
  const group = cluster?.length ? [...cluster] : [sceneId];
  const pulled =
    (detached instanceof Set && detached.has(sceneId)) || peeledId === sceneId;
  if (pulled) {
    return [sceneId];
  }
  const picked = selected || [];
  if (picked.length > 1 && picked.includes(sceneId)) {
    return [...picked];
  }
  if (group.length > 1) {
    return [...group];
  }
  return [sceneId];
}

function splitIdsByWheelMode(ids, mode, supports) {
  const keep = [];
  const drop = [];
  for (const id of ids || []) {
    if (supports(id, mode)) {
      keep.push(id);
    } else {
      drop.push(id);
    }
  }
  return { keep, drop };
}

/**
 * Mode-pill entries. Offer every disk the wheel can show. A mode the
 * selected lights cannot use stays listed and marked unsupported.
 * An empty selection treats the wheel fallback as supported.
 */
function wheelPillModes(lights, fallback = {}) {
  const rows = lights || [];
  const selected = rows.length ? rows : null;
  const entries = [
    ["color", Boolean(fallback.hasColor), (row) => row?.hasColor],
    ["temp", Boolean(fallback.hasTemp), (row) => row?.hasTemp],
    ["palette", Boolean(fallback.palette), (row) => row?.palette],
  ];
  const modes = [];
  for (const [mode, roomHas, supports] of entries) {
    const supported = selected ? selected.some(supports) : roomHas;
    if (roomHas || supported) {
      modes.push({ mode, supported });
    }
  }
  return modes;
}

/**
 * What replaces the color disks for the current selection.
 * Brightness- and on/off-only lights are not wheel pins. An empty selection,
 * or any selected light that can use color or kelvin, keeps the disks.
 */
function wheelStandIn(lights) {
  const rows = lights || [];
  if (!rows.length || rows.some((row) => row?.hasColor || row?.hasTemp)) {
    return "disks";
  }
  if (rows.every((row) => row?.onOffOnly)) {
    return "switch";
  }
  if (rows.some((row) => row?.onOffOnly)) {
    return "both";
  }
  return "slider";
}

/**
 * A light can sit on a palette disk. Bulbs that do both color and kelvin can
 * use any palette. Temperature-only bulbs need every slot to be kelvin.
 * RGB-only bulbs cannot use a palette that mixes kelvin and color.
 * `canPalette` on a drag caps object is this answer for the disk in view.
 */
function lightCanUsePalette(caps, palette, catalog) {
  if (!variableIsPalette(palette)) {
    return false;
  }
  if (caps?.hasColor && caps?.hasTemp) {
    return true;
  }
  if (caps?.hasColor && !caps?.hasTemp) {
    return !paletteIsMixed(palette, catalog);
  }
  return Boolean(
    caps?.hasTemp && !caps.hasColor && paletteIsTemperatureOnly(palette, catalog)
  );
}

/** Disks to fade while dragging: a visible mode none of the dragged lights can use. */
function disksUnsupportedByDrag(ids, capsOf) {
  const list = ids || [];
  if (!list.length) {
    return { color: false, temp: false, palette: false };
  }
  let anyColor = false;
  let anyTemp = false;
  let anyPalette = false;
  for (const id of list) {
    const caps = capsOf(id) || {};
    if (caps.hasColor) {
      anyColor = true;
    }
    if (caps.hasTemp) {
      anyTemp = true;
    }
    if (caps.canPalette) {
      anyPalette = true;
    }
  }
  return { color: !anyColor, temp: !anyTemp, palette: !anyPalette };
}

/** After a real drag, only lights that could not follow the disk stay pulled out of clusters. */
function detachedAfterDrag(detachedIds, finishedIds) {
  const finished = new Set(finishedIds || []);
  return [...detachedIds].filter((id) => !finished.has(id));
}

/** A short press on a stack opens the group. A short press otherwise only selects. Movement past the threshold writes the color. */
function pinPressAction({ moved, travel, stacked }) {
  if (!moved && travel < PIN_DRAG_THRESHOLD_PX) {
    return stacked ? "fan" : "select";
  }
  return "commit";
}

/** Even spots on a circle in the middle of the wheel. `radius` is the disk radius; the center is `(radius, radius)`. */
function groupRingPoints(count, radius) {
  const n = Number(count);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("group ring count must be a non-negative integer");
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("group ring needs a positive radius");
  }
  if (!n) {
    return [];
  }
  const ring = radius * 0.42;
  const points = [];
  for (let index = 0; index < n; index += 1) {
    const angle = -Math.PI / 2 + (index / n) * Math.PI * 2;
    points.push({
      x: radius + Math.cos(angle) * ring,
      y: radius + Math.sin(angle) * ring,
    });
  }
  return points;
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
/** Brightness units (~2%) — drag back onto the theme knot clears that override. */
export const THEME_BRIGHTNESS_SNAP = 5;

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

function openGraphStrokeD(knots, xOfSec, yOfBri) {
  const runs = linearGraphRuns(knots, { closed: false });
  return runs
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

function kelvinTrackSpan(inner, outer) {
  // An overlapped kelvin disk keeps the pin on the ring centerline, inset from
  // the rim. Map the full temperature range onto that track. A full disk still
  // uses its own edge.
  if (inner > 0 && outer > inner + 1) {
    return (inner + outer) / 2;
  }
  return outer;
}

function hueTempAt(x, y, radius, tempMin, tempMax, span = radius) {
  const [r] = xy2polar(x, y);
  if (r - 2 > radius) {
    return null;
  }
  const reach = span > 0 ? span : radius;
  let n = (y + reach) / (2 * reach);
  if (n < 0) {
    n = 0;
  } else if (n > 1) {
    n = 1;
  }
  const kelvin = Math.round(hueCurveScale(n, tempMin, tempMax));
  return { rgb: hueTempToRgb(kelvin), kelvin };
}

function coordinatesForColor(hue, saturation, radius) {
  const phi = deg2rad(degFromHue(hue));
  const r = rFromSaturation(saturation, radius);
  const [x, y] = polar2xy(r, phi);
  return { x: Math.round(x), y: Math.round(y) };
}

function coordinatesForTemp(kelvin, radius, tempMin, tempMax, span = radius) {
  let k = kelvin;
  if (k < tempMin) {
    k = tempMin;
  } else if (k > tempMax) {
    k = tempMax;
  }
  const reach = span > 0 ? span : radius;
  const n = inverseHueCurveScale(k, tempMin, tempMax);
  const y = Math.round(n * 2 * reach - reach);
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
    if (!caps.hasColor && !caps.hasTemp) {
      continue;
    }
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
    palette: { inner: radius, outer: radius },
    front: "color",
    role: { color: "front", temp: "back" },
  };
}

/** Back disk is full size. Each disk in front of it is a smaller overlay. */
function focusedDiskGeom(radius, { showTemp, showColor, showPalette, focus, innerFrac }) {
  const hidden = { inner: radius, outer: radius };
  const bands = { temp: hidden, color: hidden, palette: hidden };
  const colors = [];
  if (showColor) {
    colors.push("color");
  }
  if (showPalette) {
    colors.push("palette");
  }
  const frontName =
    colors.length === 2 ? (focus === "palette" ? "palette" : "color") : colors[0] || null;
  const order = [];
  if (showTemp) {
    order.push("temp");
  }
  if (colors.length === 2) {
    order.push(frontName === "palette" ? "color" : "palette", frontName);
  } else if (frontName) {
    order.push(frontName);
  }
  const role = {};
  if (!order.length) {
    bands.color = { inner: 0, outer: radius };
    role.color = "front";
    return { kind: "stack", ...bands, front: "color", role };
  }
  if (order.length === 1) {
    bands[order[0]] = { inner: 0, outer: radius };
    role[order[0]] = "front";
    return { kind: "stack", ...bands, front: order[0], role };
  }
  let outer = radius;
  for (let i = 0; i < order.length; i += 1) {
    const name = order[i];
    const innermost = i === order.length - 1;
    const nextOuter = innermost ? outer : outer * innerFrac;
    bands[name] = innermost
      ? { inner: 0, outer: nextOuter }
      : { inner: nextOuter, outer };
    role[name] = innermost ? "front" : i === 0 ? "back" : "mid";
    outer = nextOuter;
  }
  return { kind: "stack", ...bands, front: frontName || order[order.length - 1], role };
}

function diskHop(geom, pinMode, r, hyst, canUse) {
  // One step inward or outward. The pin stays on its disk until the pointer
  // is past the shared edge by `hyst`, then it may hop to the next disk it
  // can use. The wheel stack itself does not change here.
  const names = ["palette", "color", "temp"].filter((name) => bandLive(geom[name]));
  names.sort((a, b) => geom[a].outer - geom[b].outer);
  const index = names.indexOf(pinMode);
  if (index < 0) {
    return pinMode;
  }
  let inward = null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (canUse(names[i])) {
      inward = names[i];
      break;
    }
  }
  let outward = null;
  for (let i = index + 1; i < names.length; i += 1) {
    if (canUse(names[i])) {
      outward = names[i];
      break;
    }
  }
  if (inward && r < geom[inward].outer - hyst) {
    return inward;
  }
  if (outward && r > geom[pinMode].outer + hyst && r <= geom[outward].outer + 2) {
    return outward;
  }
  return pinMode;
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

function placeTempInAnnulus(
  kelvin,
  inner,
  outer,
  tempMin,
  tempMax,
  side = 1,
  anchorX = null
) {
  const span = kelvinTrackSpan(inner, outer);
  const coords = coordinatesForTemp(kelvin, outer, tempMin, tempMax, span);
  if (!(inner > 0)) {
    // A full kelvin disk only encodes temperature in Y. Keep the drop's X
    // instead of snapping every pin onto the vertical center.
    if (anchorX == null) {
      return { x: coords.x, y: coords.y };
    }
    if (!Number.isFinite(anchorX)) {
      throw new Error("temp pin anchor must be a finite offset");
    }
    const maxX = Math.sqrt(Math.max(0, outer * outer - coords.y * coords.y));
    const x = Math.max(-maxX, Math.min(maxX, anchorX));
    return { x, y: coords.y };
  }
  // Resting pins sit on the band centerline (not the inner rim). An outer-ring
  // drag uses the same centerline; a full disk still follows the pointer.
  // `side` is session-only: left of the wheel stays left until the wheel is
  // recreated. A refresh has no remembered side and uses the right half.
  const mid = (inner + outer) / 2;
  let y = coords.y;
  // The track poles are the temperature ends. Do not pull them inward.
  const maxY = Math.max(0, mid);
  y = Math.max(-maxY, Math.min(maxY, y));
  const sign = side < 0 ? -1 : 1;
  const x = sign * Math.sqrt(Math.max(0, mid * mid - y * y));
  return { x, y };
}

/**
 * Pin position while dragging on an outer kelvin ring.
 * The pin stays on the track centerline, at the point closest to the cursor.
 * Kelvin comes from that point's height, not the cursor's raw y. At three and
 * nine o'clock those heights match. Pulling inward toward a supported color
 * disk eases the pin slightly off the line until the convert threshold.
 * Returns null when kelvin is not an outer ring.
 */
function kelvinTrackDragPoint({
  x,
  y,
  radius,
  inner,
  outer,
  colorOuter = 0,
  colorLive = false,
  tempMin,
  tempMax,
  canColor = false,
  hyst = 0,
  side,
}) {
  const kelvinIsOuterRing =
    inner > 0 &&
    outer > inner + 1 &&
    (!colorLive || inner + 1 >= colorOuter);
  if (!kelvinIsOuterRing) {
    return null;
  }
  const relX = x - radius;
  const relY = y - radius;
  const mid = (inner + outer) / 2;
  const dist = Math.hypot(relX, relY);
  let px;
  let py;
  if (dist < 1e-6) {
    const resolvedSide = side == null || side >= 0 ? 1 : -1;
    px = resolvedSide * mid;
    py = 0;
  } else {
    px = (relX / dist) * mid;
    py = (relY / dist) * mid;
  }
  const sample = hueTempAt(px, py, outer, tempMin, tempMax, mid);
  if (!sample) {
    return null;
  }
  if (canColor && colorLive && colorOuter <= inner + 1) {
    const threshold = Math.max(0, inner - hyst);
    if (dist < mid) {
      const span = Math.max(1, mid - threshold);
      const pull = Math.max(0, Math.min(1, (mid - dist) / span));
      const pinR = Math.hypot(px, py) || mid;
      const maxDrift = (mid - inner) * 0.4;
      const nextR = Math.max(inner, pinR - pull * maxDrift);
      const scale = nextR / pinR;
      px *= scale;
      py *= scale;
    }
  }
  return { x: radius + px, y: radius + py, kelvin: sample.kelvin };
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

function drawHueWheelImage(mode, tempMin, tempMax, spanFrac = 1) {
  const frac = mode === "temp" && spanFrac > 0 ? spanFrac : 1;
  const key =
    mode === "temp"
      ? `temp:${HUE_WHEEL_RENDER}:${tempMin}:${tempMax}:${frac}`
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
  const span = radius * frac;
  const image = ctx.createImageData(HUE_WHEEL_RENDER, HUE_WHEEL_RENDER);
  const data = image.data;
  for (let x = -radius; x < radius; x++) {
    for (let y = -radius; y < radius; y++) {
      const sample =
        mode === "color"
          ? hueColorAt(x, y, radius)
          : hueTempAt(x, y, radius, tempMin, tempMax, span);
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
  _hueWheelCanvasCache.set(url, canvas);
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
  _hueWheelCanvasCache.set(url, canvas);
  return url;
}

function createLightBrightnessGraph({
  title: headingText = "Brightness",
  subtitle = "0–100% by solar event",
  getPoints,
  onSelect,
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

  const themeHalo = document.createElementNS("http://www.w3.org/2000/svg", "path");
  themeHalo.setAttribute("class", "theme-curve-halo");
  themeHalo.setAttribute("fill", "none");
  const themeCurve = document.createElementNS("http://www.w3.org/2000/svg", "path");
  themeCurve.setAttribute("class", "theme-curve");
  themeCurve.setAttribute("fill", "none");
  const themeDots = document.createElementNS("http://www.w3.org/2000/svg", "g");
  themeDots.setAttribute("class", "theme-dots");

  const handlesLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  handlesLayer.setAttribute("class", "handles");

  svg.append(defs, frame, fillArea, curve, themeHalo, themeCurve, themeDots, handlesLayer);
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

  const paintThemeGhost = (members) => {
    themeDots.replaceChildren();
    if (members.length < 2) {
      themeHalo.setAttribute("d", "");
      themeCurve.setAttribute("d", "");
      return;
    }
    const strokeParts = [];
    const n = members.length;
    for (let i = 0; i < n; i += 1) {
      const from = members[i];
      const to = members[(i + 1) % n];
      const fromTheme = Number(from.themeBrightness);
      const toTheme = Number(to.themeBrightness);
      const fromOver =
        Number.isFinite(fromTheme) &&
        Math.abs(from.brightness - fromTheme) > THEME_BRIGHTNESS_SNAP;
      const toOver =
        Number.isFinite(toTheme) &&
        Math.abs(to.brightness - toTheme) > THEME_BRIGHTNESS_SNAP;
      if (!fromOver && !toOver) {
        continue;
      }
      const stroke = openGraphStrokeD(
        [
          {
            seconds: from.seconds,
            bri:
              fromOver && Number.isFinite(fromTheme)
                ? fromTheme
                : from.brightness,
          },
          {
            seconds: to.seconds,
            bri: toOver && Number.isFinite(toTheme) ? toTheme : to.brightness,
          },
        ],
        xOf,
        yOf
      );
      if (stroke) {
        strokeParts.push(stroke);
      }
    }
    const stroke = strokeParts.join(" ");
    themeHalo.setAttribute("d", stroke);
    themeCurve.setAttribute("d", stroke);
    for (const point of members) {
      const themeBri = Number(point.themeBrightness);
      if (
        !Number.isFinite(themeBri) ||
        Math.abs(point.brightness - themeBri) <= THEME_BRIGHTNESS_SNAP
      ) {
        continue;
      }
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("class", "theme-dot");
      dot.setAttribute("cx", String(xOf(point.seconds)));
      dot.setAttribute("cy", String(yOf(themeBri)));
      dot.setAttribute("r", "3.2");
      themeDots.appendChild(dot);
    }
  };

  const paintGeometry = (points) => {
    gradient.replaceChildren();
    const members = points.filter((point) => point.member);
    if (!points.length) {
      fillArea.setAttribute("d", "");
      curve.setAttribute("d", "");
      paintThemeGhost([]);
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
    paintThemeGhost(members);
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
        group.setAttribute("aria-label", c.point.name);
        // Missing-event handles select only; add/remove lives on light tiles.
        group.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          onSelect?.(c.point.eventId);
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

/** Canvas positions of visible pins, so a rebuilt wheel can glide instead of jumping. */
function captureWheelPinPositions(root) {
  const map = new Map();
  if (!root) {
    return map;
  }
  for (const g of root.querySelectorAll(".hue-wheel-svg .gm")) {
    const id = g.dataset.sceneId;
    if (!id || g.style.display === "none") {
      continue;
    }
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
      g.style.transform || ""
    );
    if (!match) {
      continue;
    }
    map.set(id, {
      x: Number(match[1]) + PIN_TIP_X,
      y: Number(match[2]) + PIN_TIP_Y,
    });
  }
  return map;
}

/** Visible pins in paint order, for a wheel-to-wheel morph. */
function captureWheelPinList(root) {
  const list = [];
  if (!root) {
    return list;
  }
  for (const g of root.querySelectorAll(".hue-wheel-svg .gm")) {
    if (g.style.display === "none") {
      continue;
    }
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(
      g.style.transform || ""
    );
    if (!match) {
      continue;
    }
    list.push({
      x: Number(match[1]) + PIN_TIP_X,
      y: Number(match[2]) + PIN_TIP_Y,
      clone: g.cloneNode(true),
    });
  }
  return list;
}

function createSceneColorWheel({
  hasColor,
  hasTemp,
  tempMin,
  tempMax,
  getState,
  onSelect,
  onSelectMany,
  onChange,
  getPalette,
  onAddPalette,
  addVariableLabel = "Add variable",
  getCapabilities,
  getAssignmentSeed,
  getAssignmentEntityId,
  getBasePalette,
  onRandomizeSeed,
  onPickPalette,
  onEditPalette,
  showPath = true,
  groupNearby = false,
  getPinIcon,
  onClusters,
  moveOnEmptyDisk = true,
  pinFlip = null,
  fadePinIds = null,
  t = (_key, fallback) => fallback,
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
  const diskOf = (canvas, kind) => {
    const disk = document.createElement("div");
    disk.className = `hue-wheel-disk hue-wheel-disk-${kind}`;
    disk.appendChild(canvas);
    return disk;
  };
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
  const tempDisk = diskOf(bgTemp, "temp");
  const colorDisk = diskOf(bgColor, "color");
  const paletteDisk = diskOf(bgPalette, "palette");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "hue-wheel-svg");
  svg.innerHTML = `
    <defs>
      <filter id="se-dot-shadow">
        <feDropShadow dx="0" dy="0.5" stdDeviation="1" flood-opacity="1"></feDropShadow>
      </filter>
      <filter id="se-group-shadow" x="-80%" y="-80%" width="260%" height="260%">
        <feDropShadow dx="0" dy="14" stdDeviation="16" flood-opacity="0.55"></feDropShadow>
        <feDropShadow dx="0" dy="3" stdDeviation="5" flood-opacity="0.4"></feDropShadow>
      </filter>
      <filter id="se-active-shadow">
        <!-- The pin body is rotated 180°, so a negative offset hangs the heavy shadow off the bottom. -->
        <feOffset dx="0" dy="-12" />
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
  const groupRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  groupRing.setAttribute("class", "group-ring");
  groupRing.setAttribute("filter", "url(#se-group-shadow)");
  groupRing.style.display = "none";
  svg.appendChild(groupRing);
  canvasWrap.append(glow, tempDisk, colorDisk, paletteDisk, svg);
  const face = document.createElement("div");
  face.className = "hue-wheel-face";
  const floatReadout = document.createElement("div");
  floatReadout.className = "hue-wheel-float-readout";
  floatReadout.hidden = true;
  floatReadout.setAttribute("aria-live", "polite");
  canvasWrap.appendChild(floatReadout);
  const chrome = document.createElement("div");
  chrome.className = "hue-wheel-chrome";
  const presets = document.createElement("div");
  presets.className = "hue-presets";
  const paletteColors = document.createElement("div");
  paletteColors.className = "hue-palette-colors";
  paletteColors.hidden = true;
  const presetTrack = document.createElement("div");
  presetTrack.className = "hue-presets-track";
  presetTrack.setAttribute("role", "list");
  presets.append(paletteColors, presetTrack);
  chrome.append(presets);
  const modePill = document.createElement("div");
  modePill.className = "wheel-mode-pill";
  const randomizeBtn = document.createElement("button");
  randomizeBtn.type = "button";
  randomizeBtn.className = "wheel-palette-randomize";
  randomizeBtn.hidden = true;
  randomizeBtn.textContent = "Randomize";
  randomizeBtn.addEventListener("click", () => onRandomizeSeed?.());
  const modeCluster = document.createElement("div");
  modeCluster.className = "hue-wheel-mode-cluster";
  modeCluster.append(modePill, randomizeBtn);
  chrome.prepend(modeCluster);
  face.append(canvasWrap, chrome);
  stage.appendChild(face);

  const markers = new Map();
  let pinClusters = [];
  /** Pins pulled out of a stack so each can be grabbed on its own. */
  const detached = new Set();
  /** Cluster ids shown on the center ring. Null when no group is open. */
  let openGroup = null;
  /** Where a group was clicked, so the split can travel out from that pin. */
  let groupSpawn = null;
  let groupHome = null;
  let groupFlightGen = 0;
  /** Pin pulled out of a cluster for the gesture that closes an open group. */
  let soloId = null;
  let drag = null;
  /** Dot under the pointer. Not a selection — leaving it closes only this pin. */
  let hoverId = null;
  let modifyPress = null;
  let hoverCursor = null;
  let suppressHover = false;
  let hoverCheckQueued = false;
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

  const selectedIdsOf = (state) => {
    if (Array.isArray(state.selectedIds) && state.selectedIds.length) {
      return state.selectedIds.filter(Boolean);
    }
    return state.activeId ? [state.activeId] : [];
  };

  const clusterMatesOf = (ids) => {
    const picked = new Set(ids || []);
    const out = new Set(picked);
    for (const group of pinClusters) {
      if (group.some((id) => picked.has(id))) {
        group.forEach((id) => out.add(id));
      }
    }
    return [...out];
  };

  const pinIconOf = (scene) => {
    if (typeof getPinIcon === "function") {
      return getPinIcon(scene);
    }
    return scene?.icon || null;
  };

  const emitChange = (meta = {}) => {
    onChange?.({
      dragging: Boolean(drag),
      ...meta,
    });
  };

  const isOffDraft = (draft) =>
    !draft || draft.state === "off" || Number(draft.brightness) <= 0;

  const supportsMode = (scene, mode) => {
    if (!scene) {
      return false;
    }
    const caps = capsOf(scene);
    if (mode === "color") {
      return Boolean(caps.hasColor);
    }
    if (mode === "temp") {
      return Boolean(caps.hasTemp);
    }
    if (mode === "palette") {
      return lightCanUsePalette(caps, wheelPalette(), paletteCatalog());
    }
    return false;
  };

  const splitCompatible = (ids, mode) =>
    splitIdsByWheelMode(ids, mode, (id) => {
      const row = getState().scenes.find((scene) => scene.id === id);
      return supportsMode(row, mode);
    });

  const showFloatReadout = (draft, x, y, wheelMode) => {
    floatReadout.hidden = false;
    floatReadout.textContent = formatWheelReadout(draft, wheelMode);
    floatReadout.style.left = `${x}px`;
    // Anchor at the top of the pin body so the label sits above it.
    floatReadout.style.top = `${y - ACTIVE_PIN_BODY}px`;
  };

  const hideFloatReadout = () => {
    floatReadout.hidden = true;
  };

  const radiusPx = () => canvasWrap.clientWidth / 2;
  let uiMode = null;
  /** Color/temperature choice applies only to the light it was made for. */
  let uiModeForId = null;

  const lockUiMode = (mode) => {
    uiMode = mode;
    uiModeForId = getState().activeId ?? null;
  };

  const lockedUiMode = () => {
    const { activeId } = getState();
    return uiModeForId === activeId ? uiMode : null;
  };

  const paletteCatalog = () =>
    typeof getPalette === "function" ? getPalette() || [] : [];

  const paletteForDraft = (draft) =>
    paletteCatalog().find((item) => item.id === draft?.variable_ref);

  const wheelPalette = () => {
    const fromDraft = (getState().scenes || [])
      .map((row) => paletteForDraft(row?.draft))
      .find((item) => variableIsPalette(item));
    if (fromDraft) {
      return fromDraft;
    }
    if (typeof getBasePalette !== "function") {
      return null;
    }
    const base = getBasePalette();
    return variableIsPalette(base) ? base : null;
  };

  const entityIdOf = (scene) =>
    typeof getAssignmentEntityId === "function"
      ? getAssignmentEntityId(scene)
      : scene?.id;

  const seedNow = () =>
    typeof getAssignmentSeed === "function" ? Number(getAssignmentSeed()) || 0 : 0;

  let diskFocus = "color";
  let diskFocusHold = false;
  let diskPress = null;

  const onPaletteDisk = (draft, caps) =>
    lightCanUsePalette(caps, paletteForDraft(draft), paletteCatalog());

  const showingPalette = () => {
    const { scenes, activeId } = getState();
    const scene = scenes.find((row) => row.id === activeId);
    const locked = lockedUiMode();
    if (locked === "color" || locked === "temp") {
      return false;
    }
    return onPaletteDisk(scene?.draft, capsOf(scene || {}));
  };

  const currentGeom = () => {
    const radius = radiusPx();
    const { scenes, activeId } = getState();
    const innerFrac = cssFrac(stage, "--wheel-mixed-inner", WHEEL_MIXED_INNER_FRAC);
    const palette = wheelPalette();
    const catalog = paletteCatalog();
    let showColor = false;
    let anyCanPalette = false;
    let anyTemp = Boolean(hasTemp);
    let activeMode = null;
    for (const scene of scenes || []) {
      const caps = capsOf(scene);
      if (caps.hasTemp) {
        anyTemp = true;
      }
      if (lightCanUsePalette(caps, palette, catalog)) {
        anyCanPalette = true;
      }
      const onPalette = onPaletteDisk(scene?.draft, caps);
      if (
        !onPalette &&
        draftWheelMode(scene?.draft, caps.hasColor, caps.hasTemp) === "color" &&
        caps.hasColor
      ) {
        showColor = true;
      }
      if (scene?.id === activeId) {
        activeMode = onPalette
          ? "palette"
          : draftWheelMode(scene?.draft, caps.hasColor, caps.hasTemp);
      }
    }
    // Base palette stays up when any light can use it, even if none is on it yet.
    const showPalette = Boolean(palette) && anyCanPalette;
    if (
      !diskFocusHold &&
      (activeMode === "palette" || activeMode === "color") &&
      (!drag || !drag.moved)
    ) {
      // Focus follows the active light after the pin is released. A click on
      // a disk holds focus there until the next pin drop.
      diskFocus = activeMode;
    }
    const focus = showPalette && showColor ? diskFocus : showPalette ? "palette" : "color";
    return focusedDiskGeom(radius, {
      showTemp: anyTemp,
      showColor: showColor && hasColor,
      showPalette,
      focus,
      innerFrac,
    });
  };

  const drawImageTo = (canvas, url) => {
    const ctx = canvas.getContext("2d");
    const source = _hueWheelCanvasCache.get(url);
    if (source) {
      ctx.clearRect(0, 0, HUE_WHEEL_RENDER, HUE_WHEEL_RENDER);
      ctx.drawImage(source, 0, 0);
      return;
    }
    const img = new Image();
    img.onload = () => {
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

  const paintGlow = (mode, spanFrac) => {
    if (mode === "palette") {
      const variable = wheelPalette();
      if (variable) {
        drawImageTo(glow, drawPaletteWheelImage(variable, paletteCatalog()));
        return;
      }
    }
    drawImageTo(
      glow,
      drawHueWheelImage(
        mode === "temp" ? "temp" : "color",
        tempMin,
        tempMax,
        mode === "temp" ? spanFrac : 1
      )
    );
  };

  const applyLayer = (el, band, radius, role) => {
    const host = el.parentElement;
    const live = bandLive(band);
    host.classList.toggle("is-front", role === "front" && live);
    host.classList.toggle("is-mid", role === "mid" && live);
    host.classList.toggle("is-back", role === "back" && live);
    host.hidden = !live;
    el.hidden = !live;
    if (!live || !radius) {
      el.style.webkitMaskImage = "";
      el.style.maskImage = "";
      el.style.transform = "";
      el.style.clipPath = "";
      el.style.webkitClipPath = "";
      return;
    }
    const scale = band.outer / radius;
    const hole = band.outer > 1 ? (band.inner / band.outer) * 100 : 0;
    // Every disk is a scaled copy of its full image. The hole is the next disk's
    // rim, in the element's own size, so a focus change is a scale plus a hole
    // and both can interpolate. A clip would snap and leave the pin behind.
    el.style.webkitMaskImage = "";
    el.style.maskImage = "";
    el.style.clipPath = "";
    el.style.webkitClipPath = "";
    const pose = () => {
      el.style.setProperty("--disk-hole", `${hole}%`);
      el.style.transform = `scale(${scale})`;
    };
    if (!el.dataset.posed) {
      el.style.transition = "none";
      pose();
      requestAnimationFrame(() => {
        el.style.transition = "";
        el.dataset.posed = "1";
      });
      return;
    }
    pose();
  };

  const layoutLayers = (geom) => {
    const radius = radiusPx();
    if (!radius) {
      return;
    }
    const glowMode =
      ["temp", "palette", "color"].find((name) => geom.role?.[name] === "back") ||
      geom.front;
    const tempSpan = kelvinTrackSpan(geom.temp.inner, geom.temp.outer);
    const spanFrac =
      geom.temp.outer > 1
        ? Math.round((tempSpan / geom.temp.outer) * 10000) / 10000
        : 1;
    const paletteId = wheelPalette()?.id || "";
    const key = `${geom.front}|${geom.color.outer}|${geom.temp.outer}|${geom.palette?.outer}|${glowMode}|${paletteId}|${spanFrac}`;
    const stacked =
      [geom.color, geom.temp, geom.palette].filter((band) => bandLive(band)).length > 1;
    canvasWrap.classList.toggle("is-stacked", stacked);
    applyLayer(bgColor, geom.color, radius, geom.role?.color);
    applyLayer(bgTemp, geom.temp, radius, geom.role?.temp);
    applyLayer(bgPalette, geom.palette || { inner: radius, outer: radius }, radius, geom.role?.palette);
    bgColor.parentElement.hidden = !hasColor || !bandLive(geom.color);
    bgColor.hidden = bgColor.parentElement.hidden;
    bgTemp.parentElement.hidden = !hasTemp || !bandLive(geom.temp);
    bgTemp.hidden = bgTemp.parentElement.hidden;
    const palLive = bandLive(geom.palette);
    bgPalette.parentElement.hidden = !palLive;
    bgPalette.hidden = !palLive;
    if (palLive) {
      const variable = wheelPalette();
      if (variable) {
        drawImageTo(bgPalette, drawPaletteWheelImage(variable, paletteCatalog()));
      }
    }
    if (key !== lastGeomKey) {
      lastGeomKey = key;
      paintGlow(glowMode, spanFrac);
      if (hasTemp && bandLive(geom.temp)) {
        drawImageTo(bgTemp, drawHueWheelImage("temp", tempMin, tempMax, spanFrac));
        painted.temp = true;
      }
    }
    const dragging = Boolean(drag?.moved);
    const palette = wheelPalette();
    const catalog = paletteCatalog();
    const fade = disksUnsupportedByDrag(dragging ? drag.ids : [], (id) => {
      const scene = (getState().scenes || []).find((row) => row.id === id);
      const caps = scene ? capsOf(scene) : {};
      return {
        ...caps,
        canPalette: lightCanUsePalette(caps, palette, catalog),
      };
    });
    bgColor.parentElement.classList.toggle(
      "is-drag-unavailable",
      dragging && hasColor && !bgColor.hidden && fade.color
    );
    bgTemp.parentElement.classList.toggle(
      "is-drag-unavailable",
      dragging && hasTemp && !bgTemp.hidden && fade.temp
    );
    bgPalette.parentElement.classList.toggle(
      "is-drag-unavailable",
      dragging && !bgPalette.hidden && fade.palette
    );
  };

  // Kelvin left/right is not part of the draft. Cleared when this wheel is rebuilt.
  const tempSides = new Map();
  /** Horizontal offset on a full kelvin disk, keyed by scene id and entity id. */
  const tempAnchors = new Map();

  const pinAt = (px, py) =>
    `translate(${px - PIN_TIP_X}px, ${py - PIN_TIP_Y}px)`;

  // A group split animates with the Web Animations API. placeMarker must not
  // move those pins to their colors while that flight still owns the transform.
  const releaseGroupFlight = () => {
    groupFlightGen += 1;
    for (const marker of markers.values()) {
      if (!marker.flying) {
        continue;
      }
      marker.flying = false;
      marker.g.getAnimations().forEach((anim) => anim.cancel());
      marker.g.style.transition = "";
    }
  };

  const revealPinIcon = (marker, scene) => {
    const mdi = pinIconOf(scene);
    if (!mdi || !marker?.haIcon) {
      if (marker?.fo) {
        marker.fo.style.display = "none";
      }
      return;
    }
    marker.haIcon.setAttribute("icon", mdi);
    marker.dotHaIcon?.setAttribute("icon", mdi);
    marker.fo.style.display = "";
    marker.icon.textContent = "";
    const ink = pinForeground(
      scene?.draft ? draftRgb(scene.draft) : [255, 255, 255]
    );
    marker.haIcon.style.color = ink;
  };

  const flyPinsHome = (ids, home, fromTransforms) => {
    if (!home || !ids.length) {
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const gen = ++groupFlightGen;
    let pending = 0;
    const scenes = getState().scenes || [];
    const finish = () => {
      if (gen !== groupFlightGen) {
        return;
      }
      for (const id of ids) {
        const marker = markers.get(id);
        if (!marker?.flying) {
          continue;
        }
        marker.flying = false;
        marker.g.getAnimations().forEach((anim) => anim.cancel());
        marker.g.style.transition = "";
        marker.g.style.transform = pinAt(home.x, home.y);
      }
      sync();
    };
    for (const id of ids) {
      const marker = markers.get(id);
      if (!marker) {
        continue;
      }
      marker.flying = true;
      marker.x = home.x;
      marker.y = home.y;
      marker.g.style.display = "";
      setPinExpanded(marker.g, false);
      marker.g.classList.add("group-member");
      marker.g.classList.remove("grouped");
      const scene = scenes.find((row) => row.id === id);
      if (scene) {
        revealPinIcon(marker, scene);
      }
      if (reduce) {
        continue;
      }
      pending += 1;
      const captured = fromTransforms?.get(id);
      const to = pinAt(home.x, home.y);
      marker.g.style.transition = "none";
      const anim = marker.g.animate(
        [{ transform: captured && captured !== "none" ? captured : to }, { transform: to }],
        {
          duration: PIN_GROW_MS,
          easing: PIN_GROW_EASE,
          fill: "both",
        }
      );
      anim.onfinish = () => {
        if (gen !== groupFlightGen) {
          return;
        }
        pending -= 1;
        if (pending <= 0) {
          finish();
        }
      };
    }
    if (reduce || pending === 0) {
      for (const id of ids) {
        const marker = markers.get(id);
        if (marker) {
          marker.flying = false;
        }
      }
    }
  };

  const closeOpenGroup = ({ exceptId = null } = {}) => {
    const ids = (openGroup || []).filter((id) => id !== exceptId);
    const home = groupHome;
    const from = new Map();
    for (const id of ids) {
      const marker = markers.get(id);
      if (!marker) {
        continue;
      }
      from.set(id, getComputedStyle(marker.g).transform);
    }
    releaseGroupFlight();
    openGroup = null;
    if (
      !ids.length ||
      !home ||
      !Number.isFinite(home.x) ||
      !Number.isFinite(home.y)
    ) {
      return;
    }
    flyPinsHome(ids, home, from);
  };

  const PIN_GROW_MS = 520;
  const PIN_GROW_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
  const pinExpandJobs = new Map();
  const setPinExpanded = (g, on) => {
    const job = pinExpandJobs.get(g);
    if (job) {
      cancelAnimationFrame(job);
      pinExpandJobs.delete(g);
    }
    if (!on) {
      g.classList.remove("expanded");
      return;
    }
    if (g.classList.contains("expanded")) {
      return;
    }
    // The class has to land on a frame after the dot was painted. Adding it
    // in the same turn as the first hover skips the scale transition.
    pinExpandJobs.set(
      g,
      requestAnimationFrame(() => {
        pinExpandJobs.delete(g);
        g.classList.add("expanded");
        g.parentNode?.appendChild(g);
      })
    );
  };

  const placeMarker = (marker, x, y, opts) => {
    if (marker.flying) {
      return;
    }
    // Tip stays on the color. Size is a scale on .pin-body around that tip.
    const at = pinAt;
    const instant = Boolean(opts && typeof opts === "object" && opts.instant);
    const from = !marker.posed ? pinFlip?.get(marker.sceneId) : null;
    const prevX = marker.x;
    const prevY = marker.y;
    marker.x = x;
    marker.y = y;
    if (marker.flipPending) {
      return;
    }
    if (
      from &&
      Number.isFinite(from.x) &&
      Number.isFinite(from.y) &&
      (Math.abs(from.x - x) > 0.5 || Math.abs(from.y - y) > 0.5)
    ) {
      marker.posed = true;
      marker.flipPending = true;
      marker.g.style.transition = "none";
      marker.g.style.transform = at(from.x, from.y);
      requestAnimationFrame(() => {
        if (!marker.flipPending) {
          return;
        }
        marker.g.style.transition = "";
        requestAnimationFrame(() => {
          if (!marker.flipPending) {
            return;
          }
          marker.flipPending = false;
          marker.g.style.transform = at(marker.x, marker.y);
        });
      });
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const moved =
      marker.posed &&
      Number.isFinite(prevX) &&
      Number.isFinite(prevY) &&
      (Math.abs(prevX - x) > 0.5 || Math.abs(prevY - y) > 0.5);
    const pinMoves = () =>
      marker.g.getAnimations({ subtree: false }).filter((anim) => anim.playState === "running");
    if (!moved && pinMoves().length) {
      return;
    }
    if (moved && !instant && !drag && !reduce) {
      pinMoves().forEach((anim) => anim.cancel());
      marker.g.style.transition = "none";
      const anim = marker.g.animate(
        [{ transform: at(prevX, prevY) }, { transform: at(x, y) }],
        {
          duration: 480,
          easing: "cubic-bezier(0.22, 1.15, 0.36, 1)",
          fill: "both",
        }
      );
      anim.onfinish = () => {
        marker.g.style.transition = "";
        marker.g.style.transform = at(marker.x, marker.y);
        anim.cancel();
      };
      return;
    }
    pinMoves().forEach((anim) => anim.cancel());
    marker.g.style.transform = at(x, y);
    if (!marker.posed) {
      marker.posed = true;
      marker.g.style.transition = "none";
      requestAnimationFrame(() => {
        if (marker.flying) {
          return;
        }
        marker.g.style.transition = "";
      });
    }
  };

  const positionForDraft = (draft, markerMode, geom, radius, entityId) => {
    const cx = radius;
    const variable = paletteForDraft(draft);
    if (markerMode === "palette" && variableIsPalette(variable) && bandLive(geom.palette)) {
      const auto = assignmentTR(entityId || "", seedNow());
      const t = draft.palette_t ?? auto.t;
      const r = draft.palette_r ?? auto.r;
      const rel = relFromPaletteTR(t, r, geom.palette.outer || radius);
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
    let kelvin = draft.color_temp_kelvin;
    if (kelvin == null && variableIsPalette(variable)) {
      const auto = assignmentTR(entityId || "", seedNow());
      const sampled = samplePaletteWheel(
        variable,
        draft.palette_t ?? auto.t,
        draft.palette_r ?? auto.r,
        paletteCatalog(),
        draftRgb
      );
      kelvin = approxKelvinFromRgb(sampled.rgb, tempMin, tempMax);
    }
    kelvin = kelvin ?? 2700;
    const rel = placeTempInAnnulus(
      kelvin,
      geom.temp.inner,
      geom.temp.outer,
      tempMin,
      tempMax,
      tempSides.get(entityId) ?? 1,
      tempAnchors.get(entityId) ?? null
    );
    return { x: cx + rel.x, y: cx + rel.y, rgb: hueTempToRgb(kelvin) };
  };

  const applyAtBand = (draft, x, y, radius, mode, band) => {
    const limited = limitToAnnulus(x, y, radius, band.inner, band.outer);
    const cx = limited.x - radius;
    const cy = limited.y - radius;
    const variable = paletteForDraft(draft);
    if (mode === "palette" && variableIsPalette(variable)) {
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
      const sample = hueTempAt(
        cx,
        cy,
        band.outer,
        tempMin,
        tempMax,
        kelvinTrackSpan(band.inner, band.outer)
      );
      if (sample) {
        applyTempToDraft(draft, sample.kelvin);
        const linked = paletteForDraft(draft);
        if (variableIsPalette(linked) && !paletteIsTemperatureOnly(linked, paletteCatalog())) {
          delete draft.variable_ref;
          delete draft.palette_t;
          delete draft.palette_r;
        }
      }
    }
    return limited;
  };

  const rememberFullDiskTemp = (keys, canvasX, radius, band) => {
    if (!band || band.inner > 0) {
      return;
    }
    const offset = canvasX - radius;
    for (const key of keys) {
      if (key) {
        tempAnchors.set(key, offset);
      }
    }
  };

  const regionAt = (x, y, geom, radius) => {
    const r = Math.hypot(x - radius, y - radius);
    const hit = (band) =>
      bandLive(band) && r <= band.outer + 2 && r >= Math.max(0, (band.inner || 0) - 2);
    const rank = { front: 0, mid: 1, back: 2 };
    const names = ["palette", "color", "temp"].sort(
      (a, b) => (rank[geom.role?.[a]] ?? 9) - (rank[geom.role?.[b]] ?? 9)
    );
    for (const name of names) {
      if (hit(geom[name])) {
        return name;
      }
    }
    return null;
  };

  const maybeConvertDrag = (item, x, y, geom, radius, pinMode) => {
    const caps = capsOf(item);
    const r = Math.hypot(x - radius, y - radius);
    const hyst = Math.max(6, radius * cssFrac(stage, "--wheel-peek", WHEEL_PEEK_FRAC) * 0.45);
    const palette = wheelPalette();
    const catalog = paletteCatalog();
    return diskHop(geom, pinMode, r, hyst, (name) => {
      if (name === "palette") {
        return lightCanUsePalette(caps, palette, catalog);
      }
      if (name === "color") {
        return Boolean(caps.hasColor);
      }
      return Boolean(caps.hasTemp);
    });
  };

  const convertDraftTo = (draft, next, caps) => {
    if (next === "palette") {
      const base =
        typeof onPickPalette === "function" && typeof getBasePalette === "function"
          ? getBasePalette()
          : null;
      const variable = variableIsPalette(base) ? base : wheelPalette();
      if (!variable) {
        return false;
      }
      applyVariableToDraft(draft, variable, {
        entityId: "",
        seed: seedNow(),
        catalog: paletteCatalog(),
      });
      return true;
    }
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
    const state = getState();
    const { scenes, activeId } = state;
    const item = scenes.find((row) => row.id === activeId);
    const draft = item?.draft;
    const pal = onPaletteDisk(draft, capsOf(item || {}));
    const selected = selectedIdsOf(state)
      .map((id) => scenes.find((row) => row.id === id))
      .filter(Boolean)
      .map((row) => ({
        hasColor: capsOf(row).hasColor,
        hasTemp: capsOf(row).hasTemp,
        // Capability, not "already on the disk". A color bulb can join any palette.
        palette: lightCanUsePalette(capsOf(row), wheelPalette(), paletteCatalog()),
      }));
    const sceneHasPalette = variableIsPalette(wheelPalette());
    const modes = wheelPillModes(selected, {
      hasColor,
      hasTemp,
      palette: sceneHasPalette || pal || typeof onPickPalette === "function",
    });
    const lightsSelected = selected.length > 0;
    modePill.hidden =
      !lightsSelected ||
      selected.every((row) => !row.hasColor && !row.hasTemp) ||
      modes.length < 2;
    randomizeBtn.hidden =
      !lightsSelected || !pal || typeof onRandomizeSeed !== "function";
    modeCluster.hidden = modePill.hidden && randomizeBtn.hidden;
    if (modePill.hidden) {
      return;
    }
    const caps = capsOf(item || {});
    const locked = lockedUiMode();
    const current =
      locked === "palette" || locked === "color" || locked === "temp"
        ? locked
        : showingPalette()
          ? "palette"
          : draftWheelMode(draft, caps.hasColor, caps.hasTemp);
    const basePalette =
      typeof getBasePalette === "function" ? getBasePalette() : null;
    const palVar =
      typeof onPickPalette === "function"
        ? variableIsPalette(basePalette)
          ? basePalette
          : null
        : sceneHasPalette
          ? paletteForDraft(draft) || wheelPalette()
          : null;
    const unsupported = t("frontend.lights.mode_not_supported", "Not supported");
    for (const entry of modes) {
      const mode = entry.mode;
      const offerPalette = mode === "palette" && typeof onPickPalette === "function";
      const wrap = document.createElement("button");
      wrap.type = "button";
      wrap.className = "wheel-wrapper";
      wrap.setAttribute("aria-pressed", mode === current ? "true" : "false");
      if (offerPalette && !palVar) {
        wrap.classList.add("palette-add");
      }
      if (mode === current && (entry.supported || (offerPalette && palVar))) {
        wrap.classList.add("active");
      }
      if (offerPalette && palVar && mode === current) {
        wrap.classList.add("palette-active");
      }
      if (!entry.supported && !offerPalette) {
        wrap.setAttribute("aria-disabled", "true");
        wrap.classList.add("mode-unsupported");
      }
      const name = document.createElement("span");
      name.className = "wheel-mode-name";
      const label =
        mode === "temp"
          ? t("frontend.lights.group_temp", "Temperature")
          : mode === "palette"
            ? t("frontend.naming.palette", "Palette")
            : t("frontend.lights.group_color", "Color");
      if (offerPalette && !palVar) {
        name.textContent = t("frontend.dialogs.scene_palette_select", "Select a palette");
      } else {
        name.textContent = label;
      }
      const face = document.createElement("span");
      face.className = `wheel wheel-mode-${mode}`;
      if (mode === "color") {
        face.style.backgroundImage = `url(${MODE_COLOR_ICON})`;
      } else if (mode === "temp") {
        face.style.backgroundImage = `url(${MODE_TEMP_ICON})`;
      } else if (palVar) {
        face.style.backgroundImage = "none";
        face.style.background = paletteSwatchCss(palVar, paletteCatalog(), draftRgb);
      } else if (offerPalette) {
        face.textContent = "+";
        face.classList.add("palette-add-mark");
      }
      wrap.append(name, face);
      if (!entry.supported && !offerPalette) {
        const tip = document.createElement("ha-tooltip");
        tip.placement = "right";
        tip.textContent = unsupported;
        wrap.id = `wheel-mode-${mode}`;
        wrap.appendChild(tip);
        const bindTip = () => {
          const root = wrap.getRootNode();
          if (typeof root?.getElementById !== "function") {
            return;
          }
          tip.setAttribute("for", wrap.id);
        };
        if (wrap.isConnected) {
          bindTip();
        } else {
          queueMicrotask(bindTip);
        }
        wrap._modeTip = tip;
      }
      if (wrap.classList.contains("palette-active") && palVar) {
        const edit = document.createElement("span");
        edit.className = "wheel-palette-edit";
        edit.setAttribute("aria-hidden", "true");
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", "mdi:pencil");
        edit.appendChild(icon);
        edit.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onEditPalette?.(palVar.id);
        });
        wrap.appendChild(edit);
      }
      const palettePressed = offerPalette && palVar && mode === current;
      wrap.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (offerPalette && !palVar) {
          onPickPalette();
          return;
        }
        if (palettePressed) {
          onPickPalette();
          return;
        }
        if (!entry.supported && !offerPalette) {
          wrap.focus();
          if (wrap._modeTip && "open" in wrap._modeTip) {
            wrap._modeTip.open = true;
          }
          return;
        }
        lockUiMode(mode);
        const state = getState();
        const targets = clusterMatesOf(selectedIdsOf(state));
        const { keep, drop } = splitCompatible(targets, mode);
        const changed = [];
        for (const id of keep) {
          const row = state.scenes.find((scene) => scene.id === id);
          if (!row?.draft) {
            continue;
          }
          const caps = capsOf(row);
          const current = onPaletteDisk(row.draft, caps)
            ? "palette"
            : draftWheelMode(row.draft, caps.hasColor, caps.hasTemp);
          if (current !== mode && convertDraftTo(row.draft, mode, caps)) {
            markers.get(id)?.g.classList.add("glide");
            changed.push(id);
          }
        }
        if (changed.length || drop.length) {
          for (const id of changed) {
            markers.get(id)?.g.getBoundingClientRect();
          }
          emitChange({
            dragging: false,
            ids: changed,
            deselected: drop,
            fromPalette: mode === "palette",
          });
        }
        sync();
        window.setTimeout(() => {
          for (const id of changed) {
            markers.get(id)?.g.classList.remove("glide");
          }
        }, 450);
      });
      modePill.appendChild(wrap);
    }
  };

  const updatePresetOverflow = () => {
    const vertical = getComputedStyle(chrome).flexDirection === "column";
    if (vertical) {
      const max = chrome.scrollHeight - chrome.clientHeight;
      chrome.classList.toggle("can-scroll-start", max > 1 && chrome.scrollTop > 1);
      chrome.classList.toggle(
        "can-scroll-end",
        max > 1 && chrome.scrollTop < max - 1
      );
      presets.classList.remove("can-scroll-end");
      return;
    }
    chrome.classList.remove("can-scroll-start", "can-scroll-end");
    const maxScroll = presetTrack.scrollWidth - presetTrack.clientWidth;
    presets.classList.toggle(
      "can-scroll-end",
      maxScroll > 1 && presetTrack.scrollLeft < maxScroll - 1
    );
  };

  const syncPaletteColors = () => {
    paletteColors.replaceChildren();
    const state = getState();
    const { scenes, activeId } = state;
    const item = scenes.find((row) => row.id === activeId);
    const locked = lockedUiMode();
    const onPalette =
      selectedIdsOf(state).length > 0 &&
      (locked === "palette" ||
        (locked !== "color" &&
          locked !== "temp" &&
          onPaletteDisk(item?.draft, capsOf(item || {}))));
    const palette = wheelPalette();
    if (!onPalette || !variableIsPalette(palette)) {
      paletteColors.hidden = true;
      return;
    }
    paletteColors.hidden = false;
    const title = document.createElement("div");
    title.className = "hue-palette-colors-title";
    title.textContent = palette.name || t("frontend.naming.palette", "Palette");
    paletteColors.appendChild(title);
    const catalog = paletteCatalog();
    const slots = palette.slots || [];
    for (let i = 0; i < PALETTE_SLOT_COUNT; i += 1) {
      const slot = resolveSlot(palette, i, catalog);
      const ref = slots[i]?.variable_ref;
      const linked = ref ? catalog.find((entry) => entry.id === ref) : null;
      const row = document.createElement("div");
      row.className = "hue-palette-color";
      const swatch = document.createElement("span");
      swatch.className = "hue-preset-swatch";
      const rgb = swatchRgb(slot, slot.brightness);
      swatch.style.background = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      const name = document.createElement("span");
      name.className = "hue-preset-name";
      name.textContent =
        linked?.name ||
        `${t("frontend.library.slot", "Slot")} ${i + 1}`;
      row.append(swatch, name);
      paletteColors.appendChild(row);
    }
  };

  const syncPresets = () => {
    presetTrack.replaceChildren();
    const state = getState();
    const { scenes, activeId } = state;
    const active = scenes.find((item) => item.id === activeId);
    const palette = typeof getPalette === "function" ? getPalette() || [] : [];
    const lightsSelected = selectedIdsOf(state).length > 0;
    presets.hidden = !lightsSelected;
    presetTrack.setAttribute(
      "aria-label",
      t("frontend.library.variables", "Variables")
    );
    syncPaletteColors();
    if (!lightsSelected) {
      return;
    }
    for (const variable of palette) {
      if (variableIsPalette(variable)) {
        continue;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hue-preset";
      btn.setAttribute("role", "listitem");
      btn.title = variable.name;
      const swatch = document.createElement("span");
      swatch.className = "hue-preset-swatch";
      swatch.style.background = variableSwatchCss(variable, palette);
      const name = document.createElement("span");
      name.className = "hue-preset-name";
      name.textContent = variable.name || "";
      btn.append(swatch, name);
      if (active?.draft?.variable_ref === variable.id) {
        btn.classList.add("active");
      }
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const stateNow = getState();
        const picked = selectedIdsOf(stateNow)
          .map((id) => stateNow.scenes.find((row) => row.id === id))
          .filter((row) => row?.draft);
        const targets = picked.length ? picked : active?.draft ? [active] : [];
        if (!targets.length) {
          return;
        }
        for (const row of targets) {
          applyVariableToDraft(row.draft, variable, {
            entityId: entityIdOf(row),
            seed: seedNow(),
            catalog: palette,
          });
        }
        lockUiMode(variableIsPalette(variable) ? "palette" : null);
        const marker = active ? markers.get(active.id) : null;
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
      add.title = addVariableLabel;
      const face = document.createElement("span");
      face.className = "hue-preset-add-face";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", "mdi:plus");
      face.appendChild(icon);
      const name = document.createElement("span");
      name.className = "hue-preset-name";
      name.textContent = addVariableLabel;
      add.append(face, name);
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

  const stillOverHover = () => {
    if (!hoverId || !hoverCursor) {
      return false;
    }
    const marker = markers.get(hoverId);
    if (!marker) {
      return false;
    }
    const root = svg.getRootNode();
    const el = root.elementFromPoint?.(hoverCursor.x, hoverCursor.y);
    return Boolean(el && marker.g.contains(el));
  };

  const queueHoverCheck = () => {
    if (hoverCheckQueued) {
      return;
    }
    hoverCheckQueued = true;
    requestAnimationFrame(() => {
      hoverCheckQueued = false;
      suppressHover = false;
      if (!hoverId || stillOverHover()) {
        return;
      }
      hoverId = null;
      sync();
    });
  };

  const sync = () => {
    // A return flight runs after the group is closed. Cancelling it here
    // snapped the pins home instead of letting them fly back.
    let returning = false;
    for (const marker of markers.values()) {
      if (marker.flying) {
        returning = true;
        break;
      }
    }
    if (!openGroup && !returning) {
      releaseGroupFlight();
    }
    syncModePill();
    const radius = radiusPx();
    const state = getState();
    const { scenes, activeId } = state;
    const selectedIds = selectedIdsOf(state);
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
    const placed = [];
    for (const scene of scenes) {
      seen.add(scene.id);
      let marker = markers.get(scene.id);
      if (!marker) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "gm");
        g.dataset.sceneId = scene.id;
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "g");
        dot.setAttribute("class", "pin-dot");
        const dotOutline = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dotOutline.setAttribute("class", "pin-dot-outline");
        dotOutline.setAttribute("cx", String(PIN_TIP_X));
        dotOutline.setAttribute("cy", String(PIN_TIP_Y));
        dotOutline.setAttribute("r", "8");
        const dotFill = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dotFill.setAttribute("class", "pin-dot-fill");
        dotFill.setAttribute("cx", String(PIN_TIP_X));
        dotFill.setAttribute("cy", String(PIN_TIP_Y));
        dotFill.setAttribute("r", "6");
        const count = document.createElementNS("http://www.w3.org/2000/svg", "text");
        count.setAttribute("class", "group-count");
        count.setAttribute("x", String(PIN_TIP_X));
        count.setAttribute("y", String(PIN_TIP_Y));
        count.setAttribute("text-anchor", "middle");
        count.setAttribute("dominant-baseline", "central");
        const dotFo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        dotFo.setAttribute("class", "dot-icon");
        dotFo.setAttribute("x", String(PIN_TIP_X - 11));
        dotFo.setAttribute("y", String(PIN_TIP_Y - 11));
        dotFo.setAttribute("width", "22");
        dotFo.setAttribute("height", "22");
        const dotHost = document.createElement("div");
        dotHost.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        dotHost.className = "dot-icon-host";
        const dotHaIcon = document.createElement("ha-icon");
        dotHost.appendChild(dotHaIcon);
        dotFo.appendChild(dotHost);
        dot.append(dotOutline, dotFill, count, dotFo);
        const body = document.createElementNS("http://www.w3.org/2000/svg", "g");
        body.setAttribute("class", "pin-body");
        const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
        outline.setAttribute("class", "marker-outline");
        outline.setAttribute("d", HUE_PIN_PATH);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "marker");
        path.setAttribute("d", HUE_PIN_PATH);
        const glyph = document.createElementNS("http://www.w3.org/2000/svg", "g");
        glyph.setAttribute("class", "pin-glyph");
        // The pin body is rotated 180°. Spin the glyph back so icons stay upright.
        glyph.setAttribute("transform", "rotate(180 24 24)");
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("class", "icon text");
        icon.setAttribute("x", "24");
        icon.setAttribute("y", "24");
        icon.setAttribute("text-anchor", "middle");
        icon.setAttribute("dominant-baseline", "middle");
        const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        fo.setAttribute("class", "icon-fo");
        fo.setAttribute("x", "8");
        fo.setAttribute("y", "10");
        fo.setAttribute("width", "32");
        fo.setAttribute("height", "32");
        const iconHost = document.createElement("div");
        iconHost.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        iconHost.className = "pin-icon-host";
        const haIcon = document.createElement("ha-icon");
        haIcon.style.setProperty("--mdc-icon-size", "32px");
        iconHost.appendChild(haIcon);
        fo.appendChild(iconHost);
        glyph.append(icon, fo);
        body.append(outline, path, glyph);
        const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        hit.setAttribute("class", "pin-hit");
        hit.setAttribute("cx", String(PIN_TIP_X));
        hit.setAttribute("cy", String(PIN_TIP_Y));
        hit.setAttribute("r", "20");
        hit.setAttribute("fill", "transparent");
        g.append(dot, body, hit);
        marker = {
          g,
          path,
          outline,
          hit,
          icon,
          fo,
          haIcon,
          dotHaIcon,
          count,
          sceneId: scene.id,
        };
        markers.set(scene.id, marker);
        if (fadePinIds?.has(scene.id)) {
          g.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 180,
            easing: "ease-out",
          });
        }
        g.addEventListener("pointerenter", (ev) => {
          if (drag || suppressHover) {
            return;
          }
          if (g.style.display === "none") {
            return;
          }
          if (g.classList.contains("active")) {
            return;
          }
          const now = getState();
          if (selectedIdsOf(now).includes(scene.id) || hoverId === scene.id) {
            return;
          }
          hoverCursor = { x: ev.clientX, y: ev.clientY };
          hoverId = scene.id;
          sync();
        });
        g.addEventListener("pointerleave", (ev) => {
          if (hoverId !== scene.id) {
            return;
          }
          if (ev.relatedTarget && g.contains(ev.relatedTarget)) {
            return;
          }
          hoverCursor = { x: ev.clientX, y: ev.clientY };
          if (suppressHover) {
            return;
          }
          if (stillOverHover()) {
            return;
          }
          hoverId = null;
          sync();
        });
        g.addEventListener("pointerdown", (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          hoverId = null;
          if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
            const startX = ev.clientX;
            const startY = ev.clientY;
            const pointerId = ev.pointerId;
            const shiftKey = ev.shiftKey;
            const toggleKey = Boolean(ev.metaKey || ev.ctrlKey);
            const sceneId = scene.id;
            const onUp = (up) => {
              if (up.pointerId !== pointerId) {
                return;
              }
              window.removeEventListener("pointerup", onUp);
              window.removeEventListener("pointercancel", onUp);
              if (modifyPress?.onUp === onUp) {
                modifyPress = null;
              }
              const travel = Math.hypot(up.clientX - startX, up.clientY - startY);
              if (travel >= PIN_DRAG_THRESHOLD_PX) {
                sync();
                return;
              }
              onSelect?.(sceneId, { shiftKey, toggleKey });
            };
            if (modifyPress) {
              window.removeEventListener("pointerup", modifyPress.onUp);
              window.removeEventListener("pointercancel", modifyPress.onUp);
            }
            modifyPress = { onUp };
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
            return;
          }
          const now = getState();
          const item = now.scenes.find((row) => row.id === scene.id);
          if (!item) {
            return;
          }
          const cluster =
            pinClusters.find((row) => row.includes(scene.id)) || [scene.id];
          const caps = capsOf(item);
          const markerMode = onPaletteDisk(item.draft, caps)
            ? "palette"
            : draftWheelMode(item.draft, caps.hasColor, caps.hasTemp);
          if (openGroup?.includes(scene.id)) {
            const pt = pointFromEvent(ev);
            let heldX = marker.x ?? radiusPx();
            let heldY = marker.y ?? radiusPx();
            if (marker.flying) {
              const transform = getComputedStyle(marker.g).transform;
              if (transform && transform !== "none") {
                const m = new DOMMatrix(transform);
                if (Number.isFinite(m.m41) && Number.isFinite(m.m42)) {
                  heldX = m.m41 + PIN_TIP_X;
                  heldY = m.m42 + PIN_TIP_Y;
                }
              }
            }
            const grabX = pt.x - heldX;
            const grabY = pt.y - heldY;
            // Keep this pin out of the stack the select-sync would rebuild,
            // then put it back under the pointer. The other lights go home.
            closeOpenGroup({ exceptId: scene.id });
            soloId = scene.id;
            onSelect?.(scene.id);
            placeMarker(marker, heldX, heldY);
            startDrag(ev, scene.id, grabX, grabY, markerMode, [scene.id]);
            g.classList.add("drag");
            return;
          }
          const stacked = cluster.length > 1 && !detached.has(scene.id);
          if (!stacked && !selectedIdsOf(now).includes(scene.id)) {
            onSelect(scene.id);
          }
          const pt = pointFromEvent(ev);
          startDrag(
            ev,
            scene.id,
            pt.x - (marker.x ?? radiusPx()),
            pt.y - (marker.y ?? radiusPx()),
            markerMode,
            cluster
          );
          g.classList.add("drag");
        });
        svg.appendChild(g);
      }
      if (marker.flying) {
        const caps = capsOf(scene);
        const markerMode = draftWheelMode(scene.draft, caps.hasColor, caps.hasTemp);
        marker.g.style.display = "";
        placed.push({
          id: scene.id,
          x: marker.x,
          y: marker.y,
          mode: markerMode,
          off: isOffDraft(scene.draft),
        });
        continue;
      }
      const active = selectedIds.includes(scene.id);
      const preview = hoverId === scene.id && !active;
      const expanded = preview || active;
      const caps = capsOf(scene);
      if (!caps.hasColor && !caps.hasTemp) {
        marker.g.style.display = "none";
        continue;
      }
      const markerMode = onPaletteDisk(scene.draft, caps)
        ? "palette"
        : draftWheelMode(scene.draft, caps.hasColor, caps.hasTemp);
      marker.g.classList.remove("grouped", "group-member", "drop-target");
      setPinExpanded(marker.g, expanded);
      marker.g.classList.toggle("active", active && expanded);
      marker.g.classList.toggle("preview", preview);
      const mdi = pinIconOf(scene);
      if (mdi && marker.haIcon) {
        marker.haIcon.setAttribute("icon", mdi);
        marker.dotHaIcon?.setAttribute("icon", mdi);
        marker.fo.style.display = "";
      } else if (marker.fo) {
        marker.fo.style.display = "none";
      }
      /* Count / event index on the pin; entity/event mdi lives in foreignObject. */
      marker.icon.textContent =
        mdi && expanded
          ? ""
          : scene.index == null || scene.index === ""
            ? ""
            : String(scene.index);
      marker.hit.style.display = "";
      marker.g.style.display = "";
      marker.g.classList.remove("grouped");
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
      if (marker.haIcon) {
        marker.haIcon.style.color = pinForeground(pos.rgb);
      }
      if (marker.dotHaIcon) {
        marker.dotHaIcon.style.color = pinForeground(pos.rgb);
      }
      if (marker.count) {
        marker.count.style.fill = pinForeground(pos.rgb);
      }
      placeMarker(marker, pos.x, pos.y, expanded);
      placed.push({
        id: scene.id,
        x: pos.x,
        y: pos.y,
        mode: markerMode,
        off: isOffDraft(scene.draft),
      });
      if (preview) {
        suppressHover = true;
      }
    }
    const clusterInput = placed.filter(
      (item) => !detached.has(item.id) && item.id !== soloId
    );
    pinClusters =
      groupNearby && radius
        ? clusterNearbyPinIds(clusterInput, radius)
        : clusterInput.map((item) => [item.id]);
    for (const id of detached) {
      if (placed.some((item) => item.id === id)) {
        pinClusters.push([id]);
      }
    }
    if (groupNearby) {
      for (const marker of markers.values()) {
        marker.g.querySelector(".pin-dot-outline")?.setAttribute("r", "8");
        marker.g.querySelector(".pin-dot-fill")?.setAttribute("r", "6");
        marker.hit?.setAttribute("r", "20");
      }
      const hidden = new Set();
      for (const group of pinClusters) {
        if (openGroup?.some((id) => group.includes(id))) {
          continue;
        }
        const lead =
          group.find((id) => selectedIds.includes(id)) || group[0];
        for (const id of group) {
          if (id !== lead) {
            hidden.add(id);
          }
        }
        const leadMarker = markers.get(lead);
        if (leadMarker?.flying) {
          continue;
        }
        if (leadMarker && group.length > 1) {
          const expandGroup =
            (hoverId != null && group.includes(hoverId)) ||
            Boolean(
              drag?.moved && (drag.ids || []).some((id) => group.includes(id))
            ) ||
            group.some((id) => selectedIds.includes(id));
          // 16px at one light, 32px at four or more. The hit target stays 40px.
          const steps = Math.min(4, group.length) - 1;
          const outlineR = expandGroup ? 8 : 8 + (8 * steps) / 3;
          leadMarker.g.querySelector(".pin-dot-outline")?.setAttribute("r", String(outlineR));
          leadMarker.g.querySelector(".pin-dot-fill")?.setAttribute("r", String(outlineR * 0.75));
          leadMarker.hit?.setAttribute("r", "20");
          if (leadMarker.fo) {
            leadMarker.fo.style.display = "none";
          }
          if (leadMarker.count) {
            leadMarker.count.textContent = "";
          }
          leadMarker.g.classList.add("grouped");
          leadMarker.g.classList.remove("group-member");
          // The count lives on the teardrop. The resting dot stays empty.
          leadMarker.icon.textContent = expandGroup ? String(group.length) : "";
          setPinExpanded(leadMarker.g, expandGroup);
          leadMarker.hit.style.display = "";
          if (leadMarker.g.parentNode !== svg) {
            svg.appendChild(leadMarker.g);
          }
        }
      }
      for (const id of hidden) {
        const marker = markers.get(id);
        if (marker && !marker.flying) {
          marker.g.style.display = "none";
        }
      }
    }
    const fans = [];
    for (const item of placed) {
      if (!detached.has(item.id)) {
        continue;
      }
      let fan = fans.find(
        (group) => Math.hypot(group.x - item.x, group.y - item.y) < 12
      );
      if (!fan) {
        fan = { x: item.x, y: item.y, ids: [] };
        fans.push(fan);
      }
      fan.ids.push(item.id);
    }
    for (const fan of fans) {
      fan.ids.forEach((id, index) => {
        const marker = markers.get(id);
        if (!marker) {
          return;
        }
        const count = fan.ids.length;
        const ang = (index / count) * Math.PI * 2 - Math.PI / 2;
        const dist = count > 1 ? 56 : 0;
        const fanExpanded = id === hoverId || selectedIds.includes(id);
        placeMarker(
          marker,
          fan.x + Math.cos(ang) * dist,
          fan.y + Math.sin(ang) * dist,
          fanExpanded
        );
        marker.g.style.display = "";
      });
    }
    if (openGroup) {
      openGroup = openGroup.filter((id) => seen.has(id) && markers.has(id));
      if (openGroup.length < 2) {
        openGroup = null;
      }
    }
    canvasWrap.classList.toggle("group-open", Boolean(openGroup));
    if (openGroup && radius) {
      const points = groupRingPoints(openGroup.length, radius);
      const ring = radius * 0.42;
      groupRing.setAttribute("cx", String(radius));
      groupRing.setAttribute("cy", String(radius));
      groupRing.setAttribute("r", String(ring));
      groupRing.style.display = "";
      const spawn = groupSpawn;
      groupSpawn = null;
      const members = openGroup
        .map((id, index) => ({ marker: markers.get(id), point: points[index] }))
        .filter((row) => row.marker && row.point);
      const placeOpenMember = (row, x, y, expanded, instant) => {
        row.marker.g.classList.add("group-member");
        row.marker.g.classList.remove("grouped");
        row.marker.g.style.display = "";
        if (row.marker.g.parentNode !== svg) {
          svg.appendChild(row.marker.g);
        }
        setPinExpanded(row.marker.g, expanded);
        row.marker.hit.style.display = "";
        const scene = (getState().scenes || []).find(
          (item) => item.id === row.marker.sceneId
        );
        if (scene) {
          revealPinIcon(row.marker, scene);
        }
        placeMarker(row.marker, x, y, instant ? { instant: true } : undefined);
        svg.appendChild(row.marker.g);
      };
      const reduceMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches;
      if (
        spawn &&
        Number.isFinite(spawn.x) &&
        Number.isFinite(spawn.y) &&
        members.length &&
        !reduceMotion
      ) {
        // Paint every pin on the clicked group pin first. A CSS transition
        // from there was losing its start frame when sync ran again before
        // paint, so the flight is an animation that begins at that pin.
        for (const row of members) {
          row.marker.flying = false;
          row.marker.g.style.transition = "none";
          placeOpenMember(row, spawn.x, spawn.y, true, true);
          row.marker.flying = true;
        }
        svg.getBoundingClientRect();
        const fromX = spawn.x;
        const fromY = spawn.y;
        const flight = ++groupFlightGen;
        requestAnimationFrame(() => {
          if (flight !== groupFlightGen) {
            return;
          }
          for (const row of members) {
            const marker = row.marker;
            if (!marker.flying || !openGroup?.includes(marker.sceneId)) {
              marker.flying = false;
              marker.g.style.transition = "";
              continue;
            }
            const toX = row.point.x;
            const toY = row.point.y;
            marker.x = toX;
            marker.y = toY;
            marker.g.style.transition = "none";
            marker.g.style.transform = pinAt(toX, toY);
            const anim = marker.g.animate(
              [{ transform: pinAt(fromX, fromY) }, { transform: pinAt(toX, toY) }],
              {
                duration: PIN_GROW_MS,
                easing: PIN_GROW_EASE,
                fill: "both",
              }
            );
            anim.onfinish = () => {
              if (!marker.flying) {
                return;
              }
              marker.flying = false;
              marker.g.style.transition = "";
              marker.g.style.transform = pinAt(marker.x, marker.y);
              anim.cancel();
            };
          }
        });
      } else {
        for (const row of members) {
          if (row.marker.flying) {
            row.marker.g.classList.add("group-member");
            row.marker.g.classList.remove("grouped");
            setPinExpanded(row.marker.g, true);
            row.marker.g.style.display = "";
            if (row.marker.g.parentNode !== svg) {
              svg.appendChild(row.marker.g);
            }
            continue;
          }
          placeOpenMember(row, row.point.x, row.point.y, true);
        }
      }
    } else {
      groupRing.style.display = "none";
    }
    onClusters?.(pinClusters.map((group) => [...group]));
    // Document order paints later dots over an earlier teardrop. Expanded
    // pins (and drop targets) go last so the pin covers every dot.
    for (const marker of markers.values()) {
      if (
        marker.g.classList.contains("expanded") ||
        marker.g.classList.contains("drop-target")
      ) {
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
    if (hoverId && !markers.has(hoverId)) {
      hoverId = null;
    }
    if (hoverId) {
      queueHoverCheck();
    }
  };

  const syncPath = (geom, radius) => {
    pathLayer.replaceChildren();
    if (!showPath || !radius || showingPalette()) {
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
    const travel = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY);
    if (!drag.moved) {
      if (travel < PIN_DRAG_THRESHOLD_PX) {
        return;
      }
      drag.moved = true;
      const { keep, drop } = splitCompatible(drag.ids, drag.mode);
      drag.ids = keep.length ? keep : drag.ids;
      if (drop.length) {
        for (const id of drop) {
          detached.add(id);
        }
        emitChange({ dragging: true, deselected: drop, ids: drag.ids });
      }
      const clusterIds = drag.cluster || [];
      const stacking =
        clusterIds.length > 1 &&
        drag.ids.length === clusterIds.length &&
        clusterIds.every((id) => drag.ids.includes(id));
      if (stacking && !drag.groupedSelect) {
        drag.groupedSelect = true;
        onSelectMany?.([...drag.ids]);
        const lead = markers.get(drag.sceneId);
        if (lead) {
          lead.g.classList.add("expanded", "grouped");
          lead.icon.textContent = String(drag.ids.length);
          if (lead.fo) {
            lead.fo.style.display = "none";
          }
          if (lead.count) {
            lead.count.textContent = "";
          }
          svg.appendChild(lead.g);
        }
      }
    }
    const { scenes, activeId } = getState();
    const moveIds = drag.ids?.length
      ? drag.ids
      : [drag.sceneId || activeId];
    const item = scenes.find((row) => row.id === (drag.sceneId || activeId));
    if (!item) {
      return;
    }
    if (!drag.frozenGeom) {
      drag.frozenGeom = currentGeom();
      // Other pins stay in this coordinate space. A live radius read mid-drag
      // shifts them, and pointerup then snaps them back.
      drag.frozenRadius = radius;
    }
    const geom = drag.frozenGeom;
    const pinRadius = drag.frozenRadius || radius;
    const pt = pointFromEvent(ev);
    const x = pt.x - drag.grabX;
    const y = pt.y - drag.grabY;
    const r = Math.hypot(x - radius, y - radius);
    let pinMode = drag.mode;
    let converted = false;
    const nextMode = maybeConvertDrag(item, x, y, geom, radius, pinMode);
    if (nextMode !== pinMode) {
      converted = true;
      pinMode = nextMode;
      drag.mode = nextMode;
      const { keep, drop } = splitCompatible(drag.ids, pinMode);
      if (drop.length) {
        drag.ids = keep;
        for (const id of drop) {
          detached.add(id);
        }
        emitChange({ dragging: true, deselected: drop, ids: keep });
      }
      const joinIds = drag.ids?.length ? drag.ids : [item.id];
      for (const id of joinIds) {
        const row = scenes.find((scene) => scene.id === id);
        if (!row?.draft) {
          continue;
        }
        const rowCaps = capsOf(row);
        const current = onPaletteDisk(row.draft, rowCaps)
          ? "palette"
          : draftWheelMode(row.draft, rowCaps.hasColor, rowCaps.hasTemp);
        if (current !== pinMode) {
          convertDraftTo(row.draft, pinMode, rowCaps);
        }
      }
    }
    const band = pinMode === "palette" ? geom.palette : pinMode === "color" ? geom.color : geom.temp;
    if (!bandLive(band)) {
      return;
    }
    const hyst = Math.max(
      6,
      radius * cssFrac(stage, "--wheel-peek", WHEEL_PEEK_FRAC) * 0.45
    );
    const tracked =
      pinMode === "temp" && !showingPalette()
        ? kelvinTrackDragPoint({
            x,
            y,
            radius,
            inner: band.inner,
            outer: band.outer,
            colorOuter: geom.color.outer,
            colorLive: bandLive(geom.color),
            tempMin,
            tempMax,
            canColor: capsOf(item).hasColor,
            hyst,
          })
        : null;
    if (tracked) {
      const side = tracked.x < radius ? -1 : 1;
      for (const id of moveIds) {
        tempSides.set(id, side);
        const row = scenes.find((scene) => scene.id === id);
        const eid = row ? entityIdOf(row) : null;
        if (eid) {
          tempSides.set(eid, side);
        }
      }
    }
    const limited = tracked
      ? { x: tracked.x, y: tracked.y }
      : applyAtBand(item.draft, x, y, radius, pinMode, band);
    if (pinMode === "temp") {
      const keys = [];
      for (const id of moveIds) {
        keys.push(id);
        const row = scenes.find((scene) => scene.id === id);
        const eid = row ? entityIdOf(row) : null;
        if (eid) {
          keys.push(eid);
        }
      }
      rememberFullDiskTemp(keys, limited.x, radius, band);
    }
    const moved = new Set();
    const placeDragPin = (row) => {
      const pin = markers.get(row.id);
      if (!pin) {
        return;
      }
      if (converted) {
        pin.g.classList.add("glide");
        void pin.g.getBoundingClientRect();
        window.setTimeout(() => pin.g.classList.remove("glide"), 420);
      }
      const ink = draftRgb(row.draft);
      const fg = pinForeground(ink);
      pin.g.style.color = rgbCss(ink);
      pin.icon.style.fill = fg;
      if (pin.haIcon) {
        pin.haIcon.style.color = fg;
      }
      placeMarker(pin, limited.x, limited.y, selectedIdsOf(getState()).includes(row.id));
    };
    for (const id of moveIds) {
      const row = scenes.find((scene) => scene.id === id);
      if (!row?.draft) {
        continue;
      }
      if (tracked) {
        applyTempToDraft(row.draft, tracked.kelvin);
      } else if (row !== item) {
        applyAtBand(row.draft, x, y, radius, pinMode, band);
      }
      if (pinMode !== "palette") {
        delete row.draft.variable_ref;
        delete row.draft.palette_t;
        delete row.draft.palette_r;
      }
      moved.add(id);
      placeDragPin(row);
    }
    showFloatReadout(item.draft, limited.x, limited.y, pinMode);
    layoutLayers(geom);
    for (const scene of scenes) {
      if (moved.has(scene.id)) {
        continue;
      }
      const other = markers.get(scene.id);
      if (!other || other.g.style.display === "none") {
        continue;
      }
      const caps = capsOf(scene);
      // Palette lights store an rgb snapshot. draftWheelMode would read that as
      // the color disk and slide those pins until the drag ends.
      const otherMode = onPaletteDisk(scene.draft, caps)
        ? "palette"
        : draftWheelMode(scene.draft, caps.hasColor, caps.hasTemp);
      const pos = positionForDraft(
        scene.draft,
        otherMode,
        geom,
        pinRadius,
        entityIdOf(scene)
      );
      if (
        Number.isFinite(other.x) &&
        Number.isFinite(other.y) &&
        Math.hypot(other.x - pos.x, other.y - pos.y) < 0.5
      ) {
        continue;
      }
      other.g.style.color = rgbCss(pos.rgb);
      other.icon.style.fill = pinForeground(pos.rgb);
      placeMarker(other, pos.x, pos.y, false);
    }
    syncPath(geom, radius);
    const sim = [];
    for (const scene of scenes) {
      const pin = markers.get(scene.id);
      if (!pin || pin.g.style.display === "none" || pin.x == null || pin.y == null) {
        continue;
      }
      const caps = capsOf(scene);
      sim.push({
        id: scene.id,
        x: pin.x,
        y: pin.y,
        mode: moved.has(scene.id)
          ? pinMode
          : draftWheelMode(scene.draft, caps.hasColor, caps.hasTemp),
        off: isOffDraft(scene.draft),
      });
    }
    const targets = new Set(dropTargetIds(sim, radius, [...moved]));
    for (const pin of markers.values()) {
      const hit = targets.has(pin.sceneId);
      const wasTarget = pin.g.classList.contains("drop-target");
      if (hit && !wasTarget) {
        svg.appendChild(pin.g);
      }
      pin.g.classList.toggle("drop-target", hit);
      if (hit) {
        if (
          !pin.g.classList.contains("grouped") &&
          pin.fo &&
          pin.haIcon?.getAttribute("icon")
        ) {
          pin.fo.style.display = "";
        }
      } else if (!pin.g.classList.contains("expanded") && pin.fo) {
        pin.fo.style.display = "none";
      }
    }
    for (const id of moveIds) {
      const pin = markers.get(id);
      if (!pin) {
        continue;
      }
      pin.g.classList.remove("drop-target");
      svg.appendChild(pin.g);
    }
    emitChange({
      dragging: true,
      fromPalette: drag.mode === "palette" || showingPalette(),
      ids: [...moved],
    });
  };

  const onPointerUp = (ev) => {
    if (!drag || ev.pointerId !== drag.pointerId) {
      return;
    }
    soloId = null;
    const marker = markers.get(drag.sceneId);
    const finishedIds = drag.ids?.length ? [...drag.ids] : [drag.sceneId];
    const travel = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY);
    const stacked = (drag.cluster || []).length > 1 && !detached.has(drag.sceneId);
    marker?.g.classList.remove("drag");
    svg.classList.remove("pin-drag");
    const press = pinPressAction({
      moved: drag.moved,
      travel,
      stacked,
    });
    if (press === "select") {
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
      sync();
      return;
    }
    if (press === "fan") {
      openGroup = [...(drag.cluster || [])];
      groupHome = {
        x: marker?.x,
        y: marker?.y,
      };
      groupSpawn = groupHome;
      for (const id of openGroup) {
        detached.delete(id);
      }
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
      sync();
      return;
    }
    if (drag.moved) {
      const staySplit = detachedAfterDrag(detached, finishedIds);
      detached.clear();
      for (const id of staySplit) {
        detached.add(id);
      }
      lockUiMode(drag.mode);
      if (drag.mode === "palette" || drag.mode === "color") {
        diskFocus = drag.mode;
        diskFocusHold = false;
      }
    }
    const releasedMode = drag.mode;
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
    emitChange({
      dragging: false,
      final: true,
      ids: finishedIds,
      fromPalette: releasedMode === "palette",
    });
    sync();
  };

  const dragIdsFor = (sceneId, cluster) => {
    const state = getState();
    const group = cluster?.length
      ? cluster
      : pinClusters.find((row) => row.includes(sceneId)) || [sceneId];
    return dragIdsForPin({
      sceneId,
      cluster: group,
      detached,
      peeledId: state.peeledId,
      selected: selectedIdsOf(state),
    });
  };

  const startDrag = (ev, sceneId, grabX = 0, grabY = 0, mode = "color", cluster = null) => {
    drag = {
      sceneId,
      ids: dragIdsFor(sceneId, cluster),
      cluster: cluster || [sceneId],
      pointerId: ev.pointerId,
      grabX,
      grabY,
      mode,
      moved: false,
      startX: ev.clientX,
      startY: ev.clientY,
    };
    svg.classList.add("pin-drag");
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
    if (openGroup && !ev.target?.closest?.(".gm")) {
      closeOpenGroup();
      if (!moveOnEmptyDisk) {
        onSelect?.(null);
      }
      sync();
      return;
    }
    const radius = radiusPx();
    if (!radius) {
      return;
    }
    const pt = pointFromEvent(ev);
    const dist = Math.hypot(pt.x - radius, pt.y - radius);
    if (dist > radius) {
      if (!moveOnEmptyDisk) {
        onSelect?.(null);
      }
      return;
    }
    const geom = currentGeom();
    const hit = regionAt(pt.x, pt.y, geom, radius);
    if (hit === "color" || hit === "palette") {
      ev.preventDefault();
      const pointerId = ev.pointerId;
      const startX = ev.clientX;
      const startY = ev.clientY;
      const onUp = (up) => {
        if (up.pointerId !== pointerId) {
          return;
        }
        clearDiskPress();
        if (Math.hypot(up.clientX - startX, up.clientY - startY) >= PIN_DRAG_THRESHOLD_PX) {
          return;
        }
        diskFocus = hit;
        diskFocusHold = true;
        sync();
      };
      const onMove = (mv) => {
        if (mv.pointerId !== pointerId || !moveOnEmptyDisk) {
          return;
        }
        if (Math.hypot(mv.clientX - startX, mv.clientY - startY) < PIN_DRAG_THRESHOLD_PX) {
          return;
        }
        clearDiskPress();
        beginEmptyDrag(ev, pt, radius);
      };
      diskPress = { onMove, onUp };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      return;
    }
    if (!moveOnEmptyDisk) {
      onSelect?.(null);
      return;
    }
    beginEmptyDrag(ev, pt, radius);
  });

  const clearDiskPress = () => {
    if (!diskPress) {
      return;
    }
    window.removeEventListener("pointermove", diskPress.onMove);
    window.removeEventListener("pointerup", diskPress.onUp);
    window.removeEventListener("pointercancel", diskPress.onUp);
    diskPress = null;
  };

  const beginEmptyDrag = (ev, pt, radius) => {
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
    const band = pinMode === "palette" ? geom.palette : pinMode === "color" ? geom.color : geom.temp;
    if (!bandLive(band)) {
      return;
    }
    const limited = applyAtBand(item.draft, pt.x, pt.y, radius, pinMode, band);
    if (pinMode === "temp") {
      rememberFullDiskTemp(
        [item.id, entityIdOf(item)],
        limited.x,
        radius,
        band
      );
    }
    const marker = markers.get(item.id);
    marker?.g.classList.add("drag", "active");
    if (marker) {
      placeMarker(marker, limited.x, limited.y, true);
    }
    showFloatReadout(item.draft, limited.x, limited.y, pinMode);
    layoutLayers(currentGeom());
    syncPath(currentGeom(), radius);
    emitChange({ dragging: true, fromPalette: showingPalette() });
  };

  const setMode = (next, { convertDraft = false } = {}) => {
    if (next === "palette") {
      lockUiMode("palette");
      sync();
      return;
    }
    if (next === "color" && !hasColor) {
      return;
    }
    if (next === "temp" && !hasTemp) {
      return;
    }
    lockUiMode(next);
    if (convertDraft) {
      const state = getState();
      const targets = clusterMatesOf(selectedIdsOf(state));
      const { keep, drop } = splitCompatible(targets, next);
      const changed = [];
      for (const id of keep) {
        const row = state.scenes.find((scene) => scene.id === id);
        if (!row?.draft) {
          continue;
        }
        const caps = capsOf(row);
        const current = draftWheelMode(row.draft, caps.hasColor, caps.hasTemp);
        if (current !== next && convertDraftTo(row.draft, next, caps)) {
          markers.get(id)?.g.classList.add("glide");
          changed.push(id);
        }
      }
      if (changed.length || drop.length) {
        emitChange({ dragging: false, ids: changed, deselected: drop });
      }
      window.setTimeout(() => {
        for (const id of changed) {
          markers.get(id)?.g.classList.remove("glide");
        }
      }, 450);
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
  chrome.addEventListener("scroll", updatePresetOverflow, { passive: true });
  ro?.observe(chrome);
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
    if (modifyPress) {
      window.removeEventListener("pointerup", modifyPress.onUp);
      window.removeEventListener("pointercancel", modifyPress.onUp);
      modifyPress = null;
    }
    clearDiskPress();
    if (glow.parentElement !== canvasWrap) {
      canvasWrap.insertBefore(glow, canvasWrap.firstChild);
    }
  };

  const detach = (id) => {
    if (!id) {
      return;
    }
    // One peeled pin, on its own color. Leaving the previous selection
    // detached fanned those dots off the disk when the next light was chosen.
    detached.clear();
    detached.add(id);
    sync();
  };

  const clearDetached = () => {
    detached.clear();
    sync();
  };

  return {
    el: stage,
    setMode,
    sync,
    syncPresets,
    attachGlow,
    disconnect,
    detach,
    clearDetached,
  };
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
  captureWheelPinPositions,
  captureWheelPinList,
  createSceneColorWheel,
  lightDraftFingerprint,
  HUE_WHEEL_RENDER,
  HUE_COLOR_PRESETS,
  HUE_TEMP_PRESETS,
  HUE_PIN_PATH,
  HUE_DOT_PATH,
  HUE_DOT_OUTLINE_PATH,
  HUE_PATH_STEPS,
  PIN_GROUP_FRAC,
  PIN_DRAG_THRESHOLD_PX,
  clusterNearbyPinIds,
  dropTargetIds,
  dragIdsForPin,
  splitIdsByWheelMode,
  disksUnsupportedByDrag,
  lightCanUsePalette,
  focusedDiskGeom,
  wheelPillModes,
  wheelStandIn,
  kelvinTrackDragPoint,
  diskHop,
  detachedAfterDrag,
  pinPressAction,
  groupRingPoints,
  placeTempInAnnulus,
};
