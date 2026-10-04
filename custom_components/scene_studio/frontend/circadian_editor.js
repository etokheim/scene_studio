/* circadian editor owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import { DOMAIN, SCENE_PLAY_TRANSITION_SEC, EVENT_LIGHT_DEFAULTS } from "./panel_constants.js";
import { EventGuidance, eventSourceChanged, lightOverrideRows } from "./event_editor.js";
import {
  resolveEventDraft,
  eventOverrideAfterEdit,
  eventBrightnessAdjustment,
} from "./event_inheritance.js";
import { resampleLightsForEvents } from "./client_solar.js";
import {
  draftRgb,
  createLightBrightnessGraph,
  createSceneColorWheel,
  lightDraftFingerprint,
  THEME_BRIGHTNESS_SNAP,
  lightWheelCaps,
  variableSwatchCss,
} from "./color_ui.js";
import { galleryTheme, themeDraftSignature, themeEventSignature } from "./gallery.js";
import { paletteSwatchCss, sceneEventPaletteId, variableIsPalette } from "./palette.js";
import { conicGradientFromSamples, interpolateLightSample } from "./dial_clock.js";
import { PALETTE_RANDOMIZE_ICON } from "./landing.js";
import {
  bindLightTileBrightness,
  createLightTile,
  tileSelectionAfterClick,
  proportionalFillPercent,
  selectAllDisplayedFill,
  lightTileValueLabel,
  paintSelectAllTile,
  revealLightActionsNow,
} from "./light_tiles.js";

export const circadianEditorMethods = {
  /** Selected lamp for dial brightness, else theme (including `theme:` ids). */
  _dialBrightnessLightId() {
    const id = this._sidebarLightId;
    if (id && String(id).startsWith("light.")) {
      return id;
    }
    return null;
  },

  _lightSupportsSubtitle(entityId) {
    const attrs = this._hass?.states?.[entityId]?.attributes || {};
    const modes = attrs.supported_color_modes || [];
    const hasColor = modes.some((mode) =>
      ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode)
    );
    const hasTemp = modes.includes("color_temp") || modes.includes("rgbww") ||
      attrs.min_color_temp_kelvin != null;
    const hasWhite = modes.some((mode) => ["white", "rgbw", "rgbww"].includes(mode));
    const onOff = modes.length > 0 && modes.every((mode) => mode === "onoff");
    const parts = [];
    if (hasColor) {
      parts.push(this._t("frontend.lights.group_color", "Color"));
    }
    if (hasTemp) {
      parts.push(this._t("frontend.lights.group_temp", "Temperature"));
    }
    if (hasWhite) {
      parts.push(this._t("frontend.lights.group_white", "White"));
    }
    if (!hasColor && !hasTemp && !hasWhite && !onOff) {
      parts.push(this._t("frontend.lights.group_brightness", "Brightness"));
    }
    if (onOff) {
      parts.push(this._t("frontend.lights.group_onoff", "On/off"));
    }
    return parts.join(", ");
  },

  _inheritedEventBrightness(eventId) {
    const lights = (this._sunPath?.lights || []).filter(light =>
      !light.suggested && !light.removed && !light.theme_ring &&
      !Object.hasOwn(this._formData?.overrides?.[light.entity_id]?.[eventId] || {}, "brightness")
    );
    const levels = lights.map(light => Number(this._lightEventStoredState(light, eventId).brightness)).filter(Number.isFinite);
    return levels.length ? levels.reduce((sum, level) => sum + level, 0) / levels.length : 0;
  },

  _dialEventBrightness(eventId, lightIdArg) {
    const lightId =
      lightIdArg !== undefined ? lightIdArg : this._dialBrightnessLightId();
    if (lightId) {
      if (this._formData?.kind === "circadian" && this._themeDraft) {
        const draft = this._lightEventStoredState({ entity_id: lightId }, eventId);
        if (draft.state === "off") return 0;
        if (this._lightModeFlags(lightId).onOff) return 255;
        return Number(draft.brightness) || 0;
      }
      const overridden = this._formData?.overrides?.[lightId]?.[eventId];
      if (overridden && overridden.brightness != null) {
        return Number(overridden.brightness);
      }
      const sceneId = this._eventSceneId(eventId);
      const drafted = sceneId
        ? this._nativeDrafts[sceneId]?.entities?.[lightId]
        : null;
      if (drafted && drafted.brightness != null) {
        return Number(drafted.brightness);
      }
      const light = (this._sunPath?.lights || []).find(
        (item) => item.entity_id === lightId
      );
      // Sun-path rows are the last server resolve. While a theme draft is
      // open, lights with no override inherit that draft — including during
      // a brightness scrub, before the path is fetched again.
      if (!this._themeDraft) {
        const row = (light?.event_states || []).find(
          (item) => item.event === eventId
        );
        if (row?.state?.brightness != null) {
          return Number(row.state.brightness);
        }
      }
    }
    if (this._formData?.kind === "circadian" && this._themeDraft) {
      return this._inheritedEventBrightness(eventId);
    }
    if (this._themeDraft) {
      return Number(this._themeEventDraft(eventId).brightness) || 0;
    }
    const seed = EVENT_LIGHT_DEFAULTS[eventId];
    return seed ? seed[0] : 0;
  },

  _lightDraftLookFingerprint(draft) {
    return lightDraftFingerprint({
      ...draft,
      brightness: 0,
      state: "on",
    });
  },

  _themeEventBrightness(eventId) {
    return Number(this._themeEventDraft(eventId).brightness) || 0;
  },

  _deleteLightEventOverride(lightId, eventId) {
    const byLight = { ...(this._formData.overrides?.[lightId] || {}) };
    if (!(eventId in byLight)) {
      return;
    }
    delete byLight[eventId];
    const next = { ...(this._formData.overrides || {}) };
    if (Object.keys(byLight).length) {
      next[lightId] = byLight;
    } else {
      delete next[lightId];
    }
    this._formData.overrides = next;
  },

  _snapLightEventBrightness(eventId, brightness) {
    const themeBri = this._themeEventBrightness(eventId);
    if (Math.abs(Number(brightness) - themeBri) <= THEME_BRIGHTNESS_SNAP) {
      return themeBri;
    }
    return Number(brightness);
  },

  _brightnessPayloadFromTheme(eventId, brightness) {
    const draft = this._themeEventDraft(eventId);
    const payload = {
      state: brightness > 0 ? "on" : draft.state || "on",
      brightness,
    };
    if (draft.color_mode) {
      payload.color_mode = draft.color_mode;
    }
    if (draft.color_temp_kelvin != null) {
      payload.color_temp_kelvin = draft.color_temp_kelvin;
    }
    if (draft.hs_color) {
      payload.hs_color = [...draft.hs_color];
    }
    if (draft.rgb_color) {
      payload.rgb_color = [...draft.rgb_color];
    }
    return payload;
  },

  _writeDialEventBrightness(eventId, brightness, { history = false, lightId: lightIdArg } = {}) {
    const value = Number(brightness);
    if (!Number.isFinite(value)) {
      return;
    }
    const lightId =
      lightIdArg !== undefined ? lightIdArg : this._dialBrightnessLightId();
    if (!lightId && this._view === "edit" && this._formData?.kind === "circadian") {
      if (history) this._commitUndo({ type: "event-lights", eventId });
      this._formData.event_palettes ||= {};
      this._formData.event_palettes[eventId] ||= {};
      const entry = this._formData.event_palettes[eventId];
      const bases = this._eventBrightnessBases ||= new Map();
      let base = bases.get(eventId);
      if (!base || !this._eventBrightnessIsLive()) {
        base = { adjustment: structuredClone(entry.brightness_adjustment), from: this._inheritedEventBrightness(eventId) };
        bases.set(eventId, base);
      }
      entry.brightness_adjustment = eventBrightnessAdjustment(base.adjustment, base.from, value);
      this._refreshInheritedLightDrafts?.();
      if (this._eventBrightnessIsLive()) this._paintLiveEventBrightness();
      else {
        this._patchDialFromSession();
        this._syncThemePreviewSurfaces();
        this._saveSoon();
      }
      return;
    }
    if (!lightId) {
      if (!this._themeDraft) {
        void this._ensureThemeDraft();
      }
      if (!this._themeDraft) {
        return;
      }
      if (history) {
        this._commitUndo({ type: "theme-event", eventId });
      }
      const draft = {
        ...this._themeEventDraft(eventId),
        brightness: value,
      };
      // Brightness stays on the event. Dropping variable_ref here would
      // detach a palette and the dial/tiles would stop following it.
      this._writeThemeEventFromDraft(eventId, draft);
      const hook = this._dialBrightnessHook;
      if (hook?.kind === "theme") {
        const item = hook.drafts.get(eventId);
        if (item) {
          item.brightness = value;
          if (value > 0) {
            item.state = "on";
          }
        }
        hook.sync?.();
      }
      if (this._eventBrightnessIsLive()) {
        this._paintLiveEventBrightness();
        return;
      }
      this._patchDialFromSession({ applyTheme: true });
      this._syncThemePreviewSurfaces();
      this._saveSoon();
      return;
    }
    if (history) {
      this._commitUndo({ type: "light", lightId, eventId });
    }
    if (this._formData.kind === "circadian") {
      this._writeLightEventOverride(lightId, eventId, {
        ...(this._formData.overrides?.[lightId]?.[eventId] || {}), brightness: value,
      });
      this._refreshInheritedLightDrafts?.();
      this._syncClockLegendBrightEdit();
      const hook = this._dialBrightnessHook;
      if (hook?.kind === "light" && hook.lightId === lightId) {
        const entry = hook.drafts.get(eventId);
        if (entry?.draft) entry.draft.brightness = value;
        hook.sync?.();
      }
      if (this._eventBrightnessIsLive()) this._paintLiveEventBrightness();
      else {
        this._patchDialFromSession();
        this._syncThemePreviewSurfaces();
        this._saveSoon();
      }
      return;
    }
    const theme = this._themeEventDraft(eventId);
    const snapped = this._snapLightEventBrightness(eventId, value);
    if (!this._formData.overrides) {
      this._formData.overrides = {};
    }
    const byLight = { ...(this._formData.overrides[lightId] || {}) };
    const prev = byLight[eventId];
    const next = prev
      ? { ...prev, brightness: snapped }
      : this._brightnessPayloadFromTheme(eventId, snapped);
    next.brightness = snapped;
    if (snapped > 0) {
      next.state = "on";
    }
    delete next.variable_ref;
    const lookMatchesTheme =
      this._lightDraftLookFingerprint(next) ===
      this._lightDraftLookFingerprint(theme);
    if (snapped === this._themeEventBrightness(eventId) && lookMatchesTheme) {
      this._deleteLightEventOverride(lightId, eventId);
    } else {
      byLight[eventId] = next;
      this._formData.overrides = {
        ...this._formData.overrides,
        [lightId]: byLight,
      };
    }
    const hook = this._dialBrightnessHook;
    if (hook?.kind === "light" && hook.lightId === lightId) {
      const entry = hook.drafts.get(eventId);
      if (entry) {
        if (
          snapped === this._themeEventBrightness(eventId) &&
          lookMatchesTheme
        ) {
          entry.draft = { ...theme };
          entry.saved = lightDraftFingerprint(entry.draft);
        } else if (entry.draft) {
          entry.draft.brightness = snapped;
          if (snapped > 0) {
            entry.draft.state = "on";
          }
          delete entry.draft.variable_ref;
        }
      }
      hook.sync?.();
    }
    if (this._eventBrightnessIsLive()) {
      this._paintLiveEventBrightness();
      return;
    }
    this._patchDialFromSession();
    this._syncThemePreviewSurfaces();
    this._saveSoon();
  },

  _eventBrightnessIsLive() {
    return this._clockBrightDragging || this._brightnessScrubbing;
  },

  _beginBrightnessScrub() {
    if (this._brightnessScrubbing) {
      return;
    }
    this._brightnessScrubbing = true;
    this._eventBrightnessBases = new Map();
    this._clockLegendEl?.classList.add("bright-scrubbing");
    this._cancelClockBrightMotion();
  },

  _endBrightnessScrub() {
    if (!this._brightnessScrubbing) {
      return;
    }
    this._brightnessScrubbing = false;
    this._refreshInheritedLightDrafts?.();
    this._syncClockLegendBrightEdit();
    this._eventBrightnessBases = null;
    this._clockLegendEl?.classList.remove("bright-scrubbing");
    this._patchDialFromSession({
      applyTheme: this._editingThemeLook() || this._view === "theme",
    });
    this._syncThemePreviewSurfaces();
    this._saveSoon();
    const seconds =
      this._clockSunDisplayedSeconds ??
      this._clockStickySeconds ??
      this._clockSunIdleSeconds();
    this._updateLightNameBrightness(seconds);
  },

  _resampleDialFromLiveBrightness() {
    if (!this._sunPath?.lights || !this._sunPath?.events) {
      return;
    }
    const events = this._sunPath.events;
    const lights = this._sunPath.lights.map((light) => {
      // Theme ring is the dial in the theme editor. Skipping it left the
      // preview on the previous brightness for the whole scrub.
      if (light.suggested) {
        return light;
      }
      const event_states = (light.event_states || []).map((row) => {
        const brightness = this._dialEventBrightness(row.event, light.entity_id);
        const base = row.state ? { ...row.state } : { state: "on" };
        base.brightness = brightness;
        if (brightness > 0) {
          base.state = "on";
        }
        return { ...row, state: base };
      });
      return { ...light, event_states };
    });
    this._sunPath = {
      ...this._sunPath,
      lights: resampleLightsForEvents(lights, events, draftRgb, {
        intermediatesPerSegment: 5,
      }),
    };
    this._paintClockRingFills(this._sunPath);
  },

  _paintClockRingFills(payload) {
    const ringLights = this._clockRingLights(payload?.lights || []);
    const rings = this._clockRingsHost?.querySelectorAll(":scope > .clock-ring") || [];
    if (rings.length !== ringLights.length) {
      return;
    }
    const paint = (nodeList) => {
      for (let index = 0; index < nodeList.length; index += 1) {
        const fill = nodeList[index].querySelector(".clock-ring-fill");
        if (fill && ringLights[index]) {
          fill.style.background = conicGradientFromSamples(
            ringLights[index].samples || []
          );
        }
      }
    };
    paint(rings);
    for (const glow of this._clockGlowLayer?.querySelectorAll(
      ":scope > .sun-light-clock-glow"
    ) || []) {
      paint(glow.querySelectorAll(":scope > .clock-ring"));
    }
  },

  _paintLiveEventBrightness() {
    const targets = {};
    for (const event of this._sunPath?.events || []) {
      if (this._eventButtonSeconds(event) == null) {
        continue;
      }
      targets[event.id] = this._dialEventBrightness(event.id);
    }
    this._cancelClockBrightMotion();
    this._clockBrightShown = targets;
    this._clockBrightTarget = { ...targets };
    this._clockBrightFrom = { ...targets };
    this._resampleDialFromLiveBrightness();
    this._placeClockBrightnessHandles();
    this._layoutClockEventSpokes();
    this._layoutClockBrightnessCurve();
    this._syncThemePreviewSurfaces();
    const seconds =
      this._clockSunDisplayedSeconds ??
      this._clockStickySeconds ??
      this._clockSunIdleSeconds();
    this._updateLightNameBrightness(seconds);
  },

  _lightModeFlags(entityId) {
    const modes =
      this._hass?.states?.[entityId]?.attributes?.supported_color_modes || [];
    const onOff = modes.length > 0 && modes.every((mode) => mode === "onoff");
    const hasColor = modes.some((mode) =>
      ["hs", "xy", "rgb", "rgbw", "rgbww", "color_temp"].includes(mode)
    );
    return {
      known: modes.length > 0,
      onOff,
      brightnessOnly: modes.length > 0 && !onOff && !hasColor,
      temperatureOnly: modes.includes("color_temp") && !modes.some(mode => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(mode)),
    };
  },

  /** On/off is only on or off. Brightness-only keeps level and drops color. */
  _editorLightState(entityId, state) {
    const flags = this._lightModeFlags(entityId);
    const source = state || {};
    if (!flags.known) {
      return source;
    }
    if (flags.onOff) {
      const off = source.state === "off" || source.brightness === 0;
      return { state: off ? "off" : "on" };
    }
    if (flags.brightnessOnly) {
      const next = { state: source.state || "on" };
      if (source.brightness != null) {
        next.brightness = source.brightness;
      }
      return next;
    }
    if (flags.temperatureOnly && ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(source.color_mode)) {
      // Match activation: unsupported chromatic values do not become a
      // temperature command. Keep the level; the lamp retains its temperature.
      return Object.fromEntries(Object.entries(source).filter(([key]) =>
        ["state", "brightness", "effect"].includes(key)));
    }
    return source;
  },

  _lightEventStoredState(light, eventId) {
    const adapt = (state) => this._editorLightState(light.entity_id, state);
    if (this._formData?.kind === "circadian" && this._themeDraft) {
      return adapt(resolveEventDraft(this._formData, this._themeDraft, eventId, light.entity_id, this._variables));
    }
    const ov = this._formData?.overrides?.[light.entity_id]?.[eventId];
    if (ov) {
      return adapt({ state: ov.state || "on", ...ov });
    }
    const row = (light.event_states || []).find((item) => item.event === eventId);
    const scenePalette = sceneEventPaletteId(this._formData, eventId);
    const themeEv = scenePalette ? null : this._themeDraft?.events?.[eventId];
    const ref = themeEv?.color?.variable_ref;
    if (row?.present && row.state) {
      const merged = { ...row.state };
      if (ref) {
        merged.variable_ref = ref;
        if (themeEv.color.palette_t != null) {
          merged.palette_t = themeEv.color.palette_t;
        }
        if (themeEv.color.palette_r != null) {
          merged.palette_r = themeEv.color.palette_r;
        }
        merged.assignment_seed = themeEv.assignment_seed;
      }
      if (this._themeDraft && !scenePalette) {
        const themeBri = Number(this._themeEventDraft(eventId).brightness);
        if (Number.isFinite(themeBri)) {
          merged.brightness = themeBri;
        }
      }
      return adapt(merged);
    }
    if (this._themeDraft && !scenePalette) {
      return adapt(this._themeEventDraft(eventId));
    }
    return adapt(this._eventDefaultLightState(light.entity_id, eventId));
  },

  _writeLightEventOverride(lightId, eventId, payload) {
    if (!this._formData.overrides) {
      this._formData.overrides = {};
    }
    const byLight = { ...(this._formData.overrides[lightId] || {}) };
    byLight[eventId] = payload;
    this._formData.overrides = {
      ...this._formData.overrides,
      [lightId]: byLight,
    };
  },

  _themeRingLight(events) {
    const drafts = {};
    for (const event of events || []) {
      drafts[event.id] = this._themeEventDraft(event.id);
    }
    return {
      entity_id: `theme:${this._themeLookId() || "draft"}`,
      name: this._themeDraft?.name || "Theme",
      theme_ring: true,
      suggested: false,
      in_area: true,
      event_states: (events || []).map((event) => ({
        event: event.id,
        present: true,
        scene_entity_id: `theme-event:${event.id}`,
        state: drafts[event.id],
      })),
    };
  },

  async _ensureThemeSunPath() {
    if (!this._hass || !this._sunPathEl || !this._themeDraft) {
      this._parkSunPath();
      return;
    }
    const solarKey = `theme-sun:${this._previewDate}:${this._duskMinimumSeconds()}:${this._dawnMaximumSeconds()}`;
    const generation = this._previewGeneration;
    if (!this._themeSolar || this._themeSolarKey !== solarKey) {
      const msg = {
        type: `${DOMAIN}/sun_path`,
        date: this._previewDate,
        dusk_minimum: this._duskMinimumSeconds(),
      };
      const solar = await this._hass.callWS(msg);
      if (generation !== this._previewGeneration || this._view !== "theme" || solarKey !== this._chartKey()) return;
      this._themeSolar = solar;
      this._themeSolarKey = solarKey;
    }
    const solar = this._themeSolar;
    const lights = resampleLightsForEvents(
      [this._themeRingLight(solar.events)],
      solar.events,
      draftRgb,
      { intermediatesPerSegment: 5 }
    );
    this._sunPath = { ...solar, lights };
    this._sunPathKey = solarKey;
    this._sunPathEl.hidden = false;
    this._drawSunPath();
    this._syncSharedEditorShell();
  },

  _themeLookId() {
    return (
      this._themeDraft?.id ||
      this._themeId ||
      this._formData?.theme_id ||
      "default"
    );
  },

  _editingThemeLook() {
    return this._view === "theme";
  },

  _rebuildThemeDial() {
    if (!this._editingThemeLook() || !this._sunPath?.events) {
      return;
    }
    this._sunPath = {
      ...this._sunPath,
      lights: resampleLightsForEvents(
        [this._themeRingLight(this._sunPath.events)],
        this._sunPath.events,
        draftRgb,
        { intermediatesPerSegment: 5 }
      ),
    };
    // Patch ring fills in place so sidebar drags keep a live dial without
    // rebuilding clock chrome (year rail / event dots) on every pointermove.
    // Direct `#theme/<id>` editing uses this single theme ring. A theme
    // sidebar on a circadian scene keeps that scene's light rings.
    if (this._clockRingsHost?.isConnected && this._patchLightClock(this._sunPath)) {
      this._displayedSunPath = this._sunPath;
      return;
    }
    this._drawSunPath();
  },

  _dialLightsFromSession(lights, events, { applyTheme = false } = {}) {
    const next = (lights || []).map((light) => {
      if (light.suggested || light.theme_ring) {
        return light;
      }
      const event_states = (light.event_states || []).map((row) => {
        if (this._formData?.kind === "circadian" && this._themeDraft && row.event) {
          return { ...row, present: true, state: this._lightEventStoredState(light, row.event) };
        }
        const sceneId = row.scene_entity_id;
        const overridden =
          this._formData?.overrides?.[light.entity_id]?.[row.event];
        if (overridden) {
          return {
            ...row,
            present: true,
            state: {
              state: overridden.state || "on",
              ...overridden,
            },
          };
        }
        const drafted = this._nativeDrafts[sceneId]?.entities?.[light.entity_id];
        if (drafted) {
          return { ...row, present: true, state: drafted };
        }
        if (this._nativeDrafts[sceneId]?.entities?.[light.entity_id] === null) {
          return { ...row, present: false, state: null };
        }
        if (
          applyTheme &&
          this._themeDraft &&
          row.event &&
          !sceneEventPaletteId(this._formData, row.event)
        ) {
          return {
            ...row,
            present: true,
            state: this._themeEventDraft(row.event),
          };
        }
        return row;
      });
      return { ...light, event_states };
    });
    return resampleLightsForEvents(next, events, draftRgb, {
      intermediatesPerSegment: 5,
    });
  },

  /** Replace ring samples with the solar-event resample. Does not paint. */
  _applySettledDialSamples({ applyTheme = false } = {}) {
    if (!this._sunPath?.lights || !this._sunPath?.events) {
      return false;
    }
    if (this._view === "theme" || (applyTheme && this._editingThemeLook())) {
      return false;
    }
    if (this._view !== "edit") {
      return false;
    }
    void this._ensureThemeDraft();
    this._sunPath = {
      ...this._sunPath,
      lights: this._dialLightsFromSession(this._sunPath.lights, this._sunPath.events, {
        applyTheme,
      }),
    };
    return true;
  },

  _patchDialFromSession({ applyTheme = false } = {}) {
    if (applyTheme && this._editingThemeLook()) {
      this._rebuildThemeDial();
      this._syncThemePreviewSurfaces();
      return;
    }
    if (this._view === "theme") {
      this._rebuildThemeDial();
      return;
    }
    if (!this._applySettledDialSamples({ applyTheme })) {
      return;
    }
    if (this._clockRingsHost?.isConnected && this._patchLightClock(this._sunPath)) {
      this._displayedSunPath = this._sunPath;
    } else {
      this._drawSunPath();
    }
    this._syncThemePreviewSurfaces();
  },

  async _toggleThemeEventSidebar(event) {
    if (!(await this._ensureThemeDraft())) {
      this._error = this._t("frontend.library.theme_missing", "Circadian preset not found");
      return;
    }
    const existing = this.shadowRoot?.querySelector(
      ".scene-sidebar.theme-event-dialog"
    );
    if (existing && !existing._closing && this._sidebarEventId === event.id) {
      await this._requestCloseSceneSidebar(existing);
      return;
    }
    await this._openThemeEventSidebar(event);
  },

  _eventWheelRows(eventId) {
    return (this._sunPath?.lights || [])
      .filter(light => !light.removed && !light.suggested && !light.theme_ring)
      .map(light => {
        const draft = this._lightEventStoredState(light, eventId);
        return { id: light.entity_id, label: light.name, draft, savedDraft: structuredClone(draft) };
      });
  },

  _randomizeSceneEvent(eventId) {
    const assignment = this._formData?.event_palettes?.[eventId];
    const fallback = this._themeDraft?.events?.[eventId];
    const paletteId = assignment?.palette_id || fallback?.color?.variable_ref;
    if (!paletteId || !variableIsPalette(this._variables.find(item => item.id === paletteId))) {
      return false;
    }
    this._commitUndo({ type: "event-randomize", eventId });
    this._formData.event_palettes = {
      ...this._formData.event_palettes,
      [eventId]: { ...assignment, palette_id: paletteId, assignment_seed: (Math.random() * 0xffffffff) >>> 0 },
    };
    this._refreshInheritedLightDrafts?.();
    this._clearPreviewCache();
    this._patchDialFromSession();
    this._syncOpenSceneCardFace();
    this._schedulePreview();
    this._saveSoon();
    return true;
  },

  async _openThemeEventSidebar(event) {
    const generation = this._eventSidebarGeneration = (this._eventSidebarGeneration || 0) + 1;
    const route = this._currentHash();
    const events = this._sunPath?.events || [];
    const drafts = new Map();
    for (const item of events) {
      drafts.set(item.id, this._themeEventDraft(item.id));
    }
    let currentId = event.id;
    const sceneEditor = this._view === "edit";
    let lightRows = [];
    const refreshLightRows = () => {
      lightRows = sceneEditor ? this._eventWheelRows(currentId) : [];
      const members = new Set(lightRows.map(row => row.id));
      this._legendSelectedIds = new Set([...(this._legendSelectedIds || [])].filter(id => members.has(id)));
    };
    refreshLightRows();
    let wheelCtl = null;
    let brightnessGraphCtl = null;
    const themeName =
      this._themeDraft?.name ||
      this._t("frontend.library.themes", "Circadian presets");
    const opened = await this._openSceneSidebar({
      title: event.name,
      subtitle: this._t("frontend.library.theme_event_subtitle", "{name} preset", {
        name: themeName,
      }),
      className: "light-dialog theme-event-dialog",
      onDismiss: () => {
        if (this._eventSidebarOwner === generation && this._dialBrightnessHook?.kind === "theme") {
          this._dialBrightnessHook = null;
        }
        brightnessGraphCtl?.disconnect();
        wheelCtl?.disconnect();
        if (this._eventSidebarOwner === generation) {
          this._refreshInheritedLightDrafts = null;
          this._syncOpenSceneWheel = null;
          this._syncEventOverrideControls = null;
          this._detachEventLight = null;
        }
        if (!sceneEditor && this._eventSidebarOwner === generation) {
          this._setSidebarEvent(null);
          this._setSidebarLight(null);
        }
        if (this._eventSidebarOwner === generation && this._currentHash() === route) {
          if (this._view === "edit") {
            this._sunPathKey = undefined;
            void this._ensureSunPath();
          }
          void this._saveNow();
        }
      },
    });
    if (!opened || generation !== this._eventSidebarGeneration || route !== this._currentHash()) return;
    this._eventSidebarOwner = generation;
    this._setSidebarEvent(event.id);
    if (sceneEditor) this._sidebarLightId = `theme:${this._themeLookId()}`;
    else this._setSidebarLight(`theme:${this._themeLookId()}`);
    this._dialBrightnessHook = {
      kind: "theme",
      drafts,
      sync: () => {
        brightnessGraphCtl?.sync();
        wheelCtl?.sync();
      },
    };
    if (this._view === "theme") {
      this._rebuildThemeDial();
    } else {
      this._patchDialFromSession({ applyTheme: true });
    }
    this._syncThemePreviewSurfaces();
    const { body } = opened;
    const duskSlot = document.createElement("div");
    const hint = document.createElement("p");
    hint.className = "sidebar-note theme-edit-banner";
    hint.textContent = this._t(
      "frontend.library.theme_edit_hint",
      "Editing {name} changes every circadian scene that still uses this circadian preset. Per-light overrides on those scenes stay as they are.",
      { name: themeName }
    );
    if (!sceneEditor) body.appendChild(hint);
    const source = document.createElement("div");
    source.className = "event-source";
    const overrides = document.createElement("div");
    overrides.className = "event-overrides";
    if (sceneEditor) {
      body.append(source);
      this._syncEventOverrideControls = () => this._renderEventOverrideControls(source, overrides, currentId);
      this._syncEventOverrideControls();
    }

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "theme-event-restore";
    restoreBtn.hidden = true;
    const restoreIcon = document.createElement("ha-icon");
    restoreIcon.setAttribute("icon", "mdi:restore");
    restoreIcon.setAttribute("aria-hidden", "true");
    const restoreLabel = document.createElement("span");
    restoreBtn.append(restoreIcon, restoreLabel);
    const syncRestore = () => {
      const spec = galleryTheme(this._themeDraft?.builtin_id)?.events?.[currentId];
      const draft = drafts.get(currentId);
      const diverged =
        !sceneEditor && Boolean(spec) &&
        themeDraftSignature(draft, this._variables) !== themeEventSignature(spec);
      restoreBtn.hidden = !diverged;
      const event = events.find((item) => item.id === currentId);
      restoreLabel.textContent = this._t(
        "frontend.gallery.reset_event",
        "Reset {name} to the original",
        { name: event?.name || currentId }
      );
    };
    restoreBtn.addEventListener("click", async () => {
      const spec = galleryTheme(this._themeDraft?.builtin_id)?.events?.[currentId];
      if (!spec) {
        return;
      }
      try {
        drafts.set(
          currentId,
          await this._draftFromThemePresetEvent(spec, drafts.get(currentId))
        );
      } catch (err) {
        this._error = err.message || String(err);
        return;
      }
      persist();
      wheelCtl?.sync();
      brightnessGraphCtl?.sync();
    });
    body.appendChild(restoreBtn);

    let undoCommitted = false;
    const persist = ({ history = true } = {}) => {
      if (history && !undoCommitted) {
        this._commitUndo({ type: "theme-event", eventId: currentId });
        undoCommitted = true;
      }
      for (const item of events) {
        this._writeThemeEventFromDraft(item.id, drafts.get(item.id));
      }
      syncRestore();
      if (this._eventBrightnessIsLive()) {
        this._paintLiveEventBrightness();
        return;
      }
      this._patchDialFromSession({ applyTheme: true });
      this._saveSoon();
    };
    brightnessGraphCtl = createLightBrightnessGraph({
      title: this._t("frontend.lights.brightness", "Brightness"),
      subtitle: this._t("frontend.lights.graph_sub", "0–100% by solar event"),
      getPoints: () =>
        events.map((item) => {
          const draft = sceneEditor ? resolveEventDraft(this._formData, this._themeDraft, item.id, "", this._variables) : drafts.get(item.id);
          return {
            eventId: item.id,
            sceneId: item.id,
            seconds: item.seconds,
            name: item.name,
            icon: item.icon,
            member: true,
            brightness: this._dialEventBrightness(item.id, null),
            rgb: draftRgb(draft),
            draft,
            active: item.id === currentId,
          };
        }),
      onSelect: (eventId) => {
        const next = events.find((item) => item.id === eventId);
        if (!next) {
          return;
        }
        currentId = eventId;
        this._setSidebarEvent(eventId);
        const titleEl =
          opened.host.querySelector("ha-dialog-header .title") ||
          opened.host.querySelector("[slot='title']");
        if (titleEl) {
          titleEl.textContent = next.name;
        }
        this._syncDuskMinimumSlot(duskSlot, eventId);
        refreshLightRows();
        this._syncEventOverrideControls?.();
        wheelCtl?.sync();
        brightnessGraphCtl?.sync();
        syncRestore();
      },
      onBrightness: (sceneId, brightness) => {
        const draft = drafts.get(sceneId);
        if (!draft) {
          return;
        }
        this._beginBrightnessScrub();
        if (sceneEditor) {
          this._writeDialEventBrightness(sceneId, brightness, { lightId: null, history: !undoCommitted });
          undoCommitted = true;
          brightnessGraphCtl?.sync();
          return;
        }
        draft.brightness = brightness;
        if (brightness > 0) {
          draft.state = "on";
        }
        persist();
        brightnessGraphCtl?.sync();
      },
      onDragEnd: () => {
        undoCommitted = false;
        this._endBrightnessScrub();
        wheelCtl?.sync();
      },
    });
    body.appendChild(brightnessGraphCtl.el);
    wheelCtl = createSceneColorWheel({
      t: (key, fallback, vars) => this._t(key, fallback, vars),
      pinFlip: this._wheelPinFlip || null,
      hasColor: true,
      hasTemp: true,
      tempMin: 2000,
      tempMax: 6500,
      ...this._wheelPalette(),
      getBasePalette: () => {
        const base = this._sceneBasePalette?.();
        if (!base?.palette_id) {
          return null;
        }
        return (this._variables || []).find((item) => item.id === base.palette_id) || null;
      },
      onPickPalette: async () => {
        await this._pickSceneBasePalette();
        wheelCtl?.sync();
      },
      onEditPalette: (id) => this._go(`palette/${id}`),
      showPath: false,
      groupNearby: sceneEditor,
      getCapabilities: row => sceneEditor ? lightWheelCaps(this._hass.states[row.id]?.attributes || {}) : { hasColor: true, hasTemp: true },
      getAssignmentEntityId: row => row.id,
      getState: () => sceneEditor ? {
        scenes: lightRows,
        sequence: lightRows.map(row => row.id),
        activeId: [...(this._legendSelectedIds || [])][0] || null,
        selectedIds: [...(this._legendSelectedIds || [])],
      } : {
        scenes: [{ id: currentId, draft: drafts.get(currentId), event: events.find(item => item.id === currentId) }],
        sequence: [currentId],
        activeId: currentId,
      },
      onSelectMany: ids => {
        this._legendSelectedIds = new Set(ids.filter(id => lightRows.some(row => row.id === id)));
        this._syncClockLightSelection();
        wheelCtl?.sync();
      },
      onSelect: (eventId, mods) => {
        if (sceneEditor) {
          if (!eventId) {
            this._legendSelectedIds = new Set();
            this._circadianTouchSelect = false;
            this._syncClockLightSelection();
            wheelCtl?.sync();
            return;
          }
          this._selectCircadianLight(eventId, { ...mods, ctrlKey: mods?.toggleKey }, { open: false });
          wheelCtl?.sync();
          return;
        }
        if (!events.some(item => item.id === eventId)) return;
        currentId = eventId;
        this._setSidebarEvent(eventId);
        brightnessGraphCtl?.sync();
        wheelCtl?.sync();
        this._syncDuskMinimumSlot(duskSlot, eventId);
        syncRestore();
      },
      onChange: ({ fromPalette, dragging } = {}) => {
        if (sceneEditor) {
          const dirty = lightRows.filter(row => JSON.stringify(row.draft) !== JSON.stringify(row.savedDraft));
          if (!dirty.length) { if (!dragging) undoCommitted = false; return; }
          if (!undoCommitted) {
            this._commitUndo({ type: "event-lights", eventId: currentId });
            undoCommitted = true;
          }
          for (const row of dirty) {
            const changedColor = ["color_mode", "color_temp_kelvin", "hs_color", "rgb_color", "xy_color", "white"].some(key => JSON.stringify(row.savedDraft[key]) !== JSON.stringify(row.draft[key]));
            if (!fromPalette && changedColor) {
              delete row.draft.variable_ref;
              delete row.draft.palette_t;
              delete row.draft.palette_r;
            }
            this._writeLightEventOverride(row.id, currentId, eventOverrideAfterEdit(
              this._formData.overrides?.[row.id]?.[currentId], row.savedDraft, row.draft
            ));
            row.savedDraft = structuredClone(row.draft);
          }
          this._clearPreviewCache();
          this._patchDialFromSession();
          this._schedulePreview();
          this._saveSoon();
          this._syncEventOverrideControls?.();
          this._syncClockLegendBrightEdit();
          brightnessGraphCtl?.sync();
          if (!dragging) undoCommitted = false;
          return;
        }
        const draft = drafts.get(currentId);
        if (draft && !fromPalette) {
          delete draft.variable_ref;
          delete draft.palette_t;
          delete draft.palette_r;
        }
        persist();
        brightnessGraphCtl?.sync();
      },
      getAssignmentSeed: () =>
        Number(this._formData?.event_palettes?.[currentId]?.assignment_seed) ||
        Number(drafts.get(currentId)?.assignment_seed) ||
        Number(this._themeDraft?.events?.[currentId]?.assignment_seed) ||
        0,
      onRandomizeSeed: () => {
        if (sceneEditor) {
          this._randomizeSceneEvent(currentId);
          return;
        }
        const ev = this._themeDraft?.events?.[currentId];
        if (!ev) {
          return;
        }
        ev.assignment_seed = (Math.random() * 0xffffffff) >>> 0;
        const draft = drafts.get(currentId);
        if (draft) {
          draft.assignment_seed = ev.assignment_seed;
          delete draft.palette_t;
          delete draft.palette_r;
        }
        persist();
        wheelCtl?.sync();
      },
    });
    body.appendChild(wheelCtl.el);
    if (sceneEditor) {
      this._refreshInheritedLightDrafts = () => {
        refreshLightRows();
        this._syncClockLegendBrightEdit();
        wheelCtl.sync();
        brightnessGraphCtl.sync();
        this._syncEventOverrideControls?.();
      };
      this._syncOpenSceneWheel = () => wheelCtl.sync();
      this._detachEventLight = id => id ? wheelCtl.detach(id) : wheelCtl.clearDetached();
    }
    body.append(duskSlot);
    if (sceneEditor) body.append(overrides);
    this._syncDuskMinimumSlot(duskSlot, currentId);
    wheelCtl.sync();
    brightnessGraphCtl.sync();
    syncRestore();
  },

  _selectAllCaption(total, selected = 0) {
    return selected
      ? this._t("frontend.lights.n_selected_of_total", "{count} of {total} selected", { count: selected, total })
      : this._t("frontend.lights.select_all_count", "Select all ({count})", { count: total });
  },

  _circadianSelectionBrightness(id) {
    if (this._sidebarEventId) return this._dialEventBrightness(this._sidebarEventId, id);
    const light = this._sunPath.lights.find(row => row.entity_id === id);
    return this._clockLegendTileLook(light, this._clockSunIdleSeconds()).fillPct * 255 / 100;
  },

  _createCircadianSelectAll() {
    const { selector, tile, hit } = createLightTile({
      entityId: "__select_all__",
      name: this._selectAllCaption(this._circadianMemberIds().length),
      makeIcon: () => { const icon = document.createElement("ha-icon"); icon.setAttribute("icon", "mdi:select-all"); return icon; },
    });
    selector.classList.add("select-all-tile");
    const targets = () => {
      const members = this._circadianMemberIds();
      const selected = members.filter(id => this._legendSelectedIds?.has(id));
      return selected.length ? selected : members;
    };
    const binary = id => this._lightModeFlags(id).onOff;
    const displayed = () => {
      const values = targets().filter(id => !binary(id)).map(id => this._circadianSelectionBrightness(id) * 100 / 255);
      return selectAllDisplayedFill(values) ?? (targets().some(id => this._circadianSelectionBrightness(id) > 0) ? 100 : 0);
    };
    const pickAll = ev => {
      ev.stopPropagation();
      if (tile._lightTileSuppressTap || !this._requireCircadianEvent()) return;
      this._legendSelectedIds = new Set(this._legendSelectedIds?.size > 1 ? [] : this._circadianMemberIds());
      this._circadianTouchSelect = false;
      this._syncClockLightSelection();
      this._syncOpenSceneWheel?.();
      this._syncCircadianSelectAll?.();
      if (this._legendSelectedIds.size) this._reopenCircadianEvent();
    };
    tile.addEventListener("click", pickAll);
    tile.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pickAll(ev); } });
    let base = null;
    bindLightTileBrightness(tile, hit, {
      isEditable: () => Boolean(this._sidebarEventId),
      onBlocked: () => this._requireCircadianEvent(),
      isBinary: () => targets().every(binary),
      getBrightness: () => displayed() * 255 / 100,
      setBrightness: (value, { history } = {}) => {
        if (!this._requireCircadianEvent()) return;
        if (history || !base) {
          this._commitUndo({ type: "event-lights", eventId: this._sidebarEventId });
          base = { eventId: this._sidebarEventId, shown: displayed(), values: targets().map(id => ({ id, brightness: this._dialEventBrightness(this._sidebarEventId, id) })) };
        }
        if (base.eventId !== this._sidebarEventId) return;
        for (const entry of base.values) {
          const percent = binary(entry.id) ? (value >= 127.5 ? 100 : 0) : proportionalFillPercent(entry.brightness * 100 / 255, base.shown, value * 100 / 255);
          this._writeLightEventOverride(entry.id, base.eventId, { ...(this._formData.overrides?.[entry.id]?.[base.eventId] || {}), brightness: Math.round(percent * 255 / 100) });
        }
        this._refreshCircadianEvent();
      },
      onDragEnd: () => { base = null; },
    });
    this._syncCircadianSelectAll = () => {
      if (!tile.isConnected) return;
      const caption = this._selectAllCaption(this._circadianMemberIds().length, this._legendSelectedIds?.size > 1 ? this._legendSelectedIds.size : 0);
      for (const name of selector.querySelectorAll(".simple-light-name")) if (name.textContent !== caption) name.textContent = caption;
      tile.setAttribute("aria-label", caption);
      const fillPct = displayed();
      paintSelectAllTile(selector, { fillPct, selected: this._legendSelectedIds?.size > 1, brightnessLabel: targets().every(binary) ? this._lightTileValueLabel(targets()[0], fillPct) : undefined });
    };
    paintSelectAllTile(selector, { fillPct: displayed(), selected: false });
    return selector;
  },

  _circadianMemberIds() {
    return (this._sunPath?.lights || []).filter(row => !row.removed && !row.suggested && !row.theme_ring).map(row => row.entity_id);
  },

  _requireCircadianEvent() {
    if (this._sidebarEventId && this._sunPath?.events?.some(event => event.id === this._sidebarEventId)) return true;
    this._eventGuidance ||= new EventGuidance({
      reducedMotion: () => this._prefersReducedMotion(),
      show: () => {
        const legend = this._clockLegendEl;
        if (!legend) return;
        legend.classList.add("event-required");
        const message = document.createElement("div");
        message.className = "event-required-message";
        message.setAttribute("role", "status");
        const text = document.createElement("span");
        text.textContent = this._t("frontend.lights.select_event_first", "Select a solar event before changing lights");
        const copies = document.createElement("div");
        copies.className = "event-copies";
        copies.setAttribute("aria-hidden", "true");
        for (const event of this._sunPath?.events || []) {
          const copy = document.createElement("span");
          copy.className = "event-copy";
          const icon = document.createElement("ha-icon");
          icon.setAttribute("icon", event.icon);
          copy.append(icon);
          copies.append(copy);
        }
        message.append(text, copies);
        legend.append(message);
        this._eventGuidanceMessage = message;
        requestAnimationFrame(() => { if (message.isConnected) message.classList.add("visible"); });
      },
      hide: immediate => {
        const message = this._eventGuidanceMessage;
        message?.classList.remove("visible");
        message?.parentElement?.classList.remove("event-required");
        if (immediate) {
          message?.remove();
          this._eventGuidanceMessage = null;
          for (const animation of this._eventGuidanceAnimations || []) animation.cancel();
          this._eventGuidanceAnimations = [];
        }
      },
      pulse: () => {
        this._eventGuidanceAnimations = [...this.shadowRoot.querySelectorAll(".clock-event[data-event-id]")].map(button =>
          button.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)", offset: .5 }, { transform: "scale(1)" }], { duration: 500, easing: "cubic-bezier(.2,0,0,1)" }));
      },
    });
    this._eventGuidance.show();
    return false;
  },

  _selectCircadianLight(id, ev = {}, { open = true } = {}) {
    if (!this._requireCircadianEvent()) return;
    const ids = this._circadianMemberIds();
    if (!ids.includes(id)) return;
    const inSelectMode = this._circadianTouchSelect || this._legendSelectedIds?.size > 1;
    const result = tileSelectionAfterClick({ ids, selected: [...(this._legendSelectedIds || [])], anchorId: this._circadianAnchor,
      entityId: id, shiftKey: Boolean(ev.shiftKey) && !inSelectMode,
      toggleKey: Boolean(ev.metaKey || ev.ctrlKey || ev.toggleKey) || (inSelectMode && !ev.shiftKey) });
    this._legendSelectedIds = new Set(result.selected);
    this._circadianAnchor = result.anchorId;
    if (!result.selected.length) this._circadianTouchSelect = false;
    this._detachEventLight?.(result.selected.length === 1 ? result.selected[0] : null);
    this._syncClockLightSelection();
    this._syncOpenSceneWheel?.();
    this._syncCircadianSelectAll?.();
    revealLightActionsNow(this.shadowRoot);
    if (open) this._reopenCircadianEvent();
  },

  _reopenCircadianEvent() {
    const host = this.shadowRoot.querySelector(".theme-event-dialog");
    if (host && !host._closing) return;
    const event = this._sunPath?.events.find(row => row.id === this._sidebarEventId);
    if (event) void this._openThemeEventSidebar(event);
  },

  _resetCircadianLight(id) {
    if (!this._requireCircadianEvent()) return;
    this._commitUndo({ type: "event-lights", eventId: this._sidebarEventId });
    this._deleteLightEventOverride(id, this._sidebarEventId);
    this._refreshCircadianEvent();
  },

  _resetCircadianEventLightOverrides() {
    if (!this._requireCircadianEvent()) return;
    const eventId = this._sidebarEventId;
    const ids = Object.keys(this._formData.overrides || {}).filter(id =>
      Object.keys(this._formData.overrides[id]?.[eventId] || {}).length);
    if (!ids.length) return;
    this._commitUndo({ type: "event-lights", eventId });
    for (const id of ids) this._deleteLightEventOverride(id, eventId);
    this._refreshCircadianEvent();
  },

  _refreshCircadianEvent() {
    this._clearPreviewCache();
    this._refreshInheritedLightDrafts?.();
    this._patchDialFromSession();
    this._syncOpenSceneCardFace();
    this._syncEventOverrideControls?.();
    this._syncClockLegendBrightEdit();
    this._placeLegendModeGroups(this._clockLegendEl?.querySelector(".light-tiles"));
    this._schedulePreview();
    this._saveSoon();
  },

  _renderEventOverrideControls(source, summary, eventId) {
    const scene = this._formData;
    const theme = this._themeDraft;
    const assignment = scene.event_palettes?.[eventId];
    const inheritedId = theme.events?.[eventId]?.color?.variable_ref;
    const palette = (this._variables || []).find(item => item.id === (assignment?.palette_id || inheritedId) && variableIsPalette(item));
    const split = document.createElement("div");
    split.className = "scene-palette-split";
    const main = document.createElement("button");
    main.type = "button";
    main.className = "scene-used-chip";
    const swatch = document.createElement("span");
    swatch.className = "scene-used-swatch";
    const inherited = resolveEventDraft(scene, theme, eventId, "", this._variables);
    swatch.style.background = palette ? paletteSwatchCss(palette, this._variables, draftRgb) : variableSwatchCss({ color: inherited, brightness: inherited.brightness }, this._variables);
    const name = document.createElement("span");
    const event = this._sunPath.events.find(row => row.id === eventId);
    name.textContent = palette?.name || `${scene.scene_name} → ${event?.name || eventId}`;
    main.append(swatch, name);
    main.addEventListener("click", () => palette ? this._go(`palette/${palette.id}`) : this._pickSceneBasePalette());
    const choose = document.createElement("button");
    choose.type = "button";
    choose.className = "scene-used-chip";
    choose.setAttribute("aria-label", this._t("frontend.library.pick_scene_preset", "Choose scene preset"));
    const chevron = document.createElement("ha-icon");
    chevron.setAttribute("icon", "mdi:chevron-down");
    choose.append(chevron);
    choose.addEventListener("click", () => this._pickSceneBasePalette());
    split.append(main, choose);
    if (palette) {
      const shuffle = document.createElement("ha-icon-button");
      shuffle.className = "scene-palette-edit event-randomize";
      shuffle.label = this._t("frontend.dialogs.scene_palette_randomize", "Randomize");
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", PALETTE_RANDOMIZE_ICON);
      shuffle.append(icon);
      shuffle.addEventListener("click", () => this._randomizeSceneEvent(eventId));
      split.append(shuffle);
    }
    const resetLabel = this._t("frontend.lights.reset_overrides", "Reset overrides");
    const resetButton = callback => {
      const button = document.createElement("ha-button");
      button.appearance = "plain";
      button.textContent = resetLabel;
      button.addEventListener("click", callback);
      return button;
    };
    if (eventSourceChanged(scene, theme, eventId)) split.append(resetButton(() => {
      this._commitUndo({ type: "event-lights", eventId });
      delete this._formData.event_palettes[eventId];
      this._refreshCircadianEvent();
    }));
    const sourceKey = JSON.stringify([eventId, palette?.id, name.textContent, swatch.style.background, eventSourceChanged(scene, theme, eventId)]);
    if (source.dataset.renderKey !== sourceKey) {
      source.replaceChildren(split);
      source.dataset.renderKey = sourceKey;
    }
    const rows = lightOverrideRows(scene, theme, eventId, this._variables, (id, state) => this._editorLightState(id, state));
    const baselineName = palette?.name || theme.name || scene.scene_name;
    const summaryKey = JSON.stringify([eventId, baselineName, event?.name, rows, rows.map(row => this._lightDisplayName(row.id))]);
    if (summary.dataset.renderKey === summaryKey) return;
    const focusedLight = summary.contains(this.shadowRoot.activeElement) ? this.shadowRoot.activeElement?.dataset.lightId : null;
    summary.replaceChildren();
    summary.dataset.renderKey = summaryKey;
    const heading = document.createElement("div");
    heading.className = "event-overrides-heading";
    const sectionTitle = document.createElement("strong");
    sectionTitle.textContent = this._t("frontend.lights.overrides_title", "Light overrides");
    const resetAll = resetButton(() => this._resetCircadianEventLightOverrides());
    resetAll.textContent = this._t("frontend.lights.reset_all", "Reset all");
    resetAll.disabled = !rows.length;
    resetAll.dataset.lightId = "__all__";
    heading.append(sectionTitle, resetAll);
    const explanation = document.createElement("p");
    explanation.className = "event-overrides-explanation";
    explanation.textContent = this._t("frontend.lights.overrides_explanation",
      "Changes from {source} at {event}, including event brightness adjustments and each light’s capabilities. They apply only to this scene and event; shared presets stay unchanged.",
      { source: baselineName, event: event?.name || eventId });
    summary.append(heading, explanation);
    if (focusedLight === "__all__") resetAll.focus({ preventScroll: true });
    const valueText = (state, field) => {
      if (field === "color") {
        if (state.color_temp_kelvin != null) return `${state.color_temp_kelvin} K`;
        if (!state.color_mode) return "—";
        return `#${draftRgb(state).map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
      }
      if (field === "brightness") return state.brightness == null ? "—" : `${Math.round(state.brightness * 100 / 255)}%`;
      if (field === "state") return state.state === "off" ? this._t("frontend.lights.off", "Off") : this._t("frontend.lights.power", "On");
      return String(state[field] ?? "—");
    };
    for (const row of rows) {
      const container = document.createElement("div");
      container.className = "event-override-row";
      const description = document.createElement("div");
      description.className = "event-override-description";
      const title = document.createElement("strong");
      title.textContent = this._lightDisplayName(row.id, { fallback: row.id });
      description.append(title);
      for (const field of row.fields) {
        const line = document.createElement("p");
        line.textContent = `${this._t(`frontend.lights.override_${field}`, field)}: ${valueText(row.before, field)} → ${valueText(row.after, field)}`;
        description.append(line);
      }
      const reset = resetButton(() => this._resetCircadianLight(row.id));
      reset.dataset.lightId = row.id;
      container.append(description, reset);
      summary.append(container);
      if (focusedLight === row.id) reset.focus({ preventScroll: true });
    }
  },

  _setSidebarEvent(eventId) {
    this._sidebarEventId = eventId || null;
    if (eventId) {
      this._eventGuidance?.cancel();
      if (this._scenePlayActive()) {
        this._stopScenePlay({ restore: !this._roomPreview });
      }
      this._clockStickySeconds = undefined;
    }
    const host = this.shadowRoot?.querySelector(".scene-sidebar");
    if (host) {
      host._eventId = this._sidebarEventId;
    }
    this._syncEventSelection();
    this._syncClockLegendBrightEdit();
    this._placeLegendModeGroups(this._clockLegendEl?.querySelector(".light-tiles"));
    if (this._clockSunEl && this._sunPath?.curve) {
      this._clockSunLive = false;
      this._moveClockSunTo(this._clockSunIdleSeconds());
      if (this._hoverSeconds == null) {
        this._fillHoverReadout(this._idleReadoutSeconds(), { hovering: false });
      }
    }
    this._scheduleScenePreviewApply({
      force: true,
      transition: SCENE_PLAY_TRANSITION_SEC,
    });
    this._syncSceneUsed();
  },

  _setSidebarLight(entityId) {
    this._sidebarLightId = entityId || null;
    if (!entityId || !String(entityId).startsWith("light.")) {
      this._legendSelectedIds = new Set();
    } else {
      this._legendSelectedIds = new Set([entityId]);
    }
    this._syncClockLightSelection();
    revealLightActionsNow(this.shadowRoot);
    this._layoutDialChromeFn?.();
  },

  /** Drop ring hover highlight (touch scrub / mouse leave). */
  _clearClockRingHover() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    for (const ring of root.querySelectorAll(".clock-ring.hovered")) {
      ring.classList.remove("hovered");
    }
    const name = root.querySelector(".clock-ring-hover-name");
    if (name) {
      name.hidden = true;
    }
  },

  _syncClockLightSelection() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const selected = this._sidebarLightId;
    for (const ring of root.querySelectorAll(".clock-ring[data-entity-id]")) {
      const on = this._view === "edit" ? Boolean(this._legendSelectedIds?.has(ring.dataset.entityId)) : ring.dataset.entityId === selected;
      ring.classList.toggle("selected", on);
      if (on) {
        ring.setAttribute("aria-current", "true");
      } else {
        ring.removeAttribute("aria-current");
      }
    }
    const picked = this._legendSelectedIds;
    root.querySelector(".light-tiles")?.classList.toggle(
      "select-mode",
      Boolean(picked && picked.size > 1)
    );
    for (const row of root.querySelectorAll(
      ".simple-light-selector[data-entity-id]"
    )) {
      const on = picked
        ? picked.has(row.dataset.entityId)
        : row.dataset.entityId === selected;
      row.classList.toggle("active", on);
      row.classList.toggle("selected", on);
      if (on) {
        row.setAttribute("aria-current", "true");
      } else {
        row.removeAttribute("aria-current");
      }
    }
  },

  _syncEventSelection() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const selected = this._sidebarEventId;
    for (const item of root.querySelectorAll(
      ".sun-event[data-event-id], .clock-event[data-event-id]"
    )) {
      const on = item.dataset.eventId === selected;
      item.classList.toggle("selected", on);
      if (on) {
        item.setAttribute("aria-current", "true");
      } else {
        item.removeAttribute("aria-current");
      }
    }
  },

  _syncClockLegendBrightEdit() {
    const editing = Boolean(this._sidebarEventId) && this._view === "edit";
    this._clockLegendEl?.classList.toggle("event-bright-edit", editing);
    this._syncCircadianSelectAll?.();
    for (const row of this._clockLegendEl?.querySelectorAll(".simple-light-selector[data-entity-id]") || []) {
      const button = row.querySelector(".light-remove");
      if (!button) continue;
      const reset = Boolean(this._formData?.overrides?.[row.dataset.entityId]?.[this._sidebarEventId]);
      button.querySelector("ha-icon")?.setAttribute("icon", reset ? "mdi:restore" : "mdi:close");
      const label = reset ? this._t("frontend.lights.reset_overrides", "Reset overrides") : this._t("frontend.lights.remove_named_from_scene", "Remove {name} from the scene", { name: this._lightDisplayName(row.dataset.entityId) });
      button.title = label;
      button.setAttribute("aria-label", label);
    }
    const copy = this._clockLegendEl?.querySelector(".light-tiles-hint span");
    if (copy) {
      copy.textContent = editing
        ? this._t(
            "frontend.lights.tiles_hint_brightness",
            "Drag or scroll on the light tiles to change the brightness"
          )
        : this._t(
            "frontend.lights.tiles_hint_pick",
            "Select a solar event or a light to edit it, or drag the sun to preview the lights at a point in time"
          );
    }
  },

  _lightTileValueLabel(entityId, fillPct) {
    const modes =
      this._hass?.states?.[entityId]?.attributes?.supported_color_modes || [];
    if (!modes.length || !modes.every((mode) => mode === "onoff")) {
      return undefined;
    }
    return lightTileValueLabel(fillPct, {
      onOff: true,
      onText: this._t("frontend.lights.power", "On"),
      offText: this._t("frontend.lights.off", "Off"),
    });
  },

  _clockLegendTileLook(light, seconds) {
    const flags = this._lightModeFlags(light.entity_id);
    const neutral = (on) => (on ? [255, 255, 255] : [48, 48, 48]);
    const eventId = this._sidebarEventId;
    if (
      eventId &&
      this._clockStickySeconds == null &&
      (this._sunPath?.events || []).some((item) => item.id === eventId)
    ) {
      const stored = this._lightEventStoredState(light, eventId);
      if (flags.onOff) {
        const on = stored?.state !== "off";
        return { rgb: neutral(on), fillPct: on ? 100 : 0 };
      }
      const rgb = flags.brightnessOnly
        ? neutral(stored?.state !== "off")
        : draftRgb(stored) || [0, 0, 0];
      const bri = this._eventBrightnessIsLive()
        ? this._dialEventBrightness(eventId, light.entity_id)
        : Number(stored?.brightness);
      const fillPct =
        stored?.state === "off" || !(bri > 0) ? 0 : (bri * 100) / 255;
      return { rgb, fillPct };
    }
    if (seconds == null) {
      return null;
    }
    const sample = interpolateLightSample(light.samples || [], seconds);
    if (flags.onOff) {
      const on = sample.brightness > 0;
      return { rgb: neutral(on), fillPct: on ? 100 : 0 };
    }
    if (flags.brightnessOnly) {
      return { rgb: neutral(sample.brightness > 0), fillPct: sample.brightness };
    }
    return { rgb: sample.rgb, fillPct: sample.brightness };
  },

  _clearSelectedSolarEvent() {
    if (!this._sidebarEventId) return;
    this._setSidebarEvent(null);
    this._closeSceneSidebar({ animate: true, clearSelection: false });
  },

  async _toggleEventSceneDialog(event) {
    if (this._sidebarEventId === event.id && this._view === "edit") {
      this._clearSelectedSolarEvent();
      return;
    }
    await this._toggleThemeEventSidebar(event);
  }
};
