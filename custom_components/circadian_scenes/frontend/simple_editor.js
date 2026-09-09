/** Simple-scene editor: color wheel, light tiles, variable palette. */

import {
  createSceneColorWheel,
  draftRgb,
} from "./color_ui.js";

export const SIMPLE_EDITOR_CSS = `
  .simple-editor {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 0;
    padding: 0 16px 48px;
    box-sizing: border-box;
    gap: 16px;
  }
  .simple-wheels {
    display: flex;
    align-items: center;
    justify-content: center;
    width: min(100%, 86vh, var(--dial-face-max, 86vh));
  }
  .simple-wheels .hue-wheel-stage {
    width: 100%;
    max-width: none;
    margin: 0;
  }
  .var-palette {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    width: min(100%, 86vh, var(--dial-face-max, 86vh));
  }
  .scene-sidebar .var-palette {
    width: 100%;
    justify-content: flex-start;
    margin: 12px 0 8px;
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
    justify-content: center;
    gap: 12px 16px;
    width: min(100%, 86vh, var(--dial-face-max, 86vh));
    padding: 8px 0 24px;
    position: relative;
  }
  .simple-light-tile {
    width: 72px;
    min-height: 92px;
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    position: relative;
    touch-action: none;
    user-select: none;
  }
  .simple-light-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    position: relative;
    overflow: hidden;
    background: #1a1a1a;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }
  .simple-light-tile.selected .simple-light-icon {
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,0.2),
      0 0 0 2px var(--primary-color, #03a9f4);
  }
  .simple-light-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: currentColor;
    opacity: 0.92;
    pointer-events: none;
  }
  .simple-light-icon ha-state-icon,
  .simple-light-icon ha-icon {
    position: relative;
    z-index: 1;
    --mdc-icon-size: 26px;
    width: 26px;
    height: 26px;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.55));
  }
  .simple-light-name {
    font-size: 11px;
    line-height: 1.2;
    text-align: center;
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 2px rgba(0,0,0,0.45);
  }
  .simple-mode-picker {
    position: absolute;
    z-index: 6;
    width: 132px;
    height: 132px;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .simple-mode-picker button {
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: 0;
    pointer-events: auto;
    cursor: pointer;
    color: #fff;
    background: color-mix(in srgb, var(--card-background-color, #222) 88%, transparent);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .simple-mode-picker button ha-icon {
    --mdc-icon-size: 22px;
  }
  .simple-mode-picker .m-bri { left: 46px; top: 0; }
  .simple-mode-picker .m-temp { right: 0; top: 46px; }
  .simple-mode-picker .m-color { left: 46px; bottom: 0; }
  .simple-mode-picker .m-var { left: 0; top: 46px; }
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

function lightIcon(panel, entityId) {
  return panel._entityStateIcon
    ? panel._entityStateIcon(entityId, "mdi:lightbulb")
    : (() => {
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", "mdi:lightbulb");
        return icon;
      })();
}

export function renderSimpleEditor(panel, host, { glowHost } = {}) {
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

  const persistLight = (eid) => {
    const draft = drafts[eid];
    if (!draft) {
      return;
    }
    if (draft.variable_ref) {
      lights[eid] = {
        state: draft.state || "on",
        brightness: draft.brightness ?? 200,
        variable_ref: draft.variable_ref,
      };
    } else {
      lights[eid] = {
        state: draft.state || "on",
        brightness: draft.brightness ?? 200,
        color_mode: draft.color_mode,
        color_temp_kelvin: draft.color_temp_kelvin,
        hs_color: draft.hs_color,
        rgb_color: draft.rgb_color,
      };
      delete lights[eid].variable_ref;
    }
    panel._formData = { ...panel._formData, lights };
    panel._noteSimpleDirty();
  };

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
    onChange: ({ dragging, fromPalette } = {}) => {
      if (!selectedId) {
        return;
      }
      if (!fromPalette) {
        delete drafts[selectedId].variable_ref;
      }
      persistLight(selectedId);
      if (!dragging) {
        syncTiles();
      }
    },
    hasColor: true,
    hasTemp: true,
    tempMin: 2000,
    tempMax: 6500,
    ...panel._wheelPalette(),
  });
  wheels.appendChild(wheel.el);
  wrap.appendChild(wheels);

  const tiles = document.createElement("div");
  tiles.className = "light-tiles";
  wrap.appendChild(tiles);

  let pickerEl = null;
  const hidePicker = () => {
    pickerEl?.remove();
    pickerEl = null;
  };

  const showModePicker = (tile, eid, clientX, clientY) => {
    hidePicker();
    pickerEl = document.createElement("div");
    pickerEl.className = "simple-mode-picker";
    const hostRect = tiles.getBoundingClientRect();
    pickerEl.style.left = `${clientX - hostRect.left}px`;
    pickerEl.style.top = `${clientY - hostRect.top}px`;
    const add = (cls, icon, onPick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      const haIcon = document.createElement("ha-icon");
      haIcon.setAttribute("icon", icon);
      btn.appendChild(haIcon);
      btn.addEventListener("pointerup", (ev) => {
        ev.stopPropagation();
        onPick();
        hidePicker();
      });
      pickerEl.appendChild(btn);
    };
    add("m-bri", "mdi:brightness-6", () => {
      selectedId = eid;
      wheel.sync();
      syncTiles();
    });
    add("m-temp", "mdi:thermometer", () => {
      selectedId = eid;
      wheel.setMode("temp", { convertDraft: true });
      syncTiles();
    });
    add("m-color", "mdi:palette", () => {
      selectedId = eid;
      wheel.setMode("color", { convertDraft: true });
      syncTiles();
    });
    add("m-var", "mdi:variable", () => {
      selectedId = eid;
      palette.querySelector("button")?.focus();
      syncTiles();
    });
    tiles.appendChild(pickerEl);
  };

  const syncTiles = () => {
    tiles.replaceChildren();
    hidePicker();
    for (const eid of members) {
      const draft = drafts[eid] || {};
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "simple-light-tile";
      if (eid === selectedId) {
        tile.classList.add("selected");
      }
      const rgb = draftRgb(draft);
      const iconWrap = document.createElement("div");
      iconWrap.className = "simple-light-icon";
      iconWrap.style.color = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      const fill = document.createElement("div");
      fill.className = "simple-light-fill";
      const bri = Number(draft.brightness ?? 200) / 255;
      fill.style.height = `${Math.round(bri * 100)}%`;
      iconWrap.append(fill, lightIcon(panel, eid));
      const label = document.createElement("div");
      label.className = "simple-light-name";
      const state = panel._hass?.states?.[eid];
      label.textContent =
        state?.attributes?.friendly_name || eid.replace(/^light\./, "");
      tile.append(iconWrap, label);

      let pressTimer = null;
      let dragging = false;
      let startY = 0;
      let startBri = 0;
      const applyBri = (next) => {
        draft.brightness = Math.max(1, Math.min(255, Math.round(next)));
        persistLight(eid);
        fill.style.height = `${Math.round((draft.brightness / 255) * 100)}%`;
      };
      tile.addEventListener("pointerdown", (ev) => {
        tile.setPointerCapture(ev.pointerId);
        startY = ev.clientY;
        startBri = draft.brightness ?? 200;
        dragging = false;
        pressTimer = window.setTimeout(() => {
          pressTimer = null;
          showModePicker(tile, eid, ev.clientX, ev.clientY);
        }, 420);
      });
      tile.addEventListener("pointermove", (ev) => {
        if (!tile.hasPointerCapture(ev.pointerId)) {
          return;
        }
        const dy = startY - ev.clientY;
        if (!dragging && Math.abs(dy) > 8) {
          dragging = true;
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
          hidePicker();
        }
        if (dragging) {
          applyBri(startBri + dy * 1.6);
        }
      });
      tile.addEventListener("pointerup", (ev) => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        try {
          tile.releasePointerCapture(ev.pointerId);
        } catch (_err) {
          /* already released */
        }
        if (dragging) {
          syncTiles();
          return;
        }
        if (pickerEl) {
          return;
        }
        selectedId = eid;
        wheel.sync();
        syncTiles();
      });
      tile.addEventListener(
        "wheel",
        (ev) => {
          ev.preventDefault();
          applyBri((draft.brightness ?? 200) - Math.sign(ev.deltaY) * 8);
          syncTiles();
        },
        { passive: false }
      );
      tiles.appendChild(tile);
    }
  };
  syncTiles();
  host.replaceChildren(wrap);
  wheel.sync();
  if (glowHost && typeof wheel.attachGlow === "function") {
    panel._simpleWheelGlowLayout = wheel.attachGlow(glowHost);
    requestAnimationFrame(() => panel._simpleWheelGlowLayout?.());
  } else {
    panel._simpleWheelGlowLayout = null;
  }
}
