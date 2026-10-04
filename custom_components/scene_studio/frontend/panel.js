import { libraryEditorMethods } from "./library_editor.js";
import { panelCatalogMethods } from "./panel_catalog.js";
import { circadianEditorMethods } from "./circadian_editor.js";
import { previewTimelineMethods } from "./preview_timeline.js";
import { dialRendererMethods } from "./dial_renderer.js";
import { dialLightStripMethods } from "./dial_light_strip.js";
import { dialInteractionMethods } from "./dial_interaction.js";
import { dialSkyMethods } from "./dial_sky.js";
import { previewControllerMethods } from "./preview_controller.js";
import { panelDialogMethods } from "./panel_dialogs.js";

import { installPanelMethods } from "./panel_composition.js";
import { editorHistoryMethods } from "./editor_history.js";
import { PANEL_STYLES } from "./panel_styles.js";
import {
  DOMAIN,
  PANEL_URL_PATH,
  LEGACY_DOMAINS,
  WHEEL_FACE_MIN_PX,
  DIAL_FACE_MIN_PX,
  WHEEL_FACE_MAX_PX,
  DIAL_FACE_MAX_PX,
  SIDEBAR_ANIMATION_MS,
  SIDEBAR_SWAP_MS,
  LIVE_EDIT_STORAGE_VERSION,
  ROOM_PREVIEW_STORAGE_VERSION,
  SCENE_PLAY_STORAGE_VERSION,
  SCENE_PLAY_TRANSITION_SEC,
  SCENE_PLAY_DURATION_DEFAULT_SEC,
  SCENE_PLAY_DURATION_OPTIONS_SEC,
  CLOCK_FEATHER_PCT,
  LINKED_EVENTS,
  EVENT_LIGHT_DEFAULTS,
  EVENT_SCENE_KEYS,
  LABELS,
} from "./panel_constants.js";

import { editorPath, editorRoute } from "./editor_routes.js";
import {
  editorGeometry,
  crossfadePreview,
  createTransitionGate,
  createEditorShell,
  fitLightStripGutter,
  fitSidebarLightStrip,
  mountEditorRegions,
} from "./editor_shell.js";

import { rgb2hsv, hueTempToRgb } from "./color_ui.js";
import { galleryCopyName } from "./gallery.js";

import { todayIso, emptyFormData, timeToSeconds, secondsToTime } from "./editor_session.js";

import {
  renderLanding,
  renderListStageEmpty,
  sceneCoverUrl,
  syncSceneCardFace,
  bindStickyTitles,
} from "./landing.js";
import { lightDisplayName } from "./display_names.js";

import { defaultOnPreference, sceneRailCatalogKey } from "./panel_state.js";
import { panelLoadIsCurrent } from "./load_guard.js";
import { paintSimpleCardMesh } from "./card_mesh.js";
import { renderSimpleEditor, renderPaletteEditor } from "./simple_editor.js";
import { snapshotWheelEditor, applyWheelMorph } from "./wheel_morph.js";

/* @property in the shadow stylesheet does not register for animation;
   CSS.registerProperty on the document does. Call once per page load. */
function registerFeatherProperties() {
  if (typeof CSS === "undefined" || typeof CSS.registerProperty !== "function") {
    return;
  }
  for (const spec of [
    {
      name: "--clock-feather",
      syntax: "<percentage>",
      inherits: true,
      initialValue: `${CLOCK_FEATHER_PCT}%`,
    },
    {
      name: "--ring-expand",
      // Must inherit: the sharp hover/selected rim is a ::after mask that
      // reads these on the pseudo, and the fill mask lives on a child.
      syntax: "<percentage>",
      inherits: true,
      initialValue: "0%",
    },
    {
      name: "--ring-rim-w",
      // Length (not %): hover rim stays 1px across dial sizes; soft mode is 0px.
      syntax: "<length>",
      inherits: true,
      initialValue: "0px",
    },
  ]) {
    try {
      CSS.registerProperty(spec);
    } catch (_err) {
      /* already registered */
    }
  }
}
registerFeatherProperties();

class SceneStudioPanel extends HTMLElement {
  constructor() {
    super();
    this._hass = undefined;
    this._narrow = false;
    this._view = "list";
    this._editId = null;
    this._themeId = null;
    this._themeDraft = null;
    this._variableId = null;
    this._variableDraft = null;
    this._variableBase = null;
    this._themeBase = null;
    this._pendingVariableFromDraft = null;
    this._themeSaveTimer = null;
    this._saveSoonTimer = null;
    this._historyRestoring = false;
    this._items = [];
    this._managedScenes = [];
    this._variables = [];
    this._themes = [];
    this._floors = [];
    this._areaCatalogLoaded = false;
    this._mobileManualEmpty = false;
    this._settings = {
      automatically_update_lights_interval: 300,
      dusk_minimum_time_of_day: 22 * 3600,
      dusk_minimum_enabled: true,
      dawn_maximum_time_of_day: 6 * 3600,
      dawn_maximum_enabled: true,
    };
    this._listTab = "extrapolation";
    this._translationsReady = false;
    this._leaveConfirmDone = false;
    this._formData = emptyFormData();
    this._sceneBase = null;
    this._sceneRevision = null;
    this._sceneConflict = null;
    this._sceneDeleted = false;
    this._sharedConflict = false;
    this._sharedDeleted = false;
    this._entityId = null;
    this._pendingNewForm = null;
    this._areaPromptOpen = false;
    this._error = null;
    this._saving = false;
    this._built = false;
    this._sunPath = null;
    this._sunPathKey = undefined;
    this._previewDate = todayIso();
    this._previewLocation = null;
    this._previewCache = new Map();
    this._previewOverlay = null;
    this._removedLights = [];
    this._nativeDrafts = {};
    this._undoStack = [];
    this._redoStack = [];
    this._simpleUndoLatched = false;
    this._simpleUndoHold = false;
    this._simpleUndoEndTimer = null;
    this._sessionBaseline = null;
    this._previewInFlight = false;
    this._previewQueued = false;
    this._yearScrubbing = false;
    this._sidebarEventId = null;
    this._sidebarLightId = null;
    this._dialBrightnessHook = null;
    this._clockBrightShown = {};
    this._clockBrightTarget = {};
    this._clockBrightFrom = {};
    this._clockBrightAnimT0 = 0;
    this._clockBrightAnimRaf = undefined;
    this._clockBrightDragging = false;
    this._brightnessScrubbing = false;
    this._clockStickySeconds = undefined;
    this._clockEnterPlayed = false;
    this._simpleEnterPlayed = false;
    this._emptyEnterPlayed = false;
    this._emptyShouldEnter = false;
    this._outgoingStageLayer = null;
    this._surfaceKind = "none";
    this._motionFromKind = "none";
    this._layoutDialChromeFn = undefined;
    this._clockResizeObserver = undefined;
    this._sunPathHome = undefined;
    this._aulResumeInterval = 300;
    this._liveEdit = true;
    this._liveEditSidebarHandler = null;
    this._sidebarLiveEditToggle = null;
    // App-bar Live edit: preview the open circadian scene at the selected clock.
    this._roomPreview = false;
    this._roomPreviewSnapshots = null;
    this._scenePreviewOwnerId = null;
    this._scenePreviewEpoch = 0;
    this._scenePreviewLastApplyAt = undefined;
    this._scenePreviewApplyTimer = undefined;
    this._scenePreviewApplyPending = null;
    this._scenePlay = null;
    this._scenePlayRaf = undefined;
    this._scenePlayBtn = null;
    this._scenePlayMain = null;
    this._scenePlayMenu = null;
    this._clockOverrideArcSweep = null;
    this._loadGeneration = 0;
    this._previewGeneration = 0;
    this._hashSyncing = false;
    this._hashSyncQueued = false;
    this._onHashChange = () => this._syncHash();
    this._onLocationChanged = () => this._syncHash();
    this._onPanelNavClick = (ev) => this._handlePanelHomeClick(ev);
    this._onEditorKeydown = (ev) => this._handleEditorShortcut(ev);
    this._onPageHide = (ev) => {
      if (ev?.type === "visibilitychange" && document.visibilityState === "visible") {
        return;
      }
      void this._leaveLiveEdits();
    };
    this._onLandscapeChange = () => this._syncYearScrubLayout();
    this._areaRegistryUnsub = null;
    this._areaRegistrySubscription = null;
    this._changeUnsub = null;
    this._changeSubscription = null;
    this._changeConnection = null;
    this._collabRefreshGeneration = 0;
    this._onWindowResize = () => {
      if (this._resizeRaf) {
        return;
      }
      this._resizeRaf = window.requestAnimationFrame(() => {
        this._resizeRaf = undefined;
        this._syncWorkspaceScrollport();
        this._syncYearScrubLayout();
      });
    };
  }

  set hass(hass) {
    if (this._hass?.connection && this._hass.connection !== hass?.connection) {
      this._areaRegistryUnsub?.();
      this._areaRegistryUnsub = null;
      this._changeUnsub?.();
      this._changeUnsub = null;
      this._changeSubscription = null;
      this._changeConnection = null;
    }
    this._hass = hass;
    if (this.isConnected) {
      this._subscribeAreaRegistry();
      void this._ensureChangeSubscription();
    }
    this._syncDarkModeAttr();
    if (this._menuButtonEl) {
      this._menuButtonEl.hass = hass;
    }
    if (this._datePicker) {
      this._datePicker.hass = hass;
    }
    // HA assigns hass on every state update — do not rebuild the list (that
    // flickers the FAB and closes the settings sidebar). Translate once.
    const needsTranslationPaint = !this._translationsReady;
    void this._ensureTranslations().then(() => {
      if (needsTranslationPaint && this._built && this._view === "list") {
        this._renderList();
      }
    });
    // Registry/friendly_name can change while the editor is open — keep the
    // app-bar title in sync (same source as the list rows).
    if (this._built && this._headerEl) {
      this._syncAppBarTitle();
    }
    if (!this._built && this.isConnected) {
      this._build();
    }
  }

  get narrow() {
    return Boolean(this._narrow);
  }

  set narrow(value) {
    const next = Boolean(value);
    const changed = next !== Boolean(this._narrow);
    this._narrow = next;
    this.toggleAttribute("narrow", next);
    if (this._appBar) {
      this._appBar.narrow = next;
    }
    if (this._menuButtonEl) {
      this._menuButtonEl.narrow = next;
    }
    if (this._built && changed) {
      // Landing and editors mount rail vs stage from `_narrow`; the back
      // button is the nav icon. HA updates this property on resize, but a
      // title/action refresh alone leaves the previous desktop/mobile tree.
      this._render();
      this._syncWorkspaceScrollport();
      this._syncYearScrubLayout();
    }
  }

  set route(_route) {}

  set panel(_panel) {}

  /** Drive light/dark dial CSS (`:host([data-dark-mode])`) from HA’s theme. */
  _syncDarkModeAttr() {
    this.toggleAttribute(
      "data-dark-mode",
      Boolean(this._hass?.themes?.darkMode)
    );
    this._layoutClockBrightnessCurve();
  }

  connectedCallback() {
    this._subscribeAreaRegistry();
    void this._ensureChangeSubscription();
    window.addEventListener("hashchange", this._onHashChange);
    window.addEventListener("location-changed", this._onLocationChanged);
    window.addEventListener("popstate", this._onLocationChanged);
    window.addEventListener("click", this._onPanelNavClick, true);
    window.addEventListener("keydown", this._onEditorKeydown);
    window.addEventListener("pagehide", this._onPageHide);
    window.addEventListener("resize", this._onWindowResize);
    document.addEventListener("visibilitychange", this._onPageHide);
    if (!this._landscapeMq) {
      this._landscapeMq = window.matchMedia("(orientation: landscape)");
      if (this._landscapeMq.addEventListener) {
        this._landscapeMq.addEventListener("change", this._onLandscapeChange);
      } else {
        this._landscapeMq.addListener(this._onLandscapeChange);
      }
    }
    if (this._hass && !this._built) {
      this._build();
    }
    if (!this._sunTimer) {
      this._sunTimer = window.setInterval(() => {
        if (this._yearScrubbing) {
          return;
        }
        const active = this.shadowRoot?.activeElement;
        if (
          active &&
          (this._datePicker?.contains(active) ||
            this._yearScrub === active ||
            this._yearScrub?.contains(active))
        ) {
          return;
        }
        // Keep the sticky-scrub arc’s “now” tip moving without a full redraw.
        if (this._clockStickySeconds != null) {
          this._updateOverrideArc(this._clockStickySeconds);
        }
        // Only redraw when cached payload matches this view (avoids unhiding
        // a stale dial chart on the list after leaving the editor).
        if (this._sunPath && this._sunPathKey === this._chartKey()) {
          this._drawSunPath();
        }
      }, 30000);
    }
  }

  disconnectedCallback() {
    this._eventGuidance?.cancel();
    this._sharedEditorShell?.previewGate.next();
    this._sharedEditorShell?.lightGate.next();
    this._outgoingStageLayer?.remove();
    this._outgoingStageLayer = null;
    this._editorShellObserver?.disconnect();
    this._editorShellObserver = null;
    this._areaRegistryUnsub?.();
    this._areaRegistryUnsub = null;
    this._changeUnsub?.();
    this._changeUnsub = null;
    this._changeSubscription = null;
    this._changeConnection = null;
    void this._leaveLiveEdits();
    this._closeSceneSidebar();
    window.removeEventListener("hashchange", this._onHashChange);
    window.removeEventListener("location-changed", this._onLocationChanged);
    window.removeEventListener("popstate", this._onLocationChanged);
    window.removeEventListener("click", this._onPanelNavClick, true);
    window.removeEventListener("keydown", this._onEditorKeydown);
    window.removeEventListener("pagehide", this._onPageHide);
    window.removeEventListener("resize", this._onWindowResize);
    document.removeEventListener("visibilitychange", this._onPageHide);
    if (this._resizeRaf) {
      window.cancelAnimationFrame(this._resizeRaf);
      this._resizeRaf = undefined;
    }
    if (this._landscapeMq) {
      if (this._landscapeMq.removeEventListener) {
        this._landscapeMq.removeEventListener("change", this._onLandscapeChange);
      } else {
        this._landscapeMq.removeListener(this._onLandscapeChange);
      }
      this._landscapeMq = undefined;
    }
    if (this._persistTimer) {
      window.clearTimeout(this._persistTimer);
      this._persistTimer = undefined;
    }
    if (this._previewTimer) {
      window.clearTimeout(this._previewTimer);
      this._previewTimer = undefined;
    }
    if (this._sunTimer) {
      window.clearInterval(this._sunTimer);
      this._sunTimer = undefined;
    }
    if (this._scrubRaf) {
      window.cancelAnimationFrame(this._scrubRaf);
      this._scrubRaf = undefined;
    }
    if (this._hoverRaf) {
      window.cancelAnimationFrame(this._hoverRaf);
      this._hoverRaf = undefined;
    }

    this._cancelSunPathMorph();
    this._stopScenePlay({ restore: false });
    this._clearScenePreviewApplyTimer();
  }

  async _restoreOpenLightPreview() {
    const sidebar = this.shadowRoot?.querySelector(".scene-sidebar.light-dialog");
    if (typeof sidebar?._restoreLive === "function") {
      await sidebar._restoreLive();
    }
  }

  async _leaveLiveEdits() {
    await this._restoreOpenLightPreview();
    await this._abandonScenePreview();
    await this._saveNow();
  }

