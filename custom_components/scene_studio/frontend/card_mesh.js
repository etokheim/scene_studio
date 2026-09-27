/**
 * Simple-scene cards use one shared WebGL mesh gradient.
 * The warp is the multiquadric used by meshgradient.com: destination points
 * pull a bilinear four-color field. Not one context per card.
 */

const EMPTY_COLOR = [35, 35, 35];
const MESH_S2 = 0.05;
const MAX_WARP_POINTS = 8;

/** Color knots sit inset, the way the meshgradient.com field does. */
const MESH_PRESETS = [
  {
    sources: [
      [-0.85, -0.9],
      [-0.322, 0.538],
      [0.669, -0.772],
      [0.95, 0.9],
      [-0.053, 0.484],
      [0.797, -0.205],
      [0.031, 0.494],
    ],
    dests: [
      [-0.85, -0.9],
      [-0.95, 0.9],
      [-0.934, -0.5],
      [0.95, 0.9],
      [-0.625, 0.225],
      [0.544, -0.134],
      [-0.649, -0.061],
    ],
    quad: [
      [0.31, 0.3],
      [0.7, 0.32],
      [0.28, 0.71],
      [0.72, 0.75],
    ],
  },
  {
    sources: [
      [-0.72, -0.78],
      [0.7, -0.62],
      [-0.66, 0.74],
      [0.78, 0.68],
      [0.05, -0.08],
      [-0.28, 0.22],
      [0.32, 0.18],
    ],
    dests: [
      [-0.92, -0.88],
      [0.9, -0.84],
      [-0.88, 0.9],
      [0.86, 0.92],
      [0.02, -0.22],
      [-0.4, 0.08],
      [0.22, 0.36],
    ],
    quad: [
      [0.18, 0.22],
      [0.82, 0.2],
      [0.16, 0.8],
      [0.84, 0.78],
    ],
  },
  {
    sources: [
      [-0.8, -0.2],
      [0.15, -0.75],
      [-0.2, 0.8],
      [0.82, 0.35],
      [-0.35, 0.15],
      [0.4, -0.15],
      [0.1, 0.42],
    ],
    dests: [
      [-0.55, -0.7],
      [0.72, -0.48],
      [-0.78, 0.42],
      [0.48, 0.86],
      [-0.12, -0.05],
      [0.18, 0.22],
      [0.42, -0.28],
    ],
    quad: [
      [0.22, 0.55],
      [0.78, 0.28],
      [0.25, 0.82],
      [0.8, 0.62],
    ],
  },
  {
    sources: [
      [-0.6, -0.85],
      [0.55, -0.8],
      [-0.75, 0.45],
      [0.4, 0.7],
      [0.0, 0.05],
      [0.62, 0.12],
      [-0.22, -0.28],
    ],
    dests: [
      [-0.88, -0.42],
      [0.86, -0.9],
      [-0.4, 0.88],
      [0.9, 0.4],
      [-0.08, 0.18],
      [0.36, -0.22],
      [-0.48, 0.05],
    ],
    quad: [
      [0.38, 0.36],
      [0.62, 0.34],
      [0.36, 0.66],
      [0.64, 0.68],
    ],
  },
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

function cornerColors(colors, turn) {
  let corners;
  if (colors.length === 2) {
    corners = [colors[0], colors[1], colors[1], colors[0]];
  } else if (colors.length === 3) {
    corners = [colors[0], colors[1], colors[2], colors[1]];
  } else {
    corners = [0, 1, 2, 3].map((index) => colors[Math.min(index, colors.length - 1)]);
  }
  const shift = turn % 4;
  return corners.slice(shift).concat(corners.slice(0, shift));
}

/** Stable for a scene's lights. Channel values are not part of the hash, so a brightness drag does not swap the warp. */
export function meshPresetIndex(dots) {
  let hash = 0;
  for (const dot of dots || []) {
    const id = dot?.entity_id || "";
    for (let i = 0; i < id.length; i += 1) {
      hash = (Math.imul(hash, 33) + id.charCodeAt(i)) >>> 0;
    }
  }
  return hash % MESH_PRESETS.length;
}

export function meshGradientPlan(dots) {
  const colors = meshColors(dots);
  const lit = colors.filter((rgb) => rgb.some((channel) => channel > 0));
  const used = lit.length ? lit : colors;
  if (used.length <= 1) {
    return {
      flat: true,
      color: used[0] || EMPTY_COLOR,
      corners: null,
      preset: 0,
    };
  }
  const preset = meshPresetIndex(dots);
  return {
    flat: false,
    color: used[0],
    corners: cornerColors(used, preset),
    preset,
  };
}

/** Weights so the multiquadric at each destination point equals that source point. */
export function solveMeshWarp(sources, dests, s2 = MESH_S2) {
  const n = sources.length;
  if (n !== dests.length || n < 1 || n > MAX_WARP_POINTS) {
    throw new Error(`mesh warp expects 1–${MAX_WARP_POINTS} paired points`);
  }
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const row = [];
    for (let j = 0; j < n; j += 1) {
      const dx = dests[i][0] - dests[j][0];
      const dy = dests[i][1] - dests[j][1];
      row.push(Math.sqrt(dx * dx + dy * dy + s2));
    }
    row.push(sources[i][0], sources[i][1]);
    rows.push(row);
  }
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(rows[pivot][col]) < 1e-8) {
      throw new Error("mesh warp matrix is singular");
    }
    if (pivot !== col) {
      const swap = rows[col];
      rows[col] = rows[pivot];
      rows[pivot] = swap;
    }
    const divisor = rows[col][col];
    for (let colIndex = col; colIndex < n + 2; colIndex += 1) {
      rows[col][colIndex] /= divisor;
    }
    for (let row = 0; row < n; row += 1) {
      if (row === col) {
        continue;
      }
      const factor = rows[row][col];
      for (let colIndex = col; colIndex < n + 2; colIndex += 1) {
        rows[row][colIndex] -= factor * rows[col][colIndex];
      }
    }
  }
  return rows.map((row) => [row[n], row[n + 1]]);
}

