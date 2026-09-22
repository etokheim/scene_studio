/** Deterministic, rasterized 2D color mesh for simple-scene cards. */

const GRID_COLUMNS = 4;
const GRID_ROWS = 3;

function srgbToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel) {
  const value =
    channel <= 0.0031308
      ? channel * 12.92
      : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
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

function vertexColor(colors, column, row) {
  if (!colors.length) {
    return [35, 35, 35];
  }
  if (colors.length === 1) {
    return colors[0];
  }
  // Prime strides avoid rows becoming repeated bands while keeping placement
  // stable when the same scene is rendered again.
  return colors[(column * 5 + row * 3 + column * row) % colors.length];
}

function mixLinear(colors, weights) {
  return [0, 1, 2].map((channel) => {
    const linear = colors.reduce(
      (sum, color, index) =>
        sum + srgbToLinear(color[channel]) * weights[index],
      0
    );
    return linearToSrgb(linear);
  });
}

/** Sample the triangle mesh at normalized coordinates. Exported for tests. */
export function sampleMeshColor(colors, x, y) {
  const safeColors = colors?.length ? colors : [[35, 35, 35]];
  const px = Math.max(0, Math.min(1, x)) * (GRID_COLUMNS - 1);
  const py = Math.max(0, Math.min(1, y)) * (GRID_ROWS - 1);
  const column = Math.min(GRID_COLUMNS - 2, Math.floor(px));
  const row = Math.min(GRID_ROWS - 2, Math.floor(py));
  const fx = px - column;
  const fy = py - row;
  const topLeft = vertexColor(safeColors, column, row);
  const topRight = vertexColor(safeColors, column + 1, row);
  const bottomLeft = vertexColor(safeColors, column, row + 1);
  const bottomRight = vertexColor(safeColors, column + 1, row + 1);

  if (fx + fy <= 1) {
    return mixLinear(
      [topLeft, topRight, bottomLeft],
      [1 - fx - fy, fx, fy]
    );
  }
  return mixLinear(
    [bottomRight, bottomLeft, topRight],
    [fx + fy - 1, 1 - fx, 1 - fy]
  );
}

function paintMeshPixels(canvas, dots) {
  const colors = meshColors(dots);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context || canvas.width < 1 || canvas.height < 1) {
    return;
  }
  const image = context.createImageData(canvas.width, canvas.height);
  for (let py = 0; py < canvas.height; py += 1) {
    for (let px = 0; px < canvas.width; px += 1) {
      const rgb = sampleMeshColor(
        colors,
        px / Math.max(1, canvas.width - 1),
        py / Math.max(1, canvas.height - 1)
      );
      const offset = (py * canvas.width + px) * 4;
      // A small single-pass darkening keeps white card labels legible without
      // stacking translucent CSS gradient layers over the mesh.
      image.data[offset] = Math.round(rgb[0] * 0.82);
      image.data[offset + 1] = Math.round(rgb[1] * 0.82);
      image.data[offset + 2] = Math.round(rgb[2] * 0.82);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
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
