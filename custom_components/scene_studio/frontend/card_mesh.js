/** Circular light blooms for simple-scene cards, painted on one canvas. */

const EMPTY_COLOR = [35, 35, 35];

/** Scatter from the reference radial stack, plus one slot for an eighth color. */
const LIGHT_POSITIONS = [
  [0.4, 0.2],
  [0.8, 0],
  [0, 0.5],
  [0.86, 0.46],
  [0, 1],
  [0.8, 1],
  [0, 0],
  [0.55, 0.78],
];

/** Chromatic RGB scaled by brightness. Off, or brightness at or below 0, is black. */
export function scaledCardRgb(rgb, draft) {
  const channels = Array.isArray(rgb) ? rgb : [0, 0, 0];
  const off = (draft?.state || "on") === "off" || Number(draft?.brightness) <= 0;
  const scale = off ? 0 : (Number(draft?.brightness) || 0) / 255;
  return channels.map((channel) => Math.round(Number(channel) * scale));
}

export function meshColors(dots) {
  const colors = [];
  for (const dot of dots || []) {
    const rgb = dot?.rgb;
    if (
      !Array.isArray(rgb) ||
      rgb.length < 3 ||
      rgb.slice(0, 3).some((value) => !Number.isFinite(Number(value)))
    ) {
      continue;
    }
    const color = rgb.slice(0, 3).map((value) =>
      Math.max(0, Math.min(255, Number(value)))
    );
    if (!colors.some((current) => current.every((value, i) => value === color[i]))) {
      colors.push(color);
    }
    if (colors.length === 8) {
      break;
    }
  }
  return colors;
}

/** Half the distance from a unit-square point to the farthest corner. */
export function lightPointRadius(x, y) {
  const farthest = Math.max(
    Math.hypot(x, y),
    Math.hypot(1 - x, y),
    Math.hypot(x, 1 - y),
    Math.hypot(1 - x, 1 - y)
  );
  return farthest / 2;
}

/**
 * Base fill plus one circle per unique color.
 * A single color is a flat fill. Positions stay put for the same colors.
 */
export function lightPointLayout(colors) {
  const safe = colors?.length ? colors.slice(0, LIGHT_POSITIONS.length) : [EMPTY_COLOR];
  const base = safe[0];
  if (safe.length === 1) {
    return { base, points: [] };
  }
  const points = safe.map((rgb, index) => {
    const [x, y] = LIGHT_POSITIONS[index];
    return { x, y, rgb, radius: lightPointRadius(x, y) };
  });
  return { base, points };
}

function rgbCss(rgb, alpha = 1) {
  const [r, g, b] = rgb;
  if (alpha === 1) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function paintMeshPixels(canvas, dots) {
  const layout = lightPointLayout(meshColors(dots));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context || canvas.width < 1 || canvas.height < 1) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.globalCompositeOperation = "source-over";
  context.fillStyle = rgbCss(layout.base);
  context.fillRect(0, 0, width, height);
  for (const point of layout.points) {
    const px = point.x * width;
    const py = point.y * height;
    const farthest = Math.max(
      Math.hypot(px, py),
      Math.hypot(width - px, py),
      Math.hypot(px, height - py),
      Math.hypot(width - px, height - py)
    );
    const gradient = context.createRadialGradient(px, py, 0, px, py, farthest / 2);
    gradient.addColorStop(0, rgbCss(point.rgb));
    gradient.addColorStop(1, rgbCss(point.rgb, 0));
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
}

export function paintSimpleCardMesh(canvas, dots) {
  paintMeshPixels(canvas, dots);
}

export function createSimpleCardMesh(dots, { width = 192, height = 64 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "card-bg card-mesh";
  canvas.setAttribute("aria-hidden", "true");
  const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  paintMeshPixels(canvas, dots);
  return canvas;
}
