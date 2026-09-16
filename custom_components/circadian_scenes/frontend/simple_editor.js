/** Simple-scene editor: color wheel, light tiles, variable palette. */

import {
  applyVariableToDraft,
  createSceneColorWheel,
  draftRgb,
  lightWheelCaps,
} from "./color_ui.js";
import { variableIsPalette } from "./palette.js";
import {
  LIGHT_TILES_CSS,
  createLightTile,
  paintLightTile,
} from "./light_tiles.js";

export const SIMPLE_EDITOR_CSS = `
  /* Same stage column as .sun-light-clock: full width, no extra inset. */
  .simple-editor-host {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .simple-editor {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    width: 100%;
    min-width: 0;
    min-height: 0;
    padding: 40px 0 16px;
    box-sizing: border-box;
    gap: 16px;
  }
  .simple-wheels {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    max-width: none;
    min-width: 0;
    box-sizing: border-box;
    /* Keep .hue-wheel-chrome (mode pill + presets) off the Lys strip. */
    padding-bottom: 88px;
  }
  .simple-wheels .hue-wheel-stage {
    width: min(100%, 86vh, var(--dial-face-max, 86vh));
    max-width: min(100%, 86vh, var(--dial-face-max, 86vh));
    min-width: 0;
    margin: 0;
  }
  .var-palette {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: none;
    min-width: 0;
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
  ${LIGHT_TILES_CSS}
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
      if (draft.palette_t != null) {
        lights[eid].palette_t = draft.palette_t;
      }
      if (draft.palette_r != null) {
        lights[eid].palette_r = draft.palette_r;
      }
      if (draft.assignment_seed != null) {
        lights[eid].assignment_seed = draft.assignment_seed;
      }
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

  const memberCaps = members.map((id) =>
    lightWheelCaps(panel._hass?.states?.[id]?.attributes || {})
  );
  const hasColor = memberCaps.some((caps) => caps.hasColor);
  const hasTemp = memberCaps.some((caps) => caps.hasTemp);

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
        delete drafts[selectedId].palette_t;
        delete drafts[selectedId].palette_r;
      }
      persistLight(selectedId);
      const sel = tiles.querySelector(
        `.simple-light-selector[data-entity-id="${CSS.escape(selectedId)}"]`
      );
      if (dragging && sel && drafts[selectedId]) {
        paintSelector(sel, selectedId, drafts[selectedId]);
      } else if (!dragging) {
        syncTiles();
      }
    },
    hasColor,
    hasTemp,
    tempMin: 2000,
    tempMax: 6500,
    getCapabilities: (scene) =>
      lightWheelCaps(panel._hass?.states?.[scene.id]?.attributes || {}),
    getAssignmentSeed: () => Number(panel._formData?.assignment_seed) || 0,
    getAssignmentEntityId: (scene) => scene.id,
    onRandomizeSeed: () => {
      const seed = (Math.random() * 0xffffffff) >>> 0;
      panel._formData = { ...panel._formData, assignment_seed: seed };
      for (const eid of members) {
        const draft = drafts[eid];
        if (!draft) {
          continue;
        }
        delete draft.palette_t;
        delete draft.palette_r;
        const linked = variables.find((item) => item.id === draft.variable_ref);
        if (variableIsPalette(linked)) {
          applyVariableToDraft(draft, linked, {
            entityId: eid,
            seed,
            catalog: variables,
          });
        }
        persistLight(eid);
      }
      wheel.sync();
    },
    ...panel._wheelPalette(),
  });
  wheels.appendChild(wheel.el);
  wrap.appendChild(wheels);

  const scroller = document.createElement("div");
  scroller.className = "light-tiles-scroller";
  const tiles = document.createElement("div");
  tiles.className = "light-tiles";
  scroller.appendChild(tiles);
  wrap.appendChild(scroller);

  let pickerEl = null;
  const hidePicker = () => {
    pickerEl?.remove();
    pickerEl = null;
  };

  const showModePicker = (eid, clientX, clientY) => {
    hidePicker();
    pickerEl = document.createElement("div");
    pickerEl.className = "simple-mode-picker";
    const hostRect = wrap.getBoundingClientRect();
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
      persistLight(eid);
      syncTiles();
    });
    add("m-color", "mdi:palette", () => {
      selectedId = eid;
      wheel.setMode("color", { convertDraft: true });
      persistLight(eid);
      syncTiles();
    });
    add("m-var", "mdi:variable", () => {
      selectedId = eid;
      wrap.querySelector(".var-palette button")?.focus();
      syncTiles();
    });
    wrap.appendChild(pickerEl);
  };

  const fillPercent = (draft) => {
    const bri = Number(draft.brightness ?? 200);
    if (bri <= 0 || (draft.state || "on") === "off") {
      return 0;
    }
    return (bri / 255) * 100;
  };

  const paintSelector = (selector, eid, draft) => {
    paintLightTile(selector, {
      rgb: draftRgb(draft),
      fillPct: fillPercent(draft),
      selected: eid === selectedId,
    });
  };

  const syncTiles = () => {
    tiles.replaceChildren();
    hidePicker();
    for (const eid of members) {
      const draft = drafts[eid] || {};
      const state = panel._hass?.states?.[eid];
      const name =
        state?.attributes?.friendly_name || eid.replace(/^light\./, "");
      const { selector, tile, hit } = createLightTile({
        entityId: eid,
        name,
        makeIcon: () => lightIcon(panel, eid),
      });
      paintSelector(selector, eid, draft);

      let pressTimer = null;
      let drag = null;
      let wheelAxis = null;
      let wheelAxisTimer = null;

      const applyBri = (next) => {
        draft.brightness = Math.max(0, Math.min(255, Math.round(next)));
        persistLight(eid);
        paintSelector(selector, eid, draft);
      };

      const endDrag = (ev) => {
        if (!drag || (ev && ev.pointerId !== drag.pointerId)) {
          return;
        }
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        document.removeEventListener("pointermove", onDocMove);
        document.removeEventListener("pointerup", endDrag);
        document.removeEventListener("pointercancel", endDrag);
        try {
          tile.releasePointerCapture(drag.pointerId);
        } catch (_err) {
          /* already released */
        }
        const wasVertical = drag.axis === "y";
        const suppressTap = drag.suppressTap;
        drag = null;
        window.setTimeout(() => tile.classList.remove("dragging"), 250);
        if (wasVertical || suppressTap || pickerEl) {
          return;
        }
        selectedId = eid;
        wheel.sync();
        for (const other of tiles.querySelectorAll(".simple-light-selector")) {
          other.classList.toggle(
            "active",
            other.dataset.entityId === selectedId
          );
        }
      };

      const onDocMove = (ev) => {
        if (!drag || ev.pointerId !== drag.pointerId) {
          return;
        }
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        if (!drag.axis) {
          if (Math.hypot(dx, dy) < 8) {
            return;
          }
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
          hidePicker();
          if (Math.abs(dx) > Math.abs(dy)) {
            drag.axis = "x";
            drag.suppressTap = true;
            return;
          }
          drag.axis = "y";
          drag.suppressTap = true;
          tile.classList.add("dragging");
          try {
            tile.setPointerCapture(ev.pointerId);
          } catch (_err) {
            /* ignore */
          }
          return;
        }
        if (drag.axis !== "y") {
          return;
        }
        ev.preventDefault();
        const rect = tile.getBoundingClientRect();
        const fromBottom = rect.bottom - ev.clientY;
        applyBri((Math.max(0, Math.min(100, (fromBottom / rect.height) * 100)) / 100) * 255);
      };

      hit.addEventListener("pointerdown", (ev) => {
        if (ev.button && ev.button !== 0) {
          return;
        }
        drag = {
          pointerId: ev.pointerId,
          startX: ev.clientX,
          startY: ev.clientY,
          axis: null,
          suppressTap: false,
        };
        pressTimer = window.setTimeout(() => {
          pressTimer = null;
          drag.suppressTap = true;
          showModePicker(eid, ev.clientX, ev.clientY);
        }, 420);
        document.addEventListener("pointermove", onDocMove);
        document.addEventListener("pointerup", endDrag);
        document.addEventListener("pointercancel", endDrag);
      });

      tile.addEventListener(
        "wheel",
        (ev) => {
          const absX = Math.abs(ev.deltaX);
          const absY = Math.abs(ev.deltaY);
          const wantsHorizontal = ev.shiftKey || (absX > 0 && absX >= absY);
          if (wheelAxis === "x" || (wantsHorizontal && wheelAxis !== "y")) {
            wheelAxis = "x";
            window.clearTimeout(wheelAxisTimer);
            wheelAxisTimer = window.setTimeout(() => {
              wheelAxis = null;
            }, 180);
            return;
          }
          if (absY === 0) {
            return;
          }
          wheelAxis = "y";
          window.clearTimeout(wheelAxisTimer);
          wheelAxisTimer = window.setTimeout(() => {
            wheelAxis = null;
          }, 180);
          ev.preventDefault();
          tile.classList.add("wheel-adjusting");
          applyBri((draft.brightness ?? 200) - Math.sign(ev.deltaY) * 8);
          window.setTimeout(() => tile.classList.remove("wheel-adjusting"), 250);
        },
        { passive: false }
      );
      tiles.appendChild(selector);
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
