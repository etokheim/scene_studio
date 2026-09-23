/** Simple-scene editor: color wheel, light tiles, variable palette. */

import {
  applyVariableToDraft,
  colorPayloadFromDraft,
  createSceneColorWheel,
  draftRgb,
  lightWheelCaps,
  wheelStandIn,
} from "./color_ui.js";
import { scaledCardRgb } from "./card_mesh.js";
import { PALETTE_SLOT_COUNT, variableIsPalette } from "./palette.js";
import {
  LIGHT_TILES_CSS,
  TILE_BRIGHTNESS_WHEEL_STEP,
  attachLightRemove,
  attachLightSettings,
  binaryDragPreview,
  binaryWheelPreview,
  captureLightStripLayout,
  createAddLightTile,
  createLightModeGroup,
  createLightTile,
  playLightStripLayout,
  playLightTileJelly,
  lightTileColorGroup,
  lightTileGroupOrder,
  lightTileValueLabel,
  paintLightTile,
  relativeFillPercent,
  selectAllDisplayedFill,
  selectAllOnOffState,
  tileSelectionAfterClick,
  wheelDeltaToPercent,
} from "./light_tiles.js";

export const SIMPLE_EDITOR_CSS = `
  /* Same stage column as .sun-light-clock: full width, no extra inset. */
  .simple-editor-host {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
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
    flex: 1 1 auto;
    height: 100%;
    padding: 40px 0 16px;
    box-sizing: border-box;
    gap: 16px;
  }
  .simple-wheels {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 auto;
    width: 100%;
    max-width: none;
    min-width: 0;
    box-sizing: border-box;
    /* WHEEL_FACE_MIN_PX plus mode row (48), stage gap (16), and this padding.
       The scrollport scrolls once the disk cannot shrink further. */
    min-height: calc(400px + 48px + 16px + 24px);
    padding-bottom: 24px;
    container-type: size;
    container-name: wheel;
  }
  .simple-wheels .hue-wheel-stage {
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: 100%;
    min-width: 0;
    min-height: 0;
    margin: 0;
    flex: 1 1 auto;
  }
  .simple-wheels .hue-wheel-stage[hidden] {
    display: none;
  }
  .simple-level-host {
    width: min(100%, 420px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    box-sizing: border-box;
    margin: 0 auto;
  }
  .simple-level-host[hidden] {
    display: none;
  }
  .simple-level-readout {
    text-align: center;
  }
  .simple-level-value {
    font-size: 48px;
    font-weight: 400;
    line-height: 1.1;
    color: var(--primary-text-color);
  }
  .simple-level-ago {
    display: block;
    margin-top: 4px;
    font-size: 16px;
    color: var(--secondary-text-color);
  }
  .simple-level-controls {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 16px;
  }
  .simple-level-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .simple-level-glow {
    position: relative;
    display: flex;
    justify-content: center;
  }
  .simple-level-glow::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: var(--ha-border-radius-6xl, 36px);
    background: var(--simple-level-color, #ffc107);
    filter: blur(54px) saturate(1.45);
    opacity: 0.55;
    transform: scale(1.1);
    transform-origin: center center;
    z-index: 0;
    pointer-events: none;
  }
  .simple-level-glow > * {
    position: relative;
    z-index: 1;
  }
  .simple-level-host ha-control-slider,
  .simple-level-host ha-control-switch {
    height: 45vh;
    min-height: 200px;
    max-height: 320px;
    --control-slider-thickness: 130px;
    --control-slider-border-radius: var(--ha-border-radius-6xl, 36px);
    --control-slider-color: var(--simple-level-color, #ffc107);
    --control-switch-thickness: 130px;
    --control-switch-border-radius: var(--ha-border-radius-6xl, 36px);
    --control-switch-padding: 6px;
    --mdc-icon-size: 24px;
    --control-switch-on-color: var(--simple-level-color, #ffc107);
  }
  .simple-level-host ha-control-switch {
    width: var(--control-switch-thickness);
  }
  .simple-level-host ha-control-slider {
    width: var(--control-slider-thickness);
  }
  .simple-level-host ha-control-button {
    width: 48px;
    height: 48px;
    --mdc-icon-size: 24px;
    color: var(--primary-text-color);
  }
  .simple-editor .library-name-field {
    width: min(100%, 650px);
    margin: 0 auto;
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

function entityMdiIcon(panel, entityId) {
  const state = panel._hass?.states?.[entityId];
  const entry = panel._hass?.entities?.[entityId];
  return state?.attributes?.icon || entry?.icon || "mdi:lightbulb";
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
  let members = panel._simpleMembers || Object.keys(lights);
  let removedMembers = [];
  const variables = panel._variables || [];
  const wrap = document.createElement("div");
  wrap.className = "simple-editor";

  const wheels = document.createElement("div");
  wheels.className = "simple-wheels";

  let selectedIds = new Set(members[0] ? [members[0]] : []);
  let touchSelectMode = false;
  let peeledId = null;
  let anchorId = members[0] || null;
  let stripOrderIds = [];
  let pinClusters = [];
  const selectedMemberIds = () => members.filter((id) => selectedIds.has(id));
  const inSelectMode = () =>
    touchSelectMode || selectedMemberIds().length > 1;
  const scrubTargets = () => (inSelectMode() ? selectedMemberIds() : members);
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
    // Snapshot the scene before this write so undo can restore it.
    panel._beginSimpleUndo?.();
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
    paintCard();
    panel._scheduleScenePreviewApply?.({ transition: 1 });
  };

  const isOnOffLight = (eid) => {
    const modes =
      panel._hass?.states?.[eid]?.attributes?.supported_color_modes || [];
    return modes.length > 0 && modes.every((mode) => mode === "onoff");
  };

  const groupCaps = (eid) => {
    const attrs = panel._hass?.states?.[eid]?.attributes || {};
    const modes = attrs.supported_color_modes || [];
    if (!modes.length) {
      return undefined;
    }
    const caps = lightWheelCaps(attrs);
    return { known: true, hasColor: caps.hasColor, hasTemp: caps.hasTemp };
  };

  const groupOf = (eid) => lightTileColorGroup(drafts[eid], groupCaps(eid));

  const cardDots = () =>
    members.map((eid) => {
      const draft = drafts[eid] || {};
      return {
        entity_id: eid,
        rgb: scaledCardRgb(draftRgb(draft), draft),
      };
    });

  const paintCard = () => {
    panel._paintSimpleSceneCard?.(cardDots());
  };

  const memberCaps = members.map((id) =>
    lightWheelCaps(panel._hass?.states?.[id]?.attributes || {})
  );
  const hasColor = memberCaps.some((caps) => caps.hasColor);
  const hasTemp = memberCaps.some((caps) => caps.hasTemp);
  let stripGroupSignature = "";

  const getState = () => ({
    scenes: members.map((id) => ({
      id,
      draft: drafts[id],
      label: id.replace(/^light\./, ""),
      icon: entityMdiIcon(panel, id),
    })),
    activeId: [...selectedIds][0] || null,
    selectedIds: [...selectedIds],
    peeledId,
  });

  const wheel = createSceneColorWheel({
    t: (key, fallback) => panel._t(key, fallback),
    getState,
    showPath: false,
    groupNearby: true,
    getPinIcon: (scene) => entityMdiIcon(panel, scene.id),
    moveOnEmptyDisk: false,
    onClusters: (clusters) => {
      pinClusters = clusters || [];
      paintTileSelection();
    },
    onSelect: (id, mods) => {
      if (id && (mods?.shiftKey || mods?.toggleKey)) {
        const result = tileSelectionAfterClick({
          ids: stripOrderIds.length ? stripOrderIds : members,
          selected: [...selectedIds],
          anchorId,
          entityId: id,
          shiftKey: false,
          toggleKey: true,
        });
        selectedIds = new Set(result.selected);
        anchorId = result.anchorId;
        peeledId = null;
        wheel.clearDetached?.();
        if (selectedIds.size === 0) {
          touchSelectMode = false;
        }
      } else {
        touchSelectMode = false;
        selectedIds = new Set(id ? [id] : []);
        peeledId = id || null;
        if (id) {
          anchorId = id;
        }
      }
      paintTileSelection();
      syncLevelHost();
      wheel.sync();
    },
    onChange: ({ dragging, fromPalette, ids, deselected } = {}) => {
      if (dragging) {
        panel._holdSimpleUndo?.(true);
      }
      try {
        if (deselected?.length) {
          for (const id of deselected) {
            selectedIds.delete(id);
            if (peeledId === id) {
              peeledId = null;
            }
          }
          paintTileSelection();
        }
        const write = ids?.length ? ids : deselected?.length ? [] : [...selectedIds];
        if (!write.length) {
          return;
        }
        for (const eid of write) {
          if (!drafts[eid]) {
            continue;
          }
          if (!fromPalette) {
            delete drafts[eid].variable_ref;
            delete drafts[eid].palette_t;
            delete drafts[eid].palette_r;
          }
          persistLight(eid);
        }
        const nextGroups = members
          .map((id) => `${id}:${groupOf(id)}`)
          .join("|");
        if (nextGroups !== stripGroupSignature) {
          syncTiles();
          return;
        }
        for (const eid of write) {
          const sel = tiles.querySelector(
            `.simple-light-selector[data-entity-id="${CSS.escape(eid)}"]`
          );
          if (sel && drafts[eid]) {
            paintSelector(sel, eid, drafts[eid]);
          }
        }
        if (!dragging) {
          paintSelectAll();
        }
      } finally {
        if (!dragging) {
          panel._holdSimpleUndo?.(false);
        }
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
      panel._beginSimpleUndo?.();
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
  const levelHost = document.createElement("div");
  levelHost.className = "simple-level-host";
  levelHost.hidden = true;
  wheels.appendChild(levelHost);
  wrap.appendChild(wheels);

  const scroller = document.createElement("div");
  scroller.className = "light-tiles-scroller";
  const tiles = document.createElement("div");
  tiles.className = "light-tiles";
  scroller.appendChild(tiles);
  wrap.appendChild(scroller);
  scroller.addEventListener("keydown", (ev) => {
    const meta = ev.metaKey || ev.ctrlKey;
    if (meta && ev.key.toLowerCase() === "a") {
      ev.preventDefault();
      selectedIds = new Set(members);
      peeledId = null;
      anchorId = stripOrderIds[0] || members[0] || null;
      wheel.clearDetached?.();
      wheel.sync();
      paintTileSelection();
      return;
    }
    const current = ev.target.closest?.(".simple-light-selector");
    const eid = current?.dataset?.entityId;
    if (!eid || eid === "__select_all__" || !stripOrderIds.includes(eid)) {
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      applyTileClick(eid, ev);
      return;
    }
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") {
      return;
    }
    const index = stripOrderIds.indexOf(eid);
    const next = stripOrderIds[index + (ev.key === "ArrowRight" ? 1 : -1)];
    if (!next) {
      return;
    }
    ev.preventDefault();
    if (ev.shiftKey) {
      applyTileClick(next, ev);
    } else {
      touchSelectMode = false;
      selectedIds = new Set([next]);
      anchorId = next;
      peeledId = next;
      wheel.detach?.(next);
      paintTileSelection();
      wheel.sync();
      syncLevelHost();
    }
    scroller.querySelector(
      `.simple-light-selector[data-entity-id="${CSS.escape(next)}"]`
    )?.focus();
  });

  const applyTileClick = (eid, ev) => {
    const plain = !ev?.shiftKey && !ev?.metaKey && !ev?.ctrlKey;
    const wasSelectMode = inSelectMode();
    const result = tileSelectionAfterClick({
      ids: stripOrderIds.length ? stripOrderIds : members,
      selected: [...selectedIds],
      anchorId,
      entityId: eid,
      shiftKey: Boolean(ev?.shiftKey) && !wasSelectMode,
      toggleKey:
        Boolean(ev?.metaKey || ev?.ctrlKey) || (plain && wasSelectMode),
    });
    selectedIds = new Set(result.selected);
    anchorId = result.anchorId;
    if (selectedIds.size === 0) {
      touchSelectMode = false;
    }
    if (plain && !wasSelectMode) {
      peeledId = eid;
      wheel.detach?.(eid);
    } else {
      peeledId = null;
      wheel.clearDetached?.();
    }
    paintTileSelection();
    wheel.sync();
    syncLevelHost();
  };

  const fillPercent = (draft, eid) => {
    if (eid && isOnOffLight(eid)) {
      return (draft?.state || "on") === "off" ? 0 : 100;
    }
    const bri = Number(draft.brightness ?? 200);
    if (bri <= 0 || (draft.state || "on") === "off") {
      return 0;
    }
    return (bri / 255) * 100;
  };

  // On/off lights are not part of this level. With none dimmable, the tile
  // keeps the last Select all gesture instead of reading 0/100 off the switches.
  let selectAllVirtualPct = 0;

  const selectAllShownPct = (ids) => {
    const fills = ids
      .filter((id) => !isOnOffLight(id))
      .map((id) => fillPercent(drafts[id] || {}, id));
    const shown = selectAllDisplayedFill(fills);
    return shown == null ? selectAllVirtualPct : shown;
  };

  const paintSelectAll = () => {
    const selector = tiles.querySelector(
      '.simple-light-selector[data-entity-id="__select_all__"]'
    );
    if (!selector || !members.length) {
      return;
    }
    const mode = inSelectMode();
    const ids = mode ? selectedMemberIds() : members;
    const count = selectedMemberIds().length;
    selector.classList.toggle("select-mode", mode);
    const caption = mode
      ? panel._t("frontend.lights.n_selected", "{count} selected", { count })
      : panel._t("frontend.lights.select_all", "Select all");
    paintLightTile(selector, {
      rgb: [64, 60, 58],
      fillPct: selectAllShownPct(ids),
      selected: mode,
      brightnessLabel: mode
        ? panel._t("frontend.lights.deselect", "Deselect")
        : undefined,
    });
    if (mode) {
      const wash = "color-mix(in srgb, var(--primary-color) 32%, transparent)";
      selector.style.setProperty("--hue-light-on-background", wash);
      selector.style.setProperty("--hue-light-on-color", wash);
      selector.style.setProperty("--hue-light-on-text-color", "#fff");
    }
    for (const name of selector.querySelectorAll(".simple-light-name")) {
      name.textContent = caption;
    }
    selector.setAttribute(
      "aria-label",
      mode ? `${caption}, ${panel._t("frontend.lights.deselect", "Deselect")}` : caption
    );
  };

  const paintTileSelection = () => {
    for (const selector of tiles.querySelectorAll(".simple-light-selector")) {
      const eid = selector.dataset.entityId;
      if (eid === "__select_all__") {
        continue;
      }
      if (eid === "__add_light__" || selector.classList.contains("removed")) {
        selector.classList.toggle("active", false);
        continue;
      }
      selector.classList.toggle("active", selectedIds.has(eid));
    }
    paintSelectAll();
  };

  const onOffLabel = (draft) =>
    lightTileValueLabel((draft?.state || "on") === "off" ? 0 : 100, {
      onOff: true,
      onText: panel._t("frontend.lights.power", "On"),
      offText: panel._t("frontend.lights.off", "Off"),
    });

  const paintSelector = (selector, eid, draft) => {
    const onOff = isOnOffLight(eid);
    paintLightTile(selector, {
      rgb: draftRgb(draft),
      fillPct: fillPercent(draft, eid),
      selected: selectedIds.has(eid),
      brightnessLabel: onOff ? onOffLabel(draft) : undefined,
    });
  };

  const ensureDraft = (eid) => {
    if (drafts[eid]) {
      return drafts[eid];
    }
    const raw = lights[eid] || { state: "on", brightness: 200 };
    const color = resolveColor(raw, variables);
    drafts[eid] = { ...raw, ...color };
    return drafts[eid];
  };

  const syncTiles = () => {
    const scroller = tiles.parentElement;
    const keepLeft = scroller?.scrollLeft ?? 0;
    const beforeLayout = captureLightStripLayout(tiles);
    tiles.replaceChildren();
    if (members.length > 1) {
      const { selector, tile, hit } = createLightTile({
        entityId: "__select_all__",
        name: panel._t("frontend.lights.select_all", "Select all"),
        makeIcon: () => {
          const icon = document.createElement("ha-icon");
          icon.setAttribute("icon", "mdi:select-all");
          return icon;
        },
      });
      selector.classList.add("select-all-tile");
      const pickAll = (ev) => {
        ev.stopPropagation();
        if (tile._lightTileSuppressTap) {
          return;
        }
        if (inSelectMode() && selectedMemberIds().length > 1) {
          selectedIds = new Set();
          touchSelectMode = false;
          peeledId = null;
          anchorId = null;
        } else {
          selectedIds = new Set(members);
          peeledId = null;
          anchorId = stripOrderIds[0] || members[0] || null;
        }
        wheel.clearDetached?.();
        wheel.sync();
        paintTileSelection();
        syncLevelHost();
      };
      tile.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") {
          return;
        }
        ev.preventDefault();
        pickAll(ev);
      });

      let drag = null;
      let wheelAxis = null;
      let wheelAxisTimer = null;
      let wheelRevert = null;
      const dragStarts = new Map();

      const memberSelector = (id) =>
        tiles.querySelector(
          `.simple-light-selector[data-entity-id="${CSS.escape(id)}"]`
        );

      const applySelectAllDelta = (deltaPct, { fromStart }) => {
        const ids = scrubTargets();
        const dimmable = ids.filter((id) => !isOnOffLight(id));
        if (!dimmable.length) {
          const base = fromStart
            ? (drag?.virtualStart ?? selectAllVirtualPct)
            : selectAllVirtualPct;
          selectAllVirtualPct = relativeFillPercent(base, deltaPct);
        }
        for (const id of dimmable) {
          const draft = ensureDraft(id);
          const base = fromStart ? dragStarts.get(id) : fillPercent(draft, id);
          if (base == null) {
            continue;
          }
          const pct = relativeFillPercent(base, deltaPct);
          draft.brightness = Math.round((pct / 100) * 255);
          draft.state = draft.brightness > 0 ? "on" : "off";
          persistLight(id);
          const sel = memberSelector(id);
          if (sel) {
            paintSelector(sel, id, draft);
          }
        }
        const want = selectAllOnOffState(selectAllShownPct(ids));
        for (const id of ids) {
          if (!isOnOffLight(id)) {
            continue;
          }
          const draft = ensureDraft(id);
          const sel = memberSelector(id);
          if ((draft.state || "on") !== want) {
            draft.state = want;
            persistLight(id);
            playLightTileJelly(sel?.querySelector(".simple-light-tile"));
          }
          if (sel) {
            paintSelector(sel, id, draft);
          }
        }
        paintSelectAll();
      };

      const endDrag = (ev) => {
        if (!drag || (ev && ev.pointerId !== drag.pointerId)) {
          return;
        }
        panel._holdSimpleUndo?.(false);
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
        if (wasVertical || suppressTap) {
          tile._lightTileSuppressTap = true;
          window.setTimeout(() => {
            tile._lightTileSuppressTap = false;
          }, 0);
        }
        if (wasVertical) {
          for (const id of scrubTargets()) {
            const sel = memberSelector(id);
            if (sel && drafts[id]) {
              paintSelector(sel, id, drafts[id]);
            }
          }
          paintSelectAll();
        }
        window.setTimeout(() => tile.classList.remove("dragging"), 250);
        if (wasVertical || suppressTap) {
          return;
        }
        pickAll(ev);
      };

      const onDocMove = (ev) => {
        if (!drag || ev.pointerId !== drag.pointerId) {
          return;
        }
        drag.lastY = ev.clientY;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        if (!drag.axis) {
          if (Math.hypot(dx, dy) < 8) {
            return;
          }
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
        const deltaPct =
          -((ev.clientY - drag.startY) / Math.max(1, rect.height)) * 100;
        applySelectAllDelta(deltaPct, { fromStart: true });
      };

      hit.addEventListener("pointerdown", (ev) => {
        if (ev.button && ev.button !== 0) {
          return;
        }
        panel._holdSimpleUndo?.(true);
        dragStarts.clear();
        for (const id of scrubTargets()) {
          dragStarts.set(id, fillPercent(ensureDraft(id), id));
        }
        drag = {
          pointerId: ev.pointerId,
          startX: ev.clientX,
          startY: ev.clientY,
          lastY: ev.clientY,
          axis: null,
          suppressTap: false,
          virtualStart: selectAllVirtualPct,
        };
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
          const scrubIds = scrubTargets();
          if (!scrubIds.length) {
            return;
          }
          ev.preventDefault();
          tile.classList.add("wheel-adjusting");
          const dimStep =
            (-Math.sign(ev.deltaY) * TILE_BRIGHTNESS_WHEEL_STEP / 255) * 100;
          applySelectAllDelta(dimStep, { fromStart: false });
          window.clearTimeout(wheelRevert);
          wheelRevert = window.setTimeout(() => {
            wheelRevert = null;
            tile.classList.remove("wheel-adjusting");
            for (const id of scrubTargets()) {
              const sel = memberSelector(id);
              if (sel && drafts[id]) {
                paintSelector(sel, id, drafts[id]);
              }
            }
            paintSelectAll();
          }, 280);
        },
        { passive: false }
      );
      tiles.appendChild(selector);
      paintSelectAll();
    }
    const ordered = [...members].sort((a, b) => {
      const rank = (id) => {
        const st = panel._hass?.states?.[id];
        if (!st) {
          return 2;
        }
        if (st.state === "unavailable") {
          return 1;
        }
        return 0;
      };
      return rank(a) - rank(b);
    });
    const grouped = new Map(lightTileGroupOrder().map((key) => [key, []]));
    for (const eid of ordered) {
      const key = groupOf(eid);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(eid);
    }
    stripOrderIds = lightTileGroupOrder().flatMap((key) => grouped.get(key) || []);
    const groupLabels = {
      color: panel._t("frontend.lights.group_color", "Color"),
      temp: panel._t("frontend.lights.group_temp", "Temperature"),
      white: panel._t("frontend.lights.group_white", "White"),
      brightness: panel._t("frontend.lights.group_brightness", "Brightness"),
    };
    const selectAllLabel = panel._t("frontend.lights.select_all", "Select all");
    const groupRows = new Map();
    for (const key of lightTileGroupOrder()) {
      const ids = grouped.get(key) || [];
      if (!ids.length) {
        continue;
      }
      const { group, row } = createLightModeGroup({
        label: groupLabels[key] || key,
        selectAllLabel,
        groupKey: key,
        onSelectAll: () => {
          selectedIds = new Set(ids);
          anchorId = ids[0] || null;
          peeledId = null;
          wheel.clearDetached?.();
          wheel.sync();
          syncTiles();
        },
      });
      groupRows.set(key, row);
      tiles.appendChild(group);
    }
    for (const eid of stripOrderIds) {
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
      const unavailable = !state || state.state === "unavailable";
      const capsKnown = Boolean(
        state?.attributes?.supported_color_modes?.length ||
          state?.attributes?.min_color_temp_kelvin != null
      );
      if (unavailable) {
        selector.classList.add("unavailable");
        if (capsKnown) {
          selector.classList.add("caps-known");
        }
      }
      const editable = !unavailable || capsKnown;
      selector.tabIndex = 0;

      let drag = null;
      let wheelAxis = null;
      let wheelAxisTimer = null;
      let binaryPreview = null;
      let wheelRevert = null;
      const onOffOnly = isOnOffLight(eid);

      const applyBri = (next) => {
        draft.brightness = Math.max(0, Math.min(255, Math.round(next)));
        draft.state = draft.brightness > 0 ? "on" : "off";
        persistLight(eid);
        paintSelector(selector, eid, draft);
        paintSelectAll();
      };

      const showPreview = (pct) => {
        paintLightTile(selector, {
          rgb: draftRgb(draft),
          fillPct: pct,
          selected: selectedIds.has(eid),
          brightnessLabel: onOffOnly ? onOffLabel(draft) : undefined,
        });
      };

      const endDrag = (ev) => {
        if (!drag || (ev && ev.pointerId !== drag.pointerId)) {
          return;
        }
        panel._holdSimpleUndo?.(false);
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
        window.clearTimeout(drag.holdTimer);
        const revertPreview = wasVertical && onOffOnly && binaryPreview != null;
        drag = null;
        if (revertPreview) {
          binaryPreview = null;
          paintSelector(selector, eid, draft);
          paintSelectAll();
        }
        window.setTimeout(() => tile.classList.remove("dragging"), 250);
        if (wasVertical || suppressTap) {
          return;
        }
        applyTileClick(eid, ev);
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
          window.clearTimeout(drag.holdTimer);
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
        if (onOffOnly) {
          const deltaPct =
            -((ev.clientY - drag.startY) / Math.max(1, rect.height)) * 100;
          const step = binaryDragPreview({ startFill: drag.startFill, deltaPct });
          if (step.snapOn || step.snapOff) {
            draft.state = step.snapOn ? "on" : "off";
            persistLight(eid);
            binaryPreview = null;
            drag.startFill = step.snapOn ? 100 : 0;
            drag.startY = ev.clientY;
            playLightTileJelly(tile);
            paintSelector(selector, eid, draft);
            paintSelectAll();
          } else {
            binaryPreview = step.preview;
            showPreview(step.preview);
          }
          return;
        }
        const fromBottom = rect.bottom - ev.clientY;
        applyBri((Math.max(0, Math.min(100, (fromBottom / rect.height) * 100)) / 100) * 255);
      };

      hit.addEventListener("pointerdown", (ev) => {
        if (!editable || (ev.button && ev.button !== 0)) {
          return;
        }
        panel._holdSimpleUndo?.(true);
        binaryPreview = null;
        drag = {
          pointerId: ev.pointerId,
          startX: ev.clientX,
          startY: ev.clientY,
          startFill: fillPercent(draft, eid),
          axis: null,
          suppressTap: false,
          holdTimer: null,
        };
        if (ev.pointerType === "touch") {
          drag.holdTimer = window.setTimeout(() => {
            if (!drag || drag.pointerId !== ev.pointerId) {
              return;
            }
            touchSelectMode = true;
            selectedIds = new Set([eid]);
            anchorId = eid;
            peeledId = eid;
            drag.suppressTap = true;
            tile._lightTileSuppressTap = true;
            window.setTimeout(() => {
              tile._lightTileSuppressTap = false;
            }, 400);
            wheel.detach?.(eid);
            paintTileSelection();
            wheel.sync();
            syncLevelHost();
          }, 480);
        }
        document.addEventListener("pointermove", onDocMove);
        document.addEventListener("pointerup", endDrag);
        document.addEventListener("pointercancel", endDrag);
      });

      tile.addEventListener(
        "wheel",
        (ev) => {
          if (!editable) {
            return;
          }
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
          if (onOffOnly) {
            const start = binaryPreview ?? fillPercent(draft, eid);
            const step = binaryWheelPreview({
              startFill: start,
              stepPct: wheelDeltaToPercent(ev),
            });
            if (step.snapOn || step.snapOff) {
              window.clearTimeout(wheelRevert);
              draft.state = step.snapOn ? "on" : "off";
              persistLight(eid);
              binaryPreview = null;
              playLightTileJelly(tile);
              paintSelector(selector, eid, draft);
              paintSelectAll();
            } else {
              binaryPreview = step.preview;
              showPreview(step.preview);
              window.clearTimeout(wheelRevert);
              wheelRevert = window.setTimeout(() => {
                wheelRevert = null;
                binaryPreview = null;
                paintSelector(selector, eid, draft);
                paintSelectAll();
              }, 280);
            }
          } else {
            applyBri(
              (draft.brightness ?? 200) -
                Math.sign(ev.deltaY) * TILE_BRIGHTNESS_WHEEL_STEP
            );
          }
          window.setTimeout(() => tile.classList.remove("wheel-adjusting"), 250);
        },
        { passive: false }
      );
      attachLightRemove(selector, {
        label: panel._t(
          "frontend.lights.remove_named_from_scene",
          "Remove {name} from the scene",
          { name }
        ),
        onRemove: () => panel._removeLightFromSimpleMembers(eid),
      });
      attachLightSettings(selector, {
        label: panel._t(
          "frontend.lights.settings_named",
          "Settings for {name}",
          { name }
        ),
        onOpen: () => panel._showEntityMoreInfo(eid, "settings"),
      });
      const row = groupRows.get(groupOf(eid));
      (row || tiles).appendChild(selector);
    }
    for (const eid of removedMembers) {
      const state = panel._hass?.states?.[eid];
      const name =
        state?.attributes?.friendly_name || eid.replace(/^light\./, "");
      const { selector, tile } = createLightTile({
        entityId: eid,
        name: panel._t("frontend.lights.add_named", "Add {name}", { name }),
        tapOnly: true,
        makeIcon: () => {
          const icon = document.createElement("ha-icon");
          icon.setAttribute("icon", "mdi:plus");
          return icon;
        },
      });
      selector.classList.add("removed", "suggested");
      paintLightTile(selector, {
        rgb: [64, 60, 58],
        fillPct: 0,
        selected: false,
      });
      const addBack = (ev) => {
        ev.stopPropagation();
        panel._addLightToSimpleMembers(eid);
      };
      tile.addEventListener("click", addBack);
      tiles.appendChild(selector);
    }
    tiles.appendChild(
      createAddLightTile({
        label: panel._t("frontend.lights.add_light", "Add light"),
        onActivate: (anchor) => panel._openAddLightPicker(anchor, { simple: true }),
      })
    );
    if (scroller) {
      scroller.scrollLeft = keepLeft;
    }
    playLightStripLayout(tiles, beforeLayout);
    paintSelectAll();
    stripGroupSignature = members
      .map((id) => `${id}:${groupOf(id)}`)
      .join("|");
    syncLevelHost();
  };
  let levelStand = "";
  let levelInteracting = false;

  function lightLevelOf(entityId) {
    const attrs = panel._hass?.states?.[entityId]?.attributes || {};
    const caps = lightWheelCaps(attrs);
    const modes = attrs.supported_color_modes || [];
    return {
      hasColor: caps.hasColor,
      hasTemp: caps.hasTemp,
      onOffOnly: modes.length > 0 && modes.every((mode) => mode === "onoff"),
    };
  }

  function syncLevelHost() {
    const ids = [...selectedIds].filter((id) => members.includes(id));
    const stand = wheelStandIn(ids.map(lightLevelOf));
    wheel.el.hidden = stand !== "disks";
    levelHost.hidden = stand === "disks";
    if (stand === "disks") {
      levelStand = "";
      levelInteracting = false;
      levelHost.replaceChildren();
      return;
    }
    const selectedNow = () =>
      [...selectedIds].filter((id) => members.includes(id));
    const brightnessTargets = () =>
      selectedNow().filter((id) => {
        const row = lightLevelOf(id);
        return !row.onOffOnly && !row.hasColor && !row.hasTemp;
      });
    const onOffTargets = () =>
      selectedNow().filter((id) => lightLevelOf(id).onOffOnly);
    const paintTargets = (targets) => {
      for (const id of targets) {
        const sel = tiles.querySelector(
          `.simple-light-selector[data-entity-id="${CSS.escape(id)}"]`
        );
        if (sel && drafts[id]) {
          paintSelector(sel, id, drafts[id]);
        }
      }
      paintSelectAll();
    };
    const pctOf = (id) => {
      const bri = Number(drafts[id]?.brightness);
      if (!Number.isFinite(bri)) {
        return 80;
      }
      return Math.max(0, Math.min(100, Math.round((bri / 255) * 100)));
    };
    const allOn = (targets) =>
      targets.length > 0 &&
      targets.every((id) => (drafts[id]?.state || "on") !== "off");
    const newestChanged = (targets) => {
      let best = "";
      let bestT = -Infinity;
      for (const id of targets) {
        const iso = panel._hass?.states?.[id]?.last_changed || "";
        const t = Date.parse(iso);
        if (Number.isFinite(t) && t > bestT) {
          bestT = t;
          best = iso;
        }
      }
      return best;
    };
    const levelColor = (targets) => {
      const id = targets[0];
      const rgb = id && drafts[id] ? draftRgb(drafts[id]) : null;
      if (!rgb || rgb.every((channel) => channel === 0)) {
        return "#ffc107";
      }
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    };
    const writeBrightness = (pct) => {
      const next = Math.max(0, Math.min(255, Math.round((pct / 100) * 255)));
      const targets = brightnessTargets();
      for (const id of targets) {
        const draft = ensureDraft(id);
        draft.brightness = next;
        draft.state = next > 0 ? "on" : "off";
        persistLight(id);
      }
      paintTargets(targets);
      refreshReadout();
    };
    const writePower = (on) => {
      const targets = brightnessTargets();
      for (const id of targets) {
        const draft = ensureDraft(id);
        draft.state = on ? "on" : "off";
        if (on && !(Number(draft.brightness) > 0)) {
          draft.brightness = 255;
        }
        persistLight(id);
      }
      paintTargets(targets);
      refreshReadout();
    };
    const writeSwitch = (on) => {
      const targets = onOffTargets();
      for (const id of targets) {
        const draft = ensureDraft(id);
        draft.state = on ? "on" : "off";
        persistLight(id);
      }
      paintTargets(targets);
      refreshReadout();
    };

    function refreshReadout() {
      const valueEl = levelHost.querySelector(".simple-level-value");
      const ago = levelHost.querySelector("ha-relative-time");
      const bright = brightnessTargets();
      const toggles = onOffTargets();
      if (valueEl) {
        if (stand === "switch") {
          valueEl.textContent = allOn(toggles)
            ? panel._t("frontend.lights.power", "On")
            : panel._t("frontend.lights.off", "Off");
        } else if (bright.length && bright.every((id) => (drafts[id]?.state || "on") === "off")) {
          valueEl.textContent = panel._t("frontend.lights.off", "Off");
        } else {
          const pct = bright.length ? pctOf(bright[0]) : 0;
          valueEl.textContent = `${pct}%`;
        }
      }
      if (ago) {
        const iso = newestChanged(stand === "switch" ? toggles : bright.concat(toggles));
        ago.datetime = iso;
        if (panel._hass) {
          ago.hass = panel._hass;
        }
      }
      const slider = levelHost.querySelector("ha-control-slider");
      if (slider && !levelInteracting && bright.length) {
        slider.value = pctOf(bright[0]);
        levelHost.style.setProperty("--simple-level-color", levelColor(bright));
      }
      const sw = levelHost.querySelector("ha-control-switch");
      if (sw && !levelInteracting && toggles.length) {
        sw.checked = allOn(toggles);
        if (stand === "switch") {
          levelHost.style.setProperty("--simple-level-color", "#ffc107");
        }
      }
    }

    if (levelStand !== stand) {
      levelStand = stand;
      levelInteracting = false;
      levelHost.replaceChildren();
      const readout = document.createElement("div");
      readout.className = "simple-level-readout";
      const valueEl = document.createElement("div");
      valueEl.className = "simple-level-value";
      const ago = document.createElement("ha-relative-time");
      ago.className = "simple-level-ago";
      readout.append(valueEl, ago);
      const controls = document.createElement("div");
      controls.className = "simple-level-controls";
      if (stand === "slider" || stand === "both") {
        const col = document.createElement("div");
        col.className = "simple-level-col";
        const slider = document.createElement("ha-control-slider");
        slider.vertical = true;
        slider.toggleAttribute("vertical", true);
        slider.min = 0;
        slider.max = 100;
        slider.step = 1;
        slider.unit = "%";
        const first = brightnessTargets()[0];
        slider.value = first ? pctOf(first) : 80;
        const applySlider = (pct) => {
          if (pct == null || Number.isNaN(Number(pct))) {
            return;
          }
          writeBrightness(Number(pct));
        };
        slider.addEventListener("pointerdown", () => {
          levelInteracting = true;
          panel._holdSimpleUndo?.(true);
        });
        slider.addEventListener("slider-moved", (ev) => {
          if (ev.detail?.value == null) {
            levelInteracting = false;
            return;
          }
          applySlider(ev.detail.value);
        });
        const releaseSliderUndo = () => {
          window.setTimeout(() => panel._holdSimpleUndo?.(false), 0);
        };
        slider.addEventListener("pointerup", releaseSliderUndo);
        slider.addEventListener("pointercancel", releaseSliderUndo);
        slider.addEventListener("value-changed", (ev) => {
          levelInteracting = false;
          applySlider(ev.detail?.value);
          panel._holdSimpleUndo?.(false);
        });
        const power = document.createElement("ha-control-button");
        power.setAttribute(
          "aria-label",
          panel._t("frontend.lights.toggle_power", "Toggle")
        );
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", "mdi:power");
        power.appendChild(icon);
        power.addEventListener("click", () => {
          writePower(!allOn(brightnessTargets()));
        });
        const glow = document.createElement("div");
        glow.className = "simple-level-glow";
        glow.appendChild(slider);
        col.append(glow, power);
        controls.appendChild(col);
      }
      if (stand === "switch" || stand === "both") {
        const col = document.createElement("div");
        col.className = "simple-level-col";
        const sw = document.createElement("ha-control-switch");
        sw.vertical = true;
        sw.reversed = true;
        sw.toggleAttribute("vertical", true);
        sw.toggleAttribute("reversed", true);
        sw.checked = allOn(onOffTargets());
        const bulbOn = document.createElement("ha-icon");
        bulbOn.setAttribute("icon", "mdi:lightbulb");
        bulbOn.slot = "icon-on";
        const bulbOff = document.createElement("ha-icon");
        bulbOff.setAttribute("icon", "mdi:lightbulb-outline");
        bulbOff.slot = "icon-off";
        sw.append(bulbOn, bulbOff);
        sw.addEventListener("change", () => {
          writeSwitch(Boolean(sw.checked));
        });
        const glow = document.createElement("div");
        glow.className = "simple-level-glow";
        glow.appendChild(sw);
        col.appendChild(glow);
        controls.appendChild(col);
      }
      levelHost.append(readout, controls);
    }
    refreshReadout();
  }

  const refreshFromPanel = () => {
    const lists = panel._simpleMembershipLists();
    members = lists.members;
    removedMembers = lists.removed;
    panel._simpleMembers = members;
    for (const eid of members) {
      ensureDraft(eid);
    }
    selectedIds = new Set([...selectedIds].filter((id) => members.includes(id)));
    syncTiles();
    wheel.sync();
  };
  panel._simpleEditorRefresh = refreshFromPanel;
  host.replaceChildren(wrap);
  refreshFromPanel();
  if (glowHost && typeof wheel.attachGlow === "function") {
    panel._simpleWheelGlowLayout = wheel.attachGlow(glowHost);
    requestAnimationFrame(() => panel._simpleWheelGlowLayout?.());
  } else {
    panel._simpleWheelGlowLayout = null;
  }
}

function slotToDraft(slot, variables) {
  if (slot?.variable_ref) {
    const linked = variables.find((item) => item.id === slot.variable_ref);
    return {
      ...(linked?.color || {}),
      brightness: linked?.brightness ?? 255,
      variable_ref: slot.variable_ref,
      state: "on",
    };
  }
  return {
    ...(slot?.color || {}),
    brightness: slot?.brightness ?? 255,
    state: "on",
  };
}

function draftToSlot(draft) {
  if (draft?.variable_ref) {
    return { variable_ref: draft.variable_ref };
  }
  return {
    color: colorPayloadFromDraft(draft),
    brightness: Number(draft.brightness) || 255,
  };
}

export function renderPaletteEditor(panel, host, { glowHost } = {}) {
  const working = panel._variableDraft;
  const variables = panel._variables || [];
  if (!working.slots || working.slots.length < PALETTE_SLOT_COUNT) {
    working.slots = working.slots || [];
    while (working.slots.length < PALETTE_SLOT_COUNT) {
      working.slots.push({
        color: {
          color_mode: "hs",
          hs_color: [(working.slots.length / PALETTE_SLOT_COUNT) * 360, 70],
        },
        brightness: 255,
      });
    }
  }
  const wrap = document.createElement("div");
  wrap.className = "simple-editor";

  const wheels = document.createElement("div");
  wheels.className = "simple-wheels";
  const ids = [...Array(PALETTE_SLOT_COUNT)].map((_, i) => `slot:${i}`);
  let selectedId = ids[0];
  const drafts = {};
  for (let i = 0; i < PALETTE_SLOT_COUNT; i += 1) {
    drafts[ids[i]] = slotToDraft(working.slots[i], variables);
  }
  const persistSlot = (id) => {
    const index = ids.indexOf(id);
    if (index < 0) {
      return;
    }
    working.slots[index] = draftToSlot(drafts[id]);
    panel._saveSoon();
  };
  const getState = () => ({
    scenes: ids.map((id, index) => ({
      id,
      index: index + 1,
      draft: drafts[id],
      label: panel._t("frontend.library.slot_label", "Slot {n}", {
        n: index + 1,
      }),
    })),
    sequence: ids,
    activeId: selectedId,
  });
  const wheel = createSceneColorWheel({
    t: (key, fallback) => panel._t(key, fallback),
    getState,
    onSelect: (id) => {
      selectedId = id;
      syncTiles();
    },
    onChange: ({ fromPalette } = {}) => {
      if (!selectedId) {
        return;
      }
      if (!fromPalette) {
        delete drafts[selectedId].variable_ref;
        delete drafts[selectedId].palette_t;
        delete drafts[selectedId].palette_r;
      }
      persistSlot(selectedId);
      syncTiles();
    },
    hasColor: true,
    hasTemp: true,
    tempMin: 2000,
    tempMax: 6500,
    getPalette: () =>
      (panel._variables || []).filter((item) => !variableIsPalette(item)),
    onAddPalette: (draft) => panel._addVariableFromCurrentDraft(draft),
  });
  wheels.appendChild(wheel.el);

  const scroller = document.createElement("div");
  scroller.className = "light-tiles-scroller";
  const tiles = document.createElement("div");
  tiles.className = "light-tiles";
  scroller.appendChild(tiles);

  const fillPercent = (draft) => ((Number(draft.brightness) || 0) / 255) * 100;
  const syncTiles = () => {
    tiles.replaceChildren();
    ids.forEach((id, index) => {
      const draft = drafts[id];
      const name = panel._t("frontend.library.slot_label", "Slot {n}", {
        n: index + 1,
      });
      const { selector, tile, hit } = createLightTile({
        entityId: id,
        name,
        makeIcon: () => {
          const icon = document.createElement("ha-icon");
          icon.setAttribute("icon", "mdi:palette-swatch");
          return icon;
        },
      });
      paintLightTile(selector, {
        rgb: draftRgb(draft),
        fillPct: fillPercent(draft),
        selected: id === selectedId,
      });
      let drag = null;
      const applyBri = (next) => {
        draft.brightness = Math.max(0, Math.min(255, Math.round(next)));
        delete draft.variable_ref;
        persistSlot(id);
        paintLightTile(selector, {
          rgb: draftRgb(draft),
          fillPct: fillPercent(draft),
          selected: id === selectedId,
        });
      };
      const endDrag = (ev) => {
        if (!drag || (ev && ev.pointerId !== drag.pointerId)) {
          return;
        }
        document.removeEventListener("pointermove", onDocMove);
        document.removeEventListener("pointerup", endDrag);
        document.removeEventListener("pointercancel", endDrag);
        const wasVertical = drag.axis === "y";
        const suppressTap = drag.suppressTap;
        drag = null;
        window.setTimeout(() => tile.classList.remove("dragging"), 250);
        if (wasVertical || suppressTap) {
          return;
        }
        selectedId = id;
        wheel.sync();
        syncTiles();
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
          if (Math.abs(dx) > Math.abs(dy)) {
            drag.axis = "x";
            drag.suppressTap = true;
            return;
          }
          drag.axis = "y";
          drag.suppressTap = true;
          tile.classList.add("dragging");
          return;
        }
        if (drag.axis !== "y") {
          return;
        }
        ev.preventDefault();
        const rect = tile.getBoundingClientRect();
        const fromBottom = rect.bottom - ev.clientY;
        applyBri(
          (Math.max(0, Math.min(100, (fromBottom / rect.height) * 100)) / 100) *
            255
        );
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
        document.addEventListener("pointermove", onDocMove);
        document.addEventListener("pointerup", endDrag);
        document.addEventListener("pointercancel", endDrag);
      });
      tiles.appendChild(selector);
    });
  };
  wrap.append(wheels, scroller);
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