export function evaluateMeshWarp(point, dests, weights, s2 = MESH_S2) {
  let x = 0;
  let y = 0;
  for (let i = 0; i < dests.length; i += 1) {
    const dx = point[0] - dests[i][0];
    const dy = point[1] - dests[i][1];
    const kernel = Math.sqrt(dx * dx + dy * dy + s2);
    x += kernel * weights[i][0];
    y += kernel * weights[i][1];
  }
  return [x, y];
}

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision highp float;
uniform vec3 u_colors[4];
uniform vec2 u_quad[4];
uniform vec2 u_points[8];
uniform vec2 u_weights[8];
uniform int u_npoints;
uniform float u_s2;
varying vec2 v_uv;

vec3 grad(vec2 uv) {
  vec2 P0 = u_quad[0];
  vec2 P1 = u_quad[1];
  vec2 P2 = u_quad[2];
  vec2 P3 = u_quad[3];
  vec2 Q = P0 - P2;
  vec2 R = P1 - P0;
  vec2 S = R + P2 - P3;
  vec2 T = P0 - uv;
  float u;
  float t;
  if (Q.x == 0.0 && S.x == 0.0) {
    u = -T.x / R.x;
    t = (T.y + u * R.y) / (Q.y + u * S.y);
  } else if (Q.y == 0.0 && S.y == 0.0) {
    u = -T.y / R.y;
    t = (T.x + u * R.x) / (Q.x + u * S.x);
  } else {
    float A = S.x * R.y - R.x * S.y;
    float B = S.x * T.y - T.x * S.y + Q.x * R.y - R.x * Q.y;
    float C = Q.x * T.y - T.x * Q.y;
    float disc = max(B * B - 4.0 * A * C, 0.0);
    if (abs(A) < 0.0001) {
      u = -C / B;
    } else {
      u = (-B + sqrt(disc)) / (2.0 * A);
    }
    t = (T.y + u * R.y) / (Q.y + u * S.y);
  }
  u = smoothstep(0.0, 1.0, clamp(u, 0.0, 1.0));
  t = smoothstep(0.0, 1.0, clamp(t, 0.0, 1.0));
  vec3 colorA = mix(u_colors[0], u_colors[1], u);
  vec3 colorB = mix(u_colors[2], u_colors[3], u);
  return mix(colorA, colorB, t);
}

