/** Simple-scene editor: color wheel, light tiles, variable palette. */

import {
  applyVariableToDraft,
  colorPayloadFromDraft,
  createSceneColorWheel,
  draftRgb,
  lightWheelCaps,
} from "./color_ui.js";
import { scaledCardRgb } from "./card_mesh.js";
import { PALETTE_SLOT_COUNT, variableIsPalette } from "./palette.js";
import {
  LIGHT_TILES_CSS,
  TILE_BRIGHTNESS_WHEEL_STEP,
  attachLightRemove,
  attachLightSettings,
  createAddLightTile,
  createLightModeGroup,
  createLightTile,
  lightTileColorGroup,
  lightTileGroupOrder,
  paintLightTile,
  tileSelectionAfterClick,
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
  }
  .simple-wheels .hue-wheel-stage {
    width: min(100%, 650px);
    max-width: min(100%, 650px);
    height: 100%;
    max-height: 100%;
    min-width: 0;
    min-height: 0;
    margin: 0;
    flex: 1 1 auto;
    container-type: size;
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
  .simple-light-selector.select-all-tile .simple-light-tile {
    cursor: pointer;
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
  let peeledId = null;
  let anchorId = members[0] || null;
  let stripOrderIds = [];
  let pinClusters = [];
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
    paintCard();
  };

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
    getState,
    showPath: false,
    groupNearby: true,
    getPinIcon: (scene) => entityMdiIcon(panel, scene.id),
    onClusters: (clusters) => {
      pinClusters = clusters || [];
      paintTileSelection();
    },
    onSelect: (id) => {
      selectedIds = new Set(id ? [id] : []);
      peeledId = id || null;
      syncTiles();
    },
    onChange: ({ dragging, fromPalette, ids, deselected } = {}) => {
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
      if (dragging) {
        for (const eid of write) {
          const sel = tiles.querySelector(
            `.simple-light-selector[data-entity-id="${CSS.escape(eid)}"]`
          );
          if (sel && drafts[eid]) {
            paintSelector(sel, eid, drafts[eid]);
          }
        }
      } else {
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
      selectedIds = new Set([next]);
      anchorId = next;
      peeledId = next;
      wheel.detach?.(next);
      paintTileSelection();
      wheel.sync();
    }
    scroller.querySelector(
      `.simple-light-selector[data-entity-id="${CSS.escape(next)}"]`
    )?.focus();
  });

  const applyTileClick = (eid, ev) => {
    const result = tileSelectionAfterClick({
      ids: stripOrderIds.length ? stripOrderIds : members,
      selected: [...selectedIds],
      anchorId,
      entityId: eid,
      shiftKey: Boolean(ev?.shiftKey),
      toggleKey: Boolean(ev?.metaKey || ev?.ctrlKey),
    });
    selectedIds = new Set(result.selected);
    anchorId = result.anchorId;
    const plain = !ev?.shiftKey && !ev?.metaKey && !ev?.ctrlKey;
    if (plain) {
      peeledId = eid;
      wheel.detach?.(eid);
    } else {
      peeledId = null;
      wheel.clearDetached?.();
    }
    paintTileSelection();
    wheel.sync();
  };

  const fillPercent = (draft) => {
    const bri = Number(draft.brightness ?? 200);
    if (bri <= 0 || (draft.state || "on") === "off") {
      return 0;
    }
    return (bri / 255) * 100;
  };

  const paintTileSelection = () => {
    const allSelected =
      members.length > 0 && members.every((id) => selectedIds.has(id));
    for (const selector of tiles.querySelectorAll(".simple-light-selector")) {
      const eid = selector.dataset.entityId;
      if (eid === "__select_all__") {
        selector.classList.toggle("active", allSelected);
        continue;
      }
      if (eid === "__add_light__" || selector.classList.contains("removed")) {
        selector.classList.toggle("active", false);
        continue;
      }
      selector.classList.toggle("active", selectedIds.has(eid));
    }
  };

  const paintSelector = (selector, eid, draft) => {
    paintLightTile(selector, {
      rgb: draftRgb(draft),
      fillPct: fillPercent(draft),
      selected: selectedIds.has(eid),
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
    tiles.replaceChildren();
    const allSelected =
      members.length > 0 && members.every((id) => selectedIds.has(id));
    if (members.length > 1) {
      const { selector, tile } = createLightTile({
        entityId: "__select_all__",
        name: panel._t("frontend.lights.select_all", "Select all"),
        tapOnly: true,
        makeIcon: () => {
          const icon = document.createElement("ha-icon");
          icon.setAttribute("icon", "mdi:select-all");
          return icon;
        },
      });
      selector.classList.add("select-all-tile");
      paintLightTile(selector, {
        rgb: [64, 60, 58],
        fillPct: allSelected ? 100 : 0,
        selected: allSelected,
      });
      const pickAll = (ev) => {
        ev.stopPropagation();
        selectedIds = new Set(members);
        peeledId = null;
        anchorId = stripOrderIds[0] || members[0] || null;
        wheel.clearDetached?.();
        wheel.sync();
        syncTiles();
      };
      tile.addEventListener("click", pickAll);
      tiles.appendChild(selector);
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
      const key = lightTileColorGroup(drafts[eid]);
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

      const applyBri = (next) => {
        draft.brightness = Math.max(0, Math.min(255, Math.round(next)));
        persistLight(eid);
        paintSelector(selector, eid, draft);
      };

      const endDrag = (ev) => {
        if (!drag || (ev && ev.pointerId !== drag.pointerId)) {
          return;
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
        if (!editable || (ev.button && ev.button !== 0)) {
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
          applyBri(
            (draft.brightness ?? 200) -
              Math.sign(ev.deltaY) * TILE_BRIGHTNESS_WHEEL_STEP
          );
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
      const row = groupRows.get(lightTileColorGroup(draft));
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
  };
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