  async _build() {
    this._built = true;
    if (customElements.get("ha-top-app-bar-fixed") === undefined) {
      await customElements.whenDefined("ha-top-app-bar-fixed");
    }
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>${PANEL_STYLES}</style>
      <ha-top-app-bar-fixed>
        <div slot="title"></div>
        <div class="page-shell">
        <div class="page">
          <div class="page-banners" hidden>
            <div class="sun-location-override" hidden>
              <ha-icon icon="mdi:map-marker"></ha-icon>
              <div class="sun-location-copy">
                <div class="title">Previewing another location</div>
                <div class="coords"></div>
              </div>
              <ha-button class="sun-location-change" appearance="plain">Change</ha-button>
              <ha-icon-button class="sun-location-reset" label="Use home location">
                <ha-icon icon="mdi:close"></ha-icon>
              </ha-icon-button>
            </div>
          </div>
          <div class="sun-path" hidden>
            <div class="sun-path-stage">
              <div class="sun-path-body"></div>
              <div class="sun-year-scrub-rail" hidden></div>
            </div>
          </div>
          <div class="content"></div>
        </div>
        </div>
      </ha-top-app-bar-fixed>
      <div class="fab" hidden></div>
    `;
    this._appBar = this.shadowRoot.querySelector("ha-top-app-bar-fixed");
    this._appBar.narrow = Boolean(this._narrow);
    this._headerEl = this.shadowRoot.querySelector("[slot='title']");
    this._sunPathEl = this.shadowRoot.querySelector(".sun-path");
    this._sunPathHome = this._sunPathEl?.parentNode;
    this._pageBannersEl = this.shadowRoot.querySelector(".page-banners");
    this._pageBannersHome = this._pageBannersEl?.parentNode;
    this._sunPathStage = this.shadowRoot.querySelector(".sun-path-stage");
    this._sunPathBodyEl = this.shadowRoot.querySelector(".sun-path-body");
    this._clockScrubRail = this.shadowRoot.querySelector(".sun-year-scrub-rail");
    this._contentEl = this.shadowRoot.querySelector(".content");
    this._fabEl = this.shadowRoot.querySelector(".fab");
    // Location banner lives under .page-banners (shared inset).
    this._locationBanner = this.shadowRoot.querySelector(
      ".sun-location-override",
    );
    this._locationCoords = this._locationBanner?.querySelector(".coords");
    this._locationBanner
      ?.querySelector(".sun-location-change")
      ?.addEventListener("click", () => this._openLocationDialog());
    this._locationBanner
      ?.querySelector(".sun-location-reset")
      ?.addEventListener("click", () => this._setPreviewLocation(null));
    this._syncDarkModeAttr();
    this._syncHash();
  }

  _handlePanelHomeClick(ev) {
    const nodes =
      typeof ev.composedPath === "function" ? ev.composedPath() : [];
    const link = nodes.find((node) => node instanceof HTMLAnchorElement);
    if (!link?.href) {
      return;
    }
    let url;
    try {
      url = new URL(link.href, window.location.origin);
    } catch (_err) {
      return;
    }
    if (url.origin !== window.location.origin) {
      return;
    }
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (pathname !== `/${PANEL_URL_PATH}`) {
      return;
    }
    if (url.hash && url.hash !== "#") {
      return;
    }
    if (this._currentHash() === "") {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    void this._go("");
  }

  _libraryItemHash() {
    const prefix = this._view === "palette" ? "palette" : "variable";
    return this._variableId ? `${prefix}/${this._variableId}` : `${prefix}/new`;
  }

  _currentHash() {
    if (this._view === "edit") {
      return this._editId ? `edit/${this._editId}` : "new";
    }
    if (this._view === "theme") {
      return this._themeId ? `theme/${this._themeId}` : "theme/new";
    }
    if (this._view === "variable" || this._view === "palette") {
      return this._libraryItemHash();
    }
    if (this._view === "variables") {
      return "variables";
    }
    return "";
  }

  _hashHref(hash) {
    return `${editorPath(hash)}${window.location.search}`;
  }

  _locationRoute() {
    return editorRoute(window.location);
  }

  _railTabStorageKey(route = this._currentHash()) {
    return `${DOMAIN}.railTab.${this._hass?.user?.id || "anon"}.${route}`;
  }

  async _go(hash) {
    const gate = this._navigationGate ||= createTransitionGate();
    const token = gate.next();
    if (!(await this._confirmLeaveEditor())) {
      return;
    }
    if (!gate.current(token)) return;
    await this._restoreOpenLightPreview();
    if (!gate.current(token)) return;
    this._abortPreview();
    this._forceCloseSceneSidebar();
    if (/^(edit|theme|palette|variable)\//.test(hash)) this._editorReturnTab = this._railTab;
    const href = this._hashHref(hash);
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== href) {
      history.pushState(null, "", href);
    }
    window.dispatchEvent(new Event("location-changed"));
    void this._syncHash();
  }

  async _syncHash() {
    const hash = this._locationRoute();
    if (hash === null) return;
    const canonical = this._hashHref(hash);
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== canonical) history.replaceState(null, "", canonical);
    // hashchange and HA's location-changed both fire for one hash write,
    // about 30ms apart. The first pass has already returned by then, and a
    // second pass rebuilt the editor while the first animation was running.
    if (
      hash === this._hashSyncHash &&
      performance.now() - (this._hashSyncAt || 0) < 100
    ) {
      return;
    }
    if (this._hashSyncing) {
      if (hash !== this._hashSyncHash) {
        this._hashSyncQueued = true;
      }
      return;
    }
    this._hashSyncing = true;
    this._hashSyncQueued = false;
    try {
      this._hashSyncHash = hash;
      this._hashSyncAt = performance.now();
      await this._syncHashOnce();
      while (this._hashSyncQueued) {
        this._hashSyncQueued = false;
        this._hashSyncHash = this._locationRoute();
        this._hashSyncAt = performance.now();
        await this._syncHashOnce();
      }
    } finally {
      this._hashSyncing = false;
    }
  }

  async _syncHashOnce() {
    const hash = this._locationRoute();
    if (
      this._pendingRailSceneId &&
      hash !== `edit/${this._pendingRailSceneId}`
    ) {
      this._pendingRailSceneId = null;
    }
    this._noteRailTabForHash(hash);
    const current = this._currentHash();
    if (hash !== current) {
      this._eventGuidance?.cancel();
      this._sidebarEventId = null;
      this._legendSelectedIds = new Set();
      this._circadianAnchor = null;
      this._circadianTouchSelect = false;
    }
    if (
      hash !== current &&
      (this._lightEditIsDirty() || this._needsLeaveConfirm())
    ) {
      history.replaceState(null, "", this._hashHref(current));
      const leave = await this._confirmLeaveEditor();
      if (!leave) {
        return;
      }
      this._abortPreview();
      this._forceCloseSceneSidebar();
      if (this._locationRoute() !== hash) {
        history.replaceState(null, "", this._hashHref(hash));
      }
    }
    this._leaveConfirmDone = false;
    this._motionFromKind = this._surfaceKind || "none";
    void this._transitionSurfaces(
      this._motionFromKind,
      this._motionKindForHash(hash)
    );
    this._motionFromKind = undefined;
    if (hash === "new") {
      void this._createLibraryItem("scene");
      return;
    }
    const match = hash.match(/^edit\/(.+)$/);
    if (match) {
      this._view = "edit";
      this._editId = match[1];
      if (this._pendingRailSceneId === match[1]) {
        this._pendingRailSceneId = null;
      }
      this._themeId = null;
      this._themeDraft = null;
      this._variableId = null;
      this._variableDraft = null;
      this._error = null;
      this._loadItem(this._editId);
      return;
    }
    const themeMatch = hash.match(/^theme\/(.+)$/);
    if (themeMatch) {
      if (themeMatch[1] === "new") {
        void this._createLibraryItem("theme");
        return;
      }
      this._view = "theme";
      this._themeId = themeMatch[1];
      this._editId = null;
      this._variableId = null;
      this._variableDraft = null;
      this._entityId = null;
      this._error = null;
      await this._restoreOpenLightPreview();
      await this._abandonScenePreview();
      this._loadTheme(themeMatch[1]);
      return;
    }
    const paletteMatch = hash.match(/^palette\/(.+)$/);
    if (paletteMatch) {
      if (paletteMatch[1] === "new") {
        void this._createLibraryItem("palette");
        return;
      }
      this._view = "palette";
      this._editId = null;
      this._themeId = null;
      this._themeDraft = null;
      this._variableId = paletteMatch[1];
      this._entityId = null;
      this._error = null;
      await this._restoreOpenLightPreview();
      await this._abandonScenePreview();
      this._loadVariable(paletteMatch[1]);
      return;
    }
    const variableMatch = hash.match(/^variable\/(.+)$/);
    if (variableMatch) {
      if (variableMatch[1] === "new") {
        void this._createLibraryItem("variable");
        return;
      }
      this._view = "variable";
      this._editId = null;
      this._themeId = null;
      this._themeDraft = null;
      this._variableId = variableMatch[1];
      this._entityId = null;
      this._error = null;
      await this._restoreOpenLightPreview();
      await this._abandonScenePreview();
      this._loadVariable(variableMatch[1]);
      return;
    }
    if (hash === "variables") {
      this._view = "variables";
      this._editId = null;
      this._themeId = null;
      this._themeDraft = null;
      this._variableId = null;
      this._variableDraft = null;
      this._entityId = null;
      await this._restoreOpenLightPreview();
      await this._abandonScenePreview();
      this._loadList();
      return;
    }
    this._view = "list";
    this._editId = null;
    this._themeId = null;
    this._themeDraft = null;
    this._variableId = null;
    this._variableDraft = null;
    this._entityId = null;
    await this._restoreOpenLightPreview();
    await this._abandonScenePreview();
    this._loadList();
  }

  _invalidatePanelLoads() {
    this._loadGeneration += 1;
    this._abortPreview();
  }

  _abortPreview() {
    this._previewGeneration += 1;
    this._previewQueued = false;
  }

  _startPanelLoad() {
    const token = {
      generation: ++this._loadGeneration,
      view: this._view,
      sceneId:
        this._view === "theme"
          ? this._themeId
          : this._view === "variable" || this._view === "palette"
            ? this._variableId
            : this._editId,
    };
    return token;
  }

  _panelLoadIsCurrent(token) {
    return panelLoadIsCurrent(token, {
      generation: this._loadGeneration,
      view: this._view,
      sceneId:
        this._view === "theme"
          ? this._themeId
          : this._view === "variable" || this._view === "palette"
            ? this._variableId
            : this._editId,
    });
  }

  async _loadList() {
    const token = this._startPanelLoad();
    await this._ensureChangeSubscription();
    if (!this._panelLoadIsCurrent(token)) return;
    // The cached paint consumes the flag. The payload paint below has to
    // keep the rail too, or deselect rebuilds the cards and the scale snaps.
    const keepRail = Boolean(this._keepAreaRail);
    const hasCache =
      Array.isArray(this._items) && (this._floors || []).length > 0;
    if (hasCache) {
      this._render();
    }
    try {
      const payload = await this._hass.callWS({ type: `${DOMAIN}/list` });
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      const scenes = Array.isArray(payload) ? payload : payload?.scenes || [];
      this._items = scenes;
      this._variables = payload?.variables || [];
      this._themes = payload?.themes || [];
      this._floors = payload?.floors || [];
      this._areaCatalogLoaded = Array.isArray(payload?.floors);
      this._adoptSettings(payload?.settings);
      this._error = null;
    } catch (err) {
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._error = err.message || String(err);
      // Do not turn a failed refresh into an empty area catalog.
    }
    if (!this._panelLoadIsCurrent(token)) {
      return;
    }
    // Always paint the payload. Skipping this when floors were already cached
    // left auto-configure empty and let a stale in-flight load put a deleted
    // scene back on screen.
    if (keepRail) {
      this._keepAreaRail = true;
    }
    this._render();
  }

  _upsertSceneInList(scene) {
    if (!scene?.id) {
      return;
    }
    const items = [...(this._items || [])];
    const index = items.findIndex((item) => item.id === scene.id);
    if (index >= 0) {
      items[index] = { ...items[index], ...scene };
    } else {
      items.push(scene);
    }
    items.sort((a, b) =>
      (a.scene_name || "").localeCompare(b.scene_name || "", undefined, {
        sensitivity: "base",
      })
    );
    this._items = items;
  }

  _dropSceneFromList(sceneId) {
    if (!sceneId) {
      return;
    }
    this._items = (this._items || []).filter((item) => item.id !== sceneId);
  }

  _refreshVisibleSceneList() {
    if (this._view === "list" || this._view === "variables") {
      this._renderList();
      return;
    }
    if (this._view === "edit") {
      this._renderEditor();
      return;
    }
    if (this._view === "theme") {
      this._renderThemeEditor();
      return;
    }
    if (this._view === "variable" || this._view === "palette") {
      this._renderVariableEditor();
    }
  }

  async _loadItem(sceneId) {
    const token = this._startPanelLoad();
    await this._ensureChangeSubscription();
    if (!this._panelLoadIsCurrent(token)) return;
    const sidebar = this.shadowRoot?.querySelector(".scene-sidebar.light-dialog");
    if (sidebar?._sceneId && sidebar._sceneId !== sceneId) {
      await this._restoreOpenLightPreview();
      this._closeSceneSidebar();
    }
    if (this._scenePreviewOwnerId && this._scenePreviewOwnerId !== sceneId) {
      await this._abandonScenePreview();
    }
    try {
      const [item, payload] = await Promise.all([
        this._hass.callWS({
          type: `${DOMAIN}/get`,
          scene_id: sceneId,
        }),
        this._hass.callWS({ type: `${DOMAIN}/list` }),
      ]);
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._entityId = item.entity_id || null;
      this._formData = { ...emptyFormData(), ...(item.form || item) };
      this._sceneBase = structuredClone(item.form || item);
      this._sceneRevision = item.revision || null;
      this._sceneConflict = null;
      this._sceneDeleted = false;
      this._items = payload?.scenes || [];
      this._variables = payload?.variables || [];
      this._themes = payload?.themes || [];
      this._floors = payload?.floors || [];
      this._areaCatalogLoaded = Array.isArray(payload?.floors);
      this._adoptSettings(payload?.settings);
      this._error = null;
    } catch (err) {
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._error = err.message || String(err);
      this._entityId = null;
      this._formData = emptyFormData();
      this._sceneBase = null;
      this._sceneRevision = null;
    }
    if (!this._panelLoadIsCurrent(token)) {
      return;
    }
    this._resetSession();
    this._render();
  }

  _loc(key, fallback, vars) {
    const localize = this._hass?.localize;
    if (typeof localize !== "function") {
      return fallback;
    }
    const value = vars ? localize(key, vars) : localize(key);
    if (!value || value === key) {
      return fallback;
    }
    return value;
  }

  /** Panel/integration string from translations/<lang>.json (frontend.* / config.*). */
  _t(path, fallback, vars) {
    const value = this._loc(`component.${DOMAIN}.${path}`, fallback, vars);
    if (!vars) {
      return value;
    }
    const raw =
      value === `component.${DOMAIN}.${path}` ? fallback : value;
    return String(raw).replace(/\{(\w+)\}/g, (match, key) =>
      vars[key] != null ? String(vars[key]) : match
    );
  }

  _untitledLabel() {
    return this._t("frontend.common.untitled", "Untitled");
  }

  _placeholderNames() {
    return new Set([
      this._untitledLabel(),
      this._t("frontend.common.new_scene", "New scene"),
      this._t("frontend.library.new_variable", "New color preset"),
      this._t("frontend.library.new_palette", "New scene preset"),
      this._t("frontend.library.new_theme", "New circadian preset"),
    ]);
  }

  _nameIsPlaceholder(name) {
    const trimmed = String(name || "").trim();
    return !trimmed || this._placeholderNames().has(trimmed);
  }

  _areaDisplayName(areaId) {
    if (!areaId) {
      return "";
    }
    for (const floor of this._floors || []) {
      for (const area of floor.areas || []) {
        if (area.id === areaId) {
          return area.name || (area.deleted
            ? `${this._t("frontend.areas.unknown", "Deleted area")} (${area.id})`
            : "");
        }
      }
    }
    return "";
  }

  _suggestedSceneName(scene) {
    if (scene?.kind === "simple") {
      const palette = (this._variables || []).find(
        (item) => item.id === scene?.palette_id
      );
      return palette?.name || this._untitledLabel();
    }
    const themeId = scene?.theme_id || "default";
    const theme = (this._themes || []).find((item) => item.id === themeId);
    return (
      theme?.name || this._t("frontend.naming.circadian_fallback", "Circadian")
    );
  }

  /** Entity name, or the device name when HA left the entity as "Light". */
  _lightDisplayName(entityId, { areaName, fallback = "" } = {}) {
    const state = this._hass?.states?.[entityId];
    const entity = this._hass?.entities?.[entityId];
    const device = entity?.device_id
      ? this._hass?.devices?.[entity.device_id]
      : null;
    const area =
      areaName !== undefined
        ? areaName
        : this._areaDisplayName(this._formData?.area);
    return lightDisplayName({
      friendlyName:
        state?.attributes?.friendly_name || entity?.name || fallback,
      deviceName: device?.name_by_user || device?.name || "",
      entityId,
      areaName: area,
    });
  }

  /** Base name, or "Name 2" when this area already has that scene name. */
  _sceneNameInArea(areaId, base) {
    const area = areaId || null;
    const names = (this._items || [])
      .filter((scene) => (scene.area || null) === area)
      .map((scene) => String(scene.scene_name || "").trim());
    return galleryCopyName(
      String(base || "").trim() || this._untitledLabel(),
      names
    );
  }

  /** Palette name, or "Name 2" when this area already has that scene name. */
  _sceneNameFromPalette(areaId, palette) {
    return this._sceneNameInArea(areaId, palette?.name);
  }

  _suggestedLibraryName() {
    if (this._view === "palette") {
      return this._t("frontend.naming.palette", "Scene preset");
    }
    if (this._view === "theme") {
      return this._t("frontend.naming.theme", "Circadian preset");
    }
    return this._t("frontend.naming.variable", "Color preset");
  }

  _currentItemIsUnnamed() {
    if (this._view === "edit") {
      return this._nameIsPlaceholder(this._formData?.scene_name);
    }
    if (this._view === "theme") {
      return this._nameIsPlaceholder(this._themeDraft?.name);
    }
    if (this._view === "variable" || this._view === "palette") {
      return this._nameIsPlaceholder(this._variableDraft?.name);
    }
    return false;
  }

  _nameFabLabel() {
    if (this._view === "palette") {
      return this._t("frontend.actions.name_palette", "Name scene preset");
    }
    if (this._view === "variable") {
      return this._t("frontend.actions.name_variable", "Name color preset");
    }
    if (this._view === "theme") {
      return this._t("frontend.actions.name_theme", "Name circadian preset");
    }
    return this._t("frontend.actions.name_scene", "Name scene");
  }

  _syncNameFab() {
    if (!this._currentItemIsUnnamed()) {
      this._setFab(null);
      return;
    }
    this._setFab(
      this._fabButton(this._nameFabLabel(), "mdi:pencil", () => {
        void this._openNameItemDialog();
      })
    );
  }

  async _ensureTranslations() {
    if (!this._hass || this._translationsReady) {
      return;
    }
    this._translationsReady = true;
    try {
      await Promise.all([
        this._hass.loadBackendTranslation("frontend", DOMAIN),
        this._hass.loadBackendTranslation("config", DOMAIN),
      ]);
    } catch (_err) {
      // Fallback English constants remain in _t / LABELS.
    }
  }

  _railCardSelected(card) {
    if (card.dataset.sceneId) {
      // A click sets this before the scene fetch. Otherwise the previous
      // card stays highlighted until that fetch, and a second click is
      // what finally shows the new one.
      const pending = this._pendingRailSceneId;
      if (pending) {
        return card.dataset.sceneId === pending;
      }
      return this._view === "edit" && card.dataset.sceneId === this._editId;
    }
    const itemId = card.dataset.itemId;
    if (!itemId) {
      return false;
    }
    if (this._view === "palette" || this._view === "variable") {
      return itemId === this._variableId;
    }
    if (this._view === "theme") {
      return itemId === this._themeId;
    }
    return false;
  }

  _syncRailSelection() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const reveal = [];
    for (const card of root.querySelectorAll(".scene-card")) {
      const on = this._railCardSelected(card);
      const was = card.classList.contains("selected");
      if (card.hasAttribute("aria-pressed")) {
        card.setAttribute("aria-pressed", on ? "true" : "false");
      }
      if (on === was) {
        continue;
      }
      // Adding .selected in the same turn as the editor swap paints the card
      // at scale(1.1) with no transition. The next frame lets it scale.
      if (!on) {
        card.classList.remove("selected");
        card.parentElement?.classList.remove("glow-on");
        continue;
      }
      reveal.push(card);
    }
    if (reveal.length) {
      requestAnimationFrame(() => {
        for (const card of reveal) {
          if (!card.isConnected || !this._railCardSelected(card)) {
            continue;
          }
          card.classList.add("selected");
          card.parentElement?.classList.add("glow-on");
        }
      });
    }
    const revealChips = [];
    for (const chip of root.querySelectorAll(".var-chip")) {
      const on =
        this._view === "variable" && chip.dataset.itemId === this._variableId;
      const was = chip.classList.contains("selected");
      if (on === was) {
        continue;
      }
      if (!on) {
        chip.classList.remove("selected");
        continue;
      }
      // Same-turn .selected paints the pill at full width. The next frame
      // lets the width and the outside ring transition.
      if (this._prefersReducedMotion()) {
        chip.classList.add("selected");
        continue;
      }
      revealChips.push(chip);
    }
    if (revealChips.length) {
      requestAnimationFrame(() => {
        for (const chip of revealChips) {
          if (!chip.isConnected) {
            continue;
          }
          if (this._view !== "variable" || chip.dataset.itemId !== this._variableId) {
            continue;
          }
          chip.classList.add("selected");
        }
      });
    }
  }

  _crossfadeCoverInPlace(previousUrl) {
    const page = this._contentEl?.querySelector(".workspace");
    if (!page) {
      return;
    }
    const url = sceneCoverUrl(this);
    const nextUrl = url ? `url("${url}")` : "";
    if ((previousUrl || "") === nextUrl) {
      return;
    }
    const current = [...page.querySelectorAll(".scene-cover")].find(
      (cover) => !cover.classList.contains("is-leaving")
    );
    if (this._prefersReducedMotion()) {
      if (!nextUrl) {
        current?.remove();
        return;
      }
      if (!current) {
        const cover = document.createElement("div");
        cover.className = "scene-cover is-shown";
        cover.style.backgroundImage = nextUrl;
        page.prepend(cover);
        return;
      }
      current.style.backgroundImage = nextUrl;
      current.classList.add("is-shown");
      return;
    }
    if (current) {
      current.classList.add("is-leaving");
      const drop = () => current.remove();
      current.addEventListener("transitionend", drop, { once: true });
      window.setTimeout(drop, 700);
    }
    if (!nextUrl) {
      return;
    }
    const cover = document.createElement("div");
    cover.className = "scene-cover";
    cover.style.backgroundImage = nextUrl;
    page.prepend(cover);
    requestAnimationFrame(() => cover.classList.add("is-shown"));
  }

  _renderWheelMorph() {
    const host = this.shadowRoot?.querySelector(".simple-editor-host");
    if (this._error || !host?.isConnected || !host.querySelector(".simple-editor")) {
      this._wheelMorph = false;
      this._wheelMorphPins = null;
      return false;
    }
    const palette = this._view === "palette";
    const simple = this._view === "edit" && this._formData?.kind === "simple";
    if (!palette && !simple) {
      this._wheelMorph = false;
      this._wheelMorphPins = null;
      return false;
    }
    const snap = snapshotWheelEditor(this.shadowRoot);
    this._wheelMorphPins = snap?.pins || null;
    this._syncAppBarTitle();
    this._setNavigationIcon(this._narrow ? this._backButton() : this._menuButton());
    this._setEditorActions();
    this._syncEditorChrome();
    this._syncSaveFab();
    this._contentEl.classList.add("wide");
    this._parkSunPath();
    this._setRailTab(palette ? "library" : "scenes");
    this._syncRailSelection();
    if (palette) {
      renderPaletteEditor(this, host, { glowHost: null });
    } else {
      const lists = this._simpleMembershipLists();
      this._simpleMembers = lists.members;
      renderSimpleEditor(this, host, { glowHost: null });
    }
    this._syncSceneUsed();
    this._syncWorkspaceScrollport();
    applyWheelMorph(snap, this.shadowRoot);
    this._crossfadeCoverInPlace(snap?.coverUrl || "");
    this._wheelMorph = false;
    this._simpleEnterPlayed = true;
    return true;
  }

  _render() {
    if (!this._built) {
      return;
    }
    // Consumed by this paint only. A later list refresh still rebuilds the rail.
    const keepRail = Boolean(this._keepAreaRail) && !this._narrow;
    this._keepAreaRail = false;
    if (this._wheelMorph && this._renderWheelMorph()) {
      this._surfaceKind = this._editorMotionKind();
      return;
    }
    if (this._view === "edit") {
      this._renderEditor({ keepRail });
    } else if (this._view === "theme") {
      this._renderThemeEditor({ keepRail });
    } else if (this._view === "variable" || this._view === "palette") {
      this._renderVariableEditor({ keepRail });
    } else {
      this._renderList({ keepRail });
    }
    this._syncSharedEditorShell();
    if (this._view === "edit" || this._view === "theme") {
      this._ensureSunPath();
    }
    this._surfaceKind = this._editorMotionKind();
  }

  _stageScrollEl(stage) {
    return stage?.querySelector(":scope > .stage-scroll") || stage;
  }

  _stageBgEl(stage) {
    return stage?.querySelector(":scope > .stage-bg") || null;
  }

  _bindStageScrollLayout(scroll) {
    if (!scroll || scroll === this._stageScrollBound) {
      return;
    }
    if (this._stageScrollBound && this._onStageScroll) {
      this._stageScrollBound.removeEventListener("scroll", this._onStageScroll);
    }
    this._onStageScroll = () => {
      this._layoutDialChromeFn?.();
      this._simpleWheelGlowLayout?.();
    };
    this._stageScrollBound = scroll;
    scroll.addEventListener("scroll", this._onStageScroll, { passive: true });
  }

  _appBarScroller() {
    if (this._appBarScrollEl?.isConnected) {
      return this._appBarScrollEl;
    }
    const root = this._appBar?.shadowRoot;
    if (!root) {
      return undefined;
    }
    const el =
      root.querySelector(".ha-scrollbar") ||
      [...root.querySelectorAll("*")].find((node) => {
        const overflowY = getComputedStyle(node).overflowY;
        return overflowY === "auto" || overflowY === "scroll";
      });
    this._appBarScrollEl = el;
    return el;
  }

  _syncSharedEditorShell() {
    if (this._syncingEditorShell || this._error) return;
    this._syncingEditorShell = true;
    try {
      const root = this.shadowRoot;
      const active = selector => [...root.querySelectorAll(selector)].find(node => !node.closest(".editor-preview-exit"));
      const simple = this._view === "palette" || (this._view === "edit" && this._formData?.kind === "simple");
      const dial = this._isDialView();
      const visual = dial ? this._sunPathEl : simple ? active(".simple-editor-host") :
        this._view === "variable" ? active(".library-editor") :
        active(".stage-scroll > .empty-state, .editor-preview > .empty-state, .area-rail-body[data-tab=scenes] > .empty-state");
      if (!visual?.isConnected || visual.hidden) return;
      const stage = this._contentEl?.querySelector(".stage-col");
      const emptyMobile = this._narrow && !simple && !dial && this._view !== "variable";
      const mount = emptyMobile ? root.querySelector(".area-rail-body[data-tab=scenes]") : this._stageScrollEl(stage) || this._contentEl;
      const shell = this._sharedEditorShell ||= createEditorShell();
      const toolbar = [];
      if (dial && this._dateToolbar) toolbar.push(this._dateToolbar);
      if (!dial) {
        toolbar.push(...[...visual.querySelectorAll(".scene-used, .library-name-field, .library-hint, .library-used-by:not(.scene-preset-uses)")]
          .filter(node => node.classList.contains("scene-used") || !node.closest(".scene-used")));
        if (this._view === "variable") toolbar.push(...visual.querySelectorAll(":scope > ha-input, .hue-wheel-chrome"));
      }
      // Existing handlers stay on the fresh destination nodes, outside the
      // transitioning preview. Only the outer hosts survive editor changes.
      const hasLights = this._view === "edit" || this._view === "palette";
      const lights = hasLights ? (dial ? this._clockLegendEl : visual.querySelector(".light-tiles-block")) : null;
      const currentLights = lights || (hasLights ? shell.lights.firstChild : null);
      if (!dial && shell.preview.contains(visual)) {
        const freshClasses = new Set(toolbar.map(node => node.className));
        // The dial toolbar belongs to its destination adapter; never carry it
        // into a wheel editor during a responsive remount.
        toolbar.unshift(...[...shell.toolbar.children].filter(node =>
          !node.classList.contains("sun-toolbar") && !freshClasses.has(node.className)));
      }
      mountEditorRegions(shell, { mount, visual, toolbar, lights: currentLights, animateLights: true, reducedMotion: this._prefersReducedMotion() });
      shell.timeline.hidden = !dial;
      if (!dial) delete shell.el.dataset.timeline;
      shell.el.dataset.kind = dial ? "dial" : simple ? "wheel" : this._view === "variable" ? "library" : "empty";
      const bottom = stage ? mount.getBoundingClientRect().bottom :
        this.shadowRoot.querySelector(".page-shell").getBoundingClientRect().bottom;
      shell.el.style.height = `${Math.max(120, stage || emptyMobile ? mount.clientHeight : bottom - shell.el.getBoundingClientRect().top)}px`;
      if (!this._editorShellObserver) {
        this._editorShellObserver = new ResizeObserver(() => this._sizeSharedEditorPreview());
        this._editorShellObserver.observe(shell.preview);
        this._editorShellObserver.observe(shell.toolbar);
        this._editorShellObserver.observe(shell.lights);
      }
      this._sizeSharedEditorPreview();
      const ready = !dial || (Boolean(visual.querySelector(".sun-light-clock")) && this._sunPathMatchesChart());
      if (ready) {
        shell.toolbar.inert = false;
        shell.lights.inert = !hasLights;
      }
      const enter = this._sharedEnterRequested || !shell.preview.dataset.entered;
      if (ready && enter) {
        this._sharedEnterRequested = false;
        shell.preview.dataset.entered = "1";
        const token = shell.previewGate.next();
        const outgoing = this._outgoingStageLayer;
        void crossfadePreview(shell, outgoing, visual, {
          reducedMotion: this._prefersReducedMotion(), current: () => shell.previewGate.current(token),
        }).then(() => {
          if (shell.previewGate.current(token) && this._outgoingStageLayer === outgoing) this._outgoingStageLayer = null;
        });
      }
    } finally {
      this._syncingEditorShell = false;
    }
  }

  _sizeSharedEditorPreview() {
    const shell = this._sharedEditorShell;
    if (!shell?.el.isConnected) return;
    const h = shell.preview.clientHeight;
    const w = shell.preview.clientWidth;
    if (!h || !w) return;
    const usableHeight = this.shadowRoot.querySelector(".page-shell")?.clientHeight || window.innerHeight;
    const geometry = editorGeometry(shell.el.clientWidth, shell.el.clientHeight, usableHeight);
    fitLightStripGutter(shell);
    const toolbarHeight = shell.toolbar.getBoundingClientRect().height;
    shell.el.style.setProperty("--editor-toolbar-height", `${toolbarHeight}px`);
    this._fitSidebarLightStrip();
    shell.el.style.setProperty("--editor-preview-floor", `${geometry.floor}px`);
    shell.el.dataset.overlap = String(geometry.overlap);
    const cap = shell.el.dataset.kind === "dial" ? DIAL_FACE_MAX_PX : WHEEL_FACE_MAX_PX;
    const size = Math.min(cap, w, Math.max(geometry.floor, h - 48));
    const value = `${Math.floor(size)}px`;
    shell.el.style.setProperty("--dial-face-max", value);
    this._sunPathEl?.style.setProperty("--dial-face-max", value);
    this._syncYearScrubLayout();
    this._layoutDialChromeFn?.();
  }

  _syncWorkspaceScrollport() {
    this._syncSharedEditorShell();
    const workspace = this._contentEl?.querySelector(".workspace");
    const scroller = this._appBarScroller();
    const editorFills =
      this._narrow &&
      (this._contentEl?.classList.contains("wide") || this._isDialView());
    if (scroller) {
      scroller.style.overflow = workspace || editorFills ? "hidden" : "";
    }
    if (workspace && this._contentEl) {
      const shell = this.shadowRoot?.querySelector(".page-shell");
      const shellBottom = shell
        ? shell.getBoundingClientRect().bottom
        : this.getBoundingClientRect().bottom;
      const workspaceTop = workspace.getBoundingClientRect().top;
      const available = Math.max(120, Math.floor(shellBottom - workspaceTop));
      workspace.style.height = `${available}px`;
      this._bindAreaRailScroll(this._visibleRailBody(workspace));
      this._syncStageFaceMax();
      this._bindStageScrollLayout(workspace.querySelector(".stage-scroll"));
    } else if (workspace) {
      workspace.style.height = "";
    } else if (this._narrow && this._isDialView()) {
      const page = this.shadowRoot?.querySelector(".page.dial-wide");
      this._bindStageScrollLayout(page);
    }
    this._syncEditorChrome();
    requestAnimationFrame(() => {
      this._restoreAreaRailScroll(this._visibleRailBody(workspace));
      this._syncStageFaceMax();
      this._layoutDialChromeFn?.();
    });
  }

  _visibleRailBody(root) {
    const scope = root || this._contentEl;
    return scope?.querySelector(".area-rail-body:not([hidden])") || null;
  }

  _captureAreaRailScroll() {
    const rail = this._visibleRailBody();
    if (rail && !this._areaRailRestoring) {
      const tab = rail.dataset.tab || "scenes";
      this._railScrollTop = this._railScrollTop || {};
      this._railScrollTop[tab] = rail.scrollTop;
    }
  }

  _revealTargetInRail(rail) {
    const esc = (id) => CSS.escape(id);
    if (this._view === "edit" && this._editId) {
      return rail.querySelector(
        `.scene-card[data-scene-id="${esc(this._editId)}"]`
      );
    }
    if (
      (this._view === "palette" || this._view === "variable") &&
      this._variableId
    ) {
      const id = esc(this._variableId);
      return rail.querySelector(
        `.scene-card[data-item-id="${id}"], .var-chip[data-item-id="${id}"]`
      );
    }
    if (this._view === "theme" && this._themeId) {
      const id = esc(this._themeId);
      return rail.querySelector(
        `.scene-card[data-item-id="${id}"], .theme-chip[data-item-id="${id}"]`
      );
    }
    return rail.querySelector(
      ".scene-card.selected, .var-chip.selected, .theme-chip.selected"
    );
  }

  _revealSelectedInRail(rail) {
    // Match the open item by id. `.selected` is added a frame later so the
    // scale can transition, and waiting for it recenters a rail that was
    // just rebuilt at scroll 0.
    const card = this._revealTargetInRail(rail);
    if (!card || rail.clientHeight < 40) {
      return false;
    }
    const railTop = rail.getBoundingClientRect().top;
    const cardRect = card.getBoundingClientRect();
    const pad = 12;
    const inView =
      cardRect.top >= railTop + pad &&
      cardRect.bottom <= railTop + rail.clientHeight - pad;
    if (!inView) {
      const target =
        rail.scrollTop +
        (cardRect.top - railTop) -
        Math.max(pad, (rail.clientHeight - cardRect.height) / 2);
      rail.scrollTop = Math.max(0, target);
    }
    const tab = rail.dataset.tab || "scenes";
    this._railScrollTop = this._railScrollTop || {};
    this._railScrollTop[tab] = rail.scrollTop;
    this._areaRailDidReveal = true;
    return true;
  }

  _restoreAreaRailScroll(rail) {
    if (!rail) {
      return;
    }
    const tab = rail.dataset.tab || "scenes";
    const apply = () => {
      if (
        !this._areaRailHoldScroll &&
        !this._areaRailSkipReveal &&
        (this._areaRailForceReveal || !this._areaRailUserScrolled)
      ) {
        if (this._revealSelectedInRail(rail)) {
          this._areaRailForceReveal = false;
          return;
        }
      }
      this._areaRailSkipReveal = false;
      const top = this._railScrollTop?.[tab];
      if (top != null) {
        rail.scrollTop = top;
      }
    };
    this._areaRailRestoring = true;
    apply();
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(() => {
        apply();
        this._areaRailRestoring = false;
      });
    });
  }

  _bindAreaRailScroll(rail) {
    if (!rail) {
      return;
    }
    if (this._areaRailBound === rail) {
      this._restoreAreaRailScroll(rail);
      bindStickyTitles(rail)();
      return;
    }
    if (this._areaRailBound && this._onAreaRailScroll) {
      this._areaRailBound.removeEventListener("scroll", this._onAreaRailScroll);
    }
    this._onAreaRailScroll = () => {
      if (this._areaRailRestoring || !this._areaRailDidReveal) {
        return;
      }
      this._areaRailUserScrolled = true;
      const tab = rail.dataset.tab || "scenes";
      this._railScrollTop = this._railScrollTop || {};
      this._railScrollTop[tab] = rail.scrollTop;
    };
    this._areaRailBound = rail;
    rail.addEventListener("scroll", this._onAreaRailScroll, { passive: true });
    this._restoreAreaRailScroll(rail);
    bindStickyTitles(rail);
  }

  _setRailTab(tab) {
    if (tab !== "library" && tab !== "scenes") {
      return;
    }
    if (this._railTab === tab) {
      const current = this._contentEl?.querySelector(".area-rail");
      const body = current?.querySelector(`.area-rail-body[data-tab="${tab}"]`);
      if (body && !body.hidden && this._areaRailBound === body) {
        return;
      }
    }
    this._captureAreaRailScroll();
    try {
      window.localStorage.setItem(this._railTabStorageKey(), tab);
    } catch (error) {
      // Storage can be disabled; navigation still works for this visit.
      if (!["SecurityError", "QuotaExceededError"].includes(error.name)) throw error;
    }
    if (this._view === "list" || this._view === "variables") {
      void this._go(tab === "library" ? "variables" : "");
      return;
    }
    this._railTab = tab;
    const rail = this._contentEl?.querySelector(".area-rail");
    if (!rail) {
      return;
    }
    for (const body of rail.querySelectorAll(".area-rail-body")) {
      body.hidden = body.dataset.tab !== tab;
    }
    for (const button of rail.querySelectorAll("ha-tab")) {
      button.active = button.dataset.tab === tab;
    }
    const body = rail.querySelector(`.area-rail-body[data-tab="${tab}"]`);
    this._areaRailBound = null;
    this._areaRailUserScrolled = false;
    this._bindAreaRailScroll(body);
  }

  _noteRailTabForHash(hash) {
    const library = /^(variable|palette|theme|variables)(\/|$)/.test(hash || "");
    const remembered = this._readLocalStorage(this._railTabStorageKey(hash));
    const nextTab = remembered === "library" || remembered === "scenes" ? remembered : library ? "library" : "scenes";
    // edit → edit stays on the scenes rail. Rebuilding it jumps scroll and
    // flashes the selection. Load, and arrival from the list or library, still
    // reveal when the card is outside the scrollport.
    const scenesToScenes =
      !this._narrow &&
      nextTab === "scenes" &&
      this._railTab !== "library" &&
      (this._view === "edit" || this._view === "list") &&
      (hash === "" || /^edit\/.+/.test(hash || ""));
    // Already on the library tab. Keep the rail and do not recenter.
    // Load, and arrival from the scenes tab, still reveal when the item
    // is outside the scrollport.
    const libraryToLibrary =
      !this._narrow &&
      nextTab === "library" &&
      this._railTab === "library" &&
      (this._view === "variables" ||
        this._view === "variable" ||
        this._view === "palette" ||
        this._view === "theme");
    this._railTab = nextTab;
    if (libraryToLibrary) {
      this._keepAreaRail = true;
      this._areaRailHoldScroll = true;
      this._areaRailForceReveal = false;
      return;
    }
    if (scenesToScenes) {
      this._keepAreaRail = true;
      // List → edit may still scroll a card that is outside the scrollport.
      // Edit → edit and edit → list leave the scroll where the user left it.
      const fromList = this._view !== "edit";
      this._areaRailHoldScroll = !fromList;
      if (fromList) {
        this._areaRailForceReveal = true;
      }
      return;
    }
    this._keepAreaRail = false;
    this._areaRailHoldScroll = false;
    this._areaRailForceReveal = true;
    this._areaRailUserScrolled = false;
  }

  _crossfadeSceneCover(page, previous) {
    const next = page?.querySelector(".scene-cover");
    const prevUrl = previous?.style.backgroundImage || "";
    const nextUrl = next?.style.backgroundImage || "";
    const reduced = this._prefersReducedMotion();
    if (previous && prevUrl && prevUrl !== nextUrl && !reduced) {
      previous.classList.remove("is-leaving");
      previous.classList.add("is-shown");
      if (next) {
        page.insertBefore(previous, next);
      } else {
        page.prepend(previous);
      }
      const drop = () => previous.remove();
      previous.addEventListener("transitionend", drop, { once: true });
      window.setTimeout(drop, 700);
      requestAnimationFrame(() => previous.classList.add("is-leaving"));
    }
    if (!next) {
      return;
    }
    if (reduced || (prevUrl && prevUrl === nextUrl)) {
      next.classList.add("is-shown");
      return;
    }
    requestAnimationFrame(() => next.classList.add("is-shown"));
  }

  _mountWorkspacePage(page, { resetStageScroll = true } = {}) {
    this._captureAreaRailScroll();
    const overlay = this._outgoingStageLayer;
    if (!overlay?.classList.contains("editor-preview-exit")) overlay?.remove();
    const covers = [...(this._contentEl?.querySelectorAll(".scene-cover") || [])];
    const previous = covers.find((cover) => !cover.classList.contains("is-leaving"));
    previous?.remove();
    for (const cover of covers) {
      if (cover !== previous) {
        cover.remove();
      }
    }
    this._contentEl.replaceChildren(page);
    this._crossfadeSceneCover(page, previous);
    this._bindAreaRailScroll(this._visibleRailBody(page));
    if (resetStageScroll) {
      const scroll = page.querySelector(".stage-scroll");
      if (scroll) {
        scroll.scrollTop = 0;
      }
    }
    this._attachOutgoingStageLayer(page.querySelector(".stage-col"));
  }

  _syncStageFaceMax() {
    if (this._sharedEditorShell?.el.isConnected) {
      this._sizeSharedEditorPreview();
      return;
    }
    if (this._faceSyncing) {
      return;
    }
    this._faceSyncing = true;
    try {
    const stage = this._contentEl?.querySelector(".stage-col");
    // A narrow dial has no stage column. Measure the page so the face can
    // shrink into the space above the tiles.
    const narrowDial = !stage && this._narrow && this._isDialView();
    const measureRoot = stage || (narrowDial
      ? this.shadowRoot?.querySelector(".page.dial-wide")
      : null);
    if (!measureRoot) {
      return;
    }
    const scroll = stage ? this._stageScrollEl(stage) : null;
    const box = scroll || measureRoot;
    const scrollH = box.clientHeight || 0;
    const scrollW = box.clientWidth || 0;
    if (scrollH < 1 || scrollW < 1) {
      return;
    }
    const boxTop = box.getBoundingClientRect().top;
    const visibleBottom = Math.min(
      this.getBoundingClientRect().bottom,
      this._contentEl.getBoundingClientRect().bottom
    );
    const visibleH = Math.floor(
      Math.min(scrollH, Math.max(0, visibleBottom - boxTop))
    );
    const isDial = this._isDialView();
    const minPx = isDial ? DIAL_FACE_MIN_PX : WHEEL_FACE_MIN_PX;
    const widthCap = isDial ? scrollW : Math.min(scrollW, WHEEL_FACE_MAX_PX);
    const strip =
      box.querySelector(".sun-light-clock-legend") ||
      box.querySelector(".light-tiles-scroller");
    let stripH = strip
      ? Math.ceil(strip.getBoundingClientRect().height)
      : 0;
    if (
      !stripH &&
      (box.querySelector(".simple-editor") ||
        (isDial && this._view === "edit" && this._formData?.kind !== "simple"))
    ) {
      stripH = 181;
    }
    let overhead = 40 + 16;
    const clock = box.querySelector(".sun-light-clock");
    const editor = box.querySelector(".simple-editor, .library-editor");
    if (editor && this._faceObserved !== editor) {
      this._faceObserved = editor;
      this._faceObserver?.disconnect();
      this._faceObserver = new ResizeObserver(() => {
        if (this._faceSyncing) {
          this._faceResync = true;
          return;
        }
        this._syncStageFaceMax();
      });
      this._faceObserver.observe(editor);
    }
    if (clock) {
      const cs = getComputedStyle(clock);
      const padTop = parseFloat(cs.paddingTop);
      const padBottom = parseFloat(cs.paddingBottom);
      const gap = parseFloat(cs.rowGap || cs.gap);
      overhead =
        (Number.isFinite(padTop) ? padTop : 40) +
        (Number.isFinite(padBottom) ? padBottom : 16) +
        (Number.isFinite(gap) ? gap : 16);
      const face = box.querySelector(".sun-light-clock-face");
      const faceMargin = face ? parseFloat(getComputedStyle(face).marginTop) : 0;
      if (Number.isFinite(faceMargin)) {
        overhead += faceMargin;
      }
    } else if (editor) {
      const disk = editor.querySelector(".hue-wheel-canvas");
      const diskH = disk?.getBoundingClientRect().height || 0;
      const around = editor.getBoundingClientRect().height - diskH;
      if (around > 8 && diskH > 8) {
        // Tiles, mode row, and editor padding are whatever is not the disk.
        // Estimating those pieces left the disk too tall and pushed the tiles
        // out of the visible scrollport before the 400px floor.
        overhead = around;
        stripH = 0;
      } else {
        const cs = getComputedStyle(editor);
        const padTop = parseFloat(cs.paddingTop);
        const padBottom = parseFloat(cs.paddingBottom);
        const gap = parseFloat(cs.rowGap || cs.gap);
        overhead =
          (Number.isFinite(padTop) ? padTop : 40) +
          (Number.isFinite(padBottom) ? padBottom : 16) +
          (Number.isFinite(gap) ? gap : 16);
        const wheels = box.querySelector(".simple-wheels");
        if (wheels) {
          const wheelPad = parseFloat(getComputedStyle(wheels).paddingBottom);
          overhead += Number.isFinite(wheelPad) ? wheelPad : 0;
        }
        const chrome = editor.querySelector(".hue-wheel-chrome");
        const chromeH = chrome
          ? Math.ceil(chrome.getBoundingClientRect().height)
          : 0;
        const wheelStage = editor.querySelector(".hue-wheel-stage");
        const stageGap = wheelStage
          ? parseFloat(
              getComputedStyle(wheelStage).rowGap ||
                getComputedStyle(wheelStage).gap
            )
          : 16;
        overhead += (chromeH || 64) + (Number.isFinite(stageGap) ? stageGap : 16);
        const nameField = box.querySelector(".library-name-field");
        if (nameField) {
          overhead += Math.ceil(nameField.getBoundingClientRect().height) || 0;
        }
      }
    }
    let toolbarH = 0;
    if (isDial && this._dateToolbar?.isConnected && !this._dialChromeOverlaysFace()) {
      toolbarH = Math.ceil(this._dateToolbar.getBoundingClientRect().height) || 0;
    }
    /* scene-used is an overlay. Its height must not shrink the dial. */
    const budgetH = editor && !clock ? visibleH : scrollH;
    // Tile-strip padding hangs outside its margin box and lengthens the
    // scrollport. For a dial the clock is only the face, so measuring spill
    // from the clock also counted the toolbar and the tiles and pinned the
    // face at its floor. The path is the whole column.
    const laidOut = editor && !clock ? editor : clock;
    const spillTarget = isDial
      ? box.querySelector(".sun-path.dial-view") || clock
      : laidOut;
    const spill = spillTarget
      ? Math.max(0, box.scrollHeight - spillTarget.offsetHeight)
      : 0;
    const available = budgetH - stripH - overhead - toolbarH - spill;
    // Wide dials keep the color-wheel floor and scroll. A phone dial shrinks.
    const floor = narrowDial ? 1 : minPx;
    const size = Math.max(
      1,
      Math.floor(Math.min(widthCap, Math.max(floor, available)))
    );
    const nextFace = `${size}px`;
    const prevFace = measureRoot.style.getPropertyValue("--dial-face-max");
    measureRoot.style.setProperty("--dial-face-max", nextFace);
    if (this._sunPathEl?.classList.contains("dial-view")) {
      this._sunPathEl.style.setProperty("--dial-face-max", nextFace);
    }
    if (prevFace !== nextFace && (clock || (editor && !clock))) {
      const pass = (this._faceMaxPass || 0) + 1;
      if (pass <= 3) {
        this._faceMaxPass = pass;
        requestAnimationFrame(() => {
          if (this.isConnected) {
            this._syncStageFaceMax();
          }
        });
      }
    } else {
      this._faceMaxPass = 0;
    }
    } finally {
      this._faceSyncing = false;
      if (this._faceResync) {
        this._faceResync = false;
        requestAnimationFrame(() => {
          if (this.isConnected) {
            this._syncStageFaceMax();
          }
        });
      }
    }
  }

  _paintListInPlace() {
    const page = this._contentEl?.querySelector(":scope > .workspace");
    const rail = page?.querySelector(":scope > .area-rail");
    const stage = page?.querySelector(":scope > .stage-col");
    if (!rail || !stage || this._railTab === "library" || this._narrow) {
      return false;
    }
    const cards = rail.querySelectorAll(
      '.area-rail-body[data-tab="scenes"] .scene-card[data-scene-id]'
    );
    // Keep the rail only if its areas and scene membership are still current,
    // including the zero-scene case during startup.
    const scenesBody = rail.querySelector('.area-rail-body[data-tab="scenes"]');
    if (cards.length !== (this._items || []).length ||
        scenesBody?.dataset.catalogKey !== sceneRailCatalogKey(this._floors || [], this._items || [])) {
      return false;
    }
    this._syncRailSelection();
    for (const cover of page.querySelectorAll(".scene-cover")) {
      if (cover.classList.contains("is-leaving")) {
        continue;
      }
      cover.classList.add("is-leaving");
      const drop = () => cover.remove();
      cover.addEventListener("transitionend", drop, { once: true });
      window.setTimeout(drop, 700);
    }
    const scroll = this._stageScrollEl(stage);
    scroll?.replaceChildren(renderListStageEmpty(this));
    this._mountPageBanners(stage);
    this._syncWorkspaceScrollport();
    this._prepareEmptyEnter(scroll?.querySelector(":scope > .empty-state"));
    return true;
  }

  _renderList({ keepSidebar = false, keepRail = false } = {}) {
    const openSidebar = this.shadowRoot?.querySelector(".scene-sidebar");
    if (
      !keepSidebar &&
      openSidebar &&
      !openSidebar.classList.contains("list-settings-dialog")
    ) {
      this._closeSceneSidebar();
    }
    // Allow clock enter again the next time an editor opens.
    this._clockEnterPlayed = false;
    this._clockStickySeconds = undefined;
    this._liveEditSidebarHandler = null;
    this._abandonScenePreview();
    this._abortPreview();
    this._cancelClockSunArc();
    this._cancelSunPathMorph();
    this._forgetClockDom({
      keepOverlay: Boolean(this._outgoingStageLayer),
    });
    this._form = undefined;
    this._parkSunPath();
    this._sunPath = null;
    this._sunPathKey = undefined;
    this._syncAppBarTitle();
    this._setNavigationIcon(
      this._view === "variables" ? this._backButton() : this._menuButton()
    );
    this._contentEl.classList.remove("wide");
    this._contentEl.classList.remove("workspace-split");
    this._syncEditorChrome();

    if (this._error) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      this._contentEl.replaceChildren(error);
      this._setListActions();
      this._setFab(null);
      return;
    }

    if (keepRail && this._paintListInPlace()) {
      this._setListActions();
      this._setFab(null);
      return;
    }

    const page = renderLanding(this, { includeStage: true });
    this._mountWorkspacePage(page);
    const stage = page.querySelector(".stage-col");
    if (stage) {
      this._mountPageBanners(stage);
    }
    this._syncWorkspaceScrollport();
    this._setListActions();
    this._setFab(null);
    this._prepareEmptyEnter(
      this._contentEl.querySelector(".stage-scroll > .empty-state")
    );
  }

  async _autoConfigure() {
    try {
      await this._hass.callWS({ type: `${DOMAIN}/auto_configure` });
      this._mobileManualEmpty = true;
      await this._loadList();
    } catch (err) {
      this._error = err.message || String(err);
      this._renderList();
    }
  }

  async _dismissMobileOnboarding() {
    this._mobileManualEmpty = true;
    if (!this._prefersReducedMotion()) {
      this._liftOutgoingStageLayer();
      const layer = this._outgoingStageLayer;
      layer?.classList.add("editor-preview-exit-active");
      await this._waitForAnimation(layer, "stage-surface-exit-scale", 480);
      if (this._outgoingStageLayer !== layer) return;
      this._disposeOutgoingStageLayer();
    }
    this._sharedEnterRequested = false;
    this._render();
  }

  _paintSimpleSceneCard(dots) {
    const id = this._editId;
    if (!id) {
      return;
    }
    const item = (this._items || []).find((scene) => scene.id === id);
    if (item) {
      item.card = { ...(item.card || {}), kind: "simple", dots };
    }
    const card = this.shadowRoot?.querySelector(
      `.scene-card[data-scene-id="${CSS.escape(id)}"]`
    );
    const meshes = card?.parentElement?.querySelectorAll("canvas.card-mesh");
    for (const mesh of meshes || []) {
      paintSimpleCardMesh(mesh, dots);
    }
  }

  _areaCreateDropdown(trigger, { areaId, areaName } = {}) {
    const menu = document.createElement("ha-dropdown");
    menu.className = "area-create-menu";
    menu.activatable = true;
    trigger.slot = "trigger";
    menu.appendChild(trigger);
    const addItem = (value, label, iconName) => {
      const item = document.createElement("ha-dropdown-item");
      item.value = value;
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", iconName);
      icon.slot = "icon";
      item.append(icon, document.createTextNode(label));
      menu.appendChild(item);
    };
    addItem(
      "scene",
      this._t("frontend.create.circadian", "Create circadian scene"),
      "mdi:sun-clock"
    );
    addItem(
      "simple",
      this._t("frontend.create.scene", "Create scene"),
      "mdi:palette"
    );
    menu.addEventListener("wa-select", (ev) => {
      ev.stopPropagation();
      const kind = ev.detail?.item?.value;
      if (kind) {
        void this._createLibraryItem(kind, { areaId, areaName });
      }
    });
    return menu;
  }

  _editedSolarEventId() {
    if (this._sidebarEventId) {
      return this._sidebarEventId;
    }
    const events = (this._sunPath?.events || []).filter((item) => item?.id);
    if (!events.length) {
      return "noon";
    }
    const seconds = this._idleReadoutSeconds?.() ?? 0;
    let best = events[0];
    for (const event of events) {
      if (event.seconds != null && event.seconds <= seconds) {
        best = event;
      }
    }
    return best.id;
  }

  _sceneBasePalette() {
    const scene = this._formData;
    if (!scene || this._view !== "edit") {
      return null;
    }
    if (scene.kind === "simple") {
      return scene.palette_id
        ? { palette_id: scene.palette_id, assignment_seed: scene.assignment_seed || 0 }
        : null;
    }
    const eventId = this._editedSolarEventId();
    const entry = scene.event_palettes?.[eventId];
    return entry?.palette_id
      ? { palette_id: entry.palette_id, assignment_seed: entry.assignment_seed || 0, eventId }
      : { eventId };
  }

  async _pickSceneBasePalette() {
    if (this._view !== "edit" || !this._formData) {
      return;
    }
    const current = this._sceneBasePalette();
    const picked = new Set(this._simpleSelectedIds || []);
    if (this._sidebarLightId) {
      picked.add(this._sidebarLightId);
    }
    for (const id of this._legendSelectedIds || []) {
      picked.add(id);
    }
    const choice = await this._chooseScenePalette({
      areaId: this._formData.area,
      mode: "edit",
      paletteId: current?.palette_id || null,
    });
    if (!choice) {
      return;
    }
    this._applySceneBasePalette(choice, picked);
  }

  _applySceneBasePalette(choice, pickedBefore) {
    const scene = this._formData;
    if (!scene || !choice) {
      return;
    }
    const next = choice.palette?.id || null;
    const seed = next ? choice.seed || 0 : 0;
    this._commitUndo();
    const picked = pickedBefore || new Set();
    const canColor = (eid) => {
      const flags = this._lightModeFlags(eid);
      return !flags.onOff && !flags.brightnessOnly;
    };
    if (scene.kind === "simple") {
      const prev = scene.palette_id || null;
      scene.palette_id = next;
      scene.assignment_seed = seed;
      const lights = scene.lights || {};
      for (const [eid, light] of Object.entries(lights)) {
        const selected = picked.has(eid);
        const followed = light?.variable_ref === prev;
        if (!selected && !followed) {
          continue;
        }
        if (!canColor(eid)) {
          continue;
        }
        if (next) {
          lights[eid] = { variable_ref: next };
        } else if (followed) {
          delete lights[eid];
        }
      }
      for (const eid of picked) {
        if (!canColor(eid) || !next) {
          continue;
        }
        lights[eid] = { variable_ref: next };
      }
      scene.lights = lights;
      this._simpleSelectedIds = [...picked];
      this._stampListPreset();
      this._saveSoon();
      this._render();
      this._syncOpenSceneCardFace();
      return;
    }
    const eventId = this._editedSolarEventId();
    const map = { ...(scene.event_palettes || {}) };
    if (next) {
      map[eventId] = { palette_id: next, assignment_seed: seed };
    } else {
      delete map[eventId];
    }
    scene.event_palettes = map;
    if (picked.size) {
      this._legendSelectedIds = new Set(picked);
      this._syncClockLightSelection?.();
    }
    this._refreshInheritedLightDrafts?.();
    this._clearPreviewCache();
    this._patchDialFromSession();
    this._schedulePreview();
    this._stampListPreset();
    this._saveSoon();
    this._syncOpenSceneWheel?.();
    this._syncSceneUsed();
    this._syncOpenSceneCardFace();
  }

  async _pickSceneTheme() {
    if (this._view !== "edit" || !this._formData) {
      return;
    }
    const scene = this._formData;
    const current = scene.theme_id || (scene.kind === "simple" ? null : "default");
    const choice = await this._chooseSceneTheme({
      themeId: current,
      allowNone: scene.kind === "simple",
    });
    if (!choice) {
      return;
    }
    this._applySceneTheme(choice.themeId);
  }

  _applySceneTheme(themeId) {
    const scene = this._formData;
    if (!scene) {
      return;
    }
    const next = themeId || null;
    if (scene.kind !== "simple" && !next) {
      return;
    }
    const prev = scene.theme_id || (scene.kind === "simple" ? null : "default");
    if (prev === next) {
      this._syncSceneUsed();
      return;
    }
    this._commitUndo();
    scene.theme_id = next;
    this._themeDraft = null;
    this._saveSoon();
    if (scene.kind === "simple") {
      this._syncSceneUsed();
      return;
    }
    void this._ensureThemeDraft().then(() => this._ensureSunPath());
  }

  _buildEmptyState({ icon, title, paragraphs, learnMore = false }) {
    const el = document.createElement("div");
    el.className = "empty-state";
    const iconEl = document.createElement("ha-icon");
    iconEl.setAttribute("icon", icon);
    el.appendChild(iconEl);
    const heading = document.createElement("h1");
    heading.textContent = title;
    el.appendChild(heading);
    for (const text of paragraphs) {
      const p = document.createElement("p");
      p.textContent = text;
      el.appendChild(p);
    }
    if (learnMore) {
      const link = document.createElement("a");
      link.className = "learn-more";
      link.href = "https://github.com/etokheim/scene_studio";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = this._t("frontend.empty.learn_more", "Learn more");
      const openIcon = document.createElement("ha-icon");
      openIcon.setAttribute("icon", "mdi:open-in-new");
      link.appendChild(openIcon);
      el.appendChild(link);
    }
    return el;
  }

  _adoptSettings(settings) {
    this._settings = {
      automatically_update_lights_interval: 300,
      automatic_updates_enabled: true,
      respect_manual_changes: true,
      always_follow_scene: [],
      always_respect_manual_changes: [],
      dusk_minimum_time_of_day: 22 * 3600,
      dusk_minimum_enabled: true,
      dawn_maximum_time_of_day: 6 * 3600,
      dawn_maximum_enabled: true,
      ...(settings || {}),
    };
    this._settingsBindings = (this._settingsBindings || []).filter(binding => binding.control.isConnected);
    for (const binding of this._settingsBindings) binding.sync();
  }

  _appendUpdateSettings(parent) {
    const specs = [
      ["automatic_updates_enabled", "Automatic updates", "Keep activated circadian scenes moving with the sun. Paused scenes still apply once when activated.", false],
      ["respect_manual_changes", "Respect manual changes", "Stop updating lights changed manually. Temporary unavailability waits for recovery.", false],
      ["always_follow_scene", "Always follow scene", "Bring these lights back to the scene even after manual changes or switching them off.", true],
      ["always_respect_manual_changes", "Always respect manual changes", "Stop updating these lights after manual changes, even when Respect manual changes is off.", true],
    ];
    for (const [key, fallback, helperText, multiple] of specs) {
      const row = document.createElement("div");
      row.className = "setup-link-row update-preference-row";
      const copy = document.createElement("div");
      const label = document.createElement("div");
      label.className = "name";
      label.textContent = this._t(`frontend.settings.${key}`, fallback);
      const helper = document.createElement("div");
      helper.className = "sidebar-note";
      helper.textContent = this._t(`frontend.settings.${key}_helper`, helperText);
      copy.append(label, helper);
      const control = document.createElement(multiple ? "ha-selector" : "ha-switch");
      control.dataset.setting = key;
      control.setAttribute("aria-label", label.textContent);
      if (multiple) {
        control.hass = this._hass;
        control.selector = { entity: { domain: "light", multiple: true } };
      }
      const sync = () => {
        if (multiple) control.value = [...(this._settings[key] || [])];
        else control.checked = this._settings[key] !== false;
      };
      sync();
      control.addEventListener(multiple ? "value-changed" : "change", async ev => {
        ev.stopPropagation();
        const value = multiple ? (ev.detail?.value || []) : control.checked;
        if (JSON.stringify(value) === JSON.stringify(this._settings[key])) return;
        try {
          const result = await this._hass.callWS({ type: `${DOMAIN}/update_settings`, settings: { [key]: value } });
          this._adoptSettings(result.settings);
        } catch (err) {
          // A failed resume can follow a successful preference save; read the
          // durable value instead of guessing that the save was rolled back.
          this._adoptSettings(await this._hass.callWS({ type: `${DOMAIN}/get_settings` }));
          window.alert(err.message || String(err));
        }
      });
      this._settingsBindings ||= [];
      this._settingsBindings.push({ control, sync });
      row.append(copy, control);
      parent.appendChild(row);
    }
  }

  _listSettingsButton() {
    const btn = document.createElement("ha-icon-button");
    btn.label = this._t("frontend.settings.title", "Settings");
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", "mdi:cog");
    btn.appendChild(icon);
    btn.addEventListener("click", () => this._openListSettingsSidebar());
    return btn;
  }

  async _openListSettingsSidebar() {
    const existing = this.shadowRoot?.querySelector(
      ".scene-sidebar.list-settings-dialog"
    );
    if (existing && !existing._closing) {
      await this._requestCloseSceneSidebar(existing);
      return;
    }
    const opened = await this._openSceneSidebar({
      title: this._t("frontend.settings.title", "Settings"),
      className: "list-settings-dialog",
    });
    if (!opened) {
      return;
    }
    const { body } = opened;
    const note = document.createElement("p");
    note.className = "sidebar-note";
    note.textContent = this._t(
      "frontend.settings.intro",
      "These settings apply to every room. Changes take effect immediately."
    );
    body.appendChild(note);
    this._appendUpdateSettings(body);

    const intervalRow = document.createElement("div");
    intervalRow.className = "setup-link-row automatically-update-lights-interval-row";
    const intervalLabelWrap = document.createElement("div");
    const intervalLabel = document.createElement("div");
    intervalLabel.className = "name";
    intervalLabel.textContent = this._t(
      "frontend.settings.automatically_update_lights_interval",
      "Automatically update lights interval"
    );
    const intervalHelper = document.createElement("div");
    intervalHelper.className = "sidebar-note";
    intervalHelper.style.margin = "4px 0 0";
    intervalHelper.textContent = this._t(
      "frontend.settings.automatically_update_lights_interval_helper",
      "After a scene is activated, keep updating the lights this often with the same transition length (target = how the room should look at the end of the transition). Use Automatic updates to pause updates without changing this interval."
    );
    intervalLabelWrap.append(intervalLabel, intervalHelper);
    const intervalField = document.createElement("ha-selector");
    intervalField.hass = this._hass;
    intervalField.label = this._t(
      "frontend.settings.automatically_update_lights_interval_minutes",
      "Minutes"
    );
    const currentSeconds = Number(this._settings?.automatically_update_lights_interval ?? 300);
    intervalField.value = Math.round(currentSeconds / 60);
    intervalField.selector = {
      number: { min: 1, max: 30, step: 1, mode: "box", unit_of_measurement: "min" },
    };
    let intervalSaveTimer;
    const saveInterval = async () => {
      const minutes = Number(intervalField.value);
      try {
        if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 30) throw new Error(this._t("frontend.settings.invalid_interval", "Enter an interval from 1 to 30 minutes."));
        const seconds = Math.round(minutes * 60);
        const result = await this._hass.callWS({
          type: `${DOMAIN}/update_settings`,
          settings: { automatically_update_lights_interval: seconds },
        });
        this._adoptSettings(result?.settings);
        const saved = Number(
          this._settings.automatically_update_lights_interval || 0
        );
        if (saved > 0) {
          this._aulResumeInterval = saved;
        }
        intervalField.value = Math.round(saved / 60);
        if (this._view === "list") {
          this._renderList({ keepSidebar: true });
        }
      } catch (err) {
        intervalField.value = Math.round(currentSeconds / 60);
        window.alert(err.message || String(err));
      }
    };
    intervalField.addEventListener("value-changed", (ev) => {
      window.clearTimeout(intervalSaveTimer);
      intervalSaveTimer = window.setTimeout(saveInterval, 400);
      ev.stopPropagation();
    });
    intervalRow.append(intervalLabelWrap, intervalField);
    body.appendChild(intervalRow);

    this._appendDuskMinimumPicker(body);
    this._appendDuskMinimumPicker(body, "dawn");

    const reset = document.createElement("ha-button");
    reset.className = "settings-reset";
    reset.variant = "danger";
    reset.textContent = this._t(
      "frontend.settings.reset",
      "Delete and reset everything"
    );
    reset.addEventListener("click", () => this._confirmResetEverything());
    body.appendChild(reset);
  }

  _confirmResetEverything() {
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute(
      "header-title",
      this._t("frontend.settings.reset_title", "Delete and reset everything?")
    );
    dialog.open = true;
    const text = document.createElement("p");
    text.textContent = this._t(
      "frontend.settings.reset_confirm",
      "This deletes every Scene Studio scene and its Home Assistant scene. Scene presets and circadian presets are removed. Color presets are replaced with the five default colors, and settings return to their defaults. Lights, areas, and other integrations stay. This cannot be undone."
    );
    dialog.appendChild(text);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._t("frontend.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const confirm = document.createElement("ha-button");
    confirm.slot = "primaryAction";
    confirm.variant = "danger";
    confirm.textContent = this._t(
      "frontend.settings.reset",
      "Delete and reset everything"
    );
    confirm.addEventListener("click", () => {
      dialog.open = false;
      void this._resetEverything();
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  }

  _clearSceneStudioDrafts() {
    try {
      const prefixes = [`${DOMAIN}.draft.`, ...LEGACY_DOMAINS.map((domain) => `${domain}.draft.`)];
      const drop = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
          drop.push(key);
        }
      }
      for (const key of drop) {
        window.localStorage.removeItem(key);
      }
    } catch (_err) {
      // Private mode can throw on localStorage.
    }
  }

  _resetLocalEditPreferences() {
    try {
      for (const key of [
        this._liveEditStorageKey(),
        ...this._legacyLiveEditStorageKey(),
        this._roomPreviewStorageKey(),
        ...this._legacyRoomPreviewStorageKey(),
      ]) {
        window.localStorage.removeItem(key);
      }
    } catch (_err) {
      // Private mode can throw on localStorage; defaults still apply now.
    }
    this._liveEdit = true;
    this._mobileManualEmpty = false;
  }

  async _resetEverything() {
    try {
      await this._hass.callWS({ type: `${DOMAIN}/reset` });
    } catch (err) {
      this._error = err.message || String(err);
      this._render();
      return;
    }
    this._clearSceneStudioDrafts();
    this._resetLocalEditPreferences();
    this._items = [];
    this._formData = null;
    this._editId = null;
    await this._go("");
    await this._loadList();
  }

  _appendDuskMinimumPicker(parent, eventId = "dusk") {
    const dawn = eventId === "dawn";
    const timeKey = dawn ? "dawn_maximum_time_of_day" : "dusk_minimum_time_of_day";
    const enabledKey = dawn ? "dawn_maximum_enabled" : "dusk_minimum_enabled";
    const defaultSeconds = dawn ? 6 * 3600 : 22 * 3600;
    const storedSeconds = () => timeToSeconds(this._settings?.[timeKey] ?? defaultSeconds);
    const row = document.createElement("div");
    row.className = "setup-link-row dusk-minimum-row";
    const labelWrap = document.createElement("div");
    const label = document.createElement("div");
    label.className = "name";
    label.textContent = this._t(
      `frontend.settings.${timeKey}`,
      dawn ? "Latest dawn" : "Earliest time for dusk"
    );
    const helper = document.createElement("div");
    helper.className = "sidebar-note";
    helper.style.margin = "4px 0 0";
    helper.textContent = this._t(
      `frontend.settings.${timeKey}_helper`,
      dawn ? "Advance dawn when sunrise comes late. Applies to every circadian scene and preset." : "To avoid lights dimming too much, too early. Applies to every circadian scene and theme."
    );
    const titleRow = document.createElement("div");
    titleRow.className = "solar-limit-title";
    labelWrap.append(titleRow, helper);
    const picker = document.createElement("ha-selector");
    picker.classList.add(`${eventId}-minimum-picker`);
    picker.hass = this._hass;
    picker.value = secondsToTime(storedSeconds());
    picker.selector = { time: {} };
    let saveTimer;
    const save = async () => {
      try {
        const seconds = timeToSeconds(picker.value);
        if (!Number.isFinite(seconds)) throw new Error(this._t("frontend.settings.invalid_limit_time", "Enter a valid time."));
        const result = await this._hass.callWS({
          type: `${DOMAIN}/update_settings`,
          settings: { [timeKey]: seconds },
        });
        this._adoptSettings(result?.settings);
        picker.value = secondsToTime(storedSeconds());
        this._refreshDuskVisuals();
        for (const el of this.shadowRoot?.querySelectorAll(
          `ha-selector.${eventId}-minimum-picker`
        ) || []) {
          if (el !== picker) {
            el.value = picker.value;
          }
        }
      } catch (err) {
        picker.value = secondsToTime(storedSeconds());
        window.alert(err.message || String(err));
      }
    };
    picker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(save, 400);
    });
    const enabled = document.createElement("ha-switch");
    enabled.checked = this._settings?.[enabledKey] !== false;
    enabled.setAttribute("aria-label", label.textContent);
    picker.disabled = !enabled.checked;
    enabled.addEventListener("change", async () => {
      try {
        const result = await this._hass.callWS({ type: `${DOMAIN}/update_settings`, settings: { [enabledKey]: enabled.checked } });
        this._adoptSettings(result?.settings);
        picker.disabled = !enabled.checked;
        this._refreshDuskVisuals();
      } catch (err) {
        enabled.checked = this._settings?.[enabledKey] !== false;
        window.alert(err.message || String(err));
      }
    });
    titleRow.append(label, enabled);
    row.append(labelWrap, picker);
    parent.appendChild(row);
    return picker;
  }

  _syncDuskMinimumSlot(slot, eventId) {
    if (!slot) {
      return;
    }
    slot.replaceChildren();
    if (eventId === "dusk" || eventId === "dawn") {
      this._appendDuskMinimumPicker(slot, eventId);
    }
  }

  _refreshDuskVisuals() {
    this._clearPreviewCache();
    this._themeSolarKey = undefined;
    this._sunPathKey = undefined;
    if (this._view === "edit" || this._view === "theme") {
      this._ensureSunPath();
    }
  }

  _setFab(node) {
    if (!this._fabEl) {
      return;
    }
    if (this._fabHideTimer) {
      window.clearTimeout(this._fabHideTimer);
      this._fabHideTimer = undefined;
    }
    if (!node) {
      this._fabEl.classList.add("is-hidden");
      this._fabHideTimer = window.setTimeout(() => {
        this._fabHideTimer = undefined;
        if (this._fabEl?.classList.contains("is-hidden")) {
          this._fabEl.replaceChildren();
          this._fabEl.setAttribute("hidden", "");
        }
      }, 200);
      return;
    }
    this._fabEl.removeAttribute("hidden");
    this._fabEl.replaceChildren(node);
    this._fabEl.classList.add("is-hidden");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._fabEl?.classList.remove("is-hidden");
      });
    });
  }

  /** Name FAB when the open item is still Untitled. */
  _syncSaveFab() {
    this._saveFabVisible = false;
    this._syncNameFab();
  }

  _fabButton(label, icon, onClick) {
    const button = document.createElement("ha-button");
    button.size = "l";
    button.variant = "brand";
    button.appearance = "accent";
    const haIcon = document.createElement("ha-icon");
    haIcon.setAttribute("icon", icon);
    haIcon.slot = "start";
    button.append(haIcon, document.createTextNode(label));
    button.addEventListener("click", onClick);
    return button;
  }

  _setActionItems(...nodes) {
    for (const child of [...this._appBar.children]) {
      if (child.getAttribute("slot") === "actionItems") {
        child.remove();
      }
    }
    for (const node of nodes) {
      if (!node) {
        continue;
      }
      node.slot = "actionItems";
      this._appBar.appendChild(node);
    }
  }

  _setListActions() {
    const undo = this._undoRedoButton("undo");
    const redo = this._undoRedoButton("redo");
    this._undoBtn = undo;
    this._redoBtn = redo;
    this._setActionItems(undo, redo, this._listSettingsButton());
    this._syncUndoButtons();
  }

  _setEditorActions() {
    this._liveEdit = this._readLiveEditPref();
    this._liveEditSwitch = null;
    this._locationBtn = null;
    if (!this._narrow) {
      // The list column owns Live edit. Header stays undo, redo, settings.
      this._setListActions();
      if (this._view === "edit") {
        this._maybeResumeRoomPreview();
      }
      return;
    }
    if (this._view === "theme") {
      this._roomPreviewSwitch = null;
      const undo = this._undoRedoButton("undo");
      const redo = this._undoRedoButton("redo");
      this._undoBtn = undo;
      this._redoBtn = redo;
      this._setActionItems(undo, redo);
      this._syncUndoButtons();
      return;
    }
    // Narrow editors replace the rail. Live edit lives in the overflow menu.
    const undo = this._undoRedoButton("undo");
    const redo = this._undoRedoButton("redo");
    this._undoBtn = undo;
    this._redoBtn = redo;
    this._setActionItems(undo, redo, this._overflowMenu());
    this._syncUndoButtons();
    this._syncLocationToolbar();
    if (this._view === "edit") {
      this._maybeResumeRoomPreview();
    }
  }

  _syncLiveEditControl() {
    if (this._liveEditSwitch) {
      this._liveEditSwitch.checked = Boolean(this._liveEdit);
    }
    this._syncSidebarLiveEditToggle();
    this._syncActivateSceneButton();
  }

  _syncSidebarLiveEditToggle() {
    const el = this._sidebarLiveEditToggle;
    if (!el) {
      return;
    }
    el.hidden = this._readRoomPreviewPref();
  }

  _syncRoomPreviewControl() {
    const checked = this._readRoomPreviewPref();
    this.shadowRoot?.querySelectorAll(".rail-live-edit ha-switch").forEach((el) => {
      el.checked = checked;
    });
    if (this._roomPreviewSwitch) {
      this._roomPreviewSwitch.checked = checked;
    }
    this._syncSidebarLiveEditToggle();
    this._syncActivateSceneButton();
  }

  _syncActivateSceneButton() {
    const btn = this._activateSceneBtn;
    if (!btn) {
      return;
    }
    btn.hidden = Boolean(this._readRoomPreviewPref() || this._liveEdit);
  }

  _maybeResumeRoomPreview() {
    if (this._view !== "edit" || !this._readRoomPreviewPref()) {
      this._syncRoomPreviewControl();
      return;
    }
    void this._resumeRoomPreviewIfPreferred();
  }

  async _resumeRoomPreviewIfPreferred() {
    if (this._view !== "edit" || !this._readRoomPreviewPref()) {
      return;
    }
    if (this._roomPreviewHoldApply) {
      this._roomPreviewHoldApply = false;
      this._syncRoomPreviewControl();
      return;
    }
    if (!this._roomPreview) {
      await this._startRoomPreview();
      this._syncRoomPreviewControl();
      return;
    }
    this._scheduleScenePreviewApply({ force: true, transition: SCENE_PLAY_TRANSITION_SEC });
  }

  async _setLiveEdit(on) {
    const next = Boolean(on);
    if (this._liveEdit === next) {
      this._syncLiveEditControl();
      return;
    }
    this._liveEdit = next;
    this._writeLiveEditPref(next);
    this._syncLiveEditControl();
    if (typeof this._liveEditSidebarHandler === "function") {
      await this._liveEditSidebarHandler(next);
    }
  }

  _liveEditStorageKey() {
    const user = this._hass?.user?.id || "anon";
    return `${DOMAIN}.liveEdit.v${LIVE_EDIT_STORAGE_VERSION}.${user}`;
  }

  _legacyLiveEditStorageKey() {
    const user = this._hass?.user?.id || "anon";
    return LEGACY_DOMAINS.map(
      (domain) => `${domain}.liveEdit.v${LIVE_EDIT_STORAGE_VERSION}.${user}`
    );
  }

  _roomPreviewStorageKey() {
    const user = this._hass?.user?.id || "anon";
    return `${DOMAIN}.roomPreview.v${ROOM_PREVIEW_STORAGE_VERSION}.${user}`;
  }

  _legacyRoomPreviewStorageKey() {
    const user = this._hass?.user?.id || "anon";
    return LEGACY_DOMAINS.map(
      (domain) => `${domain}.roomPreview.v${ROOM_PREVIEW_STORAGE_VERSION}.${user}`
    );
  }

  _readLocalStorage(key, legacyKey) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) {
        return raw;
      }
      const legacyKeys = Array.isArray(legacyKey)
        ? legacyKey
        : legacyKey
          ? [legacyKey]
          : [];
      for (const candidate of legacyKeys) {
        const legacy = window.localStorage.getItem(candidate);
        if (legacy == null) {
          continue;
        }
        window.localStorage.setItem(key, legacy);
        return legacy;
      }
      return null;
    } catch (_err) {
      return null;
    }
  }

  _readLiveEditPref() {
    const raw = this._readLocalStorage(
      this._liveEditStorageKey(),
      this._legacyLiveEditStorageKey()
    );
    return defaultOnPreference(raw);
  }

  _writeLiveEditPref(on) {
    try {
      window.localStorage.setItem(this._liveEditStorageKey(), on ? "1" : "0");
    } catch (_err) {
      /* ignore */
    }
  }

  _readRoomPreviewPref() {
    const raw = this._readLocalStorage(
      this._roomPreviewStorageKey(),
      this._legacyRoomPreviewStorageKey()
    );
    return defaultOnPreference(raw);
  }

  _writeRoomPreviewPref(on) {
    try {
      window.localStorage.setItem(this._roomPreviewStorageKey(), on ? "1" : "0");
    } catch (_err) {
      /* ignore */
    }
  }

  _scenePlayDurationStorageKey() {
    const user = this._hass?.user?.id || "anon";
    return `${DOMAIN}.scenePlayDuration.v${SCENE_PLAY_STORAGE_VERSION}.${user}`;
  }

  _readScenePlayDurationSec() {
    const raw = this._readLocalStorage(this._scenePlayDurationStorageKey());
    if (raw == null || raw === "") {
      return SCENE_PLAY_DURATION_DEFAULT_SEC;
    }
    const n = Number(raw);
    if (SCENE_PLAY_DURATION_OPTIONS_SEC.includes(n)) {
      return n;
    }
    if (!Number.isFinite(n) || n <= 0) {
      return SCENE_PLAY_DURATION_DEFAULT_SEC;
    }
    return SCENE_PLAY_DURATION_OPTIONS_SEC.reduce((best, option) =>
      Math.abs(option - n) < Math.abs(best - n) ? option : best
    );
  }

  _writeScenePlayDurationSec(seconds) {
    const n = Number(seconds);
    const value = SCENE_PLAY_DURATION_OPTIONS_SEC.includes(n)
      ? n
      : SCENE_PLAY_DURATION_DEFAULT_SEC;
    try {
      window.localStorage.setItem(
        this._scenePlayDurationStorageKey(),
        String(value)
      );
    } catch (_err) {
      /* ignore */
    }
  }

  _isDialView() {
    return (
      this._view === "theme" ||
      (this._view === "edit" && this._formData?.kind !== "simple")
    );
  }

  _syncEditorChrome() {
    const dial = this._isDialView();
    this.shadowRoot?.querySelector(".page")?.classList.toggle("dial-wide", dial);
    this._sunPathEl?.classList.toggle("dial-view", dial);
    // Host-level vignette (not .sun-path) — must not track sidebar gutter.
    this.toggleAttribute("data-dial-view", dial);
  }
  _draftStorageKey(sceneKey = this._editId || "new") {
    const user = this._hass?.user?.id || "anon";
    return `${DOMAIN}.draft.v1.${user}.${sceneKey}`;
  }

  _legacyDraftStorageKey(sceneKey = this._editId || "new") {
    const user = this._hass?.user?.id || "anon";
    return LEGACY_DOMAINS.map(
      (domain) => `${domain}.draft.v1.${user}.${sceneKey}`
    );
  }

  _clearPersistedDraft(sceneKey) {
    try {
      window.localStorage.removeItem(this._draftStorageKey(sceneKey));
      for (const key of this._legacyDraftStorageKey(sceneKey)) {
        window.localStorage.removeItem(key);
      }
    } catch (_err) {
      // Ignore leftover-key cleanup failures.
    }
  }

  _syncPageBannersVisibility() {
    const stack = this.shadowRoot?.querySelector(".page-banners");
    if (!stack) {
      return;
    }
    const anyVisible = [...stack.children].some((child) => !child.hidden);
    stack.hidden = !anyVisible;
    // Banner show/hide changes stage-scroll size, dial budget, and vignette.
    requestAnimationFrame(() => {
      this._syncStageFaceMax();
      if (this._sunPathEl?.classList.contains("dial-view")) {
        this._syncDialHeightBudget();
      }
    });
  }

  _ensureNativeDraft(sceneId) {
    if (!this._nativeDrafts[sceneId]) {
      this._nativeDrafts[sceneId] = { entities: {} };
    }
    if (!this._nativeDrafts[sceneId].entities) {
      this._nativeDrafts[sceneId].entities = {};
    }
    return this._nativeDrafts[sceneId];
  }

  _overlayFromDrafts(extra = []) {
    const overlay = [];
    for (const [sceneId, draft] of Object.entries(this._nativeDrafts)) {
      if (draft.deleted) {
        overlay.push({ scene_entity_id: sceneId, deleted: true });
        continue;
      }
      if (draft.created) {
        const entities = {};
        for (const [entityId, state] of Object.entries(draft.entities || {})) {
          if (state != null) {
            entities[entityId] = state;
          }
        }
        overlay.push({
          scene_entity_id: sceneId,
          create_scene: {
            name: draft.name,
            icon: draft.icon,
            entities,
          },
        });
        continue;
      }
      if (draft.name) {
        overlay.push({ scene_entity_id: sceneId, name: draft.name });
      }
      for (const [entityId, state] of Object.entries(draft.entities || {})) {
        if (state == null) {
          overlay.push({
            scene_entity_id: sceneId,
            entity_id: entityId,
            remove: true,
          });
        } else {
          overlay.push({
            scene_entity_id: sceneId,
            entity_id: entityId,
            entity_state: state,
          });
        }
      }
    }
    overlay.push(...extra);
    return overlay.length ? overlay : null;
  }

  _syncPreviewOverlay(extra) {
    this._previewOverlay = this._overlayFromDrafts(extra);
  }

  _assignedSceneIds() {
    const ids = new Set();
    for (const key of Object.values(EVENT_SCENE_KEYS)) {
      if (this._formData[key]) {
        ids.add(this._formData[key]);
      }
    }
    if (this._formData.scene_dawn_sunrise_sunset) {
      ids.add(this._formData.scene_dawn_sunrise_sunset);
    }
    return [...ids].filter((id) => !this._nativeDrafts[id]?.deleted);
  }

  _ensureMembership() {
    if (!this._formData.membership) {
      this._formData.membership = { exclude: [], include: [] };
    }
    if (!Array.isArray(this._formData.membership.exclude)) {
      this._formData.membership.exclude = [];
    }
    if (!Array.isArray(this._formData.membership.include)) {
      this._formData.membership.include = [];
    }
    return this._formData.membership;
  }

  _lightGroupMemberIds(entityId) {
    const raw = this._hass?.states?.[entityId]?.attributes?.entity_id;
    const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
    return list.filter(
      (id) =>
        typeof id === "string" && id.startsWith("light.") && id !== entityId
    );
  }

  _withoutRedundantLightGroups(ids) {
    const present = new Set(ids);
    return ids.filter((id) => {
      const members = this._lightGroupMemberIds(id);
      return !members.some((member) => present.has(member));
    });
  }

  _areaLightIds(areaId = this._formData?.area) {
    if (!areaId) {
      return [];
    }
    const floorAreas = (this._floors || []).flatMap((floor) => floor.areas || []);
    const area = floorAreas.find((item) => item.id === areaId);
    return this._withoutRedundantLightGroups(
      (area?.lights || []).filter((id) => this._isPhysicalLightEntityId(id))
    );
  }

  _entityInSelectedArea(entityId) {
    if (this._areaLightIds().includes(entityId)) {
      return true;
    }
    const areaId = this._formData?.area;
    const meta = this._hass?.entities?.[entityId];
    if (!areaId || !meta) {
      return false;
    }
    return (
      meta.area_id === areaId ||
      (meta.area_id == null &&
        this._hass?.devices?.[meta.device_id]?.area_id === areaId)
    );
  }

  _excludeLightMembership(entityId) {
    const membership = this._ensureMembership();
    membership.include = membership.include.filter((id) => id !== entityId);
    if (!membership.exclude.includes(entityId)) {
      membership.exclude.push(entityId);
    }
  }

  _restoreLightMembership(entityId) {
    const membership = this._ensureMembership();
    membership.exclude = membership.exclude.filter((id) => id !== entityId);
    this._forgetRemovedLight(entityId);
    if (
      !this._entityInSelectedArea(entityId) &&
      !membership.include.includes(entityId)
    ) {
      membership.include.push(entityId);
    }
  }

  _rememberRemovedLight(light) {
    if (!light?.entity_id) {
      return;
    }
    this._removedLights = this._removedLights || [];
    if (this._removedLights.some((row) => row.entity_id === light.entity_id)) {
      return;
    }
    this._removedLights.push({
      entity_id: light.entity_id,
      name: light.name,
      samples: [],
      gaps: [],
      event_states: light.event_states || [],
      suggested: true,
      removed: true,
      in_area: light.in_area,
    });
  }

  _forgetRemovedLight(entityId) {
    this._removedLights = (this._removedLights || []).filter(
      (row) => row.entity_id !== entityId
    );
  }

  _decorateMembershipLights(lights) {
    const exclude = new Set(this._formData?.membership?.exclude || []);
    const seen = new Set();
    const decorated = [];
    for (const light of lights || []) {
      if (!light?.entity_id || seen.has(light.entity_id)) {
        continue;
      }
      seen.add(light.entity_id);
      if (exclude.has(light.entity_id) || light.removed) {
        decorated.push({ ...light, suggested: true, removed: true });
      } else {
        decorated.push(light);
      }
    }
    for (const extra of this._removedLights || []) {
      if (!seen.has(extra.entity_id)) {
        seen.add(extra.entity_id);
        decorated.push({ ...extra, suggested: true, removed: true });
      }
    }
    return decorated;
  }

  _captureLightRowRects() {
    const map = new Map();
    const root = this._clockLegendEl;
    if (!root) {
      return map;
    }
    for (const el of root.querySelectorAll(":scope .simple-light-selector")) {
      const id = el.dataset.entityId;
      if (id) {
        map.set(id, el.getBoundingClientRect());
      }
    }
    return map;
  }

  _playLightRowFlip(before) {
    if (!before?.size) {
      return;
    }
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return;
    }
    const root = this._clockLegendEl;
    if (!root) {
      return;
    }
    for (const el of root.querySelectorAll(":scope .simple-light-selector")) {
      const prev = before.get(el.dataset.entityId);
      if (!prev) {
        continue;
      }
      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        continue;
      }
      el.style.zIndex = "2";
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.getBoundingClientRect();
      el.style.transition = "transform 360ms cubic-bezier(0.2, 0, 0, 1)";
      el.style.transform = "";
      const clear = (ev) => {
        if (ev && ev.propertyName && ev.propertyName !== "transform") {
          return;
        }
        el.style.transition = "";
        el.style.transform = "";
        el.style.zIndex = "";
        el.removeEventListener("transitionend", clear);
      };
      el.addEventListener("transitionend", clear);
    }
  }

  _removeLightFromAssignedScenes(entityId) {
    if (!entityId || this._editingThemeLook()) {
      return;
    }
    const current = (this._sunPath?.lights || []).find(
      (light) => light.entity_id === entityId
    );
    if (!current || current.suggested || current.removed) {
      return;
    }
    this._commitUndo();
    this._excludeLightMembership(entityId);
    if (this._sidebarLightId === entityId) {
      this._forceCloseSceneSidebar();
      this._setSidebarLight(null);
    }
    for (const sceneId of this._assignedSceneIds()) {
      this._ensureNativeDraft(sceneId).entities[entityId] = null;
    }
    this._syncPreviewOverlay();
    if (!this._entityInSelectedArea(entityId)) {
      this._rememberRemovedLight(current);
    }
    const before = this._captureLightRowRects();
    if (this._sunPath?.lights) {
      this._sunPath = {
        ...this._sunPath,
        lights: this._decorateMembershipLights(
          this._sunPath.lights.map((light) =>
            light.entity_id === entityId
              ? { ...light, suggested: true, removed: true, samples: [] }
              : light
          )
        ),
      };
    }
    this._clearPreviewCache();
    this._refreshInheritedLightDrafts?.();
    this._drawSunPath();
    this._playLightRowFlip(before);
    this._ensureSunPath();
  }
  _eventDefaultLightState(entityId, eventId) {
    const profile =
      LINKED_EVENTS.includes(eventId) && this._formData.display_scenes_combined
        ? "noon"
        : eventId;
    const seed = EVENT_LIGHT_DEFAULTS[profile] || EVENT_LIGHT_DEFAULTS.noon;
    return { state: "on", brightness: seed[0], color_temp_kelvin: seed[1] };
  }

  _adaptStateToLight(entityId, typical, eventId) {
    if (!typical || typical.state === "off") {
      return { state: "off" };
    }
    const attrs = this._hass.states[entityId]?.attributes || {};
    const modes = new Set(attrs.supported_color_modes || []);
    const payload = { state: "on" };
    if (modes.size && [...modes].every((mode) => mode === "onoff")) {
      return payload;
    }
    if (typical.brightness != null) {
      payload.brightness = typical.brightness;
    }
    const hasTemp =
      modes.has("color_temp") ||
      modes.has("rgbww") ||
      attrs.min_color_temp_kelvin != null;
    const hasColor = [...modes].some((mode) =>
      ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode)
    );
    if (hasTemp && typical.color_temp_kelvin != null) {
      let kelvin = typical.color_temp_kelvin;
      const minK = attrs.min_color_temp_kelvin;
      const maxK = attrs.max_color_temp_kelvin;
      if (minK != null && kelvin < minK) {
        kelvin = minK;
      }
      if (maxK != null && kelvin > maxK) {
        kelvin = maxK;
      }
      payload.color_temp_kelvin = Math.round(kelvin);
      return payload;
    }
    if (hasColor || !modes.size) {
      if (Array.isArray(typical.hs_color)) {
        payload.hs_color = typical.hs_color;
        return payload;
      }
      if (Array.isArray(typical.rgb_color)) {
        payload.rgb_color = typical.rgb_color;
        return payload;
      }
      if (typical.color_temp_kelvin != null) {
        const rgb = hueTempToRgb(typical.color_temp_kelvin);
        const hsv = rgb2hsv(rgb[0], rgb[1], rgb[2]);
        payload.hs_color = [hsv[0], Math.round(hsv[1] * 100)];
        return payload;
      }
    }
    if (hasTemp && payload.color_temp_kelvin == null) {
      const fallback = this._eventDefaultLightState(entityId, eventId);
      if (fallback.color_temp_kelvin != null) {
        let kelvin = fallback.color_temp_kelvin;
        const minK = attrs.min_color_temp_kelvin;
        const maxK = attrs.max_color_temp_kelvin;
        if (minK != null && kelvin < minK) {
          kelvin = minK;
        }
        if (maxK != null && kelvin > maxK) {
          kelvin = maxK;
        }
        payload.color_temp_kelvin = Math.round(kelvin);
      }
    }
    return payload;
  }

  _optimisticIncludeLight(entityId) {
    if (!this._sunPath || !entityId?.startsWith("light.")) {
      return;
    }
    this._forgetRemovedLight(entityId);
    const state = this._hass?.states?.[entityId];
    const areaId = this._formData.area || null;
    const entityMeta = this._hass?.entities?.[entityId];
    let inArea = null;
    if (areaId && entityMeta) {
      inArea =
        entityMeta.area_id === areaId ||
        (entityMeta.area_id == null &&
          this._hass?.devices?.[entityMeta.device_id]?.area_id === areaId);
    }
    const lights = [...(this._sunPath.lights || [])];
    const index = lights.findIndex((light) => light.entity_id === entityId);
    if (index >= 0) {
      lights[index] = {
        ...lights[index],
        suggested: false,
        removed: false,
        in_area: inArea ?? lights[index].in_area,
      };
    } else {
      lights.push({
        entity_id: entityId,
        name: state?.attributes?.friendly_name || state?.name || entityId,
        samples: [],
        gaps: [],
        event_states: [],
        suggested: false,
        removed: false,
        in_area: inArea === true,
      });
    }
    this._sunPath = {
      ...this._sunPath,
      lights: this._decorateMembershipLights(lights),
    };
    // Keep key cleared so the WS preview with overlay still replaces this stub.
    this._sunPathKey = undefined;
    this._drawSunPath();
  }

  async _addLightToAssignedScenes(entityId) {
    if (!entityId?.startsWith("light.")) {
      return;
    }
    const listed = (this._sunPath?.lights || []).some(
      (light) =>
        light.entity_id === entityId && !light.suggested && !light.removed
    );
    if (listed) {
      return;
    }
    this._commitUndo();
    this._restoreLightMembership(entityId);
    const scenes = this._assignedSceneIds();
    if (scenes.length) {
      const snapshot = this._snapshotLight(entityId);
      for (const sceneId of scenes) {
        const eventId =
          Object.entries(EVENT_SCENE_KEYS).find(
            ([, key]) => this._formData[key] === sceneId
          )?.[0] || "noon";
        this._ensureNativeDraft(sceneId).entities[entityId] =
          this._adaptStateToLight(entityId, snapshot, eventId);
      }
    }
    this._syncPreviewOverlay();
    const before = this._captureLightRowRects();
    this._withPreservedTileScroll(() => {
      this._optimisticIncludeLight(entityId);
      this._clearPreviewCache();
      this._drawSunPath();
      this._playLightRowFlip(before);
    });
    await this._ensureSunPath();
  }

  _simpleMembershipLists() {
    const areaId = this._formData.area;
    const floorAreas = (this._floors || []).flatMap((f) => f.areas || []);
    const area = floorAreas.find((a) => a.id === areaId);
    const exclude = new Set(this._formData.membership?.exclude || []);
    const include = this._formData.membership?.include || [];
    const areaLights = area?.lights || [];
    const members = this._withoutRedundantLightGroups([
      ...areaLights.filter((id) => !exclude.has(id)),
      ...include.filter((id) => !areaLights.includes(id)),
    ]);
    const removed = [
      ...areaLights.filter((id) => exclude.has(id)),
      ...(this._removedLights || [])
        .map((row) => row.entity_id)
        .filter((id) => id && !members.includes(id) && !areaLights.includes(id)),
    ];
    return { members, removed };
  }

  _withPreservedTileScroll(run) {
    const scroller = this.shadowRoot?.querySelector(".light-tiles-scroller");
    if (scroller) {
      this._heldTileScroll = scroller.scrollLeft;
    }
    window.clearTimeout(this._heldTileScrollTimer);
    this._heldTileScrollTimer = window.setTimeout(() => {
      this._heldTileScroll = null;
    }, 800);
    const prev = this._suppressLightTileOpen;
    this._suppressLightTileOpen = true;
    try {
      run();
    } finally {
      this._restoreHeldTileScroll();
      this._suppressLightTileOpen = prev;
    }
  }

  _restoreHeldTileScroll() {
    if (this._heldTileScroll == null) {
      return;
    }
    const apply = () => {
      const next = this.shadowRoot?.querySelector(".light-tiles-scroller");
      if (next && this._heldTileScroll != null) {
        next.scrollLeft = this._heldTileScroll;
      }
    };
    apply();
    requestAnimationFrame(apply);
  }

  _addLightToSimpleMembers(entityId) {
    if (!entityId?.startsWith("light.")) {
      return;
    }
    const { members } = this._simpleMembershipLists();
    if (members.includes(entityId)) {
      return;
    }
    this._commitUndo();
    this._forgetRemovedLight(entityId);
    const membership = {
      exclude: [...(this._formData.membership?.exclude || [])].filter(
        (id) => id !== entityId
      ),
      include: [...(this._formData.membership?.include || [])],
    };
    const areaId = this._formData.area;
    const floorAreas = (this._floors || []).flatMap((f) => f.areas || []);
    const area = floorAreas.find((a) => a.id === areaId);
    const inArea = (area?.lights || []).includes(entityId);
    if (!inArea && !membership.include.includes(entityId)) {
      membership.include.push(entityId);
    }
    const nextLights = { ...(this._formData.lights || {}) };
    if (!nextLights[entityId]) {
      nextLights[entityId] = this._snapshotLight(entityId) || {
        state: "on",
        brightness: 200,
      };
    }
    this._formData = { ...this._formData, membership, lights: nextLights };
    this._saveSoon();
    this._withPreservedTileScroll(() => this._simpleEditorRefresh?.());
  }

  _removeLightFromSimpleMembers(entityId) {
    if (!entityId?.startsWith("light.")) {
      return;
    }
    const { members } = this._simpleMembershipLists();
    if (!members.includes(entityId)) {
      return;
    }
    this._commitUndo();
    const membership = {
      exclude: [...(this._formData.membership?.exclude || [])],
      include: [...(this._formData.membership?.include || [])].filter(
        (id) => id !== entityId
      ),
    };
    const areaId = this._formData.area;
    const floorAreas = (this._floors || []).flatMap((f) => f.areas || []);
    const area = floorAreas.find((a) => a.id === areaId);
    const inArea = (area?.lights || []).includes(entityId);
    if (inArea && !membership.exclude.includes(entityId)) {
      membership.exclude.push(entityId);
    }
    if (!inArea) {
      const name =
        this._hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
      this._rememberRemovedLight({
        entity_id: entityId,
        name,
        in_area: false,
      });
    }
    this._formData = { ...this._formData, membership };
    this._saveSoon();
    this._withPreservedTileScroll(() => this._simpleEditorRefresh?.());
  }

  _addLightChoices(exclude) {
    const states = this._hass?.states || {};
    const entities = this._hass?.entities || {};
    const devices = this._hass?.devices || {};
    const areas = this._hass?.areas || {};
    const rows = [];
    for (const entityId of Object.keys(states)) {
      if (!entityId.startsWith("light.") || exclude.has(entityId)) {
        continue;
      }
      const entity = entities[entityId] || {};
      const device = entity.device_id ? devices[entity.device_id] : null;
      const areaId = entity.area_id || device?.area_id || "";
      const areaName = areas[areaId]?.name || "";
      const deviceName = device?.name_by_user || device?.name || "";
      const friendly =
        states[entityId]?.attributes?.friendly_name || entity.name || "";
      rows.push({
        entityId,
        name: this._lightDisplayName(entityId, { areaName }),
        areaName,
        deviceName,
        friendly,
      });
    }
    rows.sort((a, b) => {
      const areaOrder = (a.areaName || "\uffff").localeCompare(
        b.areaName || "\uffff",
        undefined,
        { sensitivity: "base" }
      );
      if (areaOrder) {
        return areaOrder;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    return rows;
  }

  async _flushNativeDrafts() {
    const creates = [];
    const renames = [];
    const deletes = [];
    const updates = [];
    const removes = [];
    for (const [sceneId, draft] of Object.entries(this._nativeDrafts)) {
      if (this._entityId && sceneId === this._entityId) {
        continue;
      }
      if (draft.created) {
        if (draft.deleted) {
          continue;
        }
        const entities = {};
        for (const [entityId, state] of Object.entries(draft.entities || {})) {
          if (state != null) {
            entities[entityId] = state;
          }
        }
        creates.push({
          draft_id: sceneId,
          name: draft.name,
          icon: draft.icon,
          area_id: draft.area_id,
          id: draft.yamlId,
          entities,
        });
        continue;
      }
      if (draft.deleted) {
        deletes.push(sceneId);
        continue;
      }
      if (draft.name) {
        renames.push({ scene_entity_id: sceneId, name: draft.name });
      }
      for (const [entityId, state] of Object.entries(draft.entities || {})) {
        if (state == null) {
          removes.push({ scene_entity_id: sceneId, entity_id: entityId });
        } else {
          updates.push({
            scene_entity_id: sceneId,
            entity_id: entityId,
            entity_state: state,
          });
        }
      }
    }
    if (!creates.length && !renames.length && !deletes.length && !updates.length && !removes.length) {
      return;
    }
    const result = await this._hass.callWS({
      type: `${DOMAIN}/apply_native_drafts`,
      creates,
      renames,
      deletes,
      updates,
      removes,
    });
    const created = result.created || {};
    for (const [draftId, entityId] of Object.entries(created)) {
      this._remapSceneId(draftId, entityId);
    }
    this._nativeDrafts = {};
    this._previewOverlay = null;
  }

  _remapSceneId(fromId, toId) {
    if (!fromId || fromId === toId) {
      return;
    }
    for (const key of Object.values(EVENT_SCENE_KEYS)) {
      if (this._formData[key] === fromId) {
        this._formData[key] = toId;
      }
    }
    if (this._formData.scene_dawn_sunrise_sunset === fromId) {
      this._formData.scene_dawn_sunrise_sunset = toId;
    }
  }

  _overflowMenu() {
    const hasScene = Boolean(this._editId);
    const hasEntity = Boolean(this._entityId);
    const menu = document.createElement("ha-dropdown");
    menu.activatable = true;
    const trigger = document.createElement("ha-icon-button");
    trigger.slot = "trigger";
    trigger.label = this._loc("ui.common.menu", "Menu");
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", "mdi:dots-vertical");
    trigger.appendChild(icon);
    menu.appendChild(trigger);

    const addItem = (value, label, iconName, { disabled = false, danger = false } = {}) => {
      const item = document.createElement("ha-dropdown-item");
      item.value = value;
      item.disabled = disabled;
      if (danger) {
        item.variant = "danger";
      }
      const itemIcon = document.createElement("ha-icon");
      itemIcon.setAttribute("icon", iconName);
      itemIcon.slot = "icon";
      item.dataset.action = value;
      item.append(itemIcon, document.createTextNode(label));
      menu.appendChild(item);
    };

    if (this._narrow && this._canPlayScenePreview()) {
      const playing = this._scenePlayActive();
      addItem(
        "play-scene",
        playing
          ? this._t("frontend.actions.stop_preview", "Stop")
          : this._t("frontend.actions.play_scene", "Play scene live"),
        playing ? "mdi:stop" : "mdi:play"
      );
    }
    if (this._narrow && this._view !== "theme") {
      const row = document.createElement("div");
      row.className = "overflow-live-edit";
      const label = document.createElement("span");
      label.textContent = this._t("frontend.actions.live_edit", "Live edit");
      const previewSwitch = document.createElement("ha-switch");
      previewSwitch.checked = this._readRoomPreviewPref();
      const stop = (ev) => ev.stopPropagation();
      row.addEventListener("pointerdown", stop);
      row.addEventListener("click", stop);
      previewSwitch.addEventListener("change", () => {
        void this._setRoomPreview(Boolean(previewSwitch.checked));
      });
      row.append(label, previewSwitch);
      this._roomPreviewSwitch = previewSwitch;
      menu.appendChild(row);
    }
    // Location preview stays in overflow (Preview scene replaced Activate).
    addItem(
      "preview-location",
      this._t("frontend.actions.preview_location", "Preview another location"),
      "mdi:map-marker-outline",
      // Banner Change covers this while an override is active.
      { disabled: Boolean(this._previewLocation) }
    );
    addItem(
      "show-info",
      this._loc("ui.panel.config.scene.picker.show_info", "Information"),
      "mdi:information-outline",
      { disabled: !hasEntity }
    );
    addItem(
      "show-settings",
      this._loc("ui.panel.config.automation.picker.show_settings", "Settings"),
      "mdi:cog",
      { disabled: !hasEntity }
    );
    addItem(
      "edit-category",
      this._formData.category
        ? this._loc("ui.panel.config.scene.picker.edit_category", "Edit category")
        : this._loc(
            "ui.panel.config.scene.picker.assign_category",
            "Assign category"
          ),
      "mdi:tag",
      { disabled: !hasScene }
    );
    addItem(
      "rename",
      this._loc("ui.panel.config.scene.editor.rename", "Rename"),
      "mdi:pencil",
      { disabled: !hasScene }
    );
    if (customElements.get("wa-divider")) {
      menu.appendChild(document.createElement("wa-divider"));
    }
    addItem(
      "duplicate",
      this._loc("ui.panel.config.scene.picker.duplicate_scene", "Duplicate"),
      "mdi:content-duplicate",
      { disabled: !hasScene }
    );
    addItem(
      "delete",
      this._loc("ui.panel.config.scene.picker.delete_scene", "Delete"),
      "mdi:delete",
      { disabled: !hasScene, danger: true }
    );
    menu.addEventListener("wa-select", (ev) => {
      this._handleOverflow(ev.detail?.item?.value);
    });
    return menu;
  }

  _listSceneOverflowMenu(scene) {
    const menu = document.createElement("ha-dropdown");
    menu.activatable = true;
    const trigger = document.createElement("ha-icon-button");
    trigger.slot = "trigger";
    trigger.label = this._loc("ui.common.menu", "Menu");
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", "mdi:dots-vertical");
    trigger.appendChild(icon);
    // ha-dropdown opens from the trigger click; do not stopPropagation here.
    menu.appendChild(trigger);

    const addItem = (value, label, iconName, { disabled = false, danger = false } = {}) => {
      const item = document.createElement("ha-dropdown-item");
      item.value = value;
      item.disabled = disabled;
      if (danger) {
        item.variant = "danger";
      }
      const itemIcon = document.createElement("ha-icon");
      itemIcon.setAttribute("icon", iconName);
      itemIcon.slot = "icon";
      item.append(itemIcon, document.createTextNode(label));
      menu.appendChild(item);
    };

    const hasEntity = Boolean(scene.entity_id);
    addItem(
      "activate",
      this._t("frontend.actions.activate_scene", "Activate scene"),
      "mdi:play"
    );
    addItem(
      "show-info",
      this._loc("ui.panel.config.scene.picker.show_info", "Information"),
      "mdi:information-outline",
      { disabled: !hasEntity }
    );
    addItem(
      "show-settings",
      this._loc("ui.panel.config.automation.picker.show_settings", "Settings"),
      "mdi:cog",
      { disabled: !hasEntity }
    );
    addItem(
      "edit-category",
      scene.category
        ? this._loc("ui.panel.config.scene.picker.edit_category", "Edit category")
        : this._loc(
            "ui.panel.config.scene.picker.assign_category",
            "Assign category"
          ),
      "mdi:tag"
    );
    addItem(
      "rename",
      this._loc("ui.panel.config.scene.editor.rename", "Rename"),
      "mdi:pencil"
    );
    if (customElements.get("wa-divider")) {
      menu.appendChild(document.createElement("wa-divider"));
    }
    addItem(
      "duplicate",
      this._loc("ui.panel.config.scene.picker.duplicate_scene", "Duplicate"),
      "mdi:content-duplicate"
    );
    addItem(
      "delete",
      this._loc("ui.panel.config.scene.picker.delete_scene", "Delete"),
      "mdi:delete",
      { danger: true }
    );
    menu.addEventListener("wa-select", (ev) => {
      ev.stopPropagation();
      this._handleListSceneOverflow(scene, ev.detail?.item?.value);
    });
    return menu;
  }

  async _handleListSceneOverflow(scene, action) {
    if (!action) {
      return;
    }
    if (action === "activate") {
      if (!scene.entity_id) {
        return;
      }
      await this._hass.callService("scene", "turn_on", {
        entity_id: scene.entity_id,
      });
      return;
    }
    if (action === "show-info") {
      this._showEntityMoreInfo(scene.entity_id);
      return;
    }
    if (action === "show-settings") {
      this._showEntityMoreInfo(scene.entity_id, "settings");
      return;
    }
    if (action === "edit-category") {
      await this._openListSceneMetaDialog(scene, { focus: "category" });
      return;
    }
    if (action === "rename") {
      await this._openListSceneMetaDialog(scene, {});
      return;
    }
    if (action === "duplicate") {
      await this._duplicateSceneFromList(scene);
      return;
    }
    if (action === "delete") {
      this._confirmDeleteScene(scene);
    }
  }

  async _duplicateSceneFromList(scene) {
    const suffix = this._loc(
      "ui.panel.config.scene.picker.duplicate",
      "duplicate"
    );
    const form = { ...(scene.form || scene) };
    delete form.id;
    form.scene_name = `${form.scene_name || scene.scene_name || "Scene"} (${suffix})`;
    try {
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save`,
        data: form,
      });
      this._upsertSceneInList(saved);
      this._refreshVisibleSceneList();
      if (saved?.id) {
        this._go(`edit/${saved.id}`);
      } else {
        await this._loadList();
      }
    } catch (err) {
      this._error = err.message || String(err);
      this._renderList();
    }
  }

  async _duplicateLibraryItem(kind, item) {
    if (!item?.id || (kind !== "variable" && kind !== "palette")) {
      return;
    }
    const names = (this._variables || []).map((row) => row.name);
    const copy = { ...item, name: galleryCopyName(item.name || "Copy", names) };
    delete copy.id;
    try {
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save_variable`,
        data: copy,
      });
      this._variables = [...(this._variables || []), saved];
      if (saved?.id) {
        this._go(kind === "palette" ? `palette/${saved.id}` : `variable/${saved.id}`);
      } else {
        this._render();
      }
    } catch (err) {
      this._error = err.message || String(err);
      this._render();
    }
  }

  async _deleteLibraryItem(kind, item) {
    const id = item?.id;
    if (!id) {
      return;
    }
    window.clearTimeout(this._saveSoonTimer);
    this._saveSoonTimer = null;
    const openVariable =
      (kind === "variable" || kind === "palette") && this._variableId === id;
    const openTheme = kind === "theme" && this._themeId === id;
    if (openVariable) {
      this._variableDraft = null;
    }
    if (openTheme) {
      this._themeDraft = null;
    }
    if (kind === "theme") {
      await this._hass.callWS({
        type: `${DOMAIN}/delete_theme`,
        theme_id: id,
      });
      this._themes = (this._themes || []).filter((row) => row.id !== id);
    } else {
      await this._hass.callWS({
        type: `${DOMAIN}/delete_variable`,
        variable_id: id,
      });
      this._variables = (this._variables || []).filter((row) => row.id !== id);
    }
    if (openVariable || openTheme) {
      await this._go("");
      return;
    }
    this._render();
  }

  _handleOverflow(action) {
    if (!action) {
      return;
    }
    if (action === "play-scene") {
      this._toggleScenePlay();
      return;
    }
    if (action === "undo") {
      this._undo();
      return;
    }
    if (action === "redo") {
      this._redo();
      return;
    }
    if (action === "preview-location") {
      this._openLocationDialog();
      return;
    }
    if (action === "show-info") {
      this._showMoreInfo();
      return;
    }
    if (action === "show-settings") {
      this._showMoreInfo("settings");
      return;
    }
    if (action === "edit-category") {
      this._openSaveDialog({ rename: true, focus: "category" });
      return;
    }
    if (action === "rename") {
      this._openSaveDialog({ rename: true });
      return;
    }
    if (action === "duplicate") {
      this._duplicate();
      return;
    }
    if (action === "delete") {
      this._confirmDelete();
    }
  }

  _showMoreInfo(view) {
    this._showEntityMoreInfo(this._entityId, view);
  }

  _showEntityMoreInfo(entityId, view) {
    if (!entityId) {
      return;
    }
    const detail = { entityId };
    if (view) {
      detail.view = view;
    }
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        bubbles: true,
        composed: true,
        detail,
      })
    );
  }

  _duplicate() {
    if (!this._editId) {
      return;
    }
    const suffix = this._loc(
      "ui.panel.config.scene.picker.duplicate",
      "duplicate"
    );
    this._pendingNewForm = {
      ...this._formData,
      labels: [...(this._formData.labels || [])],
      scene_name: `${this._formData.scene_name || "Circadian"} (${suffix})`,
    };
    this._go("new");
  }

  _isEditorNarrow() {
    return (
      Boolean(this._narrow) ||
      window.matchMedia("(max-width: 870px), (max-height: 500px)").matches
    );
  }

  _lightEditIsDirty() {
    const el = this.shadowRoot?.querySelector(".scene-sidebar.light-dialog");
    return Boolean(el && !el._closing && el._isDirty?.());
  }

  _forceCloseSceneSidebar() {
    const el = this.shadowRoot?.querySelector(".scene-sidebar");
    if (!el || el.classList.contains("list-settings-dialog")) {
      return;
    }
    el._isDirty = () => false;
    this._closeSceneSidebar();
  }

  _setSidebarDocked(docked) {
    this.toggleAttribute("data-sidebar-docked", Boolean(docked && !this._isEditorNarrow()));
    this._syncYearScrubLayout();
    this._fitSidebarLightStrip();
  }

  _fitSidebarLightStrip() {
    const shell = this._sharedEditorShell;
    if (!shell?.el.isConnected) return;
    const sidebar = this.shadowRoot.querySelector(".scene-sidebar.desktop");
    fitSidebarLightStrip(shell, sidebar, Boolean(this.hasAttribute("data-sidebar-docked")));
  }

  _fillSidebarHeader(header, { title, subtitle, actionItems, host }) {
    header.replaceChildren();
    const closeBtn = document.createElement("ha-icon-button");
    closeBtn.slot = "navigationIcon";
    closeBtn.label = this._loc("ui.dialogs.generic.close", "Close");
    const closeIcon = document.createElement("ha-icon");
    closeIcon.setAttribute("icon", "mdi:close");
    closeBtn.appendChild(closeIcon);
    closeBtn.addEventListener("click", () => this._requestCloseSceneSidebar(host));
    const titleEl = document.createElement("span");
    titleEl.slot = "title";
    titleEl.textContent = title;
    header.append(closeBtn, titleEl);
    if (subtitle) {
      const sub = document.createElement("span");
      sub.slot = "subtitle";
      sub.textContent = subtitle;
      header.appendChild(sub);
    }
    for (const item of actionItems || []) {
      item.slot = "actionItems";
      header.appendChild(item);
    }
  }

  async _swapSidebarPanes(host) {
    const oldBody = host.querySelector(".scene-sidebar-body");
    const oldFooter = host.querySelector(".scene-sidebar-footer");
    const body = document.createElement("div");
    body.className = "scene-sidebar-body";
    const footer = document.createElement("div");
    footer.className = "scene-sidebar-footer";
    oldBody?.classList.add("sidebar-pane-leave");
    oldFooter?.classList.add("sidebar-pane-leave");
    await new Promise((resolve) => window.setTimeout(resolve, SIDEBAR_SWAP_MS));
    oldBody?.replaceWith(body);
    oldFooter?.replaceWith(footer);
    body.classList.add("sidebar-pane-enter");
    footer.classList.add("sidebar-pane-enter");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        body.classList.remove("sidebar-pane-enter");
        footer.classList.remove("sidebar-pane-enter");
      });
    });
    return { body, footer };
  }

  _closeSceneSidebar({ animate = false, clearSelection = true } = {}) {
    // Opening a replacement sidebar passes clearSelection:false — otherwise the
    // pre-await ring highlight (_setSidebarLight before _openSceneSidebar) is
    // wiped and the band looks deselected until a second click.
    if (clearSelection && this._view !== "edit") {
      this._setSidebarEvent(null);
      this._setSidebarLight(null);
      this._clearClockRingHover();
    }
    const el = this.shadowRoot?.querySelector(".scene-sidebar");
    if (!el) {
      this._setSidebarDocked(false);
      return;
    }
    if (
      animate &&
      el.classList.contains("desktop") &&
      el.classList.contains("open")
    ) {
      this._animateDesktopSidebarClose(el);
      return;
    }
    this._setSidebarDocked(false);
    el.dispatchEvent(new Event("closed"));
    el.remove();
  }

  _animateDesktopSidebarClose(el) {
    if (el._closing) {
      return;
    }
    if (this._view !== "edit") { this._setSidebarEvent(null); this._setSidebarLight(null); }
    this._clearClockRingHover();
    el._closing = true;
    el.classList.remove("open");
    this._setSidebarDocked(false);
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      el.removeEventListener("transitionend", onEnd);
      el.dispatchEvent(new Event("closed"));
      el.remove();
    };
    const onEnd = (ev) => {
      if (ev.target !== el) {
        return;
      }
      finish();
    };
    el.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, SIDEBAR_ANIMATION_MS + 50);
  }

  async _requestCloseSceneSidebar(el) {
    const target = el || this.shadowRoot?.querySelector(".scene-sidebar");
    if (target?._isDirty?.() && !(await target._confirmIfDirty())) {
      return;
    }
    if (target) {
      target._isDirty = () => false;
    }
    if (this._view !== "edit") this._setSidebarEvent(null);
    if (target?.localName === "ha-bottom-sheet") {
      target.open = false;
      if (this._view !== "edit") this._setSidebarLight(null);
      this._clearClockRingHover();
      return;
    }
    this._closeSceneSidebar({ animate: true });
  }

  async _openSceneSidebar({ title, subtitle, className, onDismiss, actionItems }) {
    const existing = this.shadowRoot?.querySelector(".scene-sidebar");
    const useSheet =
      this._isEditorNarrow() &&
      customElements.get("ha-bottom-sheet") !== undefined;
    const canReuse =
      existing &&
      !existing._closing &&
      existing.classList.contains(useSheet ? "mobile" : "desktop");
    if (canReuse) {
      if (existing._isDirty?.() && !(await existing._confirmIfDirty())) {
        return null;
      }
      if (!existing._committed) {
        existing._onDismiss?.();
      }
      existing._committed = false;
      existing._isDirty = undefined;
      existing._confirmIfDirty = undefined;
      existing._switchLightEvent = undefined;
      existing._lightEntityId = undefined;
      existing._onDismiss = onDismiss;
      existing.className = `scene-sidebar ${className} ${
        useSheet ? "mobile" : "desktop open"
      }`;
      if (!useSheet) {
        this._setSidebarDocked(true);
      }
      const header = existing.querySelector("ha-dialog-header");
      this._fillSidebarHeader(header, {
        title,
        subtitle,
        actionItems,
        host: existing,
      });
      const panes = await this._swapSidebarPanes(existing);
      return { host: existing, header, ...panes };
    }
    if (existing && !existing._closing && existing._isDirty?.()) {
      if (!(await existing._confirmIfDirty())) {
        return null;
      }
    }
    this._closeSceneSidebar({ clearSelection: false });
    const host = useSheet
      ? document.createElement("ha-bottom-sheet")
      : document.createElement("div");
    host.className = `scene-sidebar ${className} ${useSheet ? "mobile" : "desktop"}`;
    host.tabIndex = -1;
    host._onDismiss = onDismiss;

    const header = document.createElement("ha-dialog-header");
    this._fillSidebarHeader(header, { title, subtitle, actionItems, host });

    const body = document.createElement("div");
    body.className = "scene-sidebar-body";
    const footer = document.createElement("div");
    footer.className = "scene-sidebar-footer";

    if (useSheet) {
      host.flexContent = true;
      header.slot = "header";
      footer.slot = "footer";
      host.append(header, body, footer);
    } else {
      const card = document.createElement("ha-card");
      card.className = "scene-sidebar-card";
      card.outlined = true;
      card.append(header, body, footer);
      host.appendChild(card);
      host.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          ev.stopPropagation();
          this._requestCloseSceneSidebar(host);
        }
      });
    }

    host.addEventListener("closed", () => {
      host.remove();
      this._setSidebarDocked(false);
      // Only clear if this host still owns the highlight. A delayed desktop
      // close must not wipe the event selected by a newly opened sidebar.
      if (this._view !== "edit" && this._sidebarEventId && this._sidebarEventId === host._eventId) {
        this._setSidebarEvent(null);
      }
      // Mobile bottom-sheet swipe/backdrop dismiss fires closed without always
      // going through _requestCloseSceneSidebar — clear the ring selection too.
      if (
        host._lightEntityId &&
        this._sidebarLightId === host._lightEntityId
      ) {
        this._setSidebarLight(null);
      }
      this._clearClockRingHover();
      if (!host._committed) {
        host._onDismiss?.();
      }
      this._syncYearScrubLayout();
    });
    this.shadowRoot.appendChild(host);
    if (useSheet) {
      host.open = true;
      this._syncYearScrubLayout();
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          host.classList.add("open");
          this._setSidebarDocked(true);
          // Keep focus on the invoking ring/event. Focusing drawer chrome
          // programmatically pans HA's outer horizontal scrollport even with
          // preventScroll, making the whole panel rebound during the slide.
        });
      });
    }
    return { host, header, body, footer };
  }

  _editorRailCanStay(page) {
    const rail = page?.querySelector(":scope > .area-rail");
    const stage = page?.querySelector(":scope > .stage-col");
    if (!rail || !stage || this._railTab === "library") {
      return false;
    }
    if (!this._editId) {
      return true;
    }
    const card = rail.querySelector(
      `.scene-card[data-scene-id="${CSS.escape(this._editId)}"]`
    );
    if (card) {
      return true;
    }
    // The open scene is not in this rail yet (just created). Rebuild and reveal.
    this._areaRailHoldScroll = false;
    this._areaRailForceReveal = true;
    this._areaRailUserScrolled = false;
    return false;
  }

  _paintEditorInPlace() {
    const page = this._contentEl?.querySelector(":scope > .workspace");
    if (!this._editorRailCanStay(page)) {
      return false;
    }
    const stage = page.querySelector(":scope > .stage-col");
    this._syncRailSelection();
    if (this._areaRailForceReveal) {
      const body = page.querySelector(
        '.area-rail-body[data-tab="scenes"]:not([hidden])'
      );
      if (body) {
        this._revealSelectedInRail(body);
      }
      this._areaRailForceReveal = false;
    }
    const previousCover =
      [...page.querySelectorAll(".scene-cover")].find(
        (cover) => !cover.classList.contains("is-leaving")
      )?.style.backgroundImage || "";
    this._crossfadeCoverInPlace(previousCover);
    const scroll = this._stageScrollEl(stage);
    if (scroll) {
      scroll.scrollTop = 0;
    }
    if (this._error) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      scroll?.replaceChildren(error);
      this._syncWorkspaceScrollport();
      return true;
    }
    if (this._formData.kind === "simple") {
      this._parkSunPath();
      const host = document.createElement("div");
      host.className = "simple-editor-host";
      scroll?.replaceChildren(host);
      this._mountPageBanners(stage);
      this._simpleEditorHost = host;
      const lists = this._simpleMembershipLists();
      this._simpleMembers = lists.members;
      renderSimpleEditor(this, host, { glowHost: null });
      this._syncSceneUsed();
      this._syncWorkspaceScrollport();
      this._playSimpleEnterIfNeeded(host);
      return true;
    }
    this._mountSunPath(stage);
    // The list hero stays in the scrollport until the preview arrives. Leaving
    // it there flashes the empty state over the dial.
    for (const child of [...(scroll?.children || [])]) {
      if (child === this._sunPathEl || child === this._pageBannersEl) {
        continue;
      }
      child.remove();
    }
    // A matching path can paint now. A scene change keeps the mounted dial
    // and lets the preview lerp; forgetting it here popped every ring and tile.
    if (this._sunPathMatchesChart()) {
      if (!this._clockRingsHost?.isConnected) {
        this._drawSunPath();
      }
    }
    this._syncWorkspaceScrollport();
    return true;
  }

  _renderEditor({ keepRail = false } = {}) {
    this._syncAppBarTitle();
    this._setNavigationIcon(this._narrow ? this._backButton() : this._menuButton());
    this._setEditorActions();
    this._syncEditorChrome();
    this._syncSaveFab();
    this._contentEl.classList.add("wide");
    const split = !this._narrow;
    this._contentEl.classList.toggle("workspace-split", split);

    if (keepRail && this._paintEditorInPlace()) {
      return;
    }

    this._parkSunPath();
    const page = renderLanding(this, { includeStage: true });
    const stage = page.querySelector(".stage-col");
    if (this._error) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      this._stageScrollEl(stage)?.replaceChildren(error);
    }

    if (this._formData.kind === "simple") {
      this._parkSunPath();
      const host = document.createElement("div");
      host.className = "simple-editor-host";
      if (this._narrow) {
        this._contentEl.classList.remove("workspace-split");
        this._contentEl.replaceChildren(host);
        this._simpleEditorHost = host;
      } else {
        const scroll = this._stageScrollEl(stage);
        scroll?.replaceChildren(host);
        this._mountWorkspacePage(page);
        this._mountPageBanners(stage);
        this._simpleEditorHost = host;
      }
      const lists = this._simpleMembershipLists();
      this._simpleMembers = lists.members;
      const glowHost = null;
      renderSimpleEditor(this, host, { glowHost });
      this._syncSceneUsed();
      this._syncWorkspaceScrollport();
      this._playSimpleEnterIfNeeded(host);
      return;
    }

    if (this._narrow) {
      this._parkSunPath();
      this._contentEl.replaceChildren();
      this._contentEl.classList.remove("workspace-split");
      if (this._sunPathHome) {
        this._sunPathHome.appendChild(this._sunPathEl);
      }
      if (this._sunPathEl) {
        this._sunPathEl.hidden = false;
      }
    } else {
      this._mountWorkspacePage(page);
      if (stage) {
        this._mountSunPath(stage);
      }
    }
    // Refs may still point at the dial that was lifted into the exit layer.
    this._forgetClockDom();
    if (this._sunPathMatchesChart()) {
      this._drawSunPath();
    }
    this._syncWorkspaceScrollport();
  }

  /** App-bar / dialogs: prefer HA friendly_name over stored scene_name. */
  _editorSceneTitle() {
    if (!this._editId) {
      return this._t("frontend.common.new_scene", "New scene");
    }
    return (
      this._entityFriendlyName(this._entityId, this._formData.scene_name) ||
      this._t("frontend.common.edit_scene", "Edit scene")
    );
  }

  _syncEditorSceneTitle() {
    this._syncAppBarTitle();
  }

  _syncAppBarTitle() {
    if (!this._headerEl) {
      return;
    }
    const integration = this._t("frontend.title", "Scene Studio");
    if (this._narrow && this._view === "edit") {
      this._headerEl.textContent = this._editorSceneTitle();
      return;
    }
    if (this._narrow && (this._view === "variable" || this._view === "palette")) {
      this._headerEl.textContent =
        this._variableDraft?.name ||
        (this._view === "palette"
          ? this._t("frontend.library.add_palette", "Add scene preset")
          : this._t("frontend.library.add_variable", "Add color preset"));
      return;
    }
    if (this._narrow && this._view === "theme") {
      this._headerEl.textContent =
        this._themeDraft?.name ||
        this._t("frontend.library.themes", "Circadian presets");
      return;
    }
    this._headerEl.textContent = integration;
  }

  _setNavigationIcon(node) {
    for (const child of [...this._appBar.children]) {
      if (child.getAttribute("slot") === "navigationIcon") {
        child.remove();
      }
    }
    if (!node) {
      this._menuButtonEl = undefined;
      return;
    }
    node.slot = "navigationIcon";
    this._appBar.insertBefore(node, this._appBar.firstChild);
    this._menuButtonEl =
      node.tagName === "HA-MENU-BUTTON" ? node : undefined;
  }

  _menuButton() {
    const button = document.createElement("ha-menu-button");
    button.hass = this._hass;
    button.narrow = Boolean(this._narrow);
    return button;
  }

  _backButton() {
    if (customElements.get("ha-icon-button-arrow-prev")) {
      const button = document.createElement("ha-icon-button-arrow-prev");
      button.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._go((this._editorReturnTab || this._railTab) === "library" ? "variables" : "");
      });
      return button;
    }
    if (customElements.get("ha-icon-button")) {
      const button = document.createElement("ha-icon-button");
      button.label = "Back";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", "mdi:arrow-left");
      button.appendChild(icon);
      button.addEventListener("click", () => this._go((this._editorReturnTab || this._railTab) === "library" ? "variables" : ""));
      return button;
    }
    const button = document.createElement("button");
    button.className = "fallback ghost";
    button.textContent = "Back";
    button.addEventListener("click", () => this._go((this._editorReturnTab || this._railTab) === "library" ? "variables" : ""));
    return button;
  }

  _resolvableSceneId(sceneId) {
    if (!sceneId) {
      return null;
    }
    if (this._nativeDrafts[sceneId]?.deleted) {
      return null;
    }
    // Pending creates are resolvable via overlay before the entity exists.
    if (this._nativeDrafts[sceneId]?.created) {
      return sceneId;
    }
    // Orphan / deleted YAML scenes stay in hass.states as unavailable and
    // still have a friendly name — treat them as unassigned so the dial and
    // light sidebar do not pretend membership exists.
    const state = this._hass?.states?.[sceneId];
    if (!state || state.state === "unavailable") {
      return null;
    }
    return sceneId;
  }

  _eventSceneId(eventId) {
    const assigned =
      LINKED_EVENTS.includes(eventId) && this._formData.display_scenes_combined
        ? this._formData.scene_dawn_sunrise_sunset || null
        : this._formData[EVENT_SCENE_KEYS[eventId]] || null;
    return (
      this._resolvableSceneId(assigned) ||
      this._resolvableSceneId(this._entityId)
    );
  }

  _entityObjectId(entityId) {
    if (!entityId) {
      return "";
    }
    const dot = entityId.indexOf(".");
    return dot >= 0 ? entityId.slice(dot + 1) : entityId;
  }

  _entityFriendlyName(entityId, fallback) {
    if (!entityId) {
      return fallback || "";
    }
    const state = this._hass?.states?.[entityId];
    const friendly = state?.attributes?.friendly_name;
    if (friendly) {
      return friendly;
    }
    return fallback || this._entityObjectId(entityId);
  }

  _entityStateIcon(entityId, fallbackIcon) {
    const state = this._hass?.states?.[entityId];
    if (customElements.get("ha-state-icon") && (state || entityId)) {
      const icon = document.createElement("ha-state-icon");
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
    const entry = this._hass?.entities?.[entityId];
    const named =
      entry?.icon || state?.attributes?.icon || fallbackIcon || "mdi:palette";
    icon.setAttribute(
      "icon",
      typeof named === "string" && named.startsWith("mdi:")
        ? named
        : fallbackIcon || "mdi:palette"
    );
    return icon;
  }

  _lightIsUnavailable(entityId) {
    if (String(entityId || "").startsWith("theme:")) {
      return false;
    }
    const state = this._hass?.states?.[entityId];
    return !state || state.state === "unavailable";
  }

  _lightHasKnownCaps(entityId) {
    const attrs = this._hass?.states?.[entityId]?.attributes;
    if (!attrs) {
      return false;
    }
    return Boolean(
      (attrs.supported_color_modes && attrs.supported_color_modes.length) ||
        attrs.min_color_temp_kelvin != null
    );
  }

  _clockRingLights(lights) {
    return (lights || []).filter(
      (light) =>
        light.theme_ring ||
        (!light.suggested &&
          !light.removed &&
          !this._lightIsUnavailable(light.entity_id))
    );
  }

  _legendLights(lights) {
    if (this._editingThemeLook()) {
      return [];
    }
    const rows = [...(lights || [])];
    const rank = (light) => {
      if (light.removed || light.suggested) {
        return 2;
      }
      if (this._lightIsUnavailable(light.entity_id)) {
        return 1;
      }
      return 0;
    };
    rows.sort((a, b) => rank(a) - rank(b));
    const seen = new Set();
    return rows.filter((light) => {
      const id = light?.entity_id;
      if (!id || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  async _save() {
    await this._saveNow();
  }

  async _delete() {
    if (!this._editId) {
      return;
    }
    try {
      this._captureAreaRailScroll();
      this._areaRailSkipReveal = true;
      this._invalidatePanelLoads();
      await this._hass.callWS({
        type: `${DOMAIN}/delete`,
        scene_id: this._editId,
      });
      this._clearPersistedDraft();
      this._dropSceneFromList(this._editId);
      await this._go("");
      await this._loadList();
    } catch (err) {
      this._error = err.message || String(err);
      this._renderEditor();
    }
  }

  _dawnMaximumSeconds() {
    return this._settings?.dawn_maximum_enabled === false ? null : timeToSeconds(this._settings?.dawn_maximum_time_of_day ?? 6 * 3600);
  }

  _duskMinimumSeconds() {
    if (this._settings?.dusk_minimum_enabled === false) return null;
    const raw = this._settings?.dusk_minimum_time_of_day;
    if (raw == null || raw === "") {
      return 22 * 3600;
    }
    const seconds = timeToSeconds(raw);
    return Number.isFinite(seconds) ? seconds : 22 * 3600;
  }

  _sceneIdsFromForm() {
    const resolve = (id) => this._resolvableSceneId(id);
    if (this._formData.display_scenes_combined) {
      const shared = resolve(this._formData.scene_dawn_sunrise_sunset || null);
      return {
        scene_dawn: shared,
        scene_sunrise: shared,
        scene_sunset: shared,
        scene_noon: resolve(this._formData.scene_noon || null),
        scene_dusk: resolve(this._formData.scene_dusk || null),
      };
    }
    return {
      scene_dawn: resolve(this._formData.scene_dawn || null),
      scene_sunrise: resolve(this._formData.scene_sunrise || null),
      scene_noon: resolve(this._formData.scene_noon || null),
      scene_sunset: resolve(this._formData.scene_sunset || null),
      scene_dusk: resolve(this._formData.scene_dusk || null),
    };
  }

  _stampListPreset() {
    const scene = this._formData;
    if (!scene?.id) {
      return null;
    }
    const item = (this._items || []).find((row) => row.id === scene.id);
    if (!item) {
      return scene;
    }
    item.palette_id = scene.palette_id || null;
    item.event_palettes = scene.event_palettes || {};
    if (item.form) {
      item.form = {
        ...item.form,
        palette_id: item.palette_id,
        event_palettes: item.event_palettes,
      };
    }
    return item;
  }

  _syncOpenSceneCardFace() {
    const item = this._stampListPreset();
    if (item) {
      syncSceneCardFace(this, item);
      if (item.kind !== "simple") this._syncThemePreviewSurfaces();
    }
  }

}

installPanelMethods(SceneStudioPanel.prototype, {
  libraryEditorMethods,
  panelCatalogMethods,
  circadianEditorMethods,
  previewTimelineMethods,
  dialRendererMethods,
  dialLightStripMethods,
  dialInteractionMethods,
  dialSkyMethods,
  previewControllerMethods,
  panelDialogMethods,
  editorHistoryMethods,
});

if (!customElements.get("scene-studio-panel")) {
  customElements.define("scene-studio-panel", SceneStudioPanel);
}
