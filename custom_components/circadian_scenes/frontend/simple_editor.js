/** Simple-scene editor: color wheel, light tiles, variable palette. */

import {
  createSceneColorWheel,
  draftRgb,
  draftWheelMode,
} from "./color_ui.js";

export const SIMPLE_EDITOR_CSS = `
  .simple-editor {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 16px 48px;
    gap: 16px;
  }
  .simple-wheels {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: min(520px, 100%);
  }
  .simple-wheels .hue-wheel { flex: 1 1 auto; }
  .kelvin-crescent {
    width: 56px;
    height: min(420px, 70vw);
    border-radius: 0 28px 28px 0;
    position: relative;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15);
    flex: 0 0 56px;
  }
  .kelvin-crescent .k-handle {
    position: absolute;
    left: 50%;
    width: 18px;
    height: 18px;
    margin: -9px 0 0 -9px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    pointer-events: none;
  }
  .var-palette {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    width: min(520px, 100%);
  }
  .var-palette button {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.35);
    cursor: pointer;
    padding: 0;
  }
  .light-tiles {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    width: min(640px, 100%);
  }
  .light-tile {
    width: 92px;
    height: 72px;
    border-radius: 10px;
    border: 0;
    position: relative;
    overflow: hidden;
    color: #fff;
    cursor: ns-resize;
    padding: 0;
  }
  .light-tile .fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: currentColor;
    opacity: 0.85;
  }
  .light-tile .label {
    position: relative;
    z-index: 1;
    font-size: 11px;
    padding: 6px;
    text-shadow: 0 1px 2px #000;
  }
  .override-chip {
    font-size: 12px;
    color: var(--secondary-text-color);
  }
`;

function colorCss(color) {
  if (!color) {
    return "#555";
  }
  if (color.variable_ref) {
    return null;
  }
  if (color.color_temp_kelvin) {
    const t = Math.max(0, Math.min(1, (color.color_temp_kelvin - 2000) / 4000));
    return `rgb(255, ${Math.round(150 + t * 70)}, ${Math.round(90 + t * 130)})`;
  }
  if (color.hs_color) {
    return `hsl(${color.hs_color[0]}, ${color.hs_color[1]}%, 55%)`;
  }
  if (color.rgb_color) {
    return `rgb(${color.rgb_color[0]}, ${color.rgb_color[1]}, ${color.rgb_color[2]})`;
  }
  return "#555";
}

function resolveColor(color, variables) {
  if (color?.variable_ref) {
    const variable = variables.find((v) => v.id === color.variable_ref);
    return variable?.color || {};
  }
  return color || {};
}

