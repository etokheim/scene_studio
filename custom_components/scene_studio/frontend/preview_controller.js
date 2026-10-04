/* preview controller owns these panel methods.
 * The receiver is the panel: navigation, rendering and saving remain host hooks.
 * Keep closures bound to that receiver; do not bind methods to a separate object. */
import { sameLocation } from "./location_helpers.js";
import {
  DOMAIN,
  SECONDS_PER_DAY,
  DATE_MORPH_MS,
  PREVIEW_REFINE_MS,
  SCENE_PLAY_TICK_MS,
  SCENE_PLAY_TRANSITION_SEC,
  SCENE_PLAY_DURATION_OPTIONS_SEC,
} from "./panel_constants.js";
import { capturePreviewExit, waitForSurfaceAnimation } from "./editor_shell.js";
import { buildClientSunDay, resampleLightsForEvents } from "./client_solar.js";
import { draftRgb, applyVariableToDraft } from "./color_ui.js";
import { samplePaletteWheel, variableIsPalette } from "./palette.js";
import { todayIso, shiftIsoDate, diffIsoDays } from "./editor_session.js";
import { interpolateLightSample, easeOutCubic, lerpSunPath } from "./dial_clock.js";

export const previewControllerMethods = {
  _editorMotionKind() {
    if (this._view === "theme") {
      return "dial";
    }
    if (this._view === "variable") {
      return "library";
    }
    if (this._view === "palette") {
      return "wheel";
    }
    if (this._view === "edit") {
      if (this._formData?.kind === "simple") {
        return "wheel";
      }
      return "dial";
    }
    return "none";
  },

  _motionKindForSceneId(sceneId) {
    const item = (this._items || []).find((scene) => scene.id === sceneId);
    if (item?.kind === "simple") {
      return "wheel";
    }
    if (item) {
      return "dial";
    }
    return this._formData?.kind === "simple" ? "wheel" : "dial";
  },

  _motionKindForHash(hash) {
    const value = String(hash || "").replace(/^#/, "");
    if (value.startsWith("theme/")) {
      return "dial";
    }
    if (value.startsWith("variable/")) {
      return "library";
    }
    if (value.startsWith("palette/")) {
      return "wheel";
    }
    const edit = value.match(/^edit\/(.+)$/);
    if (edit) {
      return this._motionKindForSceneId(edit[1]);
    }
    return "none";
  },

  _prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  _waitForAnimation(el, name, fallbackMs) {
    return waitForSurfaceAnimation(el, name, fallbackMs);
  },

  _disposeOutgoingStageLayer() {
    const layer = this._outgoingStageLayer;
    this._outgoingStageLayer = null;
    if (!layer) {
      return;
    }
    if (layer.classList.contains("editor-preview-exit")) { layer.remove(); return; }
    const hadSun = this._sunPathEl && layer.contains(this._sunPathEl);
    layer.remove();
    if (hadSun) {
      this._parkSunPath();
    }
    if (this._editorMotionKind() !== "dial") {
      this._dropClockLegends();
    }
    // Incoming dial may have skipped horizon layout while the overlay existed.
    this._layoutDialChromeFn?.();
  },

  _startOutgoingExitAnimation(layer) {
    if (!layer || layer.classList.contains("stage-motion-exit-active")) {
      return;
    }
    void layer.offsetWidth;
    layer.classList.add("stage-motion-exit-active");
    void this._waitForAnimation(layer, "stage-surface-exit-scale", 480).then(
      () => {
        if (this._outgoingStageLayer === layer) {
          this._disposeOutgoingStageLayer();
        }
      }
    );
  },

  _liftOutgoingStageLayer() {
    const shell = this._sharedEditorShell;
    if (shell?.el.isConnected) {
      this._outgoingStageLayer?.remove();
      shell.previewGate.next();
      const visual = shell.preview.firstElementChild;
      const surface = visual?.querySelector(".sun-light-clock") || visual;
      if (surface) {
        this._outgoingStageLayer = capturePreviewExit(shell, surface,
          surface !== visual ? visual : null,
          this._clockHorizonBackEl?.isConnected ? [this._clockHorizonBackEl] : []);
        // The dial root is reused; its interrupted entrance must not restart
        // when it is mounted again after visiting another editor type.
        visual.classList.remove("editor-preview-enter");
        this._sharedEnterRequested = true;
      }
      return;
    }

    if (this._outgoingStageLayer) {
      return;
    }
    const stage = this._contentEl?.querySelector(".stage-col");
    const scroll = this._stageScrollEl(stage);
    const bg = this._stageBgEl(stage);
    if (!scroll?.firstChild && !bg?.firstChild) {
      return;
    }
    const layer = document.createElement("div");
    layer.className = "stage-motion-layer";
    // Enter classes survive their animation. Moving that node into the exit
    // layer restarts scale(0.92) while the layer scales the other way.
    for (const root of [scroll, bg]) {
      root
        ?.querySelectorAll(
          ".simple-editor-enter, .clock-face-enter, .stage-surface-enter"
        )
        .forEach((el) => {
          el.getAnimations().forEach((anim) => anim.cancel());
          el.classList.remove(
            "simple-editor-enter",
            "clock-face-enter",
            "stage-surface-enter"
          );
        });
    }
    // Horizon/bloom live on .stage-bg, not in the scrollport. Lift them with
    // the editor so they fade out instead of being re-parented onto the next
    // surface.
    while (bg?.firstChild) {
      layer.appendChild(bg.firstChild);
    }
    while (scroll?.firstChild) {
      layer.appendChild(scroll.firstChild);
    }
    if (
      this._clockHorizonBackEl &&
      layer.contains(this._clockHorizonBackEl)
    ) {
      this._clockHorizonBackEl = undefined;
    }
    this._outgoingStageLayer = layer;
    stage.appendChild(layer);
    this._startOutgoingExitAnimation(layer);
  },

  _attachOutgoingStageLayer(stage) {
    if (this._outgoingStageLayer?.classList.contains("editor-preview-exit")) return;
    const layer = this._outgoingStageLayer;
    if (!layer) {
      return;
    }
    if (!stage) {
      this._disposeOutgoingStageLayer();
      return;
    }
    if (layer.parentNode !== stage) {
      stage.appendChild(layer);
    }
    this._startOutgoingExitAnimation(layer);
  },

  _playSimpleEnterIfNeeded(el) {
    if (!el) {
      return;
    }
    if (this._simpleEnterPlayed || this._prefersReducedMotion()) {
      this._simpleEnterPlayed = true;
      return;
    }
    this._simpleEnterPlayed = true;
    void el.offsetWidth;
    el.classList.add("simple-editor-enter");
    const clear = (ev) => {
      if (ev.target !== el) {
        return;
      }
      if (ev.animationName && ev.animationName !== "stage-surface-enter-scale") {
        return;
      }
      finish();
    };
    const finish = () => {
      el.classList.remove("simple-editor-enter");
      el.removeEventListener("animationend", clear);
    };
    el.addEventListener("animationend", clear);
    // A child animation used to satisfy the listener, or the node was moved
    // before animationend, and the class stayed on. Reparenting then replayed
    // the enter scale inside the exit layer.
    window.setTimeout(finish, 480);
  },

  _prepareEmptyEnter(el) {
    if (!el) {
      return;
    }
    if (!this._emptyShouldEnter || this._prefersReducedMotion()) {
      this._emptyShouldEnter = false;
      this._emptyEnterPlayed = true;
      return;
    }
    el.classList.add("stage-surface-enter");
    this._emptyShouldEnter = false;
    this._emptyEnterPlayed = true;
    const clear = (ev) => {
      if (ev.animationName && ev.animationName !== "stage-surface-enter-scale") {
        return;
      }
      el.classList.remove("stage-surface-enter");
      el.removeEventListener("animationend", clear);
    };
    el.addEventListener("animationend", clear);
  },

  async _transitionSurfaces(fromKind, toKind) {
    if (this._sharedEditorShell?.el.isConnected) {
      this._sharedEditorShell.lights.inert = true;
      this._sharedEditorShell.toolbar.inert = true;
    }
    const from = fromKind || "none";
    const to = toKind || "none";
    if (from !== to && !this._prefersReducedMotion()) {
      this._liftOutgoingStageLayer();
      if (from === "dial") {
        this._forgetClockDom({ keepOverlay: true });
      }
    } else if (!this._outgoingStageLayer) {
      this._disposeOutgoingStageLayer();
    }
    if (to === "dial" && from === "dial") {
      this._clockEnterPlayed = true;
      // Keep the mounted dial and lerp the new scene's path into it.
      this._pathMorphMs = PREVIEW_REFINE_MS;
    } else if (to === "dial") {
      this._clockEnterPlayed = false;
    }
    if (to === "wheel" && from === "wheel") {
      this._wheelMorph = true;
      this._simpleEnterPlayed = true;
    } else if (to === "wheel") {
      this._wheelMorph = false;
      this._simpleEnterPlayed = false;
    } else {
      this._wheelMorph = false;
    }
    this._emptyShouldEnter =
      to === "none" && (from !== "none" || !this._emptyEnterPlayed);
  },

  _parkSunPath() {
    this._parkPageBanners();
    if (this._editorMotionKind() !== "dial") this._clearClockBackgrounds({ keepOverlay: true });
    if (!this._sunPathEl) {
      return;
    }
    if (this._outgoingStageLayer?.contains(this._sunPathEl)) {
      return;
    }
    const home = this._sunPathHome;
    if (home && this._sunPathEl.parentNode !== home) {
      const content = this._contentEl;
      if (content?.parentNode === home) {
        home.insertBefore(this._sunPathEl, content);
      } else {
        home.appendChild(this._sunPathEl);
      }
    }
    this._sunPathEl.hidden = true;
  },

  _parkPageBanners() {
    const el = this._pageBannersEl;
    const home = this._pageBannersHome;
    if (!el || !home || el.parentNode === home) {
      return;
    }
    const sun = this._sunPathEl;
    const content = this._contentEl;
    if (sun?.parentNode === home) {
      home.insertBefore(el, sun);
    } else if (content?.parentNode === home) {
      home.insertBefore(el, content);
    } else {
      home.insertBefore(el, home.firstChild);
    }
  },

  _mountPageBanners(stage) {
    const el = this._pageBannersEl;
    if (!el || !stage) {
      return;
    }
    const scroll = this._stageScrollEl(stage);
    if (el.parentNode === stage) {
      return;
    }
    // In-flow above the scrollport: rail stays full height; dial/list shift down.
    if (scroll?.parentNode === stage) {
      stage.insertBefore(el, scroll);
    } else {
      stage.appendChild(el);
    }
  },

  _mountSunPath(stage) {
    if (!this._sunPathEl || !stage) {
      return;
    }
    this._mountPageBanners(stage);
    const scroll = this._stageScrollEl(stage);
    if (this._sunPathEl.parentNode !== scroll) {
      scroll.appendChild(this._sunPathEl);
    }
    this._sunPathEl.hidden = false;
    this._bindStageScrollLayout(scroll);
  },

  _lightServicePayload(entityId, stored) {
    if (!stored || stored.state === "off") {
      return { service: "turn_off", data: { entity_id: entityId } };
    }
    const data = { entity_id: entityId };
    if (stored.brightness != null) {
      data.brightness = stored.brightness;
    }
    if (stored.effect != null && stored.effect !== "none") {
      data.effect = stored.effect;
    }
    // HA rejects two+ members of the Color descriptors exclusion group.
    // Prefer color_mode when present (same as light/reproduce_state).
    const mode = stored.color_mode;
    if (mode === "color_temp" && stored.color_temp_kelvin != null) {
      data.color_temp_kelvin = stored.color_temp_kelvin;
    } else if (mode === "rgbww" && stored.rgbww_color != null) {
      data.rgbww_color = stored.rgbww_color;
    } else if (mode === "rgbw" && stored.rgbw_color != null) {
      data.rgbw_color = stored.rgbw_color;
    } else if ((mode === "hs" || mode === "xy") && stored.hs_color != null) {
      data.hs_color = stored.hs_color;
    } else if (mode === "rgb" && stored.rgb_color != null) {
      data.rgb_color = stored.rgb_color;
    } else if (stored.rgbww_color != null) {
      data.rgbww_color = stored.rgbww_color;
    } else if (stored.rgbw_color != null) {
      data.rgbw_color = stored.rgbw_color;
    } else if (stored.hs_color != null) {
      data.hs_color = stored.hs_color;
    } else if (stored.rgb_color != null) {
      data.rgb_color = stored.rgb_color;
    } else if (stored.color_temp_kelvin != null) {
      data.color_temp_kelvin = stored.color_temp_kelvin;
    }
    return { service: "turn_on", data };
  },

  async _applyLightState(entityId, stored, { transition } = {}) {
    if (!this._isPhysicalLightEntityId(entityId)) {
      return;
    }
    const payload = this._lightServicePayload(entityId, stored);
    if (transition != null && Number(transition) > 0) {
      payload.data.transition = Number(transition);
    }
    await this._hass.callService("light", payload.service, payload.data);
  },

  _sampleToStoredState(sample) {
    if (!sample || !(sample.brightness > 0)) {
      return { state: "off" };
    }
    // Preview samples store brightness 0–100; light.turn_on wants 0–255.
    return {
      state: "on",
      brightness: Math.max(
        1,
        Math.min(255, Math.round((sample.brightness * 255) / 100))
      ),
      rgb_color: sample.rgb,
    };
  },

  _isPhysicalLightEntityId(entityId) {
    return String(entityId || "").startsWith("light.");
  },

  /** Theme rings (`theme:…`) and suggested/removed rows are not HA lights. */
  _isScenePreviewLight(light) {
    return Boolean(
      light &&
        !light.suggested &&
        !light.removed &&
        !light.theme_ring &&
        this._isPhysicalLightEntityId(light.entity_id)
    );
  },

  _perLightLiveEditOn() {
    return Boolean(this._liveEdit) && !this._readRoomPreviewPref();
  },

  _scenePlayActive() {
    return Boolean(this._scenePlay);
  },

  _simplePreviewEntityIds() {
    if (this._view !== "edit" || this._formData?.kind !== "simple") {
      return [];
    }
    const members = this._simpleMembershipLists().members;
    return members.filter((id) => this._isPhysicalLightEntityId(id));
  },

  _storedForSimplePreview(entityId) {
    const stored = {
      ...(this._formData?.lights?.[entityId] || { state: "on", brightness: 200 }),
    };
    if (!stored.variable_ref) {
      return stored;
    }
    const variable = (this._variables || []).find(
      (item) => item.id === stored.variable_ref
    );
    if (!variable) {
      return stored;
    }
    const brightness = stored.brightness;
    const state = stored.state;
    const paletteT = stored.palette_t;
    const paletteR = stored.palette_r;
    const levelOnly = this._lightModeFlags(entityId);
    applyVariableToDraft(stored, variable, {
      entityId,
      seed:
        Number(stored.assignment_seed) ||
        Number(this._formData?.assignment_seed) ||
        0,
      catalog: this._variables,
      levelOnly: Boolean(levelOnly.onOff || levelOnly.brightnessOnly),
    });
    if (brightness != null) {
      stored.brightness = brightness;
    }
    if (state) {
      stored.state = state;
    }
    if (
      !levelOnly.onOff &&
      !levelOnly.brightnessOnly &&
      paletteT != null &&
      paletteR != null &&
      variableIsPalette(variable)
    ) {
      const sampled = samplePaletteWheel(
        variable,
        paletteT,
        paletteR,
        this._variables,
        draftRgb
      );
      stored.rgb_color = sampled.rgb;
      stored.color_mode = "rgb";
    }
    return stored;
  },

  _scenePreviewWantsApply() {
    if (this._view !== "edit") {
      return false;
    }
    if (this._formData?.kind === "simple") {
      return this._roomPreview && this._simplePreviewEntityIds().length > 0;
    }
    return (
      Boolean(this._sunPath?.lights?.length) &&
      (this._roomPreview || this._scenePlayActive())
    );
  },

  _canPlayScenePreview() {
    return (
      this._view === "edit" &&
      this._formData?.kind !== "simple" &&
      Boolean(this._sunPath?.lights?.some((light) => this._isScenePreviewLight(light)))
    );
  },

  _captureScenePreviewSnapshots() {
    if (this._roomPreviewSnapshots) {
      return;
    }
    const snaps = {};
    const ids =
      this._formData?.kind === "simple"
        ? this._simplePreviewEntityIds()
        : (this._sunPath?.lights || [])
            .filter((light) => this._isScenePreviewLight(light))
            .map((light) => light.entity_id);
    for (const entityId of ids) {
      snaps[entityId] = this._snapshotLight(entityId);
    }
    this._roomPreviewSnapshots = snaps;
    this._scenePreviewOwnerId = this._editId;
  },

  _clearScenePreviewApplyTimer() {
    if (this._scenePreviewApplyTimer) {
      window.clearTimeout(this._scenePreviewApplyTimer);
      this._scenePreviewApplyTimer = undefined;
    }
    this._scenePreviewApplyPending = null;
  },

  _scheduleScenePreviewApply({
    transition = SCENE_PLAY_TRANSITION_SEC,
    force = false,
  } = {}) {
    if (!this._scenePreviewWantsApply()) {
      return;
    }
    if (force) {
      this._clearScenePreviewApplyTimer();
      this._scenePreviewLastApplyAt = performance.now();
      void this._applyRoomPreviewAtClock({ transition });
      return;
    }
    const now = performance.now();
    const last = this._scenePreviewLastApplyAt;
    if (last != null && now - last < SCENE_PLAY_TICK_MS) {
      this._scenePreviewApplyPending = { transition };
      if (!this._scenePreviewApplyTimer) {
        this._scenePreviewApplyTimer = window.setTimeout(() => {
          this._scenePreviewApplyTimer = undefined;
          const pending = this._scenePreviewApplyPending;
          this._scenePreviewApplyPending = null;
          if (pending) {
            this._scenePreviewLastApplyAt = performance.now();
            void this._applyRoomPreviewAtClock(pending);
          }
        }, SCENE_PLAY_TICK_MS - (now - last));
      }
      return;
    }
    this._scenePreviewLastApplyAt = now;
    void this._applyRoomPreviewAtClock({ transition });
  },

  async _restoreScenePreviewSnapshots() {
    const snaps = this._roomPreviewSnapshots;
    this._roomPreviewSnapshots = null;
    this._scenePreviewOwnerId = null;
    if (!snaps) {
      return;
    }
    await Promise.all(
      Object.entries(snaps).map(([entityId, stored]) =>
        this._applyLightState(entityId, stored)
      )
    );
  },

  async _abandonScenePreview() {
    this._scenePreviewEpoch += 1;
    this._stopScenePlay({ restore: false });
    this._clearScenePreviewApplyTimer();
    this._roomPreview = false;
    await this._restoreScenePreviewSnapshots();
    this._syncRoomPreviewControl();
    this._syncScenePlayButton();
  },

  async _setRoomPreview(on) {
    const next = Boolean(on);
    this._writeRoomPreviewPref(next);
    if (this._roomPreview === next) {
      this._syncRoomPreviewControl();
      if (next) {
        this._scheduleScenePreviewApply({
          force: true,
          transition: SCENE_PLAY_TRANSITION_SEC,
        });
      }
      return;
    }
    if (next) {
      await this._startRoomPreview();
    } else {
      this._stopScenePlay({ restore: false });
      this._roomPreview = false;
      this._scenePreviewEpoch += 1;
      this._clearScenePreviewApplyTimer();
      await this._restoreScenePreviewSnapshots();
    }
    this._syncRoomPreviewControl();
    this._syncScenePlayButton();
  },

  async _startRoomPreview() {
    if (this._view !== "edit") {
      return;
    }
    const simple = this._formData?.kind === "simple";
    if (simple) {
      if (!this._simplePreviewEntityIds().length) {
        return;
      }
    } else if (!this._sunPath?.lights?.length) {
      return;
    }
    this._captureScenePreviewSnapshots();
    this._roomPreview = true;
    this._scheduleScenePreviewApply({
      force: true,
      transition: SCENE_PLAY_TRANSITION_SEC,
    });
  },

  async _applyRoomPreviewAtClock({ transition = 0 } = {}) {
    if (!this._scenePreviewWantsApply()) {
      return;
    }
    const epoch = this._scenePreviewEpoch;
    if (this._formData?.kind === "simple") {
      const opts = transition > 0 ? { transition } : {};
      await Promise.all(
        this._simplePreviewEntityIds().map(async (entityId) => {
          if (epoch !== this._scenePreviewEpoch) {
            return;
          }
          await this._applyLightState(
            entityId,
            this._storedForSimplePreview(entityId),
            opts
          );
        })
      );
      return;
    }
    const seconds = this._clockSunIdleSeconds();
    const jobs = [];
    const opts =
      transition > 0 ? { transition } : {};
    for (const light of this._sunPath.lights) {
      if (!this._isScenePreviewLight(light)) {
        continue;
      }
      const sample = interpolateLightSample(light.samples || [], seconds);
      jobs.push(
        (async () => {
          if (epoch !== this._scenePreviewEpoch) {
            return;
          }
          await this._applyLightState(
            light.entity_id,
            this._sampleToStoredState(sample),
            opts
          );
        })()
      );
    }
    await Promise.all(jobs);
  },

  _stopScenePlay({ restore = false } = {}) {
    if (this._scenePlayRaf) {
      window.cancelAnimationFrame(this._scenePlayRaf);
      this._scenePlayRaf = undefined;
    }
    const wasPlaying = Boolean(this._scenePlay);
    this._scenePlay = null;
    if (wasPlaying) {
      this._syncScenePlayButton();
    }
    if (restore) {
      this._scenePreviewEpoch += 1;
      this._clearScenePreviewApplyTimer();
      void this._restoreScenePreviewSnapshots();
    }
  },

  _stopScenePlayBecauseTimeChanged() {
    this._clearSelectedSolarEvent();
    if (!this._scenePlayActive()) {
      return;
    }
    const restore = !this._roomPreview;
    this._stopScenePlay({ restore });
    if (this._roomPreview) {
      this._scheduleScenePreviewApply({
        force: true,
        transition: SCENE_PLAY_TRANSITION_SEC,
      });
    }
  },

  _toggleScenePlay() {
    if (this._scenePlayActive()) {
      this._stopScenePlay({ restore: !this._roomPreview });
      this._fillHoverReadout(this._clockSunIdleSeconds(), { hovering: false });
      return;
    }
    this._startScenePlay();
  },

  _startScenePlay() {
    if (!this._canPlayScenePreview()) {
      return;
    }
    this._cancelClockSunArc();
    this._captureScenePreviewSnapshots();
    const startSeconds = this._clockSunIdleSeconds();
    this._clockStickySeconds = startSeconds;
    this._scenePlay = {
      startSeconds,
      durationMs: this._readScenePlayDurationSec() * 1000,
      t0: performance.now(),
      lastApply: 0,
    };
    this._syncScenePlayButton();
    this._applyClockSunAppearance(startSeconds);
    this._fillHoverReadout(startSeconds, { hovering: false });
    this._scenePreviewLastApplyAt = performance.now();
    void this._applyRoomPreviewAtClock({
      transition: SCENE_PLAY_TRANSITION_SEC,
    });
    const tick = (now) => {
      const play = this._scenePlay;
      if (!play) {
        return;
      }
      const elapsed = now - play.t0;
      if (elapsed >= play.durationMs) {
        this._clockStickySeconds = play.startSeconds;
        this._applyClockSunAppearance(play.startSeconds);
        this._fillHoverReadout(play.startSeconds, { hovering: false });
        this._stopScenePlay({ restore: !this._roomPreview });
        if (this._roomPreview) {
          void this._applyRoomPreviewAtClock({
            transition: SCENE_PLAY_TRANSITION_SEC,
          });
        }
        return;
      }
      const seconds =
        (play.startSeconds + (elapsed / play.durationMs) * SECONDS_PER_DAY) %
        SECONDS_PER_DAY;
      this._clockStickySeconds = seconds;
      this._applyClockSunAppearance(seconds);
      this._patchHoverReadoutClock(seconds);
      if (now - play.lastApply >= SCENE_PLAY_TICK_MS) {
        play.lastApply = now;
        void this._applyRoomPreviewAtClock({
          transition: SCENE_PLAY_TRANSITION_SEC,
        });
      }
      this._scenePlayRaf = window.requestAnimationFrame(tick);
    };
    this._scenePlay.lastApply = performance.now();
    this._scenePlayRaf = window.requestAnimationFrame(tick);
  },

  _ensureScenePlayButton() {
    if (this._scenePlayBtn) {
      this._syncScenePlayButton();
      return this._scenePlayBtn;
    }
    const host = document.createElement("div");
    host.className = "sun-hover-play-split";

    const main = document.createElement("button");
    main.type = "button";
    main.className = "sun-hover-play-main";
    const icon = document.createElement("ha-icon");
    const text = document.createElement("span");
    text.className = "sun-hover-play-label";
    main.append(icon, text);
    main.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggleScenePlay();
    });

    const menu = document.createElement("ha-dropdown");
    menu.className = "sun-hover-play-menu";
    if ("placement" in menu) {
      menu.placement = "bottom-end";
    }
    const moreWrap = document.createElement("div");
    moreWrap.className = "sun-hover-play-more-wrap";
    const more = document.createElement("button");
    more.type = "button";
    more.slot = "trigger";
    more.className = "sun-hover-play-more";
    const chevron = document.createElement("ha-icon");
    chevron.setAttribute("icon", "mdi:menu-down");
    more.appendChild(chevron);
    menu.appendChild(more);
    for (const seconds of SCENE_PLAY_DURATION_OPTIONS_SEC) {
      const item = document.createElement("ha-dropdown-item");
      item.value = String(seconds);
      const itemIcon = document.createElement("ha-icon");
      itemIcon.setAttribute("icon", "mdi:check");
      itemIcon.slot = "icon";
      item.append(
        itemIcon,
        document.createTextNode(
          this._t("frontend.actions.play_duration_seconds", "{seconds}s", {
            seconds,
          })
        )
      );
      menu.appendChild(item);
    }
    menu.addEventListener("wa-select", (ev) => {
      ev.stopPropagation();
      const seconds = Number(ev.detail?.item?.value);
      this._writeScenePlayDurationSec(seconds);
      this._syncScenePlayButton();
    });

    moreWrap.appendChild(menu);
    host.append(main, moreWrap);
    this._scenePlayBtn = host;
    this._scenePlayMain = main;
    this._scenePlayMenu = menu;
    this._syncScenePlayButton();
    return host;
  },

  _syncNarrowPlayAction() {
    if (!this._narrow || this._view === "theme") {
      return;
    }
    const item = this.shadowRoot?.querySelector(
      'ha-dropdown-item[data-action="play-scene"]'
    );
    const want = this._canPlayScenePreview();
    if (Boolean(item) !== want) {
      if (this._syncingNarrowPlay) {
        return;
      }
      this._syncingNarrowPlay = true;
      try {
        this._setEditorActions();
      } finally {
        this._syncingNarrowPlay = false;
      }
      return;
    }
    if (!item) {
      return;
    }
    const playing = this._scenePlayActive();
    const flag = playing ? "1" : "0";
    if (item.dataset.playing === flag) {
      return;
    }
    item.dataset.playing = flag;
    const label = playing
      ? this._t("frontend.actions.stop_preview", "Stop")
      : this._t("frontend.actions.play_scene", "Play scene live");
    const text = [...item.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (text) {
      text.textContent = label;
    }
    item.querySelector("ha-icon")?.setAttribute(
      "icon",
      playing ? "mdi:stop" : "mdi:play"
    );
  },

  _syncScenePlayButton() {
    const host = this._scenePlayBtn;
    const main = this._scenePlayMain;
    if (!host || !main) {
      return;
    }
    const playing = this._scenePlayActive();
    const label = playing
      ? this._t("frontend.actions.stop_preview", "Stop")
      : this._t("frontend.actions.play_scene", "Play scene live");
    const duration = this._readScenePlayDurationSec();
    main.title = label;
    main.setAttribute("aria-label", label);
    main.setAttribute("aria-pressed", playing ? "true" : "false");
    const icon = main.querySelector("ha-icon");
    if (icon) {
      icon.setAttribute("icon", playing ? "mdi:stop" : "mdi:play");
    }
    const text = main.querySelector(".sun-hover-play-label");
    if (text) {
      text.textContent = label;
    }
    const more = this._scenePlayMenu?.querySelector(".sun-hover-play-more");
    if (more) {
      more.title = this._t(
        "frontend.actions.play_duration",
        "Play duration"
      );
      more.setAttribute(
        "aria-label",
        this._t("frontend.actions.play_duration", "Play duration")
      );
    }
    for (const item of this._scenePlayMenu?.querySelectorAll("ha-dropdown-item") ||
      []) {
      const selected = Number(item.value) === duration;
      item.toggleAttribute("data-selected", selected);
      const check = item.querySelector("ha-icon");
      if (check) {
        check.style.opacity = selected ? "1" : "0";
      }
    }
    this._syncNarrowPlayAction();
  },

  async _activateNativeSceneWithDrafts(sceneEntityId) {
    if (!sceneEntityId || String(sceneEntityId).startsWith("scene.__se_draft")) {
      return;
    }
    const draftScene = this._nativeDrafts[sceneEntityId];
    const toApply = new Map();
    for (const light of this._sunPath?.lights || []) {
      if (!this._isScenePreviewLight(light)) {
        continue;
      }
      const row = (light.event_states || []).find(
        (item) => item.scene_entity_id === sceneEntityId && item.present
      );
      if (row?.state) {
        toApply.set(light.entity_id, { ...row.state });
      }
    }
    for (const [entityId, state] of Object.entries(draftScene?.entities || {})) {
      if (!entityId.startsWith("light.")) {
        continue;
      }
      if (state == null) {
        toApply.delete(entityId);
      } else {
        toApply.set(entityId, { ...state });
      }
    }
    if (!toApply.size) {
      // No draft overlay knowledge — fall back to HA scene activate.
      await this._hass.callService("scene", "turn_on", {
        entity_id: sceneEntityId,
      });
      return;
    }
    await Promise.all(
      [...toApply.entries()].map(([entityId, stored]) =>
        this._applyLightState(entityId, stored)
      )
    );
  },

  _snapshotLight(entityId) {
    const state = this._hass.states[entityId];
    if (!state) {
      return { state: "off" };
    }
    const attrs = state.attributes || {};
    return {
      state: state.state,
      brightness: attrs.brightness,
      // Without the active mode, restore prefers hs/rgb and a color-temp
      // light comes back at a different kelvin.
      color_mode: attrs.color_mode,
      color_temp_kelvin: attrs.color_temp_kelvin,
      hs_color: attrs.hs_color,
      rgb_color: attrs.rgb_color,
      rgbw_color: attrs.rgbw_color,
      rgbww_color: attrs.rgbww_color,
      effect: attrs.effect,
    };
  },

  _closestEvent(events, seconds) {
    if (!events?.length) {
      return null;
    }
    let best = events[0];
    let bestDist = Infinity;
    for (const event of events) {
      const dist = Math.abs(event.seconds - seconds);
      if (dist < bestDist) {
        best = event;
        bestDist = dist;
      }
    }
    return best;
  },

  _sunPathMatchesChart() {
    return Boolean(
      this._sunPath?.curve?.length && this._sunPathKey === this._chartKey()
    );
  },

  _chartKey() {
    if (this._view === "theme") return `theme-sun:${this._previewDate}:${this._duskMinimumSeconds()}:${this._dawnMaximumSeconds()}`;
    if (this._view !== "edit") {
      // List chart is solar-only and always “today” — not the editor date scrub.
      return `list-sun:${todayIso()}:${this._duskMinimumSeconds()}:${this._dawnMaximumSeconds()}`;
    }
    return JSON.stringify({
      date: this._previewDate,
      dusk: this._duskMinimumSeconds(),
      dawn: this._dawnMaximumSeconds(),
      scenes: this._sceneIdsFromForm(),
      overlay: this._previewOverlay,
      location: this._previewLocation,
      area: this._formData.area || null,
      // Two circadian scenes in one area share lights and solar geometry.
      // Without the scene and theme, the mounted dial keeps the previous colors.
      scene: this._editId || null,
      theme: this._formData?.theme_id || null,
      eventPalettes: this._formData?.event_palettes || {},
      membership: this._formData.membership || { exclude: [], include: [] },
    });
  },

  _schedulePreview() {
    if (this._previewTimer) {
      window.clearTimeout(this._previewTimer);
    }
    this._previewTimer = window.setTimeout(() => {
      this._previewTimer = undefined;
      this._ensureSunPath();
    }, 80);
  },

  _rememberPreview(key, payload) {
    this._previewCache.set(key, payload);
    if (this._previewCache.size <= 64) {
      return;
    }
    this._previewCache.delete(this._previewCache.keys().next().value);
  },

  _clearPreviewCache() {
    this._previewCache.clear();
    this._sunPathKey = undefined;
  },

  _takePathMorphMs(from, to) {
    const ms = this._pathMorphMs || 0;
    this._pathMorphMs = 0;
    if (
      !ms ||
      !from?.curve?.length ||
      !to?.curve?.length ||
      !this._isDialView() ||
      !this._clockRingsHost
    ) {
      return 0;
    }
    return ms;
  },

  _commitSunPath(payload, key) {
    const decorated = {
      ...payload,
      lights: this._decorateMembershipLights(payload?.lights),
    };
    const from = this._displayedSunPath || this._sunPath;
    this._sunPath = decorated;
    this._sunPathKey = key;
    // Settled preview matches the scene card: theme + overrides, darkened
    // between solar events. The HA sample grid and a CSS lerp of five knots
    // both stay a warm wash until a solar event is opened.
    this._applySettledDialSamples({ applyTheme: true });
    const to = this._sunPath;
    const morphMs = this._takePathMorphMs(from, to);
    if (morphMs && from && from !== to) {
      this._morphSunPath(from, to, morphMs);
      return;
    }
    this._drawSunPath();
    void this._resumeRoomPreviewIfPreferred();
  },

  _cancelSunPathMorph() {
    if (this._sunPathMorphRaf) {
      window.cancelAnimationFrame(this._sunPathMorphRaf);
      this._sunPathMorphRaf = undefined;
    }
  },

  _morphSunPath(from, to, durationMs) {
    this._cancelSunPathMorph();
    // Scrub knots → settled HA samples: lerpSampleSeries samples sparse
    // "from" at each "to" timestamp — no RGB densify (wrong path).
    this._sunPath = from;
    this._displayedSunPath = from;
    if (this._clockRingsHost) {
      this._patchLightClock(from, { morphing: true });
    }
    const started = performance.now();
    const tick = (now) => {
      const u = Math.min(1, (now - started) / durationMs);
      const eased = easeOutCubic(u);
      const frame = lerpSunPath(from, to, eased);
      this._sunPath = frame;
      this._displayedSunPath = frame;
      const patched = this._patchLightClock(frame, { morphing: true });
      if (!patched) {
        this._drawSunPath();
        this._cancelSunPathMorph();
        this._sunPath = to;
        this._displayedSunPath = to;
        void this._resumeRoomPreviewIfPreferred();
        return;
      }
      if (u < 1) {
        this._sunPathMorphRaf = window.requestAnimationFrame(tick);
        return;
      }
      this._sunPathMorphRaf = undefined;
      this._sunPath = to;
      this._displayedSunPath = to;
      // Full paint once: bloom + horizon wedges (skipped mid-morph to avoid
      // stacked translucent flashes under the dial).
      this._patchLightClock(to, { morphing: false });
      void this._resumeRoomPreviewIfPreferred();
    };
    this._sunPathMorphRaf = window.requestAnimationFrame(tick);
  },

  async _ensureSunPath() {
    if (this._view === "theme") {
      await this._ensureThemeSunPath();
      return;
    }
    if (this._view !== "edit" || this._formData?.kind === "simple") {
      this._parkSunPath();
      return;
    }
    if (!this._hass || !this._sunPathEl) {
      return;
    }
    if (this._previewInFlight) {
      this._previewQueued = true;
      return;
    }
    const previewGen = this._previewGeneration;
    this._previewInFlight = true;
    try {
      do {
        this._previewQueued = false;
        if (this._previewGeneration !== previewGen || this._view !== "edit") {
          this._parkSunPath();
          return;
        }
        const key = this._chartKey();
        const listView = this._view !== "edit";
        if (this._sunPath && this._sunPathKey === key) {
          // Paint already drew this path. Drawing again restarts sun layout
          // under the enter arc and the disk flashes backward.
          this._pathMorphMs = 0;
          if (!this._clockRingsHost?.isConnected) {
            this._drawSunPath();
          }
          continue;
        }
        const cached = this._previewCache.get(key);
        // Overlay drafts must never reuse a no-overlay payload — membership
        // (add light) would stay invisible until a full document reload.
        if (cached && (listView || !this._previewOverlay)) {
          this._rememberPreview(key, cached);
          this._commitSunPath(cached, key);
          continue;
        }
        try {
          let payload;
          if (listView) {
            // Lightweight solar-only chart — full DOMAIN/preview is too heavy
            // for the list and used to race in after leaving the editor.
            payload = await this._hass.callWS({
              type: `${DOMAIN}/sun_path`,
              date: todayIso(),
              dusk_minimum: this._duskMinimumSeconds(),
            });
          } else {
            const msg = {
              type: `${DOMAIN}/preview`,
              date: this._previewDate,
              scene: {
                id: this._editId,
                kind: this._formData.kind || "circadian",
                scene_name: this._formData.scene_name,
                area: this._formData.area,
                theme_id: this._formData.theme_id || "default",
                membership: this._formData.membership || {
                  exclude: [],
                  include: [],
                },
                overrides: this._formData.overrides || {},
                event_palettes: this._formData.event_palettes || {},
                lights: this._formData.lights || {},
              },
            };
            msg.dusk_minimum = this._duskMinimumSeconds();
            if (this._previewLocation) {
              msg.location = this._previewLocation;
            }
            payload = await this._hass.callWS(msg);
          }
          if (this._previewGeneration !== previewGen || this._view !== "edit") {
            this._parkSunPath();
            return;
          }
          if (this._chartKey() !== key || (listView !== (this._view !== "edit"))) {
            this._previewQueued = true;
            continue;
          }
          if (listView || !this._previewOverlay) {
            this._rememberPreview(key, payload);
          }
          this._commitSunPath(payload, key);
        } catch (err) {
          if (this._previewGeneration !== previewGen || this._view !== "edit") {
            this._parkSunPath();
            return;
          }
          if (this._chartKey() !== key) {
            this._previewQueued = true;
            continue;
          }
          this._sunPath = null;
          this._sunPathKey = undefined;
          this._sunPathEl.hidden = false;
          const error = document.createElement("p");
          error.className = "error";
          error.style.padding = "16px";
          error.textContent = err.message || String(err);
          this._sunPathBodyEl.replaceChildren(error);
        }
      } while (this._previewQueued);
    } finally {
      this._previewInFlight = false;
    }
    if (this._previewQueued) {
      this._ensureSunPath();
    }
  },

  _shiftPreviewDate(days) {
    this._setPreviewDate(shiftIsoDate(this._previewDate, days));
  },

  _setPreviewDate(iso, { debounce = false } = {}) {
    if (!iso) {
      return;
    }
    const changed = iso !== this._previewDate;
    this._previewDate = iso;
    if (this._yearScrubbing) {
      this._syncYearScrub();
      this._syncScrubDateLabel();
    } else {
      this._syncDateToolbar();
    }
    if (!changed) {
      return;
    }
    // Dial year scrub: client sun + in-place patch (no mid-drag HA preview).
    if (this._yearScrubbing) {
      this._applyClientScrubDay(iso);
      return;
    }
    // Date picker / chips: walk intermediate calendar days on the dial so the
    // year does not crossfade in one fade (dusk clamp would also jump).
    const fromIso = this._displayedSunPath?.date || this._sunPath?.date;
    if (
      this._isDialView() &&
      fromIso &&
      fromIso !== iso &&
      this._sunPath?.lights
    ) {
      this._morphAcrossDates(fromIso, iso);
      return;
    }
    if (!this._yearScrubbing) {
      this._pathMorphMs = DATE_MORPH_MS;
    }
    // Keep sticky scrub time across date changes (curve updates underneath).
    this._sunPathKey = undefined;
    if (debounce) {
      this._schedulePreview();
    } else {
      this._ensureSunPath();
    }
  },

  /**
   * Animate the dial through each calendar day from→to, then refine with HA.
   */
  _morphAcrossDates(fromIso, toIso) {
    this._cancelSunPathMorph();
    const span = diffIsoDays(fromIso, toIso);
    if (!span) {
      this._sunPathKey = undefined;
      this._pathMorphMs = DATE_MORPH_MS;
      this._ensureSunPath();
      return;
    }
    const absSpan = Math.abs(span);
    const sign = span > 0 ? 1 : -1;
    const started = performance.now();
    let lastIso = null;
    const tick = (now) => {
      const u = Math.min(1, (now - started) / DATE_MORPH_MS);
      const eased = easeOutCubic(u);
      const dayOffset = Math.round(eased * absSpan) * sign;
      const iso = shiftIsoDate(fromIso, dayOffset);
      if (iso !== lastIso) {
        lastIso = iso;
        this._previewDate = iso;
        this._syncDateToolbar();
        this._applyClientScrubDay(iso, { keepMorph: true });
      }
      if (u < 1) {
        this._sunPathMorphRaf = window.requestAnimationFrame(tick);
        return;
      }
      this._sunPathMorphRaf = undefined;
      this._previewDate = toIso;
      this._syncDateToolbar();
      this._sunPathKey = undefined;
      this._pathMorphMs = PREVIEW_REFINE_MS;
      this._ensureSunPath();
    };
    this._sunPathMorphRaf = window.requestAnimationFrame(tick);
  },

  /**
   * Mid-drag year scrub: local sun geometry + 5-event ring knots (CSS ramps
   * between them). HA Astral preview reconciles on pointer-up via _ensureSunPath.
   */
  _applyClientScrubDay(iso, { keepMorph = false } = {}) {
    const loc = this._previewLocation || this._homeLocation();
    if (!loc || !this._sunPath?.lights) {
      return;
    }
    const timeZone = this._hass?.config?.time_zone || "UTC";
    const sunDay = buildClientSunDay({
      isoDate: iso,
      latitude: loc.latitude,
      longitude: loc.longitude,
      timeZone,
      duskMinimum: this._duskMinimumSeconds() ?? null,
      dawnMaximum: this._dawnMaximumSeconds(),
      // Coarse elevation curve while dragging; release uses Astral.
      curveStepMinutes: 30,
    });
    const lights = resampleLightsForEvents(
      this._sunPath.lights,
      sunDay.events,
      draftRgb,
      { knotsOnly: true }
    );
    if (!keepMorph) {
      this._cancelSunPathMorph();
    }
    this._sunPath = {
      ...sunDay,
      lights,
      warnings: this._sunPath.warnings || [],
    };
    if (!this._patchLightClock(this._sunPath)) {
      // Face not built yet — thumb still moves; full draw on release.
      return;
    }
    this._displayedSunPath = this._sunPath;
  },

  _homeLocation() {
    const cfg = this._hass?.config;
    if (cfg?.latitude == null || cfg?.longitude == null) {
      return null;
    }
    return {
      latitude: Number(cfg.latitude),
      longitude: Number(cfg.longitude),
    };
  },

  _setPreviewLocation(location) {
    const home = this._homeLocation();
    const next =
      location && !sameLocation(location, home)
        ? {
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
          }
        : null;
    const changed = !sameLocation(next, this._previewLocation);
    this._previewLocation = next;
    this._syncLocationToolbar();
    // Narrow overflow disables “Preview location” while the banner is up.
    if (changed && this._narrow && this._view === "edit") {
      this._setEditorActions();
    }
    if (!changed) {
      return;
    }
    this._sunPathKey = undefined;
    this._ensureSunPath();
  }
};
