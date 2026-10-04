/* dial light strip owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import { lightWheelCaps } from "./color_ui.js";
import { paletteIsMixed, paletteIsTemperatureOnly, variableIsPalette } from "./palette.js";
import { interpolateLightSample } from "./dial_clock.js";
import {
  bindLightTileBrightness,
  captureLightStripLayout,
  hasUngroupedLightTiles,
  createLightModeGroup,
  createLightTile,
  attachLightActions,
  groupSelectionAfterClick,
  lightTileColorGroup,
  lightTileGroupOrder,
  paintLightTile,
  reconcileStripChildren,
  playLightStripLayout,
  revealLightActionsNow,
} from "./light_tiles.js";

export const dialLightStripMethods = {
  _updateLightNameBrightness(seconds) {
    for (const entry of this._lightNameLabels || []) {
      const { light, titleEl, subEl, el, selector } = entry;
      if (selector) {
        const look = this._clockLegendTileLook(light, seconds);
        if (!look) {
          continue;
        }
        paintLightTile(selector, {
          rgb: look.rgb,
          fillPct: look.fillPct,
          selected: this._legendTileSelected(light.entity_id),
          brightnessLabel: this._lightTileValueLabel(light.entity_id, look.fillPct),
        });
        continue;
      }
      // Table bars: single name span (dial uses light tiles + selector).
      if (titleEl) {
        titleEl.textContent = light.name;
        if (!subEl) {
          continue;
        }
        if (seconds == null) {
          subEl.textContent = "";
          continue;
        }
        const sample = interpolateLightSample(light.samples || [], seconds);
        subEl.textContent = `${Math.round(sample.brightness)}%`;
        continue;
      }
      if (!el) {
        continue;
      }
      if (seconds == null) {
        el.textContent = light.name;
        continue;
      }
      const sample = interpolateLightSample(light.samples || [], seconds);
      el.replaceChildren();
      el.appendChild(document.createTextNode(`${light.name} `));
      const pct = document.createElement("span");
      pct.className = "light-brightness";
      pct.textContent = `${Math.round(sample.brightness)}%`;
      el.appendChild(pct);
    }
  },

  _legendTileSelected(entityId) {
    const picked = this._legendSelectedIds;
    if (picked) {
      return picked.has(entityId);
    }
    return entityId === this._sidebarLightId;
  },

  _legendGroupDraft(light) {
    const events = this._sunPath?.events || [];
    const eventId = this._sidebarEventId;
    if (
      eventId &&
      this._clockStickySeconds == null &&
      events.some((item) => item.id === eventId)
    ) {
      return this._lightEventStoredState(light, eventId);
    }
    const seconds =
      this._clockSunDisplayedSeconds ??
      this._clockStickySeconds ??
      this._clockSunIdleSeconds();
    const closest = seconds == null ? null : this._closestEvent(events, seconds);
    if (closest) {
      return this._lightEventStoredState(light, closest.id);
    }
    return {};
  },

  _legendTileCaps(entityId) {
    const attrs = this._hass?.states?.[entityId]?.attributes || {};
    const modes = attrs.supported_color_modes || [];
    if (!modes.length) {
      return undefined;
    }
    const caps = lightWheelCaps(attrs);
    return {
      known: true,
      hasColor: caps.hasColor,
      hasTemp: caps.hasTemp,
      onOff: modes.length > 0 && modes.every((mode) => mode === "onoff"),
    };
  },

  _placeLegendModeGroups(tilesEl) {
    if (!tilesEl) {
      return;
    }
    const entries = (this._lightNameLabels || []).filter(
      (entry) => entry.selector && entry.light && !entry.light.removed && !entry.light.suggested
    );
    const paletteVars = (this._variables || []).filter((item) => variableIsPalette(item));
    const paletteIds = new Set(paletteVars.map((item) => item.id));
    const tempOnlyPaletteIds = new Set(
      paletteVars
        .filter((item) => paletteIsTemperatureOnly(item, this._variables))
        .map((item) => item.id)
    );
    const mixedPaletteIds = new Set(
      paletteVars
        .filter((item) => paletteIsMixed(item, this._variables))
        .map((item) => item.id)
    );
    const bucketOf = (entry) =>
      entry.selector.classList.contains("unavailable")
        ? "unavailable"
        : lightTileColorGroup(
            this._legendGroupDraft(entry.light),
            this._legendTileCaps(entry.light.entity_id),
            paletteIds,
            tempOnlyPaletteIds,
            mixedPaletteIds
          );
    const signature = entries
      .map((entry) => `${entry.light.entity_id}:${bucketOf(entry)}`)
      .join("|");
    // A matching signature is not enough: a rebuilt legend is a flat list,
    // and a tile flight can leave selectors on the strip until it is restored.
    const ungrouped = hasUngroupedLightTiles(tilesEl);
    if (signature === tilesEl._groupSignature && !ungrouped) {
      return;
    }
    tilesEl._groupSignature = signature;
    const beforeLayout = captureLightStripLayout(tilesEl);
    const grouped = new Map(lightTileGroupOrder().map((key) => [key, []]));
    const unavailable = [];
    for (const entry of entries) {
      if (entry.selector.classList.contains("unavailable")) {
        unavailable.push(entry);
        continue;
      }
      const key = bucketOf(entry);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(entry);
    }
    const labels = {
      color: this._t("frontend.lights.group_color", "Color"),
      temp: this._t("frontend.lights.group_temp", "Temperature"),
      white: this._t("frontend.lights.group_white", "White"),
      brightness: this._t("frontend.lights.group_brightness", "Brightness"),
      onoff: this._t("frontend.lights.group_onoff", "On/off"),
    };
    const selectAllLabel = this._t("frontend.lights.select_all", "Select all");
    const add = tilesEl.querySelector(".add-light-tile");
    const orphanUnavailable = [
      ...tilesEl.querySelectorAll(".simple-light-selector.unavailable"),
    ].filter(
      (node) =>
        !node.classList.contains("removed") &&
        !entries.some((entry) => entry.selector === node)
    );
    const leftovers = [
      ...tilesEl.querySelectorAll(
        ".simple-light-selector.removed, .simple-light-selector.suggested"
      ),
    ];
    const paletteKeys = [...grouped.keys()]
      .filter((key) => key.startsWith("palette:"))
      .sort((a, b) => {
        const name = (key) => {
          const id = key.slice("palette:".length);
          return (this._variables || []).find((item) => item.id === id)?.name || id;
        };
        return name(a).localeCompare(name(b));
      });
    const groupOrder = lightTileGroupOrder(paletteKeys);
    const selectAll = tilesEl.querySelector(".select-all-tile");
    const existingGroups = new Map([...tilesEl.querySelectorAll(":scope > .light-mode-group")].map(group => [group.dataset.group, group]));
    const desired = selectAll ? [selectAll] : [];
    for (const key of groupOrder) {
      const rows = grouped.get(key) || [];
      if (!rows.length) {
        continue;
      }
      const paletteId = key.startsWith("palette:") ? key.slice("palette:".length) : "";
      const label = paletteId
        ? (this._variables || []).find((item) => item.id === paletteId)?.name || paletteId
        : labels[key] || key;
      let group = existingGroups.get(key);
      if (!group) {
        ({ group } = createLightModeGroup({
          label, selectAllLabel, groupKey: key,
          onSelectAll: (ev) => {
            if (this._view === "edit" && !this._requireCircadianEvent()) return;
            const result = groupSelectionAfterClick({
              ids: group._memberIds,
              selected: [...(this._legendSelectedIds || [])],
              toggleKey: Boolean(ev?.metaKey || ev?.ctrlKey || ev?.shiftKey),
            });
            this._legendSelectedIds = new Set(result.selected);
            this._syncOpenSceneWheel?.();
            this._syncClockLightSelection();
            this._syncCircadianSelectAll?.();
            this._reopenCircadianEvent();
            revealLightActionsNow(this.shadowRoot);
          },
        }));
      }
      group._memberIds = rows.map(entry => entry.light.entity_id);
      group.querySelector(".light-mode-name").textContent = label;
      group.querySelector(".light-mode-label").setAttribute("aria-label", `${label}. ${selectAllLabel}`);
      reconcileStripChildren(group.querySelector(".light-mode-row"), rows.map(entry => entry.selector));
      desired.push(group);
    }
    const plainGroup = (key, label, nodes) => {
      if (!nodes.length) return;
      const group = existingGroups.get(key) || createLightModeGroup({ label, plain: true, groupKey: key }).group;
      reconcileStripChildren(group.querySelector(".light-mode-row"), nodes);
      desired.push(group);
    };
    plainGroup("unavailable", this._t("frontend.lights.unavailable", "Unavailable"), [...unavailable.map(entry => entry.selector), ...orphanUnavailable]);
    plainGroup("removed", this._t("frontend.lights.removed", "Removed"), leftovers);
    if (add) desired.push(add);
    reconcileStripChildren(tilesEl, desired);
    playLightStripLayout(tilesEl, beforeLayout);
    tilesEl.parentElement?._groupTitleStick?.();
    this._fitSidebarLightStrip();
  },

  _toggleLegendLightPower(entityId) {
    if (!this._requireCircadianEvent()) return;
    const event = this._sunPath.events.find(item => item.id === this._sidebarEventId);
    const current = this._dialEventBrightness(event.id, entityId);
    const key = `${entityId}:${event.id}`;
    if (!this._legendPowerLevel) {
      this._legendPowerLevel = new Map();
    }
    const next =
      current > 0 ? 0 : this._legendPowerLevel.get(key) || 255;
    if (current > 0) {
      this._legendPowerLevel.set(key, current);
    }
    this._commitUndo({ type: "light", lightId: entityId, eventId: event.id });
    this._writeLightEventOverride(entityId, event.id, {
      ...(this._formData.overrides?.[entityId]?.[event.id] || {}),
      state: next > 0 ? "on" : "off",
      brightness: next,
    });
    this._refreshCircadianEvent();
  },

  _clockLegendRow(light, events) {
    const suggested = Boolean(light.suggested);
    const removed = Boolean(light.removed || suggested);
    const seconds =
      this._clockSunDisplayedSeconds ??
      this._clockStickySeconds ??
      this._clockSunIdleSeconds();
    const look = this._clockLegendTileLook(light, seconds) || {
      rgb: [0, 0, 0],
      fillPct: 0,
    };
    const lightName = this._lightDisplayName(light.entity_id, {
      fallback: light.name,
    });
    const displayName = removed
      ? this._t("frontend.lights.add_named", "Add {name}", { name: lightName })
      : lightName;
    const { selector, tile, hit } = createLightTile({
      entityId: light.entity_id,
      name: displayName,
      tapOnly: removed,
      makeIcon: () => {
        if (removed) {
          const icon = document.createElement("ha-icon");
          icon.setAttribute("icon", "mdi:plus");
          return icon;
        }
        return this._lightEntityIcon(light.entity_id);
      },
    });
    if (suggested) {
      selector.classList.add("suggested");
    }
    if (removed) {
      selector.classList.add("removed");
    }
    if (light.in_area === false) {
      selector.classList.add("out-of-area");
    }
    const unavailable =
      this._lightIsUnavailable(light.entity_id) && !removed;
    const capsKnown = unavailable && this._lightHasKnownCaps(light.entity_id);
    if (unavailable) {
      selector.classList.add("unavailable");
      if (capsKnown) {
        selector.classList.add("caps-known");
      }
    }
    paintLightTile(selector, {
      rgb: look.rgb,
      fillPct: removed ? 0 : look.fillPct,
      selected: !removed && this._legendTileSelected(light.entity_id),
      brightnessLabel: removed
        ? ""
        : this._lightTileValueLabel(light.entity_id, look.fillPct),
    });
    if (!removed && (!unavailable || capsKnown)) {
      this._lightNameLabels.push({ light, selector });
    }

    if (this._view === "edit") {
      const assigned = events.filter((item) => this._eventSceneId(item.id));
      if (removed) {
        tile.setAttribute(
          "aria-label",
          this._t("frontend.lights.add_named_to_scene", "Add {name} to the scene", {
            name: lightName,
          })
        );
        const addBack = (ev) => {
          ev.stopPropagation();
          void this._addLightToAssignedScenes(light.entity_id);
        };
        tile.addEventListener("click", addBack);
        tile.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ") {
            return;
          }
          ev.preventDefault();
          addBack(ev);
        });
      }
      const canEdit = !removed && assigned.length && (!unavailable || capsKnown);
      if (canEdit) {
        tile.setAttribute("aria-label", `Edit ${lightName}`);
        const openClosest = (ev) => {
          if (tile._lightTileSuppressTap || this._suppressLightTileOpen) {
            return;
          }
          ev.stopPropagation();
          this._selectCircadianLight(light.entity_id, ev);
        };
        let hold;
        let origin;
        tile.addEventListener("pointerdown", ev => {
          if (ev.pointerType !== "touch") return;
          origin = { x: ev.clientX, y: ev.clientY };
          hold = setTimeout(() => {
            if (!tile.isConnected || !this._requireCircadianEvent()) return;
            this._circadianTouchSelect = true;
            this._selectCircadianLight(light.entity_id, { toggleKey: true });
            tile._lightTileSuppressTap = true;
          }, 480);
        });
        tile.addEventListener("pointermove", ev => {
          if (origin && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) >= 8) clearTimeout(hold);
        });
        const endHold = () => { clearTimeout(hold); origin = null; setTimeout(() => { tile._lightTileSuppressTap = false; }, 400); };
        tile.addEventListener("pointerup", endHold);
        tile.addEventListener("pointercancel", endHold);
        tile.addEventListener("click", openClosest);
        tile.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ") {
            return;
          }
          ev.preventDefault();
          openClosest(ev);
        });
        bindLightTileBrightness(tile, hit, {
          onBlocked: () => this._requireCircadianEvent(),
          isEditable: () =>
            Boolean(this._sidebarEventId) &&
            assigned.some((item) => item.id === this._sidebarEventId),
          isBinary: () => {
            const modes =
              this._hass?.states?.[light.entity_id]?.attributes
                ?.supported_color_modes || [];
            return modes.length > 0 && modes.every((mode) => mode === "onoff");
          },
          getBrightness: () =>
            this._dialEventBrightness(this._sidebarEventId, light.entity_id),
          setBrightness: (value, { history } = {}) => {
            this._beginBrightnessScrub();
            this._writeDialEventBrightness(this._sidebarEventId, value, {
              history,
              lightId: light.entity_id,
            });
          },
          onDragEnd: () => this._endBrightnessScrub(),
        });
      }
      if (!removed) {
        attachLightActions(selector, {
          removeLabel: this._t(
            "frontend.lights.remove_named_from_scene",
            "Remove {name} from the scene",
            { name: lightName }
          ),
          onRemove: () => {
            if (this._formData.overrides?.[light.entity_id]?.[this._sidebarEventId]) this._resetCircadianLight(light.entity_id);
            else this._removeLightFromAssignedScenes(light.entity_id);
          },
          settingsLabel: this._t(
            "frontend.lights.settings_named",
            "Settings for {name}",
            { name: lightName }
          ),
          onSettings: () => this._showEntityMoreInfo(light.entity_id, "settings"),
          powerLabel: this._t("frontend.lights.toggle_power", "Toggle"),
          onPower: () => this._toggleLegendLightPower(light.entity_id),
        });
      }
    }
    return selector;
  },

  _lightEntityIcon(entityId) {
    const state = this._hass?.states?.[entityId];
    const entry = this._hass?.entities?.[entityId];
    // Prefer HA’s state icon so device-class / registry icons win over a
    // generic lightbulb fallback.
    if (customElements.get("ha-state-icon")) {
      const icon = document.createElement("ha-state-icon");
      icon.className = "clock-legend-icon";
      icon.hass = this._hass;
      if (state) {
        icon.stateObj = state;
      }
      if (entityId) {
        icon.entityId = entityId;
      }
      return icon;
    }
    const icon = document.createElement("ha-icon");
    icon.className = "clock-legend-icon";
    const named =
      entry?.icon || state?.attributes?.icon || state?.attributes?.entity_picture;
    icon.setAttribute(
      "icon",
      typeof named === "string" && named.startsWith("mdi:")
        ? named
        : "mdi:lightbulb"
    );
    return icon;
  }
};