export function renderSimpleEditor(panel, host) {
  const scene = panel._formData || {};
  const lights = { ...(scene.lights || {}) };
  const members = panel._simpleMembers || Object.keys(lights);
  const variables = panel._variables || [];
  const wrap = document.createElement("div");
  wrap.className = "simple-editor";

  const wheels = document.createElement("div");
  wheels.className = "simple-wheels";

  let selectedId = members[0] || null;
  const drafts = {};
  for (const eid of members) {
    const raw = lights[eid] || { state: "on", brightness: 200 };
    const color = resolveColor(raw, variables);
    drafts[eid] = {
      ...raw,
      ...color,
    };
  }

  const getState = () => ({
    scenes: members.map((id) => ({
      id,
      draft: drafts[id],
      label: id.replace(/^light\./, ""),
    })),
    activeId: selectedId,
  });

  const wheel = createSceneColorWheel({
    getState,
    onSelect: (id) => {
      selectedId = id;
      syncTiles();
    },
    onChange: ({ dragging }) => {
      if (!selectedId) {
        return;
      }
      const draft = drafts[selectedId];
      lights[selectedId] = {
        state: draft.state || "on",
        brightness: draft.brightness ?? 200,
        color_mode: draft.color_mode,
        color_temp_kelvin: draft.color_temp_kelvin,
        hs_color: draft.hs_color,
        rgb_color: draft.rgb_color,
      };
      delete lights[selectedId].variable_ref;
      panel._formData = { ...panel._formData, lights };
      panel._noteSimpleDirty();
      if (!dragging) {
        syncTiles();
      }
    },
    hasColor: true,
    hasTemp: true,
    tempMin: 2000,
    tempMax: 6500,
  });
  wheels.appendChild(wheel.el);

  const crescent = document.createElement("div");
  crescent.className = "kelvin-crescent";
  crescent.style.background =
    "linear-gradient(180deg, rgb(166,209,255) 0%, rgb(255,214,170) 55%, rgb(255,147,41) 100%)";
  const handle = document.createElement("div");
  handle.className = "k-handle";
  crescent.appendChild(handle);
  const placeHandle = (kelvin) => {
    const t = 1 - Math.max(0, Math.min(1, (kelvin - 2000) / 4500));
    handle.style.top = `${t * 100}%`;
    handle.style.background = colorCss({ color_temp_kelvin: kelvin });
  };
  const applyKelvin = (clientY) => {
    if (!selectedId) {
      return;
    }
    const rect = crescent.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const kelvin = Math.round(6500 - t * 4500);
    const draft = drafts[selectedId];
    draft.color_mode = "color_temp";
    draft.color_temp_kelvin = kelvin;
    delete draft.hs_color;
    delete draft.variable_ref;
    lights[selectedId] = { ...draft };
    placeHandle(kelvin);
    panel._formData = { ...panel._formData, lights };
    panel._noteSimpleDirty();
    wheel.sync();
  };
  crescent.addEventListener("pointerdown", (ev) => {
    crescent.setPointerCapture(ev.pointerId);
    applyKelvin(ev.clientY);
  });
  crescent.addEventListener("pointermove", (ev) => {
    if (ev.buttons) {
      applyKelvin(ev.clientY);
    }
  });
  wheels.appendChild(crescent);
  wrap.appendChild(wheels);

  const palette = document.createElement("div");
  palette.className = "var-palette";
  for (const variable of variables) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = variable.name;
    btn.style.background = colorCss(variable.color) || "#666";
    btn.addEventListener("click", () => {
      if (!selectedId) {
        return;
      }
      lights[selectedId] = {
        state: "on",
        brightness: drafts[selectedId]?.brightness ?? 200,
        variable_ref: variable.id,
      };
      drafts[selectedId] = {
        ...drafts[selectedId],
        ...variable.color,
        variable_ref: variable.id,
      };
      panel._formData = { ...panel._formData, lights };
      panel._noteSimpleDirty();
      wheel.sync();
      syncTiles();
    });
    palette.appendChild(btn);
  }
  wrap.appendChild(palette);

  const tiles = document.createElement("div");
  tiles.className = "light-tiles";
  wrap.appendChild(tiles);

  const syncTiles = () => {
    tiles.replaceChildren();
    for (const eid of members) {
      const draft = drafts[eid] || {};
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "light-tile";
      const rgb = draftRgb(draft);
      tile.style.color = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      tile.style.background = "#222";
      const fill = document.createElement("div");
      fill.className = "fill";
      const bri = Number(draft.brightness ?? 200) / 255;
      fill.style.height = `${Math.round(bri * 100)}%`;
      const label = document.createElement("div");
      label.className = "label";
      const state = panel._hass?.states?.[eid];
      label.textContent = state?.attributes?.friendly_name || eid.replace(/^light\./, "");
      tile.append(fill, label);
      tile.addEventListener("click", () => {
        selectedId = eid;
        wheel.sync();
        syncTiles();
      });
      tile.addEventListener(
        "wheel",
        (ev) => {
          ev.preventDefault();
          const next = Math.max(
            1,
            Math.min(255, (draft.brightness ?? 200) - Math.sign(ev.deltaY) * 8)
          );
          draft.brightness = next;
          lights[eid] = { ...(lights[eid] || {}), brightness: next };
          panel._formData = { ...panel._formData, lights };
          panel._noteSimpleDirty();
          syncTiles();
        },
        { passive: false }
      );
      tiles.appendChild(tile);
    }
  };
  syncTiles();
  const first = drafts[selectedId];
  if (first?.color_temp_kelvin) {
    placeHandle(first.color_temp_kelvin);
  } else {
    placeHandle(4000);
  }
  host.replaceChildren(wrap);
  wheel.sync();
}