void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  vec2 q = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= u_npoints) {
      continue;
    }
    vec2 delta = p - u_points[i];
    float kernel = sqrt(dot(delta, delta) + u_s2);
    q += kernel * u_weights[i];
  }
  gl_FragColor = vec4(grad((q + 1.0) / 2.0), 1.0);
}
`;

let glCanvas = null;
let gl = null;
let program = null;
let buffer = null;
let uniforms = null;

function compile(context, type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    const log = context.getShaderInfoLog(shader);
    context.deleteShader(shader);
    throw new Error(log || "mesh shader failed to compile");
  }
  return shader;
}

function sharedGl() {
  if (gl && !gl.isContextLost()) {
    return gl;
  }
  glCanvas = document.createElement("canvas");
  gl = glCanvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) {
    throw new Error("WebGL is required to paint the scene card mesh");
  }
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "mesh program failed to link");
  }
  buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  uniforms = {
    colors: gl.getUniformLocation(program, "u_colors"),
    quad: gl.getUniformLocation(program, "u_quad"),
    points: gl.getUniformLocation(program, "u_points"),
    weights: gl.getUniformLocation(program, "u_weights"),
    npoints: gl.getUniformLocation(program, "u_npoints"),
    s2: gl.getUniformLocation(program, "u_s2"),
  };
  return gl;
}

function padPairs(pairs) {
  const out = new Float32Array(MAX_WARP_POINTS * 2);
  pairs.forEach((pair, index) => {
    out[index * 2] = pair[0];
    out[index * 2 + 1] = pair[1];
  });
  return out;
}

function paintFlat(canvas, color) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context || canvas.width < 1 || canvas.height < 1) {
    return;
  }
  context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function paintShader(canvas, plan) {
  const context = sharedGl();
  const preset = MESH_PRESETS[plan.preset];
  const weights = solveMeshWarp(preset.sources, preset.dests);
  if (glCanvas.width !== canvas.width || glCanvas.height !== canvas.height) {
    glCanvas.width = canvas.width;
    glCanvas.height = canvas.height;
  }
  context.viewport(0, 0, canvas.width, canvas.height);
  context.useProgram(program);
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.enableVertexAttribArray(0);
  context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);
  const colorData = new Float32Array(12);
  plan.corners.forEach((rgb, index) => {
    colorData[index * 3] = rgb[0] / 255;
    colorData[index * 3 + 1] = rgb[1] / 255;
    colorData[index * 3 + 2] = rgb[2] / 255;
  });
  context.uniform3fv(uniforms.colors, colorData);
  context.uniform2fv(uniforms.quad, padPairs(preset.quad).subarray(0, 8));
  context.uniform2fv(uniforms.points, padPairs(preset.dests));
  context.uniform2fv(uniforms.weights, padPairs(weights));
  context.uniform1i(uniforms.npoints, preset.dests.length);
  context.uniform1f(uniforms.s2, MESH_S2);
  context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
  const target = canvas.getContext("2d", { alpha: false });
  target.drawImage(glCanvas, 0, 0);
}

function paintMeshPixels(canvas, dots) {
  if (canvas.width < 1 || canvas.height < 1) {
    return;
  }
  const plan = meshGradientPlan(dots);
  if (plan.flat) {
    paintFlat(canvas, plan.color);
    return;
  }
  paintShader(canvas, plan);
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
