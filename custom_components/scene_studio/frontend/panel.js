import { waitForSurfaceAnimation } from "./editor_shell.js";
import {
  buildClientSunDay,
  resampleLightsForEvents,
} from "./client_solar.js";
import { mergeFields, patchInPlace, railCatalogChanges, reconcileSaveResponse, useSavedField } from "./collaboration.js";
import {
  draftRgb,
  draftWheelMode,
  rgb2hsv,
  hueTempToRgb,
  colorBrightnessFromDraft,
  whiteBrightnessFromDraft,
  setColorBrightnessOnDraft,
  setWhiteBrightnessOnDraft,
  createLightBrightnessGraph,
  captureWheelPinPositions,
  createSceneColorWheel,
  polarEaseClosedPathD,
  lightDraftFingerprint,
  THEME_BRIGHTNESS_SNAP,
  applyVariableToDraft,
  colorPayloadFromDraft,
  hexToRgb,
  lightWheelCaps,
  variableSwatchCss,
} from "./color_ui.js";
import {
  galleryAsPalette,
  galleryCopyName,
  galleryCoverUrl,
  galleryPalette,
  gallerySections,
  galleryTheme,
  galleryThemes,
  paletteMatchesGallery,
  seedThemeEvents,
  themeDraftSignature,
  themeEventSignature,
  themeMatchesGallery,
} from "./gallery.js";
import { defaultPaletteSlots, paletteIsMixed, paletteIsTemperatureOnly, paletteSwatchCss, samplePaletteWheel, sceneEventPaletteId, variableIsPalette } from "./palette.js";
import {
  isoYear,
  daysInYear,
  dayOfYear,
  isoFromDayOfYear,
  todayIso,
  formatPreviewDayMonth,
  shiftIsoDate,
  diffIsoDays,
  emptyFormData,
  timeToSeconds,
  secondsToTime,
  nowSecondsSinceMidnight,
  formatClock,
} from "./editor_session.js";
import {
  sunStrokePathRuns,
  interpolateElevation,
  skyLookFromElevation,
  darkenedRgb,
  conicGradientFromSamples,
  interpolateLightSample,
  easeOutCubic,
  lerpSunPath,
} from "./dial_clock.js";
import {
  LANDING_CSS,
  PALETTE_RANDOMIZE_ICON,
  renderLanding,
  renderListStageEmpty,
  renderSceneUsed,
  renderPaletteUsed,
  renderLibraryUsedBy,
  renderThemePresetSource,
  createPresetSceneCard,
  sceneCoverUrl,
  syncSceneCardFace,
  applyCircularRamp,
  bindStickyTitles,
  previewRampsForTheme,
  paintThemeDial,
} from "./landing.js";
import { lightDisplayName } from "./display_names.js";
import { createOnOffEventGraph, toggleOnOffDraft } from "./onoff_graph.js";
import { defaultOnPreference, sceneRailCatalogKey } from "./panel_state.js";
import { panelLoadIsCurrent } from "./load_guard.js";
import { paintSimpleCardMesh } from "./card_mesh.js";
import { SIMPLE_EDITOR_CSS, renderSimpleEditor, renderPaletteEditor } from "./simple_editor.js";
import { snapshotWheelEditor, applyWheelMorph } from "./wheel_morph.js";
import { bindGroupTitleStick, bindLightTileBrightness, captureLightStripLayout, createAddLightTile, createLightModeGroup, createLightTile, createLightTilesHint, attachLightActions, groupSelectionAfterClick, lightTileColorGroup, lightTileGroupOrder, lightTileValueLabel, paintLightTile, playLightStripLayout, revealLightActionsNow } from "./light_tiles.js";

const DOMAIN = "scene_studio";
const PANEL_URL_PATH = "scene_studio";
const LEGACY_DOMAINS = ["circadian_scenes", "scene_extrapolation"];
const SECONDS_PER_DAY = 24 * 3600;
/* Clock overlay viewBox is 200×200. Planet (rings) sits inside a circular
   sun path whose radius scales with the day's peak elevation. */
const CLOCK_VIEW = 200;
const CLOCK_CX = 100;
const CLOCK_CY = 100;
const CLOCK_RINGS_OUTER = 52;
/* Path stays a perfect circle between planet + pad and face − pad. */
const CLOCK_SUN_PATH_PAD = 3;
const CLOCK_SUN_PATH_WIDTH_PX = 1;
/* Magnetic scrub: snap only on pointer-up if within this window (no mid-drag magnet). */
const CLOCK_SNAP_CAPTURE_SEC = Math.round(12 * 60 * 1.3 * 1.25);
const CLOCK_DRAG_CLICK_PX = 7;
/* Event spokes aim near the face edge; buttons sit in chrome outside the core. */
const CLOCK_EVENT_ICON_R = 92;
/* Fixed px band around the dial for hour ticks + labels (do not scale).
   Event-button gap from the path is also screen pixels (see below). */
const CLOCK_CHROME_PX = 80;
const CLOCK_EVENT_BTN_PX = 32;
const CLOCK_SCRUB_RAIL_PX = 104;
/* Inset the landscape timeline from the panel edge (also stops the large
   day/month label from overflowing the rail and widening the page). */
const CLOCK_SCRUB_RAIL_PAD_PX = 16;
/* Landscape rail needs room for empty left gutter + dial + rail; below this
   width keep the portrait toolbar (avoids empty “black bar” side columns). */
const CLOCK_LANDSCAPE_SCRUB_MIN_WIDTH_PX = 900;
/** Color-wheel face floor; below this the stage column scrolls.
 *  A wide dial uses the same floor. A narrow dial may shrink further so the
 *  light tiles stay on screen without a page scrollbar. */
const WHEEL_FACE_MIN_PX = 400;
const DIAL_FACE_MIN_PX = WHEEL_FACE_MIN_PX;
/** Color wheels (simple / variable) cap; the stage column stays full width. */
const WHEEL_FACE_MAX_PX = 650;
/* Rings host inset so CSS outer edge matches CLOCK_RINGS_OUTER in viewBox. */
const CLOCK_RINGS_INSET_PCT = 50 - CLOCK_RINGS_OUTER / 2;
/* Wedges/rays cover the square including corners; back layer is slightly
   larger than the face so they land just outside the container. */
const CLOCK_SKY_R = (CLOCK_VIEW / 2) * Math.SQRT2;
/* Night wedges: light theme = warm gray; dark theme = near-black (CSS vars). */
const CLOCK_NIGHT_OUTER_LIGHT = "#e4d8cc";
const CLOCK_NIGHT_DEEP_LIGHT = "#bba89a";
const CLOCK_NIGHT_OUTER_DARK = "#101218";
const CLOCK_NIGHT_DEEP_DARK = "#06070b";
/* Crispy day sky (light mode day wedge / daytime horizon glow). */
const CLOCK_DAY_SKY_LIGHT = "rgb(79, 179, 255)";
/* Outline diameter ≈ 3.47% of dial core (1/3 of the prior 10.4%). */
const CLOCK_SUN_SIZE_PCT = 10.4 / 3;
const CLOCK_SUN_R_VIEW = (CLOCK_VIEW * (CLOCK_SUN_SIZE_PCT / 100)) / 2;
/* Scale: 1 at daytime zenith (smallest); CLOCK_SUN_SCALE_MAX at
   sunrise/sunset and fixed through the night until sunrise. */
const CLOCK_SUN_SCALE_MAX = 2;
/* Handle tip radius in the dial-core viewBox (path-adjacent). Face chrome
   carries the hour ticks + numbers; solar-event buttons track the sun path. */
const CLOCK_TICK_OUTER = 94;
const CLOCK_TICK_MINOR_LEN = 2;
/* Cardinal hour numerals sit this many px farther from the face center
   than the tick-tip inset (screen pixels, same as chrome). */
const CLOCK_HOUR_LABEL_OUTSET_PX = 12;
/* Desktop px from sun-path radius to event-button center at 100% brightness.
   0% sits on the sun path; the same pixel span is the drag range on mobile
   (buttons leave the path when brightness > 0). Screen pixels so a narrower
   viewport does not eat the margin. Seasonal path radius still moves the 0% ring.
   Cardinal hour numerals replaced the 6h ticks, so this gap is wider (92px). */
const CLOCK_EVENT_GAP_FROM_PATH_PX = 92;
const CLOCK_EVENT_BRIGHT_DRAG_PX = 10;
const CLOCK_BRIGHT_MOVE_MS = 400;
/* Fallback override radius until layout maps face tick tips into core space. */
const CLOCK_OVERRIDE_R = CLOCK_TICK_OUTER;
const CLOCK_SUN_STROKE_MIN_PX = 0.2;
const CLOCK_SUN_STROKE_MAX_PX = 10;
const SIDEBAR_ANIMATION_MS = 400;
const SIDEBAR_SWAP_MS = 160;
/* Cubic ease-out: decelerates across more of the span than quintic. */
const CLOCK_SUN_MOVE_MS = 1500;
const DATE_MORPH_MS = 1500;
const PREVIEW_REFINE_MS = 800;
/** Settled preview samples are denser than scrub knots (≤8 incl. midnight). */
const UNDO_STACK_LIMIT = 75;
const LIVE_EDIT_STORAGE_VERSION = 1;
const ROOM_PREVIEW_STORAGE_VERSION = 1;
const SCENE_PLAY_STORAGE_VERSION = 2;
const SCENE_PLAY_TICK_MS = 250;
const SCENE_PLAY_TRANSITION_SEC = 0.25;
const SCENE_PLAY_DURATION_DEFAULT_SEC = 10;
const SCENE_PLAY_DURATION_OPTIONS_SEC = [2, 5, 10, 15, 30, 60, 90, 120];
const EXTERNAL_SCENE_WARN_STORAGE_VERSION = 1;
const CLOCK_FEATHER_PCT = 5.5;
const LINKED_EVENTS = ["dawn", "sunrise", "sunset"];
const SETUP_AUTOMATIC = "automatic";
// Same circadian seeds as native_scene.EVENT_LIGHT_DEFAULTS (0–255, kelvin).
const EVENT_LIGHT_DEFAULTS = {
  dawn: [102, 2700],
  sunrise: [191, 3500],
  noon: [255, 4500],
  sunset: [179, 3000],
  dusk: [64, 2200],
};
const EVENT_SCENE_KEYS = {
  dawn: "scene_dawn",
  sunrise: "scene_sunrise",
  noon: "scene_noon",
  sunset: "scene_sunset",
  dusk: "scene_dusk",
};

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

const LABELS = {
  scene_name: "Scene name",
  area: "Area",
  display_scenes_combined: "Combine dawn / sunrise / sunset scenes?",
  scene_dawn: "Dawn scene",
  scene_sunrise: "Sunrise scene",
  scene_noon: "Noon scene",
  scene_sunset: "Sunset scene",
  scene_dusk: "Dusk scene",
  scene_dawn_sunrise_sunset: "Dawn, sunrise, and sunset scene",
  scene_dusk_minimum_time_of_day: "Earliest time for the dusk scene",
};

const HELPERS = {
  scene_name: "Name for the extrapolation scene entity",
  area: "Used to filter native Home Assistant scenes and to assign the new scene",
  display_scenes_combined: "If on, configure 3 scenes in the next step. If off, configure 5",
  scene_dawn: "First light (sun 6° below the horizon)",
  scene_sunrise: "When the sun rises",
  scene_noon: "When the sun is at its highest point",
  scene_sunset: "When the sun sets",
  scene_dusk: "Last light (sun 6° below the horizon)",
  scene_dawn_sunrise_sunset: "First light, sunrise, and sunset",
  scene_dusk_minimum_time_of_day: "To avoid lights dimming too much, too early",
  setup_empty_means_auto:
    "Leave empty to create a native scene automatically for this event",
};

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
    this._sidebarMotionGeneration = 0;
    this._sidebarMotionRaf = undefined;
    this._sidebarMotionTimer = undefined;
    this._sidebarLayoutInProgress = false;
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
    if (this._sidebarMotionRaf) {
      window.cancelAnimationFrame(this._sidebarMotionRaf);
      this._sidebarMotionRaf = undefined;
    }
    if (this._sidebarMotionTimer) {
      window.clearTimeout(this._sidebarMotionTimer);
      this._sidebarMotionTimer = undefined;
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
      <style>
        :host {
          display: block;
          position: relative;
          width: 100%;
          /* 100vh fills when ha-panel-custom reports 0 height; max-height
             caps to the panel outlet when that height is definite — otherwise
             host > parent and HA’s shell scrolls beside ha-top-app-bar. */
          height: 100vh;
          max-height: 100%;
          overflow: hidden;
          --scene-safe-bottom: max(
            var(--safe-area-inset-bottom, 0px),
            env(safe-area-inset-bottom, 0px)
          );
          background: var(--primary-background-color);
          color: var(--primary-text-color);
          --scene-sidebar-gutter: 0px;
          --scene-sidebar-content-gutter: 0px;
          --selected-ring-color: rgb(255 255 255 / 75%);
          /* Night wedges: warm gray in light; near-black in dark. */
          --clock-night-outer: ${CLOCK_NIGHT_OUTER_LIGHT};
          --clock-night-deep: ${CLOCK_NIGHT_DEEP_LIGHT};
        }
        :host([data-dark-mode]) {
          --clock-night-outer: ${CLOCK_NIGHT_OUTER_DARK};
          --clock-night-deep: ${CLOCK_NIGHT_DEEP_DARK};
        }
        /* Dial L/T/R surface vignette — fixed to the panel host (full width /
           height), not .sun-path. Tying it to --scene-sidebar-gutter made the
           gradient box resize with the drawer and artifact mid-transition. */
        :host([data-dial-view])::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background:
            linear-gradient(
              to right,
              color-mix(in srgb, var(--primary-background-color) 50%, transparent) 0%,
              color-mix(in srgb, var(--primary-background-color) 28%, transparent) 72px,
              color-mix(in srgb, var(--primary-background-color) 10%, transparent) 160px,
              transparent 260px
            ),
            linear-gradient(
              to left,
              color-mix(in srgb, var(--primary-background-color) 50%, transparent) 0%,
              color-mix(in srgb, var(--primary-background-color) 28%, transparent) 72px,
              color-mix(in srgb, var(--primary-background-color) 10%, transparent) 160px,
              transparent 260px
            ),
            linear-gradient(
              to bottom,
              color-mix(in srgb, var(--primary-background-color) 50%, transparent) 0%,
              color-mix(in srgb, var(--primary-background-color) 28%, transparent) 100px,
              color-mix(in srgb, var(--primary-background-color) 10%, transparent) 220px,
              transparent 360px
            );
        }
        /* ha-panel-custom often computes to 0 height, so 100% on the app bar
           collapses. Fill the viewport, then stretch the bar to this host. */
        ha-top-app-bar-fixed {
          height: 100% !important;
        }
        .sun-path {
          /* No HA card chrome — clock/plots sit on the panel surface. */
          background: transparent;
          border: none;
          border-radius: 0;
          margin-top: 0;
          overflow: visible;
          position: relative;
        }
        .sun-path[hidden] {
          display: none;
        }
        .sun-path-stage {
          display: block;
        }
        /* Landscape clock: timeline in the right column; matching empty left
           column keeps the dial optically centered in the full stage while
           the rail still reduces the width available for the dial. */
        .sun-path-stage.landscape-clock-scrub {
          --scrub-rail-width: ${CLOCK_SCRUB_RAIL_PX}px;
          display: grid;
          grid-template-columns:
            var(--scrub-rail-width)
            minmax(0, 1fr)
            var(--scrub-rail-width);
          align-items: start;
          width: 100%;
          box-sizing: border-box;
          /* Right pad so the timeline is not flush to the panel edge; the
             matching left column still optically centers the dial. */
          padding-right: ${CLOCK_SCRUB_RAIL_PAD_PX}px;
          overflow: visible;
        }
        .sun-path-stage.landscape-clock-scrub.scrub-collapsed {
          --scrub-rail-width: 0px;
          padding-right: 0;
        }
        .sun-path-stage.landscape-clock-scrub .sun-path-body {
          grid-column: 2;
          width: 100%;
          min-width: 0;
          height: 100%;
          align-self: stretch;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .sun-year-scrub-rail {
          display: none;
          grid-column: 3;
          position: relative;
          width: 100%;
          min-width: 0;
          /* Visible so date chips can grow left into the dial column. */
          overflow: visible;
          opacity: 1;
          box-sizing: border-box;
          z-index: 3;
          flex-direction: column;
          align-items: stretch;
          gap: 6px;
          transition: opacity ${SIDEBAR_ANIMATION_MS}ms cubic-bezier(0.2, 0, 0, 1);
        }
        .sun-path-stage.landscape-clock-scrub .sun-year-scrub-rail {
          display: flex;
          /* Match portrait toolbar top inset under the app bar. */
          padding-top: 12px;
        }
        .sun-path-stage.landscape-clock-scrub.scrub-collapsed .sun-year-scrub-rail {
          opacity: 0;
          pointer-events: none;
        }
        .sun-scrub-block {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
          width: 100%;
        }
        .sun-year-scrub-rail .sun-scrub-block {
          flex: 1 1 auto;
          min-height: 0;
          height: 100%;
        }
        .sun-date-tools {
          display: flex;
          /* Table: date first (row-reverse of chips→date DOM). */
          flex-direction: row-reverse;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
        }
        /* Dial portrait: chips left of day/month.
           Above horizon bleed (sky/glow can extend past the face). */
        .sun-path.dial-view .sun-date-tools {
          position: relative;
          z-index: 3;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
        }
        .sun-year-scrub-rail .sun-date-tools {
          /* Chips above date; pack to the rail’s right edge. */
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          max-width: 100%;
          overflow: visible;
          gap: 4px;
          box-sizing: border-box;
          padding-inline-end: 2px;
        }
        .sun-chip-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .sun-year-scrub-rail .sun-chip-row {
          /* width:100% + flex-end: right edge stays in the rail; overflow grows
             left into the dial. (max-content + margin-left:auto left-aligns when
             chips are wider than the 88px rail and spills off-screen.) */
          flex-direction: row;
          flex-wrap: nowrap;
          justify-content: flex-end;
          align-items: center;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          gap: 4px;
          overflow: visible;
        }
        .sun-year-scrub-rail .sun-chip {
          flex: 0 0 auto;
          white-space: nowrap;
        }
        .sun-scrub-date {
          position: relative;
          appearance: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin: 0;
          padding: 2px 4px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--primary-text-color);
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.2;
          white-space: nowrap;
          cursor: pointer;
        }
        .sun-year-scrub-rail .sun-scrub-date {
          align-self: stretch;
          justify-content: flex-end;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          font-size: 26px;
          line-height: 1.15;
          padding: 2px 0;
        }
        .sun-scrub-date:hover {
          background: color-mix(
            in srgb,
            var(--primary-color) 12%,
            transparent
          );
        }
        .sun-scrub-date:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
        .sun-scrub-date-reset {
          --mdc-icon-size: 18px;
          color: var(--primary-text-color);
        }
        .sun-scrub-date-reset[hidden] {
          display: none;
        }
        /* Right-aligned date: icon sits in front of the text. */
        .sun-year-scrub-rail .sun-scrub-date-reset {
          order: -1;
          --mdc-icon-size: 22px;
        }
        /* Visually hidden but mounted — opened via ha-date-input._openDialog.
           Keep it laid out (not display:none) so the selector finishes upgrading.
           clip-path + contain so the upgraded control cannot widen scrollWidth. */
        .sun-date-picker-host {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: 0;
          padding: 0;
          overflow: hidden;
          clip-path: inset(50%);
          contain: strict;
          opacity: 0;
          pointer-events: none;
        }
        .sun-toolbar {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
          padding: 12px 16px 0;
          position: relative;
          z-index: 3;
        }
        /* Portrait dial: toolbar is in-flow so the year scrub pushes the dial
           down (ticks stay clear). Horizon glow still bleeds behind it
           (_layoutClockHorizonBack covers the host). Flush left so Now/Sun°
           meet the page edge like chips (no shared 16px inset). */
        .sun-path.dial-view .sun-toolbar {
          position: relative;
          z-index: 6;
          box-sizing: border-box;
          pointer-events: none;
          background: transparent;
          padding: 8px 12px 0 16px;
        }
        /* Desktop landscape: the chip/play row overlays the dial so the face
           can grow into that band. The year rail stays in the grid. */
        .sun-path.dial-view:has(.sun-path-stage.landscape-clock-scrub) > .sun-toolbar {
          position: absolute;
          top: 0;
          left: 0;
          /* Stop the chip row on the dial column so it does not cover the date. */
          right: calc(${CLOCK_SCRUB_RAIL_PX}px + ${CLOCK_SCRUB_RAIL_PAD_PX}px);
        }
        .sun-path.dial-view:has(.sun-path-stage.scrub-collapsed) > .sun-toolbar {
          right: 0;
        }
        .sun-path.dial-view:has(.sun-path-stage.landscape-clock-scrub) .sun-light-clock {
          justify-content: flex-start;
          /* The date row is absolute, so this pad keeps the face below it.
             8px toolbar padding + 32px chip row. */
          padding-top: 40px;
        }
        .sun-path.dial-view:has(.sun-path-stage.landscape-clock-scrub) .sun-light-clock-legend {
          margin-top: auto;
        }
        .sun-path.dial-view .sun-toolbar > * {
          pointer-events: auto;
        }
        /* Time/sun + date chips share one full-width wrapping row. */
        .sun-toolbar-chrome {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-start;
          gap: 8px 12px;
          width: 100%;
          box-sizing: border-box;
        }
        /* Time sits in the chrome row (not an overlay readout). */
        .sun-path.dial-view .sun-toolbar-chrome .sun-hover-readout {
          position: static;
          top: auto;
          left: auto;
          z-index: auto;
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 8px 16px;
          flex: 0 1 auto;
          max-width: none;
          min-width: 0;
          /* Match chip / reset row height so time+deg stay put when reset appears. */
          min-height: 32px;
          margin: 0;
          padding: 0;
          pointer-events: none;
          color: var(--primary-text-color);
          font-weight: 500;
        }
        .sun-path.dial-view .sun-toolbar-chrome .sun-hover-time {
          font-weight: 600;
          color: var(--primary-text-color);
        }
        .sun-path.dial-view .sun-toolbar-chrome .sun-hover-reset-slot {
          flex: 0 0 32px;
          width: 32px;
          height: 32px;
          display: inline-grid;
          place-items: center;
          pointer-events: none;
        }
        .sun-path.dial-view .sun-toolbar-chrome .sun-hover-reset {
          pointer-events: auto;
        }
        .sun-toolbar-chrome .sun-chip-row {
          flex: 0 1 auto;
          margin-left: auto;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .sun-toolbar-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .sun-year-scrub {
          position: relative;
          width: 100%;
          margin: 4px 0 8px;
          touch-action: none;
          user-select: none;
          outline: none;
          cursor: pointer;
        }
        /* Keyboard only — pointerdown must not paint a focus ring (do not
           call .focus() from the scrub pointer handler). */
        .sun-year-scrub:focus {
          outline: none;
          box-shadow: none;
        }
        .sun-year-scrub:focus-visible {
          box-shadow: 0 0 0 2px var(--primary-color);
          border-radius: 8px;
        }
        .sun-year-months {
          position: relative;
          height: 16px;
          margin-bottom: 2px;
        }
        .sun-year-months span {
          position: absolute;
          top: 0;
          font-size: 11px;
          line-height: 16px;
          color: var(--secondary-text-color);
          pointer-events: none;
          white-space: nowrap;
        }
        .sun-year-track {
          position: relative;
          height: 20px;
        }
        .sun-year-bar,
        .sun-year-fill {
          position: absolute;
          left: 0;
          top: 8px;
          height: 4px;
          border-radius: 2px;
        }
        .sun-year-bar {
          right: 0;
          background: var(--divider-color);
        }
        .sun-year-fill {
          background: var(--primary-color);
          opacity: 0.35;
        }
        .sun-year-today {
          position: absolute;
          top: 4px;
          width: 2px;
          height: 12px;
          margin-left: -1px;
          background: var(--secondary-text-color);
          pointer-events: none;
        }
        .sun-year-today[hidden] {
          display: none;
        }
        .sun-year-thumb {
          position: absolute;
          top: 4px;
          width: 16px;
          height: 16px;
          margin-left: -8px;
          border-radius: 50%;
          background: var(--primary-color);
          box-shadow: 0 0 0 2px var(--card-background-color);
          pointer-events: none;
        }
        /* Portrait / table: horizontal under the date row (default above).
           Landscape + clock: vertical rail to the right of the face. */
        .sun-year-scrub.vertical {
          display: flex;
          flex-direction: row;
          align-items: stretch;
          flex: 1 1 auto;
          width: 100%;
          min-height: 0;
          height: auto;
          margin: 0;
          padding: 2px 0;
          box-sizing: border-box;
        }
        .sun-year-scrub.vertical .sun-year-months {
          flex: 1 1 auto;
          width: auto;
          height: auto;
          margin: 0 2px 0 0;
          align-self: stretch;
        }
        .sun-year-scrub.vertical .sun-year-months span {
          left: auto;
          right: 0;
          top: 0;
          font-size: 10px;
          line-height: 1.1;
          text-align: right;
        }
        .sun-year-scrub.vertical .sun-year-track {
          flex: 0 0 20px;
          width: 20px;
          height: auto;
          align-self: stretch;
        }
        .sun-year-scrub.vertical .sun-year-bar {
          left: 8px;
          right: auto;
          top: 0;
          bottom: 0;
          width: 4px;
          height: auto;
        }
        .sun-year-scrub.vertical .sun-year-fill {
          left: 8px;
          right: auto;
          top: 0;
          width: 4px;
          height: 0;
        }
        .sun-year-scrub.vertical .sun-year-thumb {
          left: 2px;
          top: 0;
          margin-left: 0;
          margin-top: -8px;
        }
        .sun-year-scrub.vertical .sun-year-today {
          left: 4px;
          top: 0;
          width: 12px;
          height: 2px;
          margin-left: 0;
        }
        .sun-chip {
          background: transparent;
          color: var(--primary-color);
          border: 1px solid var(--divider-color);
          border-radius: 16px;
          padding: 4px 10px;
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        }
        .sun-chip[selected] {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          border-color: var(--primary-color);
        }
        .sun-location-btn {
          color: var(--secondary-text-color);
        }
        .sun-location-btn[hidden] {
          display: none;
        }
        .sun-path.dial-view {
          --dial-timeline-h: 0px;
          /* The desktop face rule adds 24px. This stays 0 so a phone dial,
             which is not in .stage-col, stays flush under the app bar. */
          margin-top: 0;
          display: flex;
          flex-direction: column;
          /* Do not clip X here — mobile face uses width 100%+48px / −24px
             margin so ticks bleed past the column; page/dial-wide clips
             horizon bleed instead (overflow-x:hidden+visible Y → auto). */
          overflow: visible;
          /* Fallback until _syncStageFaceMax measures: fill below the header,
             keep event-label pad + gap, leave room for the light-tile strip. */
          --dial-face-max: calc(
            100vh - var(--header-height, 64px) - 40px - 16px - 180px
          );
        }
        .sun-path.dial-view .sun-toolbar {
          flex: 0 0 auto;
        }
        .sun-path.dial-view .sun-path-stage {
          flex: 1 1 auto;
          min-width: 0;
          width: 100%;
          min-height: min-content;
        }
        .sun-path.dial-view .sun-path-stage:not(.landscape-clock-scrub) {
          display: flex;
          flex-direction: column;
        }
        .sun-path.dial-view .sun-path-body {
          flex: 1 1 auto;
          min-height: min-content;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .sun-light-clock {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          width: 100%;
          /* No horizontal padding — use the full stage column for the dial.
             Extra top pad leaves room for event labels above the face. */
          padding: 40px 0 16px;
          box-sizing: border-box;
          overflow: visible;
        }
        .sun-path.dial-view .sun-light-clock {
          position: relative;
          /* Face size comes from --dial-face-max. The floor matches the color
             wheel; below it the scrollport grows and the tiles move down.
             min-height includes the 40px label pad and the 16px under the
             face, so the square itself can stay at that floor. */
          flex: 1 1 auto;
          min-height: calc(${DIAL_FACE_MIN_PX}px + 40px + 16px);
          min-width: 0;
          width: 100%;
          gap: 16px;
          padding-bottom: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          container-type: size;
        }
        .sun-path.dial-view .sun-light-clock-legend {
          position: relative;
          /* Above dial labels (z-index 10) that overflow the face onto the tiles.
             The stage grows above this strip, so the tiles sit on the bottom
             until the dial floor makes the column scroll. */
          z-index: 12;
          width: 100%;
          max-width: none;
          align-self: stretch;
          padding-inline: 0;
          box-sizing: border-box;
          flex: 0 0 auto;
          pointer-events: auto;
        }
        /* Same column width as the dial light list (under the face). */
        .sun-light-clock-empty-hint {
          margin: 0;
          padding: 0 12px;
          max-width: min(100%, 86vh, var(--dial-face-max, 86vh));
          text-align: center;
          color: var(--secondary-text-color);
          font-size: 14px;
          line-height: 1.4;
          position: relative;
          z-index: 5;
        }
        .sun-light-clock-face {
          position: relative;
          width: min(100cqi, 100cqb, var(--dial-face-max, 86vh));
          max-width: min(100%, var(--dial-face-max, 86vh));
          aspect-ratio: 1;
          flex: 0 0 auto;
          /* A finger on the dial scrubs bands. The page must not scroll too. */
          touch-action: none;
          cursor: default;
          /* Visible so horizon glow/rays can bleed past the face. */
          overflow: visible;
          transform-origin: center center;
          --clock-chrome: ${CLOCK_CHROME_PX}px;
        }
        /* Mobile: drop hour numbers; grow the face past the column (clipped
           later — see overflow-x under .page.dial-wide) so ticks can bleed. */
        @media (max-width: 870px) {
          .sun-light-clock-face {
            width: min(
              calc(100% + 48px),
              96vh,
              var(--dial-face-max, 96vh)
            );
            max-width: min(96vh, var(--dial-face-max, 96vh));
            margin-inline: -24px;
          }
        }
        /* Sunrise/sunset shadow + glow sit behind the planet (back-most).
           Sized in JS to cover the full panel (under the sidebar).
           Isolate so screen-blend horizon wash does not composite over the
           light-band bloom that stacks above this layer. translate3d keeps
           scrub-driven background updates on their own compositor layer. */
        .clock-horizon-back {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate3d(-50%, -50%, 0);
          pointer-events: none;
          z-index: 0;
          overflow: visible;
          isolation: isolate;
          backface-visibility: hidden;
        }
        .stage-bg .clock-horizon-back {
          z-index: 0;
        }
        /* Light-band bloom between horizon wash and planet (same chrome inset
           as the core so clones stay aligned with the rings). Promoted so sun
           scrub does not re-rasterize the static bloom clones. */
        .sun-light-clock-glow-layer {
          position: absolute;
          inset: var(--clock-chrome);
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
          overflow: visible;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        /* Planet / path live in the inset core; event chips stay on the face
           so their px size does not shrink with the dial. */
        .sun-light-clock-core {
          position: absolute;
          inset: var(--clock-chrome);
          border-radius: 50%;
          pointer-events: none;
          z-index: 2;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .sun-light-clock-core .sun-light-clock-rings {
          pointer-events: auto;
        }
        /* Enter and exit both scale up (0.92→1 in, 1→1.08 out). Overlay
           crossfade lives on .stage-motion-layer so views overlap. */
        .sun-light-clock-face.clock-face-enter {
          animation:
            stage-surface-fade-in 280ms cubic-bezier(0.2, 0, 0, 1) both,
            stage-surface-enter-scale 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        .sun-light-clock-face.clock-face-enter .sun-light-clock-overlay {
          transform-origin: center center;
          animation: clock-overlay-spin 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        /* Cancel overlay spin on the sun fill/glow so it stays locked to the
           HTML outline (both follow the JS enter arc only). */
        .sun-light-clock-face.clock-face-enter .clock-sun-day-group {
          transform-box: view-box;
          transform-origin: center;
          animation: clock-sun-counter-spin 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        /* Buttons live on the face (outside the SVG overlay). Spin this layer
           around the dial center so they orbit with the path, not in place.
           Anchors counter-rotate so the icon + label stay screen-level. */
        .sun-light-clock-face.clock-face-enter .clock-event-layer {
          transform-origin: center center;
          animation: clock-overlay-spin 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        .sun-light-clock-face.clock-face-enter .clock-event-anchor {
          animation: clock-event-counter-spin 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        @keyframes stage-surface-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes stage-surface-fade-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes stage-surface-enter-scale {
          from {
            transform: scale(0.92);
          }
          to {
            transform: scale(1);
          }
        }
        @keyframes stage-surface-exit-scale {
          from {
            transform: scale(1);
          }
          to {
            transform: scale(1.08);
          }
        }
        @keyframes clock-overlay-spin {
          from {
            transform: translateZ(0) rotate(-8deg);
          }
          to {
            transform: translateZ(0) rotate(0deg);
          }
        }
        @keyframes clock-sun-counter-spin {
          from {
            transform: rotate(8deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        @keyframes clock-event-counter-spin {
          from {
            transform: translate(-50%, -50%) rotate(8deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(0deg);
          }
        }
        .simple-editor-host.simple-editor-enter,
        .library-editor.simple-editor-enter,
        .empty-state.stage-surface-enter {
          transform-origin: center center;
          animation:
            stage-surface-fade-in 280ms cubic-bezier(0.2, 0, 0, 1) both,
            stage-surface-enter-scale 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        .stage-motion-layer {
          position: absolute;
          inset: 0;
          z-index: 6;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          overflow: hidden;
          pointer-events: none;
          transform-origin: center center;
        }
        .stage-motion-layer.stage-motion-exit-active {
          animation:
            stage-surface-fade-out 280ms cubic-bezier(0.2, 0, 0, 1) both,
            stage-surface-exit-scale 400ms cubic-bezier(0.2, 0, 0, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .sun-light-clock-face.clock-face-enter,
          .simple-editor-host.simple-editor-enter,
          .library-editor.simple-editor-enter,
          .empty-state.stage-surface-enter,
          .stage-motion-layer.stage-motion-exit-active {
            animation-duration: 1ms !important;
          }
        }
        /* Registered via CSS.registerProperty (document), not @property here —
           shadow-root @property does not enable transitions. */
        /* Soft bloom from simple dial clones (same ring colors as the planet).
           Each scale is its own blurred stage (lg then md) above the horizon. */
        .sun-light-clock-glow {
          position: absolute;
          inset: ${CLOCK_RINGS_INSET_PCT}%;
          border-radius: 50%;
          pointer-events: none;
          transform-origin: center center;
          filter: blur(28px);
          /* Was 0.63; 50% less transparent → opacity 0.815 */
          opacity: 0.815;
          overflow: visible;
          /* Match soft-mode bleed so the bloom still overlaps between bands. */
          --clock-feather: ${CLOCK_FEATHER_PCT}%;
          --ring-soft-expand: ${(CLOCK_FEATHER_PCT * 1.35).toFixed(2)}%;
          backface-visibility: hidden;
        }
        /* Light theme: half the bloom so rings do not wash the pale sky. */
        :host(:not([data-dark-mode])) .sun-light-clock-glow {
          opacity: 0.4075;
        }
        .sun-light-clock-glow.glow-lg {
          transform: translateZ(0) scale(2.76);
          /* Outermost bloom: half of the shared glow opacity. */
          opacity: 0.4075;
        }
        :host(:not([data-dark-mode])) .sun-light-clock-glow.glow-lg {
          opacity: 0.20375;
        }
        .sun-light-clock-glow.glow-md {
          transform: translateZ(0) scale(1.38);
        }
        .sun-light-clock-glow .clock-ring {
          --ring-expand: var(--ring-soft-expand);
          --ring-rim-w: 0px;
          transition: none;
          filter: none;
          opacity: 1;
          transform: none;
        }
        .sun-light-clock-glow .clock-ring::after {
          content: none;
          display: none;
        }
        /* Sunrise/sunset wash — not clipped to the planet rim. Paints a
           multi-stop spectrum that ends at the surface color (normal blend). */
        .clock-horizon-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          mix-blend-mode: normal;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .clock-horizon-sky {
          position: absolute;
          inset: 0;
          overflow: visible;
          pointer-events: none;
        }
        .sun-light-clock-rings {
          position: absolute;
          inset: ${CLOCK_RINGS_INSET_PCT}%;
          border-radius: 50%;
          /* Above the hour handle so the planet occludes it; path/sun stay higher. */
          z-index: 7;
          overflow: visible;
          --clock-feather: ${CLOCK_FEATHER_PCT}%;
          /* Soft mode: expand bands into neighbors so opaque cores overlap —
             feather alone only overlaps fades and the surface disc shows through. */
          --ring-soft-expand: ${(CLOCK_FEATHER_PCT * 1.35).toFixed(2)}%;
          /* Sharp ↔ soft snaps instantly — animating feather/expand reads as a
             size/ramp morph on every hover. */
          cursor: pointer;
          /* Finger scrub over bands must not scroll the page. */
          touch-action: none;
          /* Filled circular planet: box-shadow matches the old drop-shadow look
             without filter-rasterizing masked conics every frame. */
          box-shadow: 0 0 32px rgba(0, 0, 0, 0.4);
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        /* Surface disc under the bands so 50% rings mix with the panel color,
           not the horizon/bloom graphics behind the planet. */
        .sun-light-clock-rings::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: var(--primary-background-color);
          z-index: 0;
          pointer-events: none;
        }
        /* Soft → sharp: no feather / soft-expand so bands sit edge-to-edge.
           Include :has(.hovered) so touch scrub (no :hover) matches mouse. */
        .sun-light-clock-rings:hover,
        .sun-light-clock-rings:has(.clock-ring.selected),
        .sun-light-clock-rings:has(.clock-ring.hovered) {
          --clock-feather: 0%;
          --ring-soft-expand: 0%;
        }
        .clock-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          /* Masked rings still fill the square for hit-testing; open via
             radial pick on the host instead of per-ring clicks. */
          pointer-events: none;
          z-index: 1;
          --ring-expand: var(--ring-soft-expand);
          --ring-rim-w: 0px;
          transform-origin: center center;
          /* Opacity/filter only — expand/rim-w follow sharp/soft with no tween. */
          transition:
            opacity 180ms cubic-bezier(0.2, 0, 0, 1),
            filter 180ms cubic-bezier(0.2, 0, 0, 1);
        }
        /* Fill lives on a child so the ring mask does not clip ::after borders. */
        .clock-ring-fill {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
        }
        /* Inner + outer rim strokes just inside the band edges (not straddling
           100%, which clipped the outer half of the outermost ring). Width is
           a fixed length so it stays 1px across dial sizes. */
        .clock-ring::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          /* Hover rim: was 0.1; 40% more transparent → 0.06 */
          background: rgba(255, 255, 255, 0.06);
          opacity: 0;
          transition: opacity 180ms cubic-bezier(0.2, 0, 0, 1);
          -webkit-mask-image: radial-gradient(
            farthest-side,
            transparent calc(var(--ring-inner) - var(--ring-expand)),
            #000 calc(var(--ring-inner) - var(--ring-expand)),
            #000
              calc(
                var(--ring-inner) - var(--ring-expand) + var(--ring-rim-w)
              ),
            transparent
              calc(
                var(--ring-inner) - var(--ring-expand) + var(--ring-rim-w)
              ),
            transparent
              calc(
                var(--ring-outer) + var(--ring-expand) - var(--ring-rim-w)
              ),
            #000
              calc(
                var(--ring-outer) + var(--ring-expand) - var(--ring-rim-w)
              ),
            #000 calc(var(--ring-outer) + var(--ring-expand)),
            transparent calc(var(--ring-outer) + var(--ring-expand))
          );
          mask-image: radial-gradient(
            farthest-side,
            transparent calc(var(--ring-inner) - var(--ring-expand)),
            #000 calc(var(--ring-inner) - var(--ring-expand)),
            #000
              calc(
                var(--ring-inner) - var(--ring-expand) + var(--ring-rim-w)
              ),
            transparent
              calc(
                var(--ring-inner) - var(--ring-expand) + var(--ring-rim-w)
              ),
            transparent
              calc(
                var(--ring-outer) + var(--ring-expand) - var(--ring-rim-w)
              ),
            #000
              calc(
                var(--ring-outer) + var(--ring-expand) - var(--ring-rim-w)
              ),
            #000 calc(var(--ring-outer) + var(--ring-expand)),
            transparent calc(var(--ring-outer) + var(--ring-expand))
          );
        }
        /* Dim only siblings — :is/:has dimming outranked .hovered/.selected
           opacity:1 when applied to every .clock-ring. */
        .sun-light-clock-rings:is(
            :hover,
            :has(.clock-ring.selected),
            :has(.clock-ring.hovered)
          )
          .clock-ring:not(.hovered):not(.selected) {
          opacity: 0.5;
        }
        /* Hover/selected: stronger black shadow (2× blur), soft white rim.
           Keep rules separate — comma-grouped selectors failed to apply
           registered --ring-* props in the past. */
        .clock-ring.hovered {
          --ring-expand: 0%;
          --ring-rim-w: 1px;
          opacity: 1;
          filter:
            drop-shadow(0 4px 28px rgba(0, 0, 0, 0.75))
            drop-shadow(0 0 12px rgba(0, 0, 0, 0.45));
          z-index: 5;
        }
        .clock-ring.hovered::after {
          opacity: 1;
        }
        .clock-ring.selected {
          --ring-expand: 0%;
          --ring-rim-w: 1px;
          opacity: 1;
          filter:
            drop-shadow(0 4px 28px rgba(0, 0, 0, 0.75))
            drop-shadow(0 0 12px rgba(0, 0, 0, 0.45));
          z-index: 6;
        }
        .clock-ring.selected::after {
          opacity: 1;
        }
        /* Only one band highlighted: while hovering another ring, the
           selected ring yields (still .selected for sidebar sync). */
        .sun-light-clock-rings:has(.clock-ring.hovered)
          .clock-ring.selected:not(.hovered) {
          --ring-expand: 0%;
          --ring-rim-w: 0px;
          opacity: 0.5;
          filter: none;
          z-index: 1;
        }
        .sun-light-clock-rings:has(.clock-ring.hovered)
          .clock-ring.selected:not(.hovered)::after {
          opacity: 0;
        }
        .clock-ring.selected.hovered {
          z-index: 7;
        }
        /* Friendly name flush above the outer light-ring edge (rings are inset
           inside the core; do not anchor to --clock-chrome / face chrome). */
        .clock-ring-hover-name {
          position: absolute;
          left: 50%;
          top: ${CLOCK_RINGS_INSET_PCT}%;
          transform: translate(-50%, -100%);
          z-index: 10;
          pointer-events: none;
          max-width: min(80%, 14rem);
          padding: 6px 12px;
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--card-background-color) 88%,
            transparent
          );
          color: var(--primary-text-color);
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--divider-color) 70%, transparent),
            0 4px 14px rgba(0, 0, 0, 0.28);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.2;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .clock-ring-hover-name[hidden] {
          display: none;
        }
        .clock-ring-hover-caps {
          margin-left: 0.35em;
          color: var(--secondary-text-color);
          font-size: 0.82em;
          font-weight: 400;
        }
        .sun-light-clock-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: visible;
          z-index: 4;
          /* Own layer so sun/path moves do not dirty the static bloom/rings. */
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .sun-light-clock-handle-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: visible;
          z-index: 6;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .clock-horizon-sky .clock-sky-day {
          /* Fill set in JS from skyLook (Apple-like day sky blue). */
          fill: transparent;
        }
        .clock-horizon-sky .clock-sky-night {
          /* Sunset→sunrise shadow (outer night). Half prior mix so day/night
             fill stays readable; day/night *glow* is the conic opacity, not this. */
          fill: color-mix(in srgb, var(--clock-night-outer) 36%, transparent);
        }
        .clock-horizon-sky .clock-sky-deep {
          /* Dusk→dawn wrap (deeper band). */
          fill: color-mix(in srgb, var(--clock-night-deep) 39%, transparent);
        }
        .sun-light-clock-overlay .clock-sun-day {
          fill: none;
          stroke: #000;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-linejoin: round;
          stroke-linecap: round;
          opacity: 0.9;
        }
        .sun-light-clock-overlay .clock-sun-path-night {
          fill: none;
          stroke: #000;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-dasharray: 5 4;
          stroke-linejoin: round;
          stroke-linecap: round;
          opacity: 0.5;
        }
        .sun-light-clock-overlay .clock-event-dot {
          fill: #000;
          stroke: none;
        }
        /* Match night sun-path dash + opacity. */
        .sun-light-clock-overlay .clock-event-ray,
        .sun-light-clock-overlay .clock-event-clamp-link {
          fill: none;
          stroke: #000;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-dasharray: 5 4;
          stroke-linejoin: round;
          stroke-linecap: round;
          opacity: 0.5;
        }
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-sun-day {
          stroke: #e8eef8;
        }
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-sun-path-night,
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-event-ray,
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-event-clamp-link {
          stroke: #d8e0ff;
        }
        :host([data-dark-mode]) .sun-light-clock-overlay .clock-event-dot {
          fill: var(--primary-text-color);
        }
        .sun-light-clock-overlay .clock-handle,
        .sun-light-clock-handle-overlay .clock-handle {
          stroke: var(--primary-text-color);
          stroke-width: 1.5px;
          vector-effect: non-scaling-stroke;
          stroke-linecap: round;
          opacity: 0.85;
        }
        .sun-light-clock-overlay .clock-override-arc {
          fill: none;
          stroke: #fff;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-linecap: round;
          opacity: 0.88;
        }
        .sun-light-clock-overlay .clock-override-glow {
          pointer-events: none;
        }
        .clock-brightness-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
          overflow: visible;
        }
        .clock-brightness-overlay .clock-brightness-arc {
          fill: none;
          stroke: #fff;
          stroke-width: 1px;
          vector-effect: non-scaling-stroke;
          stroke-linecap: round;
          stroke-linejoin: round;
          /* Hint, not a second rim — quieter than time-override chrome. */
          opacity: 0.32;
        }
        :host(:not([data-dark-mode])) .clock-brightness-overlay .clock-brightness-arc {
          stroke: rgb(0 0 0 / 22%);
          opacity: 1;
        }
        .clock-brightness-overlay .clock-theme-bright-dot {
          fill: var(--card-background-color);
          stroke: var(--primary-text-color);
          stroke-width: 0.45;
          pointer-events: none;
        }
        .clock-brightness-overlay .clock-brightness-fill {
          pointer-events: none;
        }
        .clock-handle-hit {
          position: absolute;
          left: 50%;
          bottom: 50%;
          width: 22px;
          /* Tip only (planet rim → tick tips). A full center→rim spoke sat
             above the light rings and ate dial clicks along the sun angle. */
          height: ${((CLOCK_TICK_OUTER - CLOCK_RINGS_OUTER) / CLOCK_VIEW) * 100}%;
          margin-bottom: ${(CLOCK_RINGS_OUTER / CLOCK_VIEW) * 100}%;
          transform-origin: center bottom;
          transform: translateX(-50%) rotate(var(--handle-deg, 0deg));
          /* Below .sun-light-clock-rings (7) so the planet keeps ring picks. */
          z-index: 6;
          cursor: grab;
          pointer-events: auto;
          touch-action: none;
        }
        .clock-handle-hit:active,
        .clock-sun-hit:active {
          cursor: grabbing;
        }
        /* Visual sun under the handle; hit on top. SVG white fill + glow are
           day-wedge clipped (outline-only below the horizon). */
        .clock-sun {
          position: absolute;
          width: ${CLOCK_SUN_SIZE_PCT}%;
          height: ${CLOCK_SUN_SIZE_PCT}%;
          transform: translate(-50%, -50%) scale(var(--sun-scale, 1));
          pointer-events: none;
          z-index: 5;
          --sun-scale: 1;
        }
        .clock-sun > span {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .clock-sun-shadow {
          /* Shadow is SVG behind the fill so it never covers the white disc. */
          display: none;
        }
        .clock-sun-ring {
          inset: 0;
          border: 1.5px solid #fff;
          background: transparent;
          box-sizing: border-box;
          z-index: 2;
        }
        .sun-light-clock-overlay .clock-sun-fill {
          fill: #fff;
          pointer-events: none;
        }
        .sun-light-clock-overlay .clock-sun-glow-disc {
          pointer-events: none;
          /* Softness is in the SVG radial gradient — CSS filter:blur on a
             cx/cy-moved circle trails under Chromium while scrubbing. */
        }
        .sun-light-clock-overlay .clock-sun-shadow-disc {
          pointer-events: none;
        }
        .clock-sun-hit {
          position: absolute;
          width: ${CLOCK_SUN_SIZE_PCT}%;
          height: ${CLOCK_SUN_SIZE_PCT}%;
          transform: translate(-50%, -50%) scale(var(--sun-scale, 1));
          border-radius: 50%;
          pointer-events: auto;
          cursor: grab;
          touch-action: none;
          /* Below rings so an oversized night sun does not steal planet clicks. */
          z-index: 6;
        }
        /* Hourly ticks on the face; 00/06/12/18 are numerals, not ticks.
           Text-colored (not white) so light-mode sky wash stays readable;
           surface halo replaces the old black shadow. */
        .clock-face-ticks {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: visible;
          z-index: 5;
          filter:
            drop-shadow(
              0 0 8px
                color-mix(in srgb, var(--primary-background-color) 25%, transparent)
            )
            drop-shadow(
              0 1px 6px
                color-mix(in srgb, var(--primary-background-color) 25%, transparent)
            );
        }
        .clock-face-ticks .clock-tick {
          stroke: color-mix(in srgb, var(--primary-text-color) 28%, transparent);
          stroke-width: 2px;
          vector-effect: non-scaling-stroke;
          stroke-linecap: round;
        }
        /* Cardinal hour numerals sit on the old 6h tick tips (serif, not HA UI). */
        .clock-hour-label {
          position: absolute;
          transform: translate(-50%, -50%);
          font-family: "Iowan Old Style", "Palatino Linotype", Palatino,
            "Times New Roman", Times, serif;
          font-size: var(--clock-hour-size, 32px);
          font-weight: 400;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
          line-height: 1;
          color: color-mix(in srgb, var(--primary-text-color) 52%, transparent);
          pointer-events: none;
          z-index: 7;
          text-shadow:
            0 0 8px
              color-mix(in srgb, var(--primary-background-color) 25%, transparent),
            0 1px 6px
              color-mix(in srgb, var(--primary-background-color) 25%, transparent);
        }
        .clock-event-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 6;
        }
        .clock-event-anchor {
          position: absolute;
          width: 32px;
          height: 32px;
          transform: translate(-50%, -50%);
          z-index: 6;
          pointer-events: none;
        }
        .clock-event-meta {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 4px);
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          max-width: min(7.5rem, calc(var(--clock-chrome) * 2 - 8px));
          padding: 0 2px;
          text-align: center;
          pointer-events: none;
          white-space: nowrap;
          /* Surface halo — half strength so labels stay readable without a glow blob. */
          text-shadow:
            0 0 4px
              color-mix(in srgb, var(--primary-background-color) 50%, transparent),
            0 1px 2px
              color-mix(in srgb, var(--primary-background-color) 50%, transparent);
        }
        /* Collision placement: below the button (see _layoutClockEventMetas). */
        .clock-event-meta.below {
          bottom: auto;
          top: calc(100% + 4px);
        }
        .clock-event-meta .clock-event-heading {
          font-size: 10px;
          font-weight: 600;
          line-height: 1.15;
          color: var(--primary-text-color);
        }
        .clock-event-meta .clock-event-bright {
          font-size: 9px;
          font-variant-numeric: tabular-nums;
          line-height: 1.15;
          color: color-mix(in srgb, var(--primary-text-color) 70%, transparent);
        }
        .clock-event {
          position: absolute;
          inset: 0;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
          pointer-events: auto;
          cursor: pointer;
          padding: 0;
          font: inherit;
          transform-origin: center center;
          /* Radial brightness drag is along the spoke; do not let the face
             pan-y steal the gesture. */
          touch-action: none;
          transition:
            transform 160ms cubic-bezier(0.2, 0, 0, 1),
            box-shadow 160ms cubic-bezier(0.2, 0, 0, 1),
            border-color 160ms cubic-bezier(0.2, 0, 0, 1),
            background 160ms cubic-bezier(0.2, 0, 0, 1);
        }
        .clock-event.bright-dragging {
          cursor: grabbing;
          transition: none;
        }
        .clock-event:hover,
        .clock-event:focus-visible,
        .clock-event:active,
        .clock-event.selected {
          transform: scale(1.12);
          z-index: 1;
        }
        .clock-event:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
        .clock-event:hover:not(.selected):not(.missing),
        .clock-event:focus-visible:not(.selected):not(.missing) {
          border-color: var(--primary-color);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
        }
        .clock-event ha-icon {
          --mdc-icon-size: 18px;
        }
        /* True-solar stand-in when earliest-dusk moves the active button. */
        .clock-event-anchor.ghost {
          width: 22px;
          height: 22px;
          z-index: 5;
        }
        .clock-event.ghost {
          width: 22px;
          height: 22px;
          opacity: 0.48;
          cursor: default;
          pointer-events: none;
          box-shadow: none;
          border-style: dashed;
          background: color-mix(
            in srgb,
            var(--card-background-color) 70%,
            transparent
          );
          transform: none;
        }
        .clock-event.ghost:hover,
        .clock-event.ghost:focus-visible,
        .clock-event.ghost:active,
        .clock-event.ghost.selected {
          transform: none;
        }
        .clock-event.ghost ha-icon {
          --mdc-icon-size: 13px;
        }
        /* Missing native assignment used to warn here; v4 has no per-event scene pick. */
        .clock-event.missing {
          color: var(--warning-color, var(--error-color));
          border: 2px solid var(--warning-color, var(--error-color));
          background: color-mix(
            in srgb,
            var(--warning-color, var(--primary-color)) 18%,
            var(--card-background-color)
          );
          box-shadow:
            0 0 0 3px
              color-mix(
                in srgb,
                var(--warning-color, var(--primary-color)) 28%,
                transparent
              ),
            0 2px 8px rgba(0, 0, 0, 0.22);
        }
        .clock-event.selected {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px var(--primary-color);
        }
        .clock-event.missing.selected {
          border-color: var(--primary-color);
          box-shadow:
            0 0 0 2px var(--primary-color),
            0 0 0 5px
              color-mix(
                in srgb,
                var(--warning-color, var(--primary-color)) 28%,
                transparent
              ),
            0 2px 8px rgba(0, 0, 0, 0.22);
        }
        .sun-light-clock-legend {
          width: 100%;
          max-width: none;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          position: relative;
          z-index: 12;
          pointer-events: auto;
        }
        .sun-light-clock-legend:not(.event-bright-edit)
          .simple-light-tile:not(.tap-only) {
          cursor: pointer;
        }
        .sun-light-clock-legend .light-tiles-scroller {
          padding-left: 0;
          padding-right: 0;
        }
        .sun-light-clock-legend .light-tiles-hint {
          margin-top: 4px;
        }
        .sun-light-clock-legend .light-list-add {
          width: min(100%, 500px);
          margin-inline: auto;
        }
        .simple-light-selector.suggested {
          opacity: 0.92;
        }
        .simple-light-selector.removed {
          opacity: 0.68;
        }
        .simple-light-selector.unavailable {
          opacity: 0.55;
        }
        .simple-light-selector.unavailable:not(.caps-known) {
          filter: grayscale(1);
          pointer-events: none;
        }
        .sun-location-override {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          padding: 10px 12px;
          border-radius: var(--ha-border-radius-lg, 12px);
          border: 1px solid var(--warning-color, var(--primary-color));
          background: color-mix(
            in srgb,
            var(--warning-color, var(--primary-color)) 18%,
            var(--card-background-color)
          );
        }
        .sun-location-override[hidden] {
          display: none;
        }
        .sun-location-override ha-icon {
          --mdc-icon-size: 22px;
          color: var(--warning-color, var(--primary-color));
          flex-shrink: 0;
        }
        .sun-location-copy {
          flex: 1 1 auto;
          min-width: 0;
        }
        .sun-location-copy .title {
          font-size: 13px;
          font-weight: 600;
        }
        .sun-location-copy .coords {
          font-size: 12px;
          font-variant-numeric: tabular-nums;
          color: var(--secondary-text-color);
        }
        .location-dialog {
          --mdc-dialog-min-width: min(560px, 95vw);
        }
        .location-dialog ha-selector {
          display: block;
          margin-top: 8px;
        }
        .location-dialog p {
          margin: 0 0 8px;
          color: var(--secondary-text-color);
          font-size: 14px;
        }
        .location-search {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          margin: 8px 0;
        }
        .location-search ha-textfield,
        .location-search ha-selector,
        .location-search input {
          flex: 1;
          min-width: 0;
        }
        .location-search-results {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin: 0 0 8px;
        }
        .location-search-results button {
          margin: 0;
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: var(--ha-border-radius-lg, 12px);
          background: var(--secondary-background-color, var(--card-background-color));
          color: inherit;
          font: inherit;
          font-size: 13px;
          text-align: start;
          cursor: pointer;
        }
        .location-search-results button:hover {
          border-color: var(--primary-color);
        }
        .location-dialog .error {
          margin: 0 0 8px;
        }
        .sun-fallback-note {
          margin: 8px 16px 0;
          font-size: 13px;
          color: var(--secondary-text-color);
        }
        .light-scene-list {
          display: flex;
          flex-wrap: nowrap;
          gap: 6px;
          margin: 0 -24px 12px;
          padding: 0 24px 4px;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scroll-snap-type: x proximity;
        }
        .light-scene-list .sun-event {
          flex: 0 0 auto;
          min-width: 5.5rem;
          max-width: 9rem;
          padding: 6px 10px;
          gap: 1px;
          scroll-snap-align: start;
        }
        .light-scene-list .sun-event ha-icon {
          --mdc-icon-size: 16px;
        }
        .light-scene-list .sun-event .name {
          font-size: 11px;
          white-space: normal;
        }
        .light-scene-list .sun-event .time {
          font-size: 10px;
          white-space: normal;
        }
        .light-scene-list .sun-event[aria-current="true"] {
          border-color: var(--primary-color);
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
        }
        .sidebar-note {
          margin: 0 0 8px;
          font-size: 13px;
          line-height: 1.4;
          color: var(--secondary-text-color);
        }
        .theme-event-restore {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 12px;
          padding: 8px 10px;
          border: 0;
          border-radius: 8px;
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
          color: var(--primary-text-color);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        }
        .theme-event-restore[hidden] {
          display: none;
        }
        .theme-event-restore ha-icon {
          --mdc-icon-size: 18px;
          color: var(--primary-color);
        }
        .scene-theme-choice {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          margin: 0;
          padding: 6px;
          border: 0;
          border-radius: 12px;
          background: none;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .scene-theme-choice .theme-dial {
          width: 48px;
          height: 48px;
          flex: 0 0 auto;
          pointer-events: none;
        }
        .scene-theme-choice.selected .theme-dial {
          outline: 3px solid var(--primary-color);
          outline-offset: 3px;
        }
        .scene-gallery-card.scene-theme-card .theme-dial {
          position: absolute;
          inset: 0;
          width: auto;
          height: auto;
          border-radius: inherit;
          box-shadow: none;
          pointer-events: none;
        }
        .theme-edit-banner {
          color: var(--primary-text-color);
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
          border-radius: 8px;
          padding: 10px 12px;
          margin: 0 0 16px;
        }
        .scene-sidebar-footer .sidebar-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 0;
        }
        .scene-sidebar-footer .sidebar-note ha-icon {
          --mdc-icon-size: 18px;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .scene-sidebar-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
        }
        .hue-wheel-stage {
          position: relative;
          margin: 8px -8px 0;
          padding: 8px 8px 8px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
          --wheel-peek: 10%;
          --wheel-mixed-inner: 81%;
          --wheel-mixed-gap: 0%;
        }
        .hue-wheel-face {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
          width: 100%;
          min-width: 0;
          min-height: 0;
          flex: 1 1 auto;
        }
        .hue-wheel-canvas {
          position: relative;
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          aspect-ratio: 1;
          overflow: visible;
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
        }
        .wheel-mode-pill {
          box-sizing: border-box;
          display: flex;
          height: 48px;
          padding: 8px;
          gap: 8px;
          border-radius: 24px;
          box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
          background: var(--surface-2, var(--secondary-background-color, #242022));
          pointer-events: auto;
        }
        .wheel-mode-pill[hidden] {
          display: none !important;
        }
        .wheel-mode-pill .wheel-wrapper {
          box-sizing: border-box;
          width: 32px;
          height: 32px;
          margin: 0;
          padding: 2px;
          border-radius: 16px;
          border: 2px solid transparent;
          background: transparent;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
        }
        .wheel-mode-pill .wheel-wrapper:hover,
        .wheel-mode-pill .wheel-wrapper:active {
          background-color: var(--surface-2, var(--secondary-background-color, #242022));
        }
        .wheel-mode-pill .wheel-wrapper.active {
          border-color: #fff;
        }
        .wheel-mode-pill .wheel-wrapper.palette-add {
          border-color: transparent;
          color: var(--primary-text-color);
          -webkit-text-fill-color: var(--primary-text-color);
        }
        .wheel-mode-pill .wheel-wrapper.palette-add .wheel {
          box-sizing: border-box;
          display: grid;
          place-items: center;
          box-shadow: none;
          background: transparent;
          border: 2px dashed
            color-mix(in srgb, var(--primary-text-color) 55%, transparent);
          color: var(--primary-text-color);
        }
        .wheel-mode-pill .wheel-wrapper.palette-add ha-icon {
          --mdc-icon-size: 14px;
          width: 14px;
          height: 14px;
          color: var(--primary-text-color);
          -webkit-text-fill-color: var(--primary-text-color);
        }
        .wheel-mode-pill .wheel-wrapper.palette-active,
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.palette-active {
          width: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0;
          border-color: transparent;
          background: color-mix(in srgb, var(--primary-text-color) 12%, transparent);
        }
        .wheel-mode-pill .wheel-wrapper.palette-active .wheel,
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.palette-active .wheel {
          position: relative;
          /* Same drop shadow as the other mode swatches. The selection ring is
             the shared ::after, not a second stroke on the disc. */
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.15);
        }
        .wheel-mode-pill .wheel-wrapper.palette-active .wheel::after,
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.palette-active .wheel::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid #fff;
          opacity: 0.75;
          pointer-events: none;
        }
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.palette-active .wheel::after {
          border-color: var(--primary-color);
        }
        .wheel-palette-edit {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 24px;
          color: var(--primary-text-color);
        }
        .wheel-palette-edit ha-icon {
          --mdc-icon-size: 16px;
          width: 16px;
          height: 16px;
        }
        .wheel-mode-pill .wheel-wrapper[aria-disabled="true"] {
          cursor: default;
        }
        .wheel-mode-pill .wheel-wrapper.mode-unsupported .wheel {
          filter: grayscale(1);
        }
        .wheel-mode-pill .wheel-wrapper.mode-unsupported .wheel-mode-name {
          text-decoration: line-through;
        }
        .wheel-mode-pill .wheel {
          display: block;
          width: 24px;
          height: 24px;
          border-radius: 12px;
          background-size: cover;
          background-position: center;
          flex: 0 0 auto;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.15);
        }
        :host(:not([data-dark-mode])) .wheel-mode-pill .wheel-wrapper.active {
          border-color: var(--primary-color);
        }
        .wheel-mode-name {
          display: none;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          line-height: 1.2;
          color: var(--primary-text-color);
        }
        .hue-wheel-mode-cluster {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          flex: 0 0 auto;
        }
        .wheel-palette-randomize {
          flex: 0 0 auto;
          margin: 0;
          padding: 6px 10px;
          border: 0;
          border-radius: 16px;
          box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
          background: var(--surface-2, var(--secondary-background-color, #242022));
          color: var(--primary-text-color);
          font: inherit;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .wheel-palette-randomize[hidden] {
          display: none !important;
        }
        .library-editor {
          box-sizing: border-box;
          width: 100%;
          max-width: none;
          min-width: 0;
          min-height: 0;
          flex: 1 1 auto;
          margin: 0 auto;
          padding: 16px 8px 48px;
        }
        .library-name-field {
          display: block;
          margin: 8px 8px 16px;
          max-width: 650px;
        }
        .palette-slots {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 12px 0;
        }
        .palette-slot-row {
          display: grid;
          grid-template-columns: 36px 44px minmax(0, 1fr) 72px;
          gap: 8px;
          align-items: center;
        }
        .palette-slot-swatch {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.2);
        }
        .palette-slot-row input[type="color"] {
          width: 44px;
          height: 32px;
          padding: 0;
          border: 0;
          background: transparent;
        }
        .hue-wheel-glow,
        .hue-wheel-layer {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }
        .hue-wheel-glow {
          position: absolute;
          left: 0;
          top: 0;
          pointer-events: none;
          z-index: 0;
          transform: scale(1.1);
          transform-origin: center center;
          filter: blur(54px) saturate(1.45);
          opacity: 0.55;
        }
        :host(:not([data-dark-mode])) .hue-wheel-glow {
          opacity: 0.22;
        }
        .hue-wheel-disk {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }
        @property --disk-hole {
          syntax: "<percentage>";
          inherits: false;
          initial-value: 0%;
        }
        .hue-wheel-layer {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          transform-origin: center center;
          --disk-hole: 0%;
          /* Hole and scale share the pin's 480ms curve so a pin stays on its disk. */
          -webkit-mask-image: radial-gradient(
            farthest-side,
            transparent var(--disk-hole),
            #000 var(--disk-hole)
          );
          mask-image: radial-gradient(
            farthest-side,
            transparent var(--disk-hole),
            #000 var(--disk-hole)
          );
          transition:
            transform 480ms cubic-bezier(0.22, 1.15, 0.36, 1),
            --disk-hole 480ms cubic-bezier(0.22, 1.15, 0.36, 1);
        }
        .hue-wheel-disk.is-mid {
          z-index: 2;
        }
        .hue-wheel-disk.is-front {
          z-index: 3;
        }
        .hue-wheel-disk.is-back,
        .hue-wheel-disk.is-mid,
        .hue-wheel-disk.is-front {
          /* Shadow on the wrapper. A filter on the clipped canvas is masked
             away, so the overlap has no edge. */
          filter:
            drop-shadow(0 18px 28px rgba(0, 0, 0, 0.55))
            drop-shadow(0 6px 10px rgba(0, 0, 0, 0.4));
        }
        .hue-wheel-disk.is-back {
          z-index: 1;
        }
        :host(:not([data-dark-mode])) .hue-wheel-disk.is-back,
        :host(:not([data-dark-mode])) .hue-wheel-disk.is-mid,
        :host(:not([data-dark-mode])) .hue-wheel-disk.is-front {
          filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.22));
        }
        .hue-wheel-disk.is-drag-unavailable {
          opacity: 0.18;
        }
        .hue-wheel-svg {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          z-index: 4;
          color: white;
        }
        .hue-wheel-paths {
          pointer-events: none;
        }
        .hue-wheel-svg .hue-path-under {
          fill: none;
          stroke: rgba(0, 0, 0, 0.65);
          stroke-width: 6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .hue-wheel-svg .hue-path-mid {
          fill: none;
          stroke: rgba(255, 255, 255, 0.92);
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .hue-wheel-svg .hue-path-seg {
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .hue-wheel-svg .gm {
          cursor: pointer;
          transition: color 360ms ease;
        }
        .hue-wheel-svg .gm.expanded,
        .hue-wheel-svg .gm.drop-target {
          /* Above every resting dot. SVG paint order still follows the tree,
             so sync() also moves these groups to the end. */
          z-index: 2;
        }
        .hue-wheel-svg.pin-drag .gm {
          transition: none;
        }
        .hue-wheel-svg .pin-body {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          transform: rotate(180deg);
          scale: 0.2;
          opacity: 0;
          /* Collapse fades late so the shrink is the expand played backwards. */
          transition:
            scale 520ms cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 280ms ease 240ms;
        }
        .hue-wheel-svg .gm.expanded .pin-body,
        .hue-wheel-svg .gm.drop-target .pin-body {
          scale: 1;
          opacity: 1;
          transition:
            scale 520ms cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 280ms ease;
        }
        .hue-wheel-svg .gm.drag .pin-body {
          scale: 1.16;
          opacity: 1;
        }
        .hue-wheel-svg .pin-dot {
          opacity: 1;
          transition: opacity 280ms ease 240ms;
        }
        .hue-wheel-svg .gm.expanded .pin-dot,
        .hue-wheel-svg .gm.drop-target .pin-dot {
          opacity: 0;
          transition: opacity 280ms ease;
        }
        .hue-wheel-svg .pin-dot-outline {
          fill: #fff;
          filter: url(#se-dot-shadow);
        }
        .hue-wheel-svg .pin-dot-fill {
          fill: currentColor;
        }
        .hue-wheel-svg .group-count,
        .hue-wheel-svg .dot-icon {
          display: none;
        }
        .hue-wheel-svg .dot-icon-host {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .hue-wheel-svg .dot-icon-host ha-icon {
          --mdc-icon-size: 16px;
          width: 16px;
          height: 16px;
          color: inherit;
          --icon-primary-color: currentColor;
        }
        .hue-wheel-svg .group-ring {
          fill: color-mix(
            in srgb,
            var(--card-background-color, #1c1c1c) 48%,
            transparent
          );
          stroke: rgba(255, 255, 255, 0.92);
          stroke-width: 3;
          pointer-events: none;
        }
        .hue-wheel-layer {
          transition:
            transform 480ms cubic-bezier(0.22, 1.15, 0.36, 1),
            --disk-hole 480ms cubic-bezier(0.22, 1.15, 0.36, 1),
            opacity 280ms ease;
        }
        .hue-wheel-canvas.group-open .hue-wheel-layer {
          opacity: 0.38;
        }
        .hue-wheel-svg .pin-hit {
          pointer-events: all;
        }
        .hue-wheel-svg .marker-outline {
          fill: none;
          stroke: #fff;
          stroke-width: 2px;
          vector-effect: non-scaling-stroke;
          filter: url(#se-dot-shadow);
        }
        .hue-wheel-svg .marker {
          fill: currentColor;
        }
        .hue-wheel-svg .icon.text {
          font-size: 20px;
          font-weight: bold;
          paint-order: stroke fill;
        }
        .hue-wheel-svg .icon-fo {
          pointer-events: none;
          overflow: visible;
        }
        .hue-wheel-svg .pin-icon-host {
          box-sizing: border-box;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .hue-wheel-svg .pin-icon-host ha-icon,
        .hue-wheel-svg .pin-icon-host ha-state-icon {
          display: flex;
          width: 32px;
          height: 32px;
          --mdc-icon-size: 32px;
          color: inherit;
          --icon-primary-color: currentColor;
        }
        .hue-wheel-svg .gm.expanded .marker,
        .hue-wheel-svg .gm.drop-target .marker {
          filter: url(#se-active-shadow);
        }
        .hue-wheel-svg .marker-outline {
          opacity: 1;
          transition: opacity 280ms ease 240ms;
        }
        .hue-wheel-svg .gm.expanded .marker-outline,
        .hue-wheel-svg .gm.drop-target .marker-outline {
          opacity: 0;
          transition: opacity 280ms ease;
        }
        .hue-wheel-svg .pin-glyph {
          opacity: 1;
          transition: opacity 280ms ease;
        }
        .hue-wheel-svg .gm:not(.expanded):not(.drop-target) .pin-glyph {
          opacity: 0;
          transition: opacity 280ms ease 240ms;
        }
        @media (prefers-reduced-motion: reduce) {
          .hue-wheel-svg .gm,
          .hue-wheel-svg .pin-body {
            transition: none;
          }
        }
        .hue-wheel-chrome {
          position: relative;
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          pointer-events: none;
          z-index: 3;
        }
        .hue-wheel-chrome > * {
          pointer-events: auto;
        }
        .hue-wheel-float-readout {
          position: absolute;
          z-index: 4;
          transform: translate(-50%, calc(-100% - 6px));
          padding: 4px 8px;
          border-radius: 8px;
          background: color-mix(
            in srgb,
            var(--card-background-color, #1c1c1c) 92%,
            transparent
          );
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
          font-size: 0.75rem;
          font-variant-numeric: tabular-nums;
          line-height: 1.2;
          color: var(--primary-text-color);
          white-space: nowrap;
          pointer-events: none;
        }
        .hue-wheel-float-readout[hidden] {
          display: none !important;
        }
        .hue-palette-colors,
        .hue-palette-colors[hidden] {
          display: none !important;
        }
        .hue-presets[hidden],
        .hue-wheel-mode-cluster[hidden],
        .hue-wheel-chrome[hidden] {
          display: none !important;
        }
        .hue-wheel-mode-cluster,
        .hue-presets {
          transition:
            opacity 180ms cubic-bezier(0.2, 0, 0, 1),
            transform 180ms cubic-bezier(0.2, 0, 0, 1);
        }
        .simple-editor:not(.chrome-aside) .hue-wheel-mode-cluster:not(.is-shown) {
          opacity: 0;
          transform: translateX(-24px);
          pointer-events: none;
        }
        .simple-editor:not(.chrome-aside) .hue-presets:not(.is-shown) {
          opacity: 0;
          transform: translateX(24px);
          pointer-events: none;
        }
        .hue-presets {
          box-sizing: border-box;
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          min-height: 48px;
          padding: 8px;
          gap: 8px;
          min-width: 0;
          width: max-content;
          max-width: 100%;
          border-radius: 24px;
          box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.4);
          background: var(--surface-2, var(--secondary-background-color, #242022));
          position: relative;
          flex: 0 1 auto;
          justify-content: flex-end;
          overflow: hidden;
          padding: 10px 6px;
        }
        .hue-preset-edit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: 4px;
          color: inherit;
          cursor: pointer;
        }
        .hue-preset-edit ha-icon {
          --mdc-icon-size: 16px;
        }
        .hue-presets-track {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 8px;
          min-width: 0;
          width: max-content;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
        }
        .hue-presets::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 32px;
          pointer-events: none;
          opacity: 0;
          border-radius: 0 20px 20px 0;
          background: linear-gradient(
            to right,
            transparent,
            var(--secondary-background-color, #242022)
          );
          box-shadow: inset -10px 0 12px -8px rgba(0, 0, 0, 0.45);
          transition: opacity 160ms cubic-bezier(0.2, 0, 0, 1);
        }
        .hue-presets.can-scroll-end::after {
          opacity: 1;
        }
        .hue-preset {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          margin: 0;
          padding: 2px;
          border-radius: 50%;
          border: 2px solid transparent;
          background: transparent;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
        }
        .hue-preset-swatch {
          position: relative;
          display: block;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          flex: 0 0 auto;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.4),
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.15);
        }
        .hue-preset-name {
          display: none;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          line-height: 1.2;
          color: var(--primary-text-color);
          text-align: start;
        }
        .hue-preset:hover {
          border-color: rgba(255, 255, 255, 0.45);
        }
        .hue-preset.active {
          border-color: #fff;
        }
        :host(:not([data-dark-mode])) .hue-preset.active {
          border-color: var(--primary-color);
        }
        .hue-preset {
          background-clip: content-box;
          background-origin: content-box;
        }
        .hue-preset.add {
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border-color: transparent;
          opacity: 0.8;
        }
        .hue-preset.add:hover {
          opacity: 1;
        }
        .hue-preset-add-face {
          box-sizing: border-box;
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px dashed
            color-mix(in srgb, var(--primary-text-color) 55%, transparent);
          flex: 0 0 auto;
        }
        .hue-preset.add,
        .hue-preset.add ha-icon {
          color: var(--primary-text-color);
          -webkit-text-fill-color: var(--primary-text-color);
        }
        .hue-preset.add ha-icon {
          --mdc-icon-size: 14px;
          width: 14px;
          height: 14px;
          transform: translateY(-2px);
        }
        .light-brightness-graph {
          position: relative;
          width: 100%;
          margin: 0 0 12px;
          user-select: none;
          /* Title/subtitle may start a page scroll; the plot locks pan. */
          touch-action: pan-y;
        }
        .light-brightness-graph-heading {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin: 0 0 6px;
        }
        .light-brightness-graph-title {
          font-size: 14px;
          font-weight: 500;
          line-height: 1.25;
          color: var(--primary-text-color);
        }
        .light-brightness-graph-sub {
          font-size: 12px;
          line-height: 1.25;
          color: var(--secondary-text-color);
        }
        .light-onoff-graph {
          margin: 12px 0;
        }
        .light-onoff-events {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 1px;
        }
        .light-onoff-event {
          display: flex;
          flex: 1 0 64px;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 10px 6px;
          border: 1px solid var(--divider-color);
          border-radius: 12px;
          background: var(--card-background-color);
          color: var(--secondary-text-color);
          font: inherit;
          cursor: pointer;
        }
        .light-onoff-event.is-on {
          border-color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 12%, var(--card-background-color));
          color: var(--primary-text-color);
        }
        .light-onoff-event.is-active {
          box-shadow: 0 0 0 1px var(--primary-color);
        }
        .light-onoff-event:disabled {
          opacity: 0.45;
          cursor: default;
        }
        .light-onoff-event-name {
          font-size: 11px;
        }
        .light-onoff-event-state {
          font-size: 13px;
          font-weight: 600;
        }
        .light-brightness-graph-plot {
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
        }
        .light-brightness-graph svg {
          display: block;
          width: 100%;
          height: 120px;
          overflow: visible;
          touch-action: none;
        }
        .light-brightness-graph .bg-frame {
          fill: color-mix(
            in srgb,
            var(--secondary-text-color) 10%,
            var(--card-background-color)
          );
          stroke: var(--divider-color);
          stroke-width: 1;
        }
        .light-brightness-graph .fill-area {
          stroke: none;
        }
        .light-brightness-graph .curve {
          fill: none;
          stroke: var(--primary-text-color);
          stroke-width: 1.5;
          stroke-linejoin: round;
          stroke-linecap: round;
          opacity: 0.55;
        }
        .light-brightness-graph .handle {
          cursor: ns-resize;
        }
        .light-brightness-graph .handle.add {
          cursor: pointer;
        }
        .light-brightness-graph .handle-hit {
          fill: transparent;
          stroke: none;
        }
        .light-brightness-graph .handle-dot {
          fill: var(--card-background-color);
          stroke: var(--primary-text-color);
          stroke-width: 2;
        }
        .light-brightness-graph .handle.active .handle-dot {
          stroke: var(--primary-color);
          stroke-width: 2.5;
        }
        .light-brightness-graph .handle.add .handle-dot {
          stroke: var(--primary-color);
          stroke-dasharray: 3 2;
        }
        .light-brightness-graph .theme-curve-halo {
          stroke: var(--card-background-color);
          stroke-width: 5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .light-brightness-graph .theme-curve {
          stroke: var(--primary-text-color);
          stroke-width: 1.6;
          stroke-dasharray: 5 3.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: 0.92;
        }
        .light-brightness-graph .theme-dot {
          fill: var(--card-background-color);
          stroke: var(--primary-text-color);
          stroke-width: 1.6;
          pointer-events: none;
        }
        .light-overrides {
          margin-top: 14px;
        }
        .light-overrides-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--secondary-text-color);
          margin-bottom: 6px;
        }
        .light-override-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          width: 100%;
          padding: 8px 0;
          border: 0;
          border-bottom: 1px solid var(--divider-color);
          background: none;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .light-override-row:last-child {
          border-bottom: 0;
        }
        .light-override-name {
          font-weight: 500;
        }
        .light-override-meta {
          font-size: 0.75rem;
          color: var(--secondary-text-color);
        }
        .light-brightness-graph .handle-fill {
          stroke: none;
        }
        .light-brightness-graph .handle-label {
          fill: var(--secondary-text-color);
          font-size: 10px;
          text-anchor: middle;
          pointer-events: none;
        }
        .light-dialog ha-selector,
        .light-dialog ha-switch,
        .event-dialog ha-selector,
        .event-dialog ha-switch,
        .scene-sidebar-body ha-selector,
        .scene-sidebar-body ha-switch {
          display: block;
          margin-top: 16px;
        }
        .scene-sidebar.desktop {
          --scene-sidebar-surface: color-mix(
            in srgb,
            var(--primary-background-color) 58%,
            transparent
          );
          --ha-card-border-radius: var(
            --ha-dialog-border-radius,
            var(--ha-border-radius-2xl, 28px)
          );
          position: absolute;
          z-index: 16;
          top: calc(var(--header-height, 64px) + 16px);
          right: calc(16px + var(--safe-area-inset-right, 0px));
          width: var(--scene-sidebar-width, 375px);
          height: calc(
            100% - var(--header-height, 64px) - 32px -
              var(--safe-area-inset-bottom, 0px)
          );
          outline: none;
          pointer-events: none;
          transform: translateX(100%);
          opacity: 0;
          transition:
            transform ${SIDEBAR_ANIMATION_MS}ms cubic-bezier(0.2, 0, 0, 1),
            opacity ${SIDEBAR_ANIMATION_MS}ms cubic-bezier(0.2, 0, 0, 1);
        }
        .scene-sidebar.desktop.open {
          pointer-events: auto;
          transform: translateX(0);
          opacity: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .scene-sidebar.desktop {
            transition-duration: 1ms;
          }
          .page-shell,
          .fab {
            transition-duration: 1ms;
          }
          .sun-light-clock-rings,
          .scene-sidebar-body,
          .scene-sidebar-footer,
          .hue-presets::after,
          .hue-wheel-mode-cluster,
          .hue-presets,
          .hue-wheel-chrome {
            transition-duration: 1ms;
          }
        }
        .scene-sidebar-body,
        .scene-sidebar-footer {
          transition: opacity ${SIDEBAR_SWAP_MS}ms cubic-bezier(0.2, 0, 0, 1);
        }
        .scene-sidebar-body.sidebar-pane-leave,
        .scene-sidebar-footer.sidebar-pane-leave,
        .scene-sidebar-body.sidebar-pane-enter,
        .scene-sidebar-footer.sidebar-pane-enter {
          opacity: 0;
        }
        .scene-sidebar.mobile {
          --ha-bottom-sheet-surface-background: var(--card-background-color);
          --ha-card-border-radius: var(
            --ha-dialog-border-radius,
            var(--ha-border-radius-2xl, 28px)
          );
        }
        .scene-sidebar-card {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-color: var(--primary-color);
          border-width: 2px;
          --ha-card-border-width: 2px;
          --ha-card-border-color: var(--primary-color);
        }
        .scene-sidebar.desktop .scene-sidebar-card {
          --ha-card-background: var(--scene-sidebar-surface);
          --ha-dialog-surface-background: transparent;
          background: var(--scene-sidebar-surface);
          backdrop-filter: blur(18px) saturate(1.2);
          -webkit-backdrop-filter: blur(18px) saturate(1.2);
        }
        .scene-sidebar.desktop
          .scene-sidebar-footer:has(.sidebar-actions-bar) {
          background: transparent;
        }
        .scene-sidebar-card ha-dialog-header {
          border-radius: var(--ha-card-border-radius);
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }
        .scene-sidebar-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
          padding: 0 24px 16px;
        }
        .scene-sidebar-footer {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          gap: 12px;
          padding: 12px 16px 16px;
          flex-shrink: 0;
        }
        .scene-sidebar .dusk-minimum-row {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
          margin-top: 16px;
          box-sizing: border-box;
        }
        .scene-sidebar .dusk-minimum-row ha-selector {
          width: 100%;
        }
        /* ha-selector's own top margin is the field label's slot. The title
           already sits above this row, so the flex gap is the only space. */
        .dusk-minimum-row ha-selector {
          margin-top: 0;
        }
        .scene-sidebar-footer:has(.sidebar-actions-bar) {
          flex-direction: column;
          justify-content: flex-start;
          align-items: stretch;
          gap: 0;
          padding: 0;
          border-top: 1px solid var(--divider-color);
          background: var(--card-background-color);
        }
        /* Beat ha-bottom-sheet ::slotted(footer) { justify-content: flex-end }. */
        .scene-sidebar.mobile .scene-sidebar-footer:has(.sidebar-actions-bar) {
          justify-content: flex-start;
          align-items: stretch;
          padding: 0;
        }
        /* Undo/redo first, then live preview + activate — left-aligned. */
        .sidebar-actions-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-start;
          gap: 4px 8px;
          padding: 8px 12px calc(12px + var(--safe-area-inset-bottom, 0px));
          background: var(--card-background-color);
        }
        .sidebar-actions-bar .live-edit-toggle {
          margin-inline-start: 4px;
        }
        .sidebar-actions-bar .activate-scene-btn {
          margin-inline-end: 4px;
        }
        .sidebar-remove-light {
          margin-top: 20px;
          padding-top: 12px;
          border-top: 1px solid var(--divider-color);
        }
        .sidebar-remove-light .remove-light-from-scene-btn {
          --ha-button-width: 100%;
        }
        .light-effect-row {
          display: flex;
          justify-content: center;
          margin: 16px 0 4px;
        }
        .light-effect-row ha-control-select-menu,
        .light-effect-row ha-more-info-control-select-container {
          min-width: 160px;
          max-width: 220px;
          width: 100%;
        }
        .light-list-add {
          display: flex;
          justify-content: center;
          padding: 12px 8px 4px;
        }
        /* Shrink-wrap to the add button — a fixed picker width left-aligns
           the slotted ha-button inside ha-generic-picker’s full-width container. */
        .light-list-add ha-entity-picker {
          width: fit-content;
          max-width: 100%;
        }
        .light-add-picker-host {
          position: absolute;
          left: 50%;
          bottom: 8px;
          width: min(280px, calc(100% - 16px));
          transform: translateX(-50%);
          /* Keep the field out of layout chrome; popover still anchors here. */
          opacity: 0;
          pointer-events: none;
          z-index: 5;
        }
        .light-add-picker-host.is-menu {
          opacity: 1;
          pointer-events: auto;
          z-index: 30;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-sizing: border-box;
          padding: 8px;
          max-height: min(360px, 50vh);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          border-radius: 12px;
          box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.35));
        }
        .light-add-menu-search {
          box-sizing: border-box;
          width: 100%;
          margin: 0;
          padding: 8px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font: inherit;
        }
        .light-add-menu-list {
          overflow: auto;
          min-height: 0;
        }
        .light-add-menu-area {
          padding: 8px 8px 2px;
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }
        .light-add-menu-item {
          display: block;
          width: 100%;
          margin: 0;
          padding: 8px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--primary-text-color);
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .light-add-menu-item:hover,
        .light-add-menu-item:focus-visible {
          background: var(--secondary-background-color);
        }
        .settings-reset {
          margin-top: 24px;
        }
        .light-list-add ha-button {
          --mdc-typography-button-text-transform: none;
        }
        .live-edit-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          padding: 0 4px;
          color: var(--primary-text-color);
          font: inherit;
          font-size: 14px;
          cursor: pointer;
          user-select: none;
        }
        .live-edit-toggle[hidden] {
          display: none !important;
        }
        .overflow-live-edit {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-sizing: border-box;
          min-height: 48px;
          padding: 8px 16px;
          color: var(--primary-text-color);
        }
        .overflow-live-edit ha-switch {
          --mdc-switch-track-width: 36px;
        }
        .live-edit-toggle ha-switch {
          --mdc-switch-track-width: 36px;
        }
        .scene-palette-dialog {
          /* Dialog content padding sits outside this list and clips the
             card shadow, leaves a band above the footer, and shrinks the
             view. The inset lives on the scroller instead. */
          --dialog-content-padding: 0;
        }
        .scene-palette-dialog .scene-palette-hint {
          margin: 0;
          padding: 0 0 12px;
          color: var(--secondary-text-color);
          font-size: 14px;
          line-height: 20px;
        }
        .scene-palette-body {
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          min-height: 240px;
          /* wa-dialog tops out at 100dvh - 80px. Header and footer are 68px
             each, so this is the content band. A taller body makes that
             dialog scroll and clips the card shadow above the footer. */
          height: calc(100dvh - 216px);
          max-height: calc(100dvh - 216px);
          overflow: hidden;
        }
        .scene-palette-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1 1 auto;
          min-height: 0;
          max-height: none;
          overflow-x: hidden;
          overflow-y: auto;
          /* Inside the scroller, so scale(1.1) and the 32px shadow are not
             clipped and this inset does not sit between the list and the footer. */
          padding: 16px 20px 20px;
          box-sizing: border-box;
        }
        .scene-palette-dialog .live-edit-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-inline-start: auto;
        }
        .scene-palette-choice {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .scene-palette-none {
          align-self: flex-start;
          padding: 6px 10px;
          border: 2px solid transparent;
          border-radius: 10px;
          background: none;
          color: var(--primary-text-color);
          font: inherit;
          cursor: pointer;
        }
        .scene-palette-none.selected {
          border-color: var(--primary-color);
        }
        .scene-theme-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: min(480px, 60vh);
          overflow: auto;
        }
        .scene-theme-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 2px solid transparent;
          border-radius: 10px;
          background: none;
          color: var(--primary-text-color);
          font: inherit;
          text-align: start;
          cursor: pointer;
        }
        .scene-theme-row.selected {
          border-color: var(--primary-color);
        }
        .scene-palette-randomize[hidden] {
          display: none !important;
        }
        .scene-gallery-label {
          margin: 14px 0 8px;
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .scene-palette-list > .scene-gallery-label:first-child {
          margin-top: 0;
        }
        .scene-palette-list .scene-cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          width: 100%;
          box-sizing: border-box;
          flex-wrap: wrap;
          overflow: visible;
          padding: 0;
        }
        .scene-palette-list .scene-card-slot {
          width: auto;
          max-width: none;
          max-height: none;
          flex: none;
        }
        .scene-palette-list .scene-card {
          max-width: none;
          max-height: none;
        }
        .scene-gallery-grid {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 12px;
        }
        .scene-gallery-slot,
        .scene-gallery-grid > .scene-gallery-card {
          display: block;
          min-width: 0;
          width: calc(50% - 6px);
          max-width: 155px;
        }
        .scene-palette-randomize-label {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.45);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          pointer-events: none;
        }
        .scene-palette-randomize-label ha-icon {
          --mdc-icon-size: 14px;
          width: 14px;
          height: 14px;
        }
        .scene-palette-randomize-label[hidden] {
          display: none !important;
        }
        .var-chip {
          position: relative;
        }
        .scene-gallery-card {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 1;
          max-height: 155px;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 16px;
          overflow: hidden;
          appearance: none;
          background: var(--surface-2, #242022);
          color: #fff;
          cursor: pointer;
        }
        .scene-gallery-card::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1;
          height: 46%;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.62) 0%,
            rgba(0, 0, 0, 0.22) 62%,
            transparent 100%
          );
          pointer-events: none;
        }
        .scene-gallery-card.selected {
          outline: 3px solid var(--primary-color);
          outline-offset: 3px;
        }
        .scene-gallery-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          border: 0;
        }
        .scene-gallery-card > span:not(.scene-palette-randomize-label) {
          position: absolute;
          left: 10px;
          right: 10px;
          bottom: 10px;
          z-index: 2;
          font-size: 14px;
          font-weight: 650;
          line-height: 1.2;
          text-align: left;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
        }
        @media (max-width: 870px) {
          .scene-gallery-grid {
            flex-wrap: nowrap;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            padding-bottom: 4px;
          }
          .scene-gallery-slot,
          .scene-gallery-grid > .scene-gallery-card {
            flex: 0 0 calc(50% - 6px);
          }
        }
        .dialog-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
        }
        .event-scene-field {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          margin-top: 16px;
        }
        .event-scene-field ha-selector {
          flex: 1;
          min-width: 0;
          margin-top: 0;
        }
        .event-scene-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .event-scene-hint,
        .event-scene-error {
          margin: 8px 0 0;
          font-size: 14px;
          line-height: 20px;
        }
        .event-scene-hint {
          color: var(--secondary-text-color);
        }
        .event-scene-error {
          color: var(--error-color);
        }
        .sun-event {
          flex: 1 1 0;
          min-width: 0;
          max-width: 10.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 2px;
          margin: 0;
          padding: 10px 8px;
          border: 1px solid transparent;
          border-radius: var(--ha-border-radius-lg, 12px);
          background: transparent;
          color: inherit;
          font: inherit;
          cursor: default;
        }
        .sun-event.clickable {
          cursor: pointer;
          background: var(--secondary-background-color, var(--card-background-color));
          border-color: var(--divider-color);
          box-shadow: var(--ha-box-shadow-s, 0 1px 2px rgba(0, 0, 0, 0.18));
          transform-origin: center center;
          transition:
            transform 160ms cubic-bezier(0.2, 0, 0, 1),
            border-color 160ms cubic-bezier(0.2, 0, 0, 1),
            background 160ms cubic-bezier(0.2, 0, 0, 1),
            box-shadow 160ms cubic-bezier(0.2, 0, 0, 1);
        }
        .sun-event.clickable:hover,
        .sun-event.clickable:focus-visible,
        .sun-event.clickable:active,
        .sun-event.clickable.selected {
          transform: scale(1.04);
        }
        .sun-event.clickable:hover {
          border-color: var(--primary-color);
          background: var(--card-background-color);
        }
        .sun-event.clickable:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
        .sun-event.clickable.missing {
          border: 2px solid var(--warning-color, var(--accent-color, var(--primary-color)));
          background: color-mix(
            in srgb,
            var(--warning-color, var(--primary-color)) 16%,
            var(--card-background-color)
          );
          box-shadow: none;
        }
        .sun-event.clickable.missing:hover {
          background: color-mix(
            in srgb,
            var(--warning-color, var(--primary-color)) 24%,
            var(--card-background-color)
          );
        }
        .sun-event.clickable.selected {
          border-color: var(--primary-color);
          border-width: 2px;
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
        }
        .sun-event.clickable.missing.selected {
          border-color: var(--primary-color);
        }
        .sun-event ha-icon {
          --mdc-icon-size: 22px;
          color: var(--primary-text-color);
        }
        .sun-event .name {
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }
        .sun-event .time {
          font-size: 12px;
          color: var(--secondary-text-color);
          font-variant-numeric: tabular-nums;
        }
        .sun-event .time .solar-struck {
          text-decoration: line-through;
          opacity: 0.65;
          margin-right: 0.35em;
        }
        .sun-event .time .clamp-time {
          color: var(--primary-text-color);
          font-weight: 600;
        }
        .sun-hover-readout {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 16px;
          min-height: 36px;
          padding: 4px 16px 8px;
          font-size: 13px;
          font-variant-numeric: tabular-nums;
          color: var(--secondary-text-color);
        }
        .sun-hover-readout[data-active] {
          color: var(--primary-text-color);
        }
        /* Dial: readout/chips live in .sun-toolbar (full stage width). Table
           view still puts the readout in .sun-path-body under the chart. */
        .sun-path.dial-view .sun-path-body {
          position: relative;
          width: 100%;
        }
        .sun-path.dial-view .sun-hover-readout {
          position: relative;
          top: auto;
          left: auto;
          z-index: 4;
          min-height: 0;
          margin: 0;
          padding: 8px 12px 8px 8px;
          pointer-events: none;
          color: var(--primary-text-color);
        }
        .sun-hover-time {
          font-weight: 500;
        }
        .sun-hover-play-split,
        .sun-hover-reset {
          pointer-events: auto;
          color: var(--primary-text-color);
          font: inherit;
        }
        .sun-hover-play-split {
          display: inline-flex;
          align-items: stretch;
          height: 32px;
          border-radius: 16px;
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
        }
        .sun-hover-play-main,
        .sun-hover-play-more {
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font: inherit;
        }
        .sun-hover-play-main {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 8px 0 10px;
          border-radius: 16px 0 0 16px;
        }
        .sun-hover-play-label {
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
        }
        .sun-hover-play-more {
          display: inline-grid;
          place-items: center;
          width: 28px;
          border-inline-start: 1px solid color-mix(
            in srgb,
            var(--primary-text-color) 18%,
            transparent
          );
          border-radius: 0 16px 16px 0;
        }
        .sun-hover-play-main:hover,
        .sun-hover-play-more:hover,
        .sun-hover-reset:hover {
          background: color-mix(
            in srgb,
            var(--primary-color) 24%,
            var(--card-background-color)
          );
        }
        .sun-hover-play-split ha-icon,
        .sun-hover-reset ha-icon {
          --mdc-icon-size: 18px;
        }
        .sun-hover-play-more-wrap {
          display: flex;
          align-items: stretch;
          pointer-events: auto;
        }
        .sun-hover-play-split ha-dropdown {
          display: flex;
          align-items: stretch;
          pointer-events: auto;
        }
        .sun-hover-reset {
          display: inline-grid;
          place-items: center;
          width: 32px;
          height: 32px;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: color-mix(
            in srgb,
            var(--primary-color) 14%,
            var(--card-background-color)
          );
        }
        .sun-plots {
          position: relative;
          cursor: crosshair;
        }
        .sun-now-line,
        .sun-hover-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          margin-left: -1px;
          pointer-events: none;
        }
        .sun-now-line {
          background: var(--primary-color);
          z-index: 2;
        }
        .sun-hover-line {
          background: var(--primary-text-color);
          opacity: 0.55;
          z-index: 3;
          display: none;
        }
        .sun-plots[data-hovering] .sun-hover-line {
          display: block;
        }
        .sun-now {
          position: absolute;
          width: 10px;
          height: 10px;
          margin-left: -5px;
          margin-top: -5px;
          border-radius: 50%;
          background: var(--primary-color);
          border: 2px solid var(--card-background-color);
          box-sizing: border-box;
          pointer-events: none;
        }
        .sun-dot {
          position: absolute;
          width: 9px;
          height: 9px;
          margin-left: -4.5px;
          margin-top: -4.5px;
          border-radius: 50%;
          background: transparent;
          border: 2px solid var(--secondary-text-color);
          box-sizing: border-box;
          pointer-events: none;
          opacity: 0.55;
        }
        .sun-dot.clamp-tick {
          width: 6px;
          height: 6px;
          margin-left: -3px;
          margin-top: -3px;
          border-width: 1.5px;
          border-style: dashed;
          border-color: var(--secondary-text-color);
          background: transparent;
          opacity: 0.75;
        }
        .sun-clamp-link {
          position: absolute;
          height: 0;
          border: none;
          border-top: 1px dashed var(--secondary-text-color);
          opacity: 0.55;
          pointer-events: none;
          transform-origin: left center;
        }
        .page-shell {
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding-right: var(--scene-sidebar-gutter);
          overflow-x: clip;
          overflow-y: hidden;
        }
        .page {
          --page-max-width: 1024px;
          max-width: var(--page-max-width);
          width: 100%;
          margin-inline: auto;
          padding-inline: 12px;
          box-sizing: border-box;
        }
        /* Narrow editors drop the area rail and mount straight in .page.
           The 12px inset kept tiles and the dial off the screen edge.
           The editor fills the shell: the wheel grows, the tiles stay at the bottom. */
        :host([narrow]) .page {
          padding-inline: 0;
        }
        :host([narrow]) .page:has(.content.wide),
        :host([narrow]) .page.dial-wide {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          max-width: none;
          padding-bottom: 0;
        }
        /* The dial page also has an empty .content.wide, so :has(.content.wide)
           matches it and is more specific than .page.dial-wide. */
        :host([narrow]) .page:has(.content.wide):not(.dial-wide) {
          overflow: hidden;
        }
        /* The face shrinks to the leftover height. The page does not scroll. */
        :host([narrow]) .page.dial-wide {
          overflow: hidden;
        }
        :host([narrow]) .content.wide {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
        }
        /* Dial pages keep an empty .content beside the sun path. The fill
           rule above would split the column with it and shrink the dial. */
        :host([narrow]) .page.dial-wide > .content:empty {
          display: none;
          flex: none;
        }
        :host([narrow]) .page.dial-wide > .sun-path.dial-view {
          flex: 1 1 auto;
          min-height: 0;
          min-width: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          /* Tile-strip bleed padding hangs out of the column. Clip it so that
             padding is not extra scroll while the face still fits. Plates that
             slide up over the dial stay inside this box. */
          overflow: clip;
        }
        :host([narrow]) .sun-path.dial-view .sun-toolbar {
          flex: 0 0 auto;
        }
        :host([narrow]) .sun-chip-row,
        :host([narrow]) .sun-toolbar-chrome .sun-chip-row {
          display: none;
        }
        :host([narrow]) .sun-path.dial-view .sun-year-scrub {
          margin-bottom: 16px;
        }
        :host([narrow]) .sun-path.dial-view .sun-date-tools {
          flex-wrap: nowrap;
          width: 100%;
        }
        :host([narrow]) .sun-path.dial-view .sun-date-tools .sun-hover-readout {
          position: static;
          flex: 1 1 auto;
          justify-content: flex-end;
          flex-wrap: nowrap;
          min-height: 0;
          margin: 0;
          padding: 0;
          gap: 8px 12px;
        }
        :host([narrow]) .sun-hover-play-split {
          display: none;
        }
        @media (max-width: 870px) {
          .sun-chip-row,
          .sun-toolbar-chrome .sun-chip-row {
            display: none;
          }
          .sun-path.dial-view .sun-year-scrub {
            margin-bottom: 16px;
          }
        }
        :host([narrow]) .sun-path.dial-view .sun-path-stage,
        :host([narrow]) .sun-path.dial-view .sun-path-body,
        :host([narrow]) .sun-path.dial-view .sun-light-clock {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        :host([narrow]) .sun-path.dial-view .sun-light-clock {
          padding: 0;
          gap: 0;
          justify-content: flex-start;
          /* The face may shrink below the color-wheel floor so the tiles fit.
             No extra pad: auto margins center the face between the date and tiles. */
          min-height: 0;
          flex: 1 1 auto;
          container-type: size;
        }
        :host([narrow]) .sun-path.dial-view .sun-light-clock-legend {
          flex: 0 0 auto;
          width: 100%;
          margin-top: 0;
          padding-bottom: var(--scene-safe-bottom, 0px);
        }
        :host([narrow]) .sun-light-clock-face {
          flex: 0 0 auto;
          /* --dial-face-max is the leftover height. margin-block centers the
             face in the space above the tiles; the legend stays at the bottom. */
          width: min(100%, var(--dial-face-max, 100%));
          max-width: 100%;
          height: auto;
          max-height: var(--dial-face-max, none);
          margin-inline: 0;
          margin-block: auto;
        }
        /* Workspace (rail + .stage-col) always uses the full panel — same
           shell as the circadian dial, including simple/variable editors. */
        .page:has(.workspace),
        .page.dial-wide {
          --page-max-width: none;
          max-width: none;
          padding-inline: 0;
          /* Extend under the sidebar gutter; in-flow content keeps padding so
             the dial still shifts left while horizon backgrounds span full width. */
          margin-right: calc(-1 * var(--scene-sidebar-gutter));
          width: calc(100% + var(--scene-sidebar-gutter));
          padding-right: var(--scene-sidebar-gutter);
          /* No FAB pad. The name button floats, and a bottom pad would lift
             the light tiles off the shell. Workspace pages also must not pad:
             the pad shrinks the flex content box while the workspace is sized
             to the shell, so overflow:hidden clips the scenes list and editor. */
          padding-bottom: 0;
          box-sizing: border-box;
          position: relative;
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          /* The shell clips. This page fills it so the scenes list and the
             editor body scroll inside, instead of growing past the panel. */
          overflow: hidden;
        }
        /* Clip X on the wide page. Horizon may bleed under the frosted rail;
           height is capped in _layoutClockHorizonBack. */
        .page:has(.workspace) {
          padding-bottom: 0;
        }
        .page:has(.workspace),
        .page.dial-wide {
          overflow-x: clip;
        }
        /* Keep full-panel backgrounds at workspace width. Only the content
           stage yields to the overlay drawer, so horizon graphics remain
           visible beneath its translucent surface. */
        :host([data-sidebar-docked]) .workspace .stage-col {
          margin-right: var(--scene-sidebar-content-gutter);
        }
        /* Sidebar open: keep path/face overflow visible for chips / underpaint;
           leave page-shell x-clipped so the horizontal scrollbar stays gone. */
        :host([data-sidebar-docked]) .sun-path.dial-view,
        :host([data-sidebar-docked]) .sun-path-stage,
        :host([data-sidebar-docked]) .sun-path-body,
        :host([data-sidebar-docked]) .sun-light-clock {
          overflow: visible;
        }
        /* Shared inset for draft + location banners (dial zeroes .page padding).
           Mounted into .stage-col when a workspace exists so they push the
           dial/list down without spanning the area rail. */
        .page-banners {
          position: relative;
          z-index: 5;
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: var(--ha-space-3);
          margin-inline: 16px;
        }
        .stage-col > .page-banners {
          z-index: 2;
        }
        .page-banners[hidden] {
          display: none;
        }
        .draft-restore {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          padding: 10px 12px;
          border-radius: var(--ha-border-radius-lg, 12px);
          border: 1px solid var(--info-color, var(--primary-color));
          background: color-mix(
            in srgb,
            var(--info-color, var(--primary-color)) 14%,
            var(--card-background-color)
          );
        }
        .draft-restore[hidden] {
          display: none;
        }
        .draft-restore ha-icon {
          --mdc-icon-size: 22px;
          color: var(--info-color, var(--primary-color));
          flex-shrink: 0;
        }
        .draft-restore-copy {
          flex: 1 1 auto;
          min-width: 0;
        }
        .draft-restore-copy .title {
          font-size: 13px;
          font-weight: 600;
        }
        .draft-restore-copy .detail {
          font-size: 12px;
          line-height: 1.35;
          color: var(--secondary-text-color);
        }
        .draft-restore-dismiss {
          flex-shrink: 0;
          margin-inline-end: -4px;
        }
        .content {
          position: relative;
          z-index: 5;
          padding: var(--ha-space-3) 0 88px;
        }
        /* Dial editor leaves content empty — do not reserve FAB pad twice. */
        .content:empty {
          display: none;
          padding: 0;
        }
        .content.wide {
          width: 100%;
          box-sizing: border-box;
          /* The shared content pad left a black band between the app bar and
             the wheel glow. Bottom pad stays so the FAB does not cover tiles. */
          padding-top: 0;
        }
        .content:has(.workspace) {
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
          padding: 0;
        }
        /* Color wheels cap at WHEEL_FACE_MAX; --dial-face-max shrinks them to
           fit above light tiles. The stage column itself stays full width. */
        .stage-col .hue-wheel-stage {
          width: min(100%, ${WHEEL_FACE_MAX_PX}px, var(--dial-face-max, ${WHEEL_FACE_MAX_PX}px));
          max-width: min(100%, ${WHEEL_FACE_MAX_PX}px, var(--dial-face-max, ${WHEEL_FACE_MAX_PX}px));
          margin: 0 auto;
          padding: 40px 0 16px;
          box-sizing: border-box;
        }
        .stage-col .hue-wheel-canvas {
          width: 100%;
          max-width: none;
        }
        /* Simple-scene disk is the leftover above the light tiles, not the
           dial budget. 64px is the mode row (48) plus the stage gap (16).
           Floor matches WHEEL_FACE_MIN_PX; the wheels box min-height makes
           the scrollport scroll before the disk goes smaller. */
        .stage-col .simple-editor .hue-wheel-stage {
          min-width: 0;
          padding: 0;
          width: 100%;
          max-width: none;
          height: 100%;
          max-height: 100%;
        }
        .stage-col .simple-editor .hue-wheel-canvas {
          width: max(
            ${WHEEL_FACE_MIN_PX}px,
            min(100cqi, calc(100cqb - 64px), ${WHEEL_FACE_MAX_PX}px)
          );
          max-width: min(100%, ${WHEEL_FACE_MAX_PX}px, calc(100cqb - 64px));
          height: auto;
        }
        /* Vertical modes and variables when the gutter beside the disk is wide enough. */
        .simple-editor.chrome-aside {
          .hue-wheel-face {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .stage-col .simple-editor .hue-wheel-canvas {
            width: min(100%, 100cqb, ${WHEEL_FACE_MAX_PX}px);
            height: auto;
            max-width: 100%;
            max-height: 100%;
            aspect-ratio: 1;
            margin: 0 auto;
          }
          .hue-wheel-chrome {
            position: absolute;
            top: 50%;
            left: calc(50% + var(--wheel-half, 0px) + var(--chrome-gap, 16px));
            right: auto;
            bottom: auto;
            transform: translateY(-50%);
            z-index: 4;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            width: max-content;
            max-width: calc(50% - var(--wheel-half, 0px) - var(--chrome-gap, 16px) - 8px);
            height: auto;
            max-height: 100%;
            min-height: 0;
            padding: 6px 4px 6px 14px;
            box-sizing: border-box;
            overflow: visible;
            gap: 8px;
            transition:
              opacity 180ms cubic-bezier(0.2, 0, 0, 1),
              transform 180ms cubic-bezier(0.2, 0, 0, 1);
          }
          .hue-wheel-chrome:not(.is-shown) {
            opacity: 0;
            transform: translateY(-50%) translateX(24px);
            pointer-events: none;
          }
          .hue-wheel-mode-cluster,
          .hue-presets {
            opacity: 1;
            transform: none;
            pointer-events: auto;
          }
          .hue-wheel-chrome::-webkit-scrollbar {
            display: none;
          }
          /* Color modes stay put. Only the variables (and palette colors) scroll. */
          .hue-wheel-mode-cluster {
            flex: 0 0 auto;
            align-items: flex-start;
            align-self: flex-start;
            width: max-content;
            max-width: 100%;
            padding: 0 0 10px;
            margin-bottom: 12px;
            border-bottom: 1px solid var(--divider-color);
            background: none;
          }
          .wheel-mode-pill {
            flex-direction: column;
            align-items: flex-start;
            width: auto;
            max-width: 100%;
            height: auto;
            padding: 0;
            gap: 4px;
            background: none;
            box-shadow: none;
          }
          .wheel-mode-pill .wheel-wrapper {
            width: auto;
            max-width: 100%;
            height: 32px;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            gap: 8px;
            padding: 4px 0;
            border-color: transparent;
            opacity: 0.75;
            overflow: visible;
          }
          .wheel-mode-pill .wheel-wrapper:hover,
          .wheel-mode-pill .wheel-wrapper:active,
          .wheel-mode-pill .wheel-wrapper.active {
            border-color: transparent;
            background-color: transparent;
            opacity: 1;
          }
          .wheel-mode-pill .wheel-wrapper.active {
            gap: 10px;
          }
          .wheel-mode-pill .wheel-wrapper {
            transform-origin: 14px center;
            transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
          }
          .wheel-mode-pill .wheel-wrapper:hover:not(.active) {
            transform: translateX(-1.6px) scale(1.08);
          }
          .wheel-mode-pill .wheel-wrapper.active,
          .wheel-mode-pill .wheel-wrapper.active:hover {
            transform: translateX(-3.8px) scale(1.08);
          }
          .wheel-mode-pill .wheel-wrapper:active {
            transform: translateX(0.8px) scale(0.96);
          }
          .wheel-mode-pill .wheel-wrapper.active:active {
            transform: translateX(-1.1px) scale(0.96);
          }
          .wheel-mode-pill .wheel-wrapper .wheel {
            position: relative;
          }
          .wheel-mode-pill .wheel-wrapper.active .wheel {
            outline: none;
          }
          .wheel-mode-pill .wheel-wrapper.active .wheel::after {
            content: "";
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid #fff;
            opacity: 0.75;
            pointer-events: none;
            animation: hue-preset-ring-in 180ms cubic-bezier(0.2, 0, 0, 1);
          }
          .wheel-mode-pill .wheel-wrapper.palette-active {
            width: auto;
            background: none;
          }
          .wheel-mode-pill .wheel-wrapper.active .wheel-mode-name {
            font-weight: 700;
          }
          .wheel-mode-pill .wheel-wrapper .wheel {
            order: 0;
          }
          .wheel-mode-pill .wheel-wrapper .wheel-mode-name {
            order: 1;
          }
          .wheel-mode-pill .wheel-wrapper.palette-active .wheel-palette-edit {
            order: 2;
            width: auto;
            margin-inline-start: 4px;
          }
          .wheel-mode-name {
            display: block;
            max-width: none;
            overflow: visible;
            text-align: start;
          }
          .hue-presets {
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            width: max-content;
            max-width: 100%;
            height: auto;
            max-height: none;
            min-height: 0;
            flex: 1 1 auto;
            /* The scaled swatch and its ring sit in this padding so overflow
               does not clip the top of the selected variable. */
            padding: 14px 8px 14px 12px;
            margin: 0 -4px 0 0;
            overflow-x: hidden;
            overflow-y: auto;
            scrollbar-width: none;
            border-radius: 0;
            background: none;
            box-shadow: none;
          }
          .hue-presets::-webkit-scrollbar {
            display: none;
          }
          .hue-presets.can-scroll-start {
            -webkit-mask-image: linear-gradient(to bottom, transparent, #000 28px);
            mask-image: linear-gradient(to bottom, transparent, #000 28px);
          }
          .hue-presets.can-scroll-end {
            -webkit-mask-image: linear-gradient(
              to bottom,
              #000 calc(100% - 28px),
              transparent
            );
            mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
          }
          .hue-presets.can-scroll-start.can-scroll-end {
            -webkit-mask-image: linear-gradient(
              to bottom,
              transparent,
              #000 28px,
              #000 calc(100% - 28px),
              transparent
            );
            mask-image: linear-gradient(
              to bottom,
              transparent,
              #000 28px,
              #000 calc(100% - 28px),
              transparent
            );
          }
          .hue-presets-track {
            flex-direction: column;
            align-items: flex-start;
            width: max-content;
            max-width: 100%;
            overflow: visible;
          }
          .hue-presets::after {
            display: none;
          }
          .hue-preset:not(.add) {
            width: auto;
            max-width: 100%;
            height: 36px;
            border-radius: 18px;
            flex-direction: row;
            justify-content: flex-start;
            gap: 8px;
            padding: 4px 0;
            border-color: transparent;
            opacity: 0.75;
          }
          .hue-preset:not(.add):hover,
          .hue-preset.active {
            border-color: transparent;
            opacity: 1;
          }
          .hue-preset.active {
            gap: 10px;
          }
          .hue-preset {
            transform-origin: 14px center;
            transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
          }
          .hue-preset:hover:not(.active) {
            transform: translateX(-1.6px) scale(1.08);
          }
          .hue-preset.active,
          .hue-preset.active:hover {
            transform: translateX(-3.8px) scale(1.08);
          }
          .hue-preset:active {
            transform: translateX(0.8px) scale(0.96);
          }
          .hue-preset.active:active {
            transform: translateX(-1.1px) scale(0.96);
          }
          .hue-preset.active .hue-preset-swatch {
            outline: none;
          }
          .hue-preset.active .hue-preset-swatch::after {
            content: "";
            position: absolute;
            inset: -4px;
            border-radius: inherit;
            border: 2px solid #fff;
            opacity: 0.75;
            pointer-events: none;
            animation: hue-preset-ring-in 180ms cubic-bezier(0.2, 0, 0, 1);
          }
          .hue-preset.active .hue-preset-name {
            font-weight: 700;
          }
          .hue-preset.add {
            align-self: flex-start;
            width: auto;
            max-width: 100%;
            height: 36px;
            padding: 4px 0;
            justify-content: flex-start;
            gap: 8px;
            border-radius: 18px;
          }
          .hue-preset-name {
            display: block;
            max-width: none;
            overflow: visible;
            text-align: start;
          }
          .hue-palette-colors:not([hidden]) {
            display: flex !important;
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
            width: max-content;
            max-width: 100%;
            margin: 0 0 10px;
            padding: 0 0 10px;
            border-bottom: 1px solid var(--divider-color);
          }
          .hue-palette-colors-title {
            margin: 2px 0 4px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--secondary-text-color);
          }
          .hue-palette-color {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            height: 36px;
            max-width: 100%;
            opacity: 0.9;
          }
        }
        @keyframes hue-preset-ring-in {
          from {
            transform: scale(0.72);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 0.75;
          }
        }
        :host(:not([data-dark-mode])) .simple-editor.chrome-aside .wheel-mode-pill .wheel-wrapper.active .wheel::after,
        :host(:not([data-dark-mode])) .simple-editor.chrome-aside .hue-preset.active .hue-preset-swatch::after {
          border-color: var(--primary-color);
        }
        .stage-bg .hue-wheel-glow {
          position: absolute;
          pointer-events: none;
          z-index: 0;
          transform: scale(1.2);
          transform-origin: center center;
          filter: blur(36px) saturate(1.3);
          opacity: 0.4;
          border-radius: 50%;
        }
        :host(:not([data-dark-mode])) .stage-bg .hue-wheel-glow {
          opacity: 0.16;
        }
        .card-content {
          padding: 16px;
        }
        .list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .list-tab-group {
          display: block;
          margin: 0 0 12px;
          --ha-tab-indicator-color: var(--primary-color);
        }
        .row.created-scene {
          cursor: pointer;
        }
        .list-settings-dialog .setup-link-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
        }
        .list-settings-dialog .setup-link-row ha-switch {
          flex-shrink: 0;
          margin-top: 2px;
        }
        .list-settings-dialog .automatically-update-lights-interval-row {
          flex-direction: column;
          align-items: stretch;
        }
        .list-settings-dialog .automatically-update-lights-interval-row ha-selector {
          width: 100%;
          margin-top: 8px;
        }
        .list-settings-dialog .dusk-minimum-row {
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
        }
        .row .row-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .row .row-actions ha-icon-button {
          --mdc-icon-button-size: 40px;
          color: var(--secondary-text-color);
        }
        /* Shared with create-wizard mode cards; list uses the same chrome. */
        .setup-mode-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          width: 100%;
          text-align: left;
          padding: 14px 16px;
          border-radius: var(--ha-border-radius-lg, 12px);
          border: 2px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          cursor: pointer;
          box-sizing: border-box;
        }
        /* After .setup-mode-card so row layout wins (same specificity otherwise
           leaves the switch under the copy). */
        .setup-mode-card.list-aul-card {
          margin-bottom: 12px;
          flex-direction: row;
          align-items: center;
          gap: 12px;
        }
        .list-aul-card .aul-copy {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
        .list-aul-card .mode-detail {
          padding-left: 30px;
        }
        .list-aul-card ha-switch {
          flex-shrink: 0;
          pointer-events: auto;
        }
        .setup-mode-card:hover {
          border-color: color-mix(in srgb, var(--primary-color) 45%, var(--divider-color));
        }
        .setup-mode-card.selected {
          border-color: var(--primary-color);
          background: color-mix(
            in srgb,
            var(--primary-color) 10%,
            var(--card-background-color)
          );
        }
        .setup-mode-card .mode-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
        }
        .setup-mode-card .mode-title ha-icon {
          --mdc-icon-size: 22px;
          color: var(--primary-color);
        }
        .setup-mode-card .mode-detail {
          font-size: 13px;
          line-height: 1.35;
          color: var(--secondary-text-color);
          padding-left: 30px;
        }
        /* Scene list: HA data-table-like surface (custom panels cannot load
           ha-data-table reliably — lazy chunk, Lit column templates). */
        .list.scene-table {
          gap: 0;
          border: 1px solid var(--divider-color);
          border-radius: var(--ha-card-border-radius, 12px);
          overflow: hidden;
          background: var(--card-background-color);
        }
        .list.scene-table .scene-table-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          height: 48px;
          box-sizing: border-box;
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--divider-color);
          background: var(--card-background-color);
        }
        .list.scene-table .scene-table-group {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          box-sizing: border-box;
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color);
          background: var(--primary-background-color);
          border-bottom: 1px solid var(--divider-color);
        }
        .list.scene-table .scene-table-header .meta {
          flex: 1;
          min-width: 0;
        }
        .list.scene-table .scene-table-header .row-actions {
          width: 88px;
          flex-shrink: 0;
        }
        .list.scene-table .row {
          border: none;
          border-radius: 0;
          border-bottom: 1px solid var(--divider-color);
          background: transparent;
        }
        .list.scene-table .row:last-child {
          border-bottom: none;
        }
        .list.scene-table .row:hover {
          background: color-mix(
            in srgb,
            var(--primary-text-color) 6%,
            var(--card-background-color)
          );
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-sizing: border-box;
          width: 100%;
          max-width: 480px;
          margin-inline: auto;
          padding: 48px 24px 112px;
          /* Prefer the scrollport height over 100vh so empty states do not
             force a second scrollbar outside ha-top-app-bar. */
          min-height: calc(100% - 96px);
        }
        .empty-state > ha-icon {
          --mdc-icon-size: 80px;
          color: var(--disabled-text-color, var(--secondary-text-color));
          margin-bottom: 16px;
        }
        .empty-state h1 {
          margin: 0 0 16px;
          font-size: 1.5rem;
          font-weight: 400;
          line-height: 1.3;
          color: var(--primary-text-color);
        }
        .stage-scroll > .empty-state {
          flex: 1 1 auto;
          width: 100%;
          max-width: 560px;
          min-height: 100%;
          padding: 48px 24px 64px;
        }
        .empty-state p {
          margin: 0 0 12px;
          font-size: 14px;
          line-height: 1.5;
          color: var(--secondary-text-color);
        }
        .empty-state a.learn-more {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
          color: var(--primary-color);
          text-decoration: none;
          font-size: 14px;
        }
        .empty-state a.learn-more:hover {
          text-decoration: underline;
        }
        .empty-state a.learn-more ha-icon {
          --mdc-icon-size: 16px;
        }
        .empty-state .auto-configure {
          margin-top: 16px;
        }
        .empty {
          text-align: center;
          padding: 48px 16px;
          color: var(--secondary-text-color);
        }
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--card-background-color);
          border-radius: var(--ha-card-border-radius, 12px);
          cursor: pointer;
          border: 1px solid var(--divider-color);
        }
        .row:hover {
          background: var(--secondary-background-color);
        }
        .row ha-icon,
        .row ha-state-icon {
          color: var(--secondary-text-color);
          --mdc-icon-size: 24px;
        }
        .row .meta {
          flex: 1;
          min-width: 0;
        }
        .row .name {
          font-weight: 500;
        }
        .row .sub {
          color: var(--secondary-text-color);
          font-size: 14px;
        }
        /* Corner overlay matching hass-subpage #fab. ha-top-app-bar-fixed has
           no fab slot, so this sits as a sibling of the app bar. */
        .fab {
          position: absolute;
          right: calc(
            16px + var(--safe-area-inset-right, 0px) +
              var(--scene-sidebar-gutter)
          );
          bottom: calc(16px + var(--safe-area-inset-bottom, 0px));
          /* Above the light-tile strip (z-index 12). The event sidebar stays higher. */
          z-index: 13;
          --ha-button-box-shadow: var(--ha-box-shadow-l);
          transform-origin: bottom right;
          transition:
            opacity 180ms cubic-bezier(0.2, 0, 0, 1),
            transform 180ms cubic-bezier(0.2, 0, 0, 1),
            visibility 180ms;
        }
        /* Prefer class over [hidden] so opacity/scale can animate (UA hidden is display:none). */
        .fab.is-hidden {
          opacity: 0;
          transform: scale(0.85);
          visibility: hidden;
          pointer-events: none;
        }
        .save-dialog ha-input,
        .save-dialog ha-textfield,
        .save-dialog ha-textarea,
        .save-dialog ha-labels-picker,
        .save-dialog ha-category-picker,
        .save-dialog ha-icon-picker,
        .save-dialog ha-selector,
        .area-dialog ha-selector,
        .confirm-dialog p {
          display: block;
          margin-top: 16px;
        }
        .area-dialog {
          --mdc-dialog-min-width: min(440px, 95vw);
        }
        .area-dialog .setup-step {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 8px;
        }
        .area-dialog .setup-step[hidden] {
          display: none;
        }
        .area-dialog .setup-mode-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .area-dialog .setup-error {
          margin: 0;
          color: var(--error-color);
          font-size: 13px;
          line-height: 1.35;
        }
        .area-dialog .setup-intro {
          margin: 0;
          color: var(--primary-text-color);
          font-size: 14px;
          line-height: 1.45;
        }
        .area-dialog .setup-intro .muted {
          color: var(--secondary-text-color);
          font-size: 13px;
        }
        .area-dialog .setup-slot {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .area-dialog .setup-slot ha-selector {
          display: block;
          margin-top: 0;
        }
        .area-dialog .setup-link-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 0 8px;
        }
        .area-dialog .setup-link-row span {
          font-size: 14px;
          line-height: 1.3;
        }
        .area-dialog .setup-link-helper {
          margin: -4px 0 8px;
          font-size: 12px;
          line-height: 1.35;
          color: var(--secondary-text-color);
        }
        .save-dialog ha-chip-set {
          margin-top: 16px;
        }
        .error {
          color: var(--error-color);
          margin: 0 0 16px;
        }
        button.fallback {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          border: 0;
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
        }
        button.fallback.danger {
          background: var(--error-color);
        }
        button.fallback.ghost {
          background: transparent;
          color: var(--primary-color);
        }
        ha-icon-button {
          --mdc-icon-button-size: 40px;
          color: inherit;
        }
        ${LANDING_CSS}
        ${SIMPLE_EDITOR_CSS}
      </style>
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
    const suffix = hash ? `#${hash}` : "";
    return `${window.location.pathname}${window.location.search}${suffix}`;
  }

  async _go(hash) {
    if (!(await this._confirmLeaveEditor())) {
      return;
    }
    await this._restoreOpenLightPreview();
    this._abortPreview();
    this._forceCloseSceneSidebar();
    const previous = (window.location.hash || "#").replace(/^#/, "");
    window.location.hash = hash;
    const next = (window.location.hash || "#").replace(/^#/, "");
    // Setting the same hash (including "" → "") does not fire hashchange.
    if (previous === next) {
      void this._syncHash();
    }
  }

  async _syncHash() {
    const hash = (window.location.hash || "#").replace(/^#/, "");
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
        this._hashSyncHash = (window.location.hash || "#").replace(/^#/, "");
        this._hashSyncAt = performance.now();
        await this._syncHashOnce();
      }
    } finally {
      this._hashSyncing = false;
    }
  }

  async _syncHashOnce() {
    const hash = (window.location.hash || "#").replace(/^#/, "");
    if (
      this._pendingRailSceneId &&
      hash !== `edit/${this._pendingRailSceneId}`
    ) {
      this._pendingRailSceneId = null;
    }
    this._noteRailTabForHash(hash);
    const current = this._currentHash();
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
      if ((window.location.hash || "#").replace(/^#/, "") !== hash) {
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
  }

  _motionKindForSceneId(sceneId) {
    const item = (this._items || []).find((scene) => scene.id === sceneId);
    if (item?.kind === "simple") {
      return "wheel";
    }
    if (item) {
      return "dial";
    }
    return this._formData?.kind === "simple" ? "wheel" : "dial";
  }

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
  }

  _prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  _waitForAnimation(el, name, fallbackMs) {
    return waitForSurfaceAnimation(el, name, fallbackMs);
  }

  _disposeOutgoingStageLayer() {
    const layer = this._outgoingStageLayer;
    this._outgoingStageLayer = null;
    if (!layer) {
      return;
    }
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
  }

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
  }

  _liftOutgoingStageLayer() {
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
  }

  _attachOutgoingStageLayer(stage) {
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
  }

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
  }

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
  }

  async _transitionSurfaces(fromKind, toKind) {
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

  async _openNameItemDialog() {
    if (this._view === "edit") {
      await this._openSaveDialog({ rename: true });
      return;
    }
    const isTheme = this._view === "theme";
    const current = isTheme
      ? this._themeDraft?.name
      : this._variableDraft?.name;
    const suggested = this._nameIsPlaceholder(current)
      ? this._suggestedLibraryName()
      : current;
    await this._openLibraryRenameDialog({
      title: this._nameFabLabel(),
      value: suggested,
      onSave: async (name) => {
        if (isTheme) {
          if (!this._themeDraft) {
            return;
          }
          this._commitUndo();
          this._themeDraft.name = name;
          await this._saveThemeQuiet();
        } else if (this._variableDraft) {
          this._commitUndo();
          this._variableDraft.name = name;
          await this._saveVariableQuiet();
        }
        this._syncAppBarTitle();
        this._syncNameFab();
      },
    });
  }

  async _openLibraryRenameDialog({ title, value, onSave }) {
    this.shadowRoot.querySelector("ha-dialog.save-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "save-dialog";
    dialog.setAttribute("header-title", title);
    dialog.open = true;
    const nameInput = this._haInput(
      this._t("frontend.common.name", "Name"),
      value || ""
    );
    nameInput.required = true;
    nameInput.setAttribute("autofocus", "");
    dialog.appendChild(nameInput);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._t("frontend.common.cancel", "Cancel");
    const save = document.createElement("ha-button");
    save.slot = "primaryAction";
    save.variant = "brand";
    save.textContent = this._t("frontend.common.save", "Save");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    save.addEventListener("click", async () => {
      const name = (nameInput.value || "").trim();
      if (!name) {
        nameInput.reportValidity?.();
        return;
      }
      dialog.open = false;
      await onSave(name);
    });
    footer.append(cancel, save);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
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
    if (this._view === "edit" || this._view === "theme") {
      this._ensureSunPath();
    }
    this._surfaceKind = this._editorMotionKind();
  }

  _parkSunPath() {
    this._parkPageBanners();
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
  }

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
  }

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
  }

  _stageScrollEl(stage) {
    return stage?.querySelector(":scope > .stage-scroll") || stage;
  }

  _stageBgEl(stage) {
    return stage?.querySelector(":scope > .stage-bg") || null;
  }

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

  _syncWorkspaceScrollport() {
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
    const nextTab = library ? "library" : "scenes";
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
    overlay?.remove();
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

  _noteSimpleDirty() {
    this._sessionDirty = true;
    this._saveSoon();
  }

  // Simple-scene light edits share the global undo stack. The snapshot is the
  // scene before the write; a drag or scroll stays one entry until the gesture ends.
  _beginSimpleUndo() {
    if (this._historyRestoring) {
      return;
    }
    if (!this._simpleUndoLatched) {
      this._simpleUndoLatched = true;
      this._commitUndo({ type: "simple" });
    }
    window.clearTimeout(this._simpleUndoEndTimer);
    if (this._simpleUndoHold) {
      this._simpleUndoEndTimer = null;
      return;
    }
    this._simpleUndoEndTimer = window.setTimeout(() => {
      this._simpleUndoEndTimer = null;
      this._finishSimpleUndo();
    }, 400);
  }

  _holdSimpleUndo(hold) {
    if (hold) {
      if (!this._simpleUndoHold && this._simpleUndoLatched) {
        this._finishSimpleUndo();
      }
      this._simpleUndoHold = true;
      window.clearTimeout(this._simpleUndoEndTimer);
      this._simpleUndoEndTimer = null;
      return;
    }
    this._simpleUndoHold = false;
    window.clearTimeout(this._simpleUndoEndTimer);
    this._simpleUndoEndTimer = null;
    this._finishSimpleUndo();
  }

  _finishSimpleUndo() {
    window.clearTimeout(this._simpleUndoEndTimer);
    this._simpleUndoEndTimer = null;
    if (!this._simpleUndoLatched) {
      return;
    }
    this._stampHistoryAfter();
    this._simpleUndoLatched = false;
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

  _applyAreaCatalog(payload) {
    const before = {
      scenes: this._items,
      floors: this._floors,
      themes: this._themes,
      variables: this._variables,
    };
    this._items = payload?.scenes || this._items;
    this._floors = payload?.floors || this._floors;
    if (Array.isArray(payload?.floors)) this._areaCatalogLoaded = true;
    this._themes = payload?.themes || this._themes;
    this._variables = payload?.variables || this._variables;
    const changes = railCatalogChanges(before, {
      scenes: this._items,
      floors: this._floors,
      themes: this._themes,
      variables: this._variables,
    });
    const rail = this._contentEl?.querySelector(":scope > .workspace > .area-rail");
    if (!rail) {
      if (this._view === "list" || this._view === "variables") this._render();
      return;
    }
    const scroll = rail.querySelector('.area-rail-body:not([hidden])');
    const scrollTab = scroll?.dataset.tab || "scenes";
    const scrollTop = scroll?.scrollTop || 0;
    const replacement = renderLanding(this, { includeStage: false }).querySelector(".area-rail");
    if (!changes.rebuild) {
      // Keep the rail, its scroll container, and any focused control mounted.
      this._roomPreviewSwitch = rail.querySelector(".area-rail-body[data-tab=\"scenes\"] ha-switch");
      const selector = ".scene-card[data-scene-id], .scene-card[data-item-id], .var-chip[data-item-id]";
      const existingCards = [...rail.querySelectorAll(selector)];
      const updatedCards = [...replacement.querySelectorAll(selector)];
      for (let index = 0; index < existingCards.length; index += 1) {
        const oldCard = existingCards[index];
        const newCard = updatedCards[index];
        const sceneId = oldCard.dataset.sceneId;
        if (sceneId && !changes.sharedChanged && !changes.sceneIds.has(sceneId)) continue;
        if (!sceneId && !changes.sharedChanged) continue;
        const oldHost = oldCard.closest(".scene-card-slot") || oldCard.closest(".var-row > div");
        const newHost = newCard.closest(".scene-card-slot") || newCard.closest(".var-row > div");
        if (!oldHost || !newHost) continue;
        const focused = this.shadowRoot.activeElement;
        const focusInCard = focused && oldHost.contains(focused);
        const focusPath = [];
        if (focusInCard) {
          for (let node = focused; node !== oldHost; node = node.parentElement) {
            focusPath.unshift([...node.parentElement.children].indexOf(node));
          }
        }
        if (oldCard.classList.contains("selected")) newCard.classList.add("selected");
        if (oldHost.classList.contains("glow-on")) newHost.classList.add("glow-on");
        oldHost.replaceWith(newHost);
        if (focusInCard) {
          const target = focusPath.reduce((node, child) => node?.children[child], newHost);
          (target?.focus ? target : newCard).focus({ preventScroll: true });
        }
      }
      this._syncRailSelection();
      return;
    }
    rail.replaceWith(replacement);
    const nextScroll = replacement.querySelector(`.area-rail-body[data-tab="${scrollTab}"]`);
    if (nextScroll) {
      nextScroll.scrollTop = scrollTop;
      this._bindAreaRailScroll(nextScroll);
    }
    this._syncRailSelection();
  }

  _subscribeAreaRegistry() {
    if (!this._hass?.connection?.subscribeEvents || this._areaRegistrySubscription || this._areaRegistryUnsub) return;
    this._areaRegistrySubscription = this._hass.connection.subscribeEvents(
      () => { void this._refreshAreasFromRegistry(); },
      "area_registry_updated"
    ).then((unsubscribe) => {
      this._areaRegistrySubscription = null;
      if (!this.isConnected) {
        unsubscribe();
      } else {
        this._areaRegistryUnsub = unsubscribe;
      }
    }).catch((error) => {
      this._areaRegistrySubscription = null;
      this._error = error.message || String(error);
    });
  }

  async _ensureChangeSubscription() {
    const connection = this._hass?.connection;
    if (!connection?.subscribeMessage || !this.isConnected) return;
    if (this._changeConnection === connection && this._changeUnsub) return;
    if (this._changeConnection === connection && this._changeSubscription) {
      await this._changeSubscription;
      return;
    }
    const hadCatalog = Boolean(this._items?.length || this._themes?.length || this._variables?.length);
    this._changeConnection = connection;
    this._changeSubscription = connection.subscribeMessage(
      (event) => { void this._receiveSavedChange(event); },
      { type: `${DOMAIN}/subscribe_changes` }
    );
    try {
      const unsubscribe = await this._changeSubscription;
      if (!this.isConnected || this._changeConnection !== connection) {
        unsubscribe();
        return;
      }
      this._changeUnsub = unsubscribe;
      this._changeSubscription = null;
      if (hadCatalog) void this._receiveSavedChange({ kind: "catalog", action: "resync" });
    } catch (error) {
      if (this._changeConnection === connection) {
        this._changeSubscription = null;
        this._error = error.message || String(error);
      }
    }
  }

  _rebaseSceneHistory(before, after) {
    for (const entry of [...this._undoStack, ...this._redoStack]) {
      if (entry.target?.view !== "edit" || entry.target.editId !== this._editId) continue;
      for (const snapshot of [entry.session, entry.after]) {
        if (snapshot?.form) snapshot.form = mergeFields(before, snapshot.form, after).value;
      }
    }
  }

  _rebaseLibraryHistory(kind, before, after) {
    const field = kind === "theme" ? "theme" : "variable";
    const targetField = kind === "theme" ? "themeId" : "variableId";
    const openId = kind === "theme" ? this._themeId : this._variableId;
    for (const entry of [...this._undoStack, ...this._redoStack]) {
      if (entry.target?.[targetField] !== openId) continue;
      for (const snapshot of [entry.session, entry.after]) {
        if (snapshot?.[field]) snapshot[field] = mergeFields(before, snapshot[field], after).value;
      }
    }
  }

  async _applyRemoteLibrary(kind, itemId, item) {
    const isTheme = kind === "theme";
    const active = isTheme
      ? this._themeDraft?.id === itemId || this._themeId === itemId
      : this._variableId === itemId;
    if (!active) return;
    if (this._sharedConflict) return;
    if (!item) {
      this._sharedDeleted = true;
      window.clearTimeout(this._saveSoonTimer);
      this._saveSoonTimer = null;
      this._showDeletedDraftBanner();
      return;
    }
    const baseItem = isTheme ? this._themeBase : this._variableBase;
    if (!baseItem || baseItem.revision === item.revision) return;
    const base = structuredClone(baseItem);
    const current = structuredClone(item);
    delete base.revision;
    delete current.revision;
    const before = isTheme ? base : this._variableWorkingCopy(base);
    const after = isTheme ? current : this._variableWorkingCopy(current);
    const draft = isTheme ? this._themeDraft : this._variableDraft;
    if (!draft) return;
    const result = mergeFields(before, draft, after);
    let resolved = result.value;
    if (result.conflicts.length) {
      this._sharedConflict = true;
      window.clearTimeout(this._saveSoonTimer);
      this._saveSoonTimer = null;
      try {
        resolved = await this._chooseConflictValues(
          { base: before, current: after, fields: result.conflicts },
          draft
        );
      } finally {
        this._sharedConflict = false;
      }
    }
    this._rebaseLibraryHistory(kind, before, after);
    if (isTheme) {
      patchInPlace(this._themeDraft, resolved);
      this._themeBase = structuredClone(item);
      this._patchDialFromSession({ applyTheme: true });
      this._syncThemePreviewSurfaces();
    } else {
      patchInPlace(this._variableDraft, resolved);
      this._variableBase = structuredClone(item);
      this._variableWheel?.sync();
      const brightnessField = [...(this.shadowRoot?.querySelectorAll(".library-editor ha-input") || [])]
        .find((field) => field.label === this._t("frontend.lights.brightness", "Brightness"));
      if (brightnessField && this._view === "variable") {
        brightnessField.value = String(this._variableDraft.colorDraft?.brightness ?? 255);
      }
    }
    this._syncAppBarTitle();
    if (JSON.stringify(resolved) !== JSON.stringify(after)) this._saveSoon();
    else this._sessionBaseline = this._snapshotSession();
  }

  _showDeletedDraftBanner() {
    const stage = this._contentEl?.querySelector(".stage-col");
    const scroll = (stage && this._stageScrollEl(stage)) ||
      this._contentEl?.querySelector(".library-editor, .simple-editor-host") || this._contentEl;
    if (!scroll || scroll.querySelector(".deleted-draft-banner")) return;
    const banner = document.createElement("p");
    banner.className = "deleted-draft-banner error";
    banner.setAttribute("role", "alert");
    banner.textContent = this._t("frontend.conflict.deleted", "This item was deleted. Your unsaved draft remains here for copying.");
    scroll.prepend(banner);
  }

  async _receiveSavedChange(event) {
    const generation = ++this._collabRefreshGeneration;
    try {
      const payload = await this._hass.callWS({ type: `${DOMAIN}/list` });
      if (!this.isConnected || generation !== this._collabRefreshGeneration) return;
      const before = this._sceneBase;
      const openId = this._view === "edit" ? this._editId : null;
      const saved = openId && (payload.scenes || []).find((item) => item.id === openId);
      this._applyAreaCatalog(payload);
      if (this._themeDraft?.id) {
        await this._applyRemoteLibrary(
          "theme", this._themeDraft.id,
          this._themes.find((item) => item.id === this._themeDraft.id) || null
        );
      }
      if (this._variableId) {
        await this._applyRemoteLibrary(
          "variable", this._variableId,
          this._variables.find((item) => item.id === this._variableId) || null
        );
      }
      if (event.kind === "theme" || event.kind === "variable") {
        this._clearPreviewCache();
        this._patchDialFromSession({ applyTheme: true });
      }
      if (!openId) return;
      if (!saved) {
        this._sceneDeleted = true;
        window.clearTimeout(this._saveSoonTimer);
        this._saveSoonTimer = null;
        this._showDeletedDraftBanner();
        return;
      }
      if (!before || !saved.revision || saved.revision === this._sceneRevision) return;
      if (this._sceneConflict?.revision === saved.revision) return;
      const next = mergeFields(before, this._formData, saved.form);
      if (next.conflicts.length) {
        this._sceneConflict = {
          fields: next.conflicts,
          current: saved.form,
          revision: saved.revision,
          base: before,
        };
        window.clearTimeout(this._saveSoonTimer);
        this._saveSoonTimer = null;
        this._showSceneConflict();
        return;
      }
      this._rebaseSceneHistory(before, saved.form);
      patchInPlace(this._formData, next.value);
      this._sceneBase = structuredClone(saved.form);
      this._sceneRevision = saved.revision;
      this._syncAppBarTitle();
      this._patchDialFromSession();
      this._syncSceneUsed();
      if (JSON.stringify(next.value) !== JSON.stringify(saved.form)) this._saveSoon();
      else this._sessionBaseline = this._snapshotSession();
    } catch (error) {
      this._error = error.message || String(error);
    }
  }

  async _refreshAreasFromRegistry() {
    try {
      const payload = await this._hass.callWS({ type: `${DOMAIN}/list` });
      if (this.isConnected) this._applyAreaCatalog(payload);
    } catch (error) {
      this._error = error.message || String(error);
    }
  }

  _moveDeletedArea(area) {
    this.shadowRoot.querySelector("ha-dialog.deleted-area-dialog")?.remove();
    const choices = (this._floors || []).flatMap((floor) =>
      (floor.areas || []).filter((item) => !item.deleted && item.id !== area.id)
    );
    const dialog = document.createElement("ha-dialog");
    dialog.className = "deleted-area-dialog";
    dialog.setAttribute("header-title", this._t("frontend.areas.move_title", "Move scenes"));
    dialog.open = true;
    const field = document.createElement("ha-selector");
    field.hass = this._hass;
    field.label = this._t("frontend.areas.target", "Target area");
    field.selector = { select: { mode: "dropdown", options: choices.map((item) => ({ value: item.id, label: item.name })) } };
    let targetId = null;
    field.addEventListener("value-changed", (event) => { targetId = event.detail?.value || null; });
    const errorText = document.createElement("p");
    errorText.style.color = "var(--error-color)";
    errorText.setAttribute("role", "alert");
    const footer = document.createElement("ha-dialog-footer");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => { dialog.open = false; });
    const move = document.createElement("ha-button");
    move.slot = "primaryAction";
    move.variant = "brand";
    move.textContent = this._t("frontend.areas.move", "Move");
    move.addEventListener("click", async () => {
      if (!targetId) return;
      move.disabled = true;
      try {
        const payload = await this._hass.callWS({ type: `${DOMAIN}/move_deleted_area`, area_id: area.id, target_area_id: targetId });
        dialog.open = false;
        if (this._view === "edit" && this._formData?.area === area.id) {
          this._formData.area = targetId;
          this._formData.membership = { exclude: [], include: [] };
          this._clearPreviewCache();
          this._schedulePreview();
        }
        this._applyAreaCatalog(payload);
      } catch (error) {
        errorText.textContent = error.message || String(error);
        move.disabled = false;
      }
    });
    footer.append(cancel, move);
    dialog.append(field, errorText, footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  }

  _deleteDeletedArea(area, count) {
    this.shadowRoot.querySelector("ha-dialog.deleted-area-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "deleted-area-dialog";
    dialog.setAttribute("header-title", this._t("frontend.areas.delete_title", "Delete scenes?"));
    dialog.open = true;
    const detail = document.createElement("p");
    detail.textContent = this._t("frontend.areas.delete_confirm", "Delete all {count} scenes in {name}?", { count, name: area.name || `${this._t("frontend.areas.unknown", "Deleted area")} (${area.id})` });
    const errorText = document.createElement("p");
    errorText.style.color = "var(--error-color)";
    errorText.setAttribute("role", "alert");
    const footer = document.createElement("ha-dialog-footer");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => { dialog.open = false; });
    const remove = document.createElement("ha-button");
    remove.slot = "primaryAction";
    remove.variant = "danger";
    remove.textContent = this._loc("ui.common.delete", "Delete");
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      try {
        const payload = await this._hass.callWS({ type: `${DOMAIN}/delete_deleted_area`, area_id: area.id });
        dialog.open = false;
        if (this._view === "edit" && this._formData?.area === area.id) {
          this._go("");
        }
        this._applyAreaCatalog(payload);
      } catch (error) {
        errorText.textContent = error.message || String(error);
        remove.disabled = false;
      }
    });
    footer.append(cancel, remove);
    dialog.append(detail, errorText, footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  }

  _haInput(label, value, { type, min, max } = {}) {
    const field = customElements.get("ha-input")
      ? document.createElement("ha-input")
      : document.createElement("ha-selector");
    field.label = label;
    field.value = value;
    if (field.localName === "ha-selector") {
      field.hass = this._hass;
      field.selector =
        type === "number"
          ? {
              number: {
                min: min ?? 0,
                max: max ?? 8000,
                step: 1,
                mode: "box",
              },
            }
          : { text: {} };
    } else if (type === "number") {
      field.type = "number";
      if (min != null) {
        field.min = min;
      }
      if (max != null) {
        field.max = max;
      }
    }
    return field;
  }

  _variableEditorDraft(variable) {
    if (variable) {
      return {
        ...(variable.color || {}),
        brightness: variable.brightness ?? 255,
        state: "on",
      };
    }
    return {
      color_mode: "color_temp",
      color_temp_kelvin: 3000,
      brightness: 255,
      state: "on",
    };
  }

  _wheelPalette() {
    return {
      getPalette: () => this._variables || [],
      onAddPalette: (draft) => this._addVariableFromCurrentDraft(draft),
      addVariableLabel: this._t("frontend.library.add_variable", "Add color preset"),
      onEditVariable: (id) => this._go(`variable/${id}`),
    };
  }

  _openCreateVariableDialog() {
    void this._createLibraryItem("variable");
  }

  _openCreatePaletteDialog() {
    void this._createLibraryItem("palette");
  }

  _addVariableFromCurrentDraft(draft) {
    this._pendingVariableFromDraft = draft ? { ...draft } : null;
    void this._createLibraryItem("variable", { fromDraft: draft });
    return Promise.resolve(null);
  }

  _openCreateThemeDialog() {
    void this._createLibraryItem("theme");
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
    if (next && picked.size) {
      const overrides = { ...(scene.overrides || {}) };
      const palette = (this._variables || []).find((item) => item.id === next);
      for (const eid of picked) {
        if (!canColor(eid)) {
          continue;
        }
        const per = { ...(overrides[eid] || {}) };
        const draft = { state: "on", variable_ref: next };
        if (palette) {
          applyVariableToDraft(draft, palette, {
            entityId: eid,
            seed,
            catalog: this._variables,
          });
        }
        per[eventId] = draft;
        overrides[eid] = per;
      }
      scene.overrides = overrides;
      this._assignOpenLightToPalette?.(next, seed);
    }
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

  _chooseSceneTheme({ themeId, allowNone } = {}) {
    return new Promise((resolve) => {
      this.shadowRoot.querySelector("ha-dialog.scene-theme-dialog")?.remove();
      const dialog = document.createElement("ha-dialog");
      dialog.className = "scene-theme-dialog";
      dialog.setAttribute(
        "header-title",
        this._t("frontend.dialogs.scene_theme_select", "Select a circadian preset")
      );
      dialog.open = true;
      let settled = false;
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        dialog.open = false;
        resolve(value);
      };
      const list = document.createElement("div");
      list.className = "scene-theme-list";
      const addRow = (id, label, swatch) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scene-theme-row";
        if ((id || null) === (themeId || null)) {
          button.classList.add("selected");
        }
        if (swatch) {
          button.appendChild(swatch);
        }
        const name = document.createElement("span");
        name.textContent = label;
        button.appendChild(name);
        button.addEventListener("click", () => finish({ themeId: id }));
        list.appendChild(button);
      };
      if (allowNone) {
        addRow(null, this._t("frontend.dialogs.scene_palette_none", "None"), null);
      }
      for (const theme of this._themes || []) {
        const swatch = document.createElement("span");
        swatch.className = "scene-used-swatch";
        paintThemeDial(swatch, theme, this._variables || []);
        addRow(theme.id, theme.name || theme.id, swatch);
      }
      dialog.appendChild(list);
      dialog.addEventListener("closed", () => {
        dialog.remove();
        finish(null);
      });
      this.shadowRoot.appendChild(dialog);
    });
  }

  _chooseScenePalette({ areaId, mode, paletteId } = {}) {
    return new Promise((resolve) => {
      this.shadowRoot.querySelector("ha-dialog.scene-palette-dialog")?.remove();
      const palettes = (this._variables || []).filter((item) =>
        variableIsPalette(item)
      );
      const areaLights = this._areaLightIds(areaId);
      const dialog = document.createElement("ha-dialog");
      dialog.className = "scene-palette-dialog";
      dialog.setAttribute(
        "header-title",
        mode === "edit"
          ? this._t("frontend.dialogs.scene_palette_select", "Select a scene preset")
          : this._t("frontend.dialogs.scene_palette_title", "New scene")
      );
      dialog.open = true;
      let settled = false;
      let selectedKind = mode === "edit" && paletteId ? "user" : null;
      let selectedId = mode === "edit" ? paletteId || null : null;
      let seed = (Math.random() * 0xffffffff) >>> 0;
      let snaps = null;
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        dialog.open = false;
        resolve(value);
      };
      const restoreSnaps = async () => {
        if (!snaps) {
          return;
        }
        const prior = snaps;
        snaps = null;
        await Promise.all(
          Object.entries(prior).map(([entityId, stored]) =>
            this._applyLightState(entityId, stored, { transition: 0.4 })
          )
        );
      };
      const selectedPalette = () =>
        selectedKind === "gallery"
          ? galleryAsPalette(selectedId)
          : palettes.find((item) => item.id === selectedId);
      const applyPreview = async () => {
        const palette = selectedPalette();
        if (!this._readRoomPreviewPref() || !palette) {
          await restoreSnaps();
          return;
        }
        if (!snaps) {
          snaps = {};
          for (const entityId of areaLights) {
            snaps[entityId] = this._snapshotLight(entityId);
          }
        }
        await Promise.all(
          areaLights.map((entityId) => {
            const draft = { state: "on", brightness: 200 };
            applyVariableToDraft(draft, palette, {
              entityId,
              seed,
              catalog: this._variables,
            });
            return this._applyLightState(entityId, draft, { transition: 0.4 });
          })
        );
      };
      const hint = document.createElement("p");
      hint.className = "scene-palette-hint";
      hint.textContent = this._t(
        "frontend.dialogs.scene_palette_hint",
        "Create a scene from a preset or start from scratch (current lighting)"
      );
      const liveToggle = document.createElement("label");
      liveToggle.className = "live-edit-toggle";
      const liveLabel = document.createElement("span");
      liveLabel.textContent = this._t(
        "frontend.dialogs.scene_palette_live_preview",
        "Live preview"
      );
      const liveSwitch = document.createElement("ha-switch");
      liveSwitch.checked = this._readRoomPreviewPref();
      liveSwitch.addEventListener("change", () => {
        this._writeRoomPreviewPref(Boolean(liveSwitch.checked));
        this._syncRoomPreviewControl();
        void applyPreview();
      });
      liveToggle.slot = "headerActionItems";
      liveToggle.append(liveLabel, liveSwitch);
      const list = document.createElement("div");
      list.className = "scene-palette-list";
      const rows = [];
      const cards = [];
      const choose = (kind, id) => {
        selectedKind = kind;
        selectedId = id;
        paintSelection();
        void applyPreview();
      };
      const paletteChoiceCard = (name, paint, palette) =>
        createPresetSceneCard({
          name,
          paint,
          asButton: true,
          palette,
          catalog: this._variables,
        });
      const randomizeLabel = () => {
        const label = document.createElement("span");
        label.className = "scene-palette-randomize-label";
        label.hidden = true;
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", PALETTE_RANDOMIZE_ICON);
        icon.setAttribute("aria-hidden", "true");
        label.append(
          icon,
          document.createTextNode(
            this._t("frontend.dialogs.scene_palette_randomize", "Randomize")
          )
        );
        return label;
      };
      const randomizeSeed = () => {
        seed = (Math.random() * 0xffffffff) >>> 0;
        void applyPreview();
      };
      const markChoice = (row, on) => {
        row.card.classList.toggle("selected", on);
        row.slot.classList.toggle("glow-on", on);
        if (row.label) {
          row.label.hidden = !on;
        }
      };
      const paintSelection = () => {
        for (const row of rows) {
          markChoice(row, selectedKind === "user" && row.id === selectedId);
        }
        for (const card of cards) {
          markChoice(card, selectedKind === "gallery" && card.id === selectedId);
        }
        const hasPreset = Boolean(selectedKind && selectedPalette());
        if (mode === "edit") {
          useBtn.textContent = hasPreset
            ? this._t("frontend.dialogs.scene_palette_use", "Use this preset")
            : this._t("frontend.dialogs.scene_palette_clear", "Clear preset");
          scratchBtn.textContent = this._t(
            "frontend.dialogs.scene_palette_clear",
            "Clear preset"
          );
        } else {
          useBtn.textContent = this._t(
            "frontend.dialogs.scene_palette_from_preset",
            "Create from this preset"
          );
          useBtn.hidden = !hasPreset;
          scratchBtn.textContent = this._t(
            "frontend.dialogs.scene_palette_start_scratch",
            "Start from scratch"
          );
          scratchBtn.slot = hasPreset ? "secondaryAction" : "primaryAction";
          scratchBtn.appearance = hasPreset ? "plain" : "filled";
          scratchBtn.variant = hasPreset ? "neutral" : "brand";
        }
        scratchBtn.hidden = mode === "edit" && !hasPreset;
        useBtn.disabled = false;
        useBtn.toggleAttribute("disabled", false);
      };
      if (palettes.length) {
        const yours = document.createElement("p");
        yours.className = "scene-gallery-label";
        yours.textContent = this._t(
          "frontend.dialogs.scene_palette_yours",
          "Your scene presets"
        );
        list.appendChild(yours);
      }
      const pictured = palettes.filter((palette) => galleryPalette(palette?.builtin_id));
      const plain = palettes.filter((palette) => !galleryPalette(palette?.builtin_id));
      const onUserPalette = (palette) => {
        if (selectedKind === "user" && selectedId === palette.id) {
          randomizeSeed();
          return;
        }
        choose("user", palette.id);
      };
      const appendPaletteCards = (palettesToShow, paintFor) => {
        if (!palettesToShow.length) {
          return;
        }
        const grid = document.createElement("div");
        grid.className = "scene-cards";
        for (const palette of palettesToShow) {
          const choice = paletteChoiceCard(palette.name, paintFor(palette), palette);
          const label = randomizeLabel();
          choice.card.appendChild(label);
          choice.card.addEventListener("click", () => onUserPalette(palette));
          grid.appendChild(choice.slot);
          rows.push({ id: palette.id, ...choice, label });
        }
        list.appendChild(grid);
      };
      appendPaletteCards(pictured, (palette) => (bg) => {
        const cover = galleryPalette(palette.builtin_id);
        bg.classList.add("is-cover");
        bg.style.backgroundImage = `url("${galleryCoverUrl(cover.id)}")`;
      });
      appendPaletteCards(plain, (palette) => (bg) => {
        bg.style.background = paletteSwatchCss(
          palette,
          this._variables,
          draftRgb
        );
      });
      const adoptedPalettes = new Set(
        (this._variables || []).map((item) => item.builtin_id).filter(Boolean)
      );
      for (const section of gallerySections()) {
        const visible = section.palettes.filter((item) => !adoptedPalettes.has(item.id));
        if (!visible.length) {
          continue;
        }
        const label = document.createElement("p");
        label.className = "scene-gallery-label";
        label.textContent = this._t(section.nameKey, section.name);
        const grid = document.createElement("div");
        grid.className = "scene-cards";
        for (const item of visible) {
          const choice = paletteChoiceCard(
            this._t(item.nameKey, item.name),
            (bg) => {
              bg.classList.add("is-cover");
              bg.style.backgroundImage = `url("${galleryCoverUrl(item.id)}")`;
            },
            galleryAsPalette(item.id)
          );
          const randomLabel = randomizeLabel();
          choice.card.appendChild(randomLabel);
          choice.card.addEventListener("click", () => {
            if (selectedKind === "gallery" && selectedId === item.id) {
              randomizeSeed();
              return;
            }
            choose("gallery", item.id);
          });
          grid.appendChild(choice.slot);
          cards.push({ id: item.id, ...choice, label: randomLabel });
        }
        list.append(label, grid);
      }
      const body = document.createElement("div");
      body.className = "scene-palette-body";
      list.prepend(hint);
      body.append(list);
      dialog.append(liveToggle, body);
      const footer = customElements.get("ha-dialog-footer")
        ? document.createElement("ha-dialog-footer")
        : document.createElement("div");
      footer.slot = "footer";
      const finishScratch = () => {
        void restoreSnaps().then(() => finish({ palette: null }));
      };
      const scratchBtn = document.createElement("ha-button");
      scratchBtn.slot = mode === "edit" ? "secondaryAction" : "primaryAction";
      scratchBtn.appearance = mode === "edit" ? "plain" : "filled";
      scratchBtn.variant = "brand";
      scratchBtn.hidden = mode === "edit";
      scratchBtn.addEventListener("click", () => finishScratch());
      const useBtn = document.createElement("ha-button");
      useBtn.slot = "primaryAction";
      useBtn.variant = "brand";
      useBtn.textContent = mode === "edit"
        ? this._t("frontend.dialogs.scene_palette_clear", "Clear preset")
        : this._t("frontend.dialogs.scene_palette_from_preset", "Create from this preset");
      useBtn.hidden = mode !== "edit";
      useBtn.addEventListener("click", () => {
        if (!selectedKind) {
          finishScratch();
          return;
        }
        const picked = selectedPalette();
        if (!picked) {
          return;
        }
        const done = (palette) => {
          if (mode === "edit") {
            void restoreSnaps().then(() => finish({ palette, seed }));
            return;
          }
          const keepPreview = this._readRoomPreviewPref() && Boolean(snaps);
          finish({
            palette,
            seed,
            snapshots: keepPreview ? snaps : null,
            keepPreview,
          });
          snaps = null;
        };
        if (selectedKind !== "gallery") {
          done(picked);
          return;
        }
        const source = galleryPalette(selectedId);
        void this._hass
          .callWS({
            type: `${DOMAIN}/save_variable`,
            data: {
              name: galleryCopyName(
                this._t(source.nameKey, source.name),
                (this._variables || []).map((item) => item.name)
              ),
              kind: "palette",
              slots: source.slots,
              builtin_id: source.id,
            },
          })
          .then((saved) => {
            const list = [...(this._variables || [])];
            const index = list.findIndex((item) => item.id === saved.id);
            if (index >= 0) {
              list[index] = saved;
            } else {
              list.push(saved);
            }
            this._variables = list;
            done(saved);
          })
          .catch((err) => {
            this._error = err.message || String(err);
          });
      });
      footer.append(scratchBtn, useBtn);
      dialog.appendChild(footer);
      paintSelection();
      dialog.addEventListener("closed", () => {
        dialog.remove();
        if (!settled) {
          void restoreSnaps().then(() => finish(null));
        }
      });
      this.shadowRoot.appendChild(dialog);
    });
  }

  async _copyGalleryPalette(paletteId) {
    const source = galleryPalette(paletteId);
    if (!source) {
      throw new Error(`Palette ${paletteId} not found`);
    }
    const saved = await this._hass.callWS({
      type: `${DOMAIN}/save_variable`,
      data: {
        name: galleryCopyName(
          this._t(source.nameKey, source.name),
          (this._variables || []).map((item) => item.name)
        ),
        kind: "palette",
        slots: source.slots,
        builtin_id: source.id,
      },
    });
    const list = [...(this._variables || [])];
    const index = list.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      list[index] = saved;
    } else {
      list.push(saved);
    }
    this._variables = list;
    return saved;
  }

  async _ensureDefaultTheme({ adoptDraft = true } = {}) {
    const result = await this._hass.callWS({
      type: `${DOMAIN}/ensure_default_theme`,
    });
    if (Array.isArray(result?.variables)) {
      this._variables = result.variables;
    }
    const theme = result?.theme;
    if (!theme) {
      throw new Error("Default circadian preset was not created");
    }
    if (adoptDraft) {
      this._adoptSavedTheme(theme);
    } else {
      const themes = [...(this._themes || [])];
      const index = themes.findIndex((item) => item.id === theme.id);
      if (index >= 0) {
        themes[index] = structuredClone(theme);
      } else {
        themes.push(structuredClone(theme));
      }
      this._themes = themes;
    }
    return theme;
  }

  async _copyThemePreset(preset) {
    if (preset?.seed) {
      return this._ensureDefaultTheme();
    }
    const events = {};
    const copied = new Map();
    for (const eventId of ["dawn", "sunrise", "noon", "sunset", "dusk"]) {
      const spec = preset.events[eventId];
      if (spec.palette) {
        let paletteId = copied.get(spec.palette);
        if (!paletteId) {
          const palette = await this._copyGalleryPalette(spec.palette);
          paletteId = palette.id;
          copied.set(spec.palette, paletteId);
        }
        events[eventId] = {
          color: { variable_ref: paletteId },
          brightness: spec.brightness,
          assignment_seed: 0,
        };
      } else {
        events[eventId] = {
          color: structuredClone(spec.color),
          brightness: spec.brightness,
        };
      }
    }
    const saved = await this._hass.callWS({
      type: `${DOMAIN}/save_theme`,
      data: {
        name: galleryCopyName(
          this._t(preset.nameKey, preset.name),
          (this._themes || []).map((item) => item.name)
        ),
        builtin_id: preset.id,
        events,
      },
    });
    this._adoptSavedTheme(saved);
    return saved;
  }

  async _draftFromThemePresetEvent(spec, current) {
    if (spec?.palette) {
      const currentVar = (this._variables || []).find(
        (item) => item.id === current?.variable_ref
      );
      const keep =
        variableIsPalette(currentVar) && currentVar.builtin_id === spec.palette
          ? currentVar
          : (this._variables || []).find(
              (item) =>
                variableIsPalette(item) && item.builtin_id === spec.palette
            );
      const palette = keep || (await this._copyGalleryPalette(spec.palette));
      return {
        state: "on",
        brightness: spec.brightness,
        variable_ref: palette.id,
        assignment_seed: 0,
      };
    }
    return {
      state: "on",
      brightness: spec.brightness,
      ...structuredClone(spec.color),
    };
  }

  _confirmResetPreset(kind) {
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute(
      "header-title",
      this._t("frontend.library.reset_preset_title", "Reset to preset default?")
    );
    dialog.open = true;
    const text = document.createElement("p");
    text.textContent = this._t(
      "frontend.library.reset_preset_text",
      "This replaces your edits with the original preset. You can undo it afterward."
    );
    dialog.appendChild(text);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const confirm = document.createElement("ha-button");
    confirm.slot = "primaryAction";
    confirm.textContent = this._t("frontend.library.reset_preset", "Reset to preset default");
    confirm.addEventListener("click", () => {
      dialog.open = false;
      if (kind === "theme") {
        void this._resetThemeToPresetDefault();
        return;
      }
      this._resetPaletteToPresetDefault();
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  }

  _resetPaletteToPresetDefault() {
    const draft = this._variableDraft;
    const source = galleryPalette(draft?.builtin_id);
    if (!source || this._view !== "palette") {
      return;
    }
    this._commitUndo();
    this._variableDraft = {
      ...draft,
      slots: structuredClone(source.slots),
    };
    this._saveSoon();
    this._render();
  }

  async _resetThemeToPresetDefault() {
    const draft = this._themeDraft;
    const preset = galleryTheme(draft?.builtin_id);
    if (!preset || this._view !== "theme") {
      return;
    }
    this._commitUndo();
    if (preset.seed) {
      await this._ensureDefaultTheme({ adoptDraft: false });
      this._themeDraft = {
        ...this._themeDraft,
        builtin_id: preset.id,
        events: seedThemeEvents(preset),
      };
      this._saveSoon();
      this._rebuildThemeDial();
      this._render();
      return;
    }
    const events = {};
    for (const eventId of ["dawn", "sunrise", "noon", "sunset", "dusk"]) {
      const spec = preset.events?.[eventId];
      if (!spec) {
        continue;
      }
      if (spec.palette) {
        const current = draft.events?.[eventId]?.color;
        const currentVar = (this._variables || []).find(
          (item) => item.id === current?.variable_ref
        );
        const keep =
          variableIsPalette(currentVar) && currentVar.builtin_id === spec.palette
            ? currentVar
            : (this._variables || []).find(
                (item) =>
                  variableIsPalette(item) && item.builtin_id === spec.palette
              );
        const palette = keep || (await this._copyGalleryPalette(spec.palette));
        events[eventId] = {
          color: { variable_ref: palette.id },
          brightness: spec.brightness,
          assignment_seed: 0,
        };
      } else {
        events[eventId] = {
          color: structuredClone(spec.color),
          brightness: spec.brightness,
        };
      }
    }
    this._themeDraft = { ...this._themeDraft, events };
    this._saveSoon();
    this._rebuildThemeDial();
    this._render();
  }

  _chooseCircadianTheme({ areaId } = {}) {
    return new Promise((resolve) => {
      this.shadowRoot.querySelector("ha-dialog.scene-theme-create-dialog")?.remove();
      const dialog = document.createElement("ha-dialog");
      dialog.className = "scene-palette-dialog scene-theme-create-dialog";
      dialog.setAttribute(
        "header-title",
        this._t("frontend.dialogs.scene_theme_title", "New circadian scene")
      );
      dialog.open = true;
      let settled = false;
      let selectedKind = null;
      let selectedId = null;
      let snaps = null;
      const areaLights = this._areaLightIds(areaId);
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        dialog.open = false;
        resolve(value);
      };
      const restoreSnaps = async () => {
        if (!snaps) {
          return;
        }
        const prior = snaps;
        snaps = null;
        await Promise.all(
          Object.entries(prior).map(([entityId, stored]) =>
            this._applyLightState(entityId, stored, { transition: 0.4 })
          )
        );
      };
      const selectedRecord = () =>
        selectedKind === "preset"
          ? galleryTheme(selectedId)
          : (this._themes || []).find((item) => item.id === selectedId);
      const noonDraft = (theme) => {
        const ev = theme?.events?.noon;
        if (!ev) {
          return null;
        }
        const draft = { state: "on", brightness: ev.brightness ?? 200 };
        if (ev.palette) {
          const palette = galleryAsPalette(ev.palette);
          if (!palette) {
            return null;
          }
          applyVariableToDraft(draft, palette, { catalog: this._variables });
          return draft;
        }
        const color = ev.color || {};
        if (color.variable_ref) {
          const variable = (this._variables || []).find(
            (item) => item.id === color.variable_ref
          );
          if (variable) {
            applyVariableToDraft(draft, variable, { catalog: this._variables });
            return draft;
          }
        }
        return { ...draft, ...color };
      };
      const applyPreview = async () => {
        const theme = selectedRecord();
        const draft = noonDraft(theme);
        if (!this._readRoomPreviewPref() || !draft || !areaLights.length) {
          await restoreSnaps();
          return;
        }
        if (!snaps) {
          snaps = {};
          for (const entityId of areaLights) {
            snaps[entityId] = this._snapshotLight(entityId);
          }
        }
        await Promise.all(
          areaLights.map((entityId) =>
            this._applyLightState(entityId, draft, { transition: 0.4 })
          )
        );
      };
      const hint = document.createElement("p");
      hint.className = "scene-palette-hint";
      hint.textContent = this._t(
        "frontend.dialogs.scene_theme_hint",
        "Create a circadian scene from a preset or start from scratch"
      );
      const liveToggle = document.createElement("label");
      liveToggle.className = "live-edit-toggle";
      const liveLabel = document.createElement("span");
      liveLabel.textContent = this._t(
        "frontend.dialogs.scene_palette_live_preview",
        "Live preview"
      );
      const liveSwitch = document.createElement("ha-switch");
      liveSwitch.checked = this._readRoomPreviewPref();
      liveSwitch.addEventListener("change", () => {
        this._writeRoomPreviewPref(Boolean(liveSwitch.checked));
        this._syncRoomPreviewControl();
        void applyPreview();
      });
      liveToggle.slot = "headerActionItems";
      liveToggle.append(liveLabel, liveSwitch);
      const list = document.createElement("div");
      list.className = "scene-palette-list";
      const themes = this._themes || [];
      const rows = [];
      const cards = [];
      const paintCard = (theme) => (bg) => {
        bg.classList.add("theme-dial");
        paintThemeDial(bg, theme, this._variables || []);
      };
      if (themes.length) {
        const yours = document.createElement("p");
        yours.className = "scene-gallery-label";
        yours.textContent = this._t(
          "frontend.dialogs.scene_theme_yours",
          "Your circadian presets"
        );
        const yoursGrid = document.createElement("div");
        yoursGrid.className = "scene-cards";
        for (const theme of themes) {
          const choice = createPresetSceneCard({
            name: theme.name || theme.id,
            paint: paintCard(theme),
            asButton: true,
          });
          choice.card.addEventListener("click", () => choose("user", theme.id));
          yoursGrid.appendChild(choice.slot);
          rows.push({ id: theme.id, ...choice });
        }
        list.append(yours, yoursGrid);
      }
      const adopted = new Set(themes.map((item) => item.builtin_id).filter(Boolean));
      if (themes.some((item) => item.id === "default")) {
        adopted.add("default");
      }
      const presets = galleryThemes().filter((item) => !adopted.has(item.id));
      if (presets.length) {
        const presetsLabel = document.createElement("p");
        presetsLabel.className = "scene-gallery-label";
        presetsLabel.textContent = this._t(
          "frontend.dialogs.scene_theme_presets",
          "Starter presets"
        );
        const grid = document.createElement("div");
        grid.className = "scene-cards";
        for (const preset of presets) {
          const choice = createPresetSceneCard({
            name: this._t(preset.nameKey, preset.name),
            paint: paintCard(preset),
            asButton: true,
          });
          choice.card.addEventListener("click", () => choose("preset", preset.id));
          grid.appendChild(choice.slot);
          cards.push({ id: preset.id, ...choice });
        }
        list.append(presetsLabel, grid);
      }
      const body = document.createElement("div");
      body.className = "scene-palette-body";
      list.prepend(hint);
      body.append(list);
      dialog.append(liveToggle, body);
      const footer = customElements.get("ha-dialog-footer")
        ? document.createElement("ha-dialog-footer")
        : document.createElement("div");
      footer.slot = "footer";
      const finishScratch = () => {
        void restoreSnaps().then(() => finish({ custom: true }));
      };
      const scratchBtn = document.createElement("ha-button");
      scratchBtn.slot = "primaryAction";
      scratchBtn.appearance = "filled";
      scratchBtn.variant = "brand";
      scratchBtn.textContent = this._t(
        "frontend.dialogs.scene_theme_start_scratch",
        "Start from scratch"
      );
      scratchBtn.addEventListener("click", () => finishScratch());
      const useBtn = document.createElement("ha-button");
      useBtn.slot = "primaryAction";
      useBtn.variant = "brand";
      useBtn.textContent = this._t(
        "frontend.dialogs.scene_theme_from_preset",
        "Create from this preset"
      );
      useBtn.hidden = true;
      const markChoice = (row, on) => {
        row.card.classList.toggle("selected", on);
        row.slot.classList.toggle("glow-on", on);
      };
      const choose = (kind, id) => {
        selectedKind = kind;
        selectedId = id;
        paintSelection();
        void applyPreview();
      };
      const paintSelection = () => {
        for (const row of rows) {
          markChoice(row, selectedKind === "user" && row.id === selectedId);
        }
        for (const card of cards) {
          markChoice(card, selectedKind === "preset" && card.id === selectedId);
        }
        const hasPreset = Boolean(selectedKind && selectedRecord());
        useBtn.hidden = !hasPreset;
        scratchBtn.slot = hasPreset ? "secondaryAction" : "primaryAction";
        scratchBtn.appearance = hasPreset ? "plain" : "filled";
        scratchBtn.variant = hasPreset ? "neutral" : "brand";
      };
      useBtn.addEventListener("click", () => {
        if (!selectedKind) {
          finishScratch();
          return;
        }
        const deliver = (value) => {
          const keepPreview = this._readRoomPreviewPref() && Boolean(snaps);
          if (!keepPreview) {
            void restoreSnaps().then(() => finish(value));
            return;
          }
          snaps = null;
          finish(value);
        };
        if (selectedKind === "user") {
          const theme = themes.find((item) => item.id === selectedId);
          if (theme) {
            deliver({ theme });
          }
          return;
        }
        const preset = galleryTheme(selectedId);
        if (preset) {
          deliver({ preset });
        }
      });
      footer.append(scratchBtn, useBtn);
      dialog.appendChild(footer);
      paintSelection();
      dialog.addEventListener("closed", () => {
        dialog.remove();
        if (!settled) {
          void restoreSnaps().then(() => finish(null));
        }
      });
      this.shadowRoot.appendChild(dialog);
    });
  }

  async _createLibraryItem(kind, { fromDraft, areaId, areaName } = {}) {
    if (this._creatingLibrary) {
      return;
    }
    if (!(await this._confirmLeaveEditor())) {
      return;
    }
    this._creatingLibrary = true;
    const beforeTarget = this._historyTarget();
    try {
      if (kind === "scene") {
        const choice = await this._chooseCircadianTheme({ areaId });
        if (!choice) {
          return;
        }
        const theme = choice.custom
          ? await this._ensureDefaultTheme({ adoptDraft: false })
          : choice.preset
            ? await this._copyThemePreset(choice.preset)
            : choice.theme;
        const saved = await this._hass.callWS({
          type: `${DOMAIN}/save`,
          data: {
            kind: "circadian",
            scene_name: choice.custom
              ? this._sceneNameInArea(areaId, this._untitledLabel())
              : this._sceneNameInArea(areaId, theme?.name),
            area: areaId || null,
            theme_id: theme.id,
            membership: { exclude: [], include: [] },
            overrides: {},
            lights: {},
          },
        });
        this._upsertSceneInList(saved);
        this._commitCreatedUndo({
          kind: "scene",
          id: saved.id,
          record: saved,
          beforeTarget,
        });
        this._refreshVisibleSceneList();
        this._go(`edit/${saved.id}`);
        return;
      }
      if (kind === "simple") {
        const choice = await this._chooseScenePalette({ areaId });
        if (!choice) {
          return;
        }
        const lights = {};
        let paletteId = null;
        let assignmentSeed = 0;
        if (choice.palette) {
          paletteId = choice.palette.id;
          assignmentSeed = choice.seed || 0;
          for (const entityId of this._areaLightIds(areaId)) {
            lights[entityId] = { variable_ref: paletteId };
          }
        } else {
          for (const entityId of this._areaLightIds(areaId)) {
            const prior = choice.room?.[entityId];
            lights[entityId] = prior
              ? structuredClone(prior)
              : this._snapshotLight(entityId);
          }
        }
        const saved = await this._hass.callWS({
          type: `${DOMAIN}/save`,
          data: {
            kind: "simple",
            scene_name: choice.palette
              ? this._sceneNameFromPalette(areaId, choice.palette)
              : this._untitledLabel(),
            area: areaId || null,
            membership: { exclude: [], include: [] },
            lights,
            palette_id: paletteId,
            assignment_seed: assignmentSeed,
          },
        });
        if (choice.keepPreview && choice.snapshots) {
          this._roomPreview = true;
          this._roomPreviewSnapshots = choice.snapshots;
          this._scenePreviewOwnerId = saved.id;
          // The dialog already painted these lights. A second apply with a
          // transition flashes the room back and forth.
          this._roomPreviewHoldApply = true;
        }
        this._upsertSceneInList(saved);
        this._commitCreatedUndo({
          kind: "scene",
          id: saved.id,
          record: saved,
          beforeTarget,
        });
        this._refreshVisibleSceneList();
        this._go(`edit/${saved.id}`);
        return;
      }
      if (kind === "theme") {
        const choice = await this._chooseCircadianTheme();
        if (!choice) {
          return;
        }
        const source = choice.theme || galleryTheme("default");
        const saved = choice.preset
          ? await this._copyThemePreset(choice.preset)
          : await this._hass.callWS({
              type: `${DOMAIN}/save_theme`,
              data: {
                name: choice.theme
                  ? galleryCopyName(source.name, (this._themes || []).map((item) => item.name))
                  : this._untitledLabel(),
                events: structuredClone(source.events),
              },
            });
        this._commitCreatedUndo({
          kind: "theme",
          id: saved.id,
          record: saved,
          beforeTarget,
        });
        this._adoptSavedTheme(saved);
        this._go(`theme/${saved.id}`);
        return;
      }
      const isPalette = kind === "palette";
      const from = fromDraft || this._pendingVariableFromDraft;
      this._pendingVariableFromDraft = null;
      const data = isPalette
        ? {
            name: this._untitledLabel(),
            kind: "palette",
            slots: defaultPaletteSlots(),
          }
        : {
            name: this._untitledLabel(),
            kind: "color",
            brightness: Number(from?.brightness) || 255,
            color: colorPayloadFromDraft(from || this._variableEditorDraft(null)),
          };
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save_variable`,
        data,
      });
      this._commitCreatedUndo({
        kind: isPalette ? "palette" : "variable",
        id: saved.id,
        record: saved,
        beforeTarget,
      });
      const list = [...(this._variables || [])];
      const index = list.findIndex((item) => item.id === saved.id);
      if (index >= 0) {
        list[index] = saved;
      } else {
        list.push(saved);
      }
      this._variables = list;
      this._go(isPalette ? `palette/${saved.id}` : `variable/${saved.id}`);
    } catch (err) {
      this._error = err.message || String(err);
      this._render();
    } finally {
      this._creatingLibrary = false;
    }
  }

  _commitCreatedUndo({ kind, id, record, beforeTarget }) {
    this._undoStack.push({
      session: this._snapshotSession(),
      after: { created: { kind, id, record } },
      target: beforeTarget || this._historyTarget(),
      created: { kind, id, record },
      focus: null,
    });
    if (this._undoStack.length > UNDO_STACK_LIMIT) {
      this._undoStack.shift();
    }
    this._redoStack = [];
    this._syncUndoButtons();
  }

  _createdHistoryTarget(created) {
    if (created.kind === "scene") {
      return { view: "edit", editId: created.id, themeId: null, variableId: null };
    }
    if (created.kind === "theme") {
      return { view: "theme", editId: null, themeId: created.id, variableId: null };
    }
    if (created.kind === "palette") {
      return {
        view: "palette",
        editId: null,
        themeId: null,
        variableId: created.id,
      };
    }
    return {
      view: "variable",
      editId: null,
      themeId: null,
      variableId: created.id,
    };
  }

  async _deleteCreated(created) {
    if (!created?.id) {
      return;
    }
    if (created.kind === "scene") {
      await this._hass.callWS({
        type: `${DOMAIN}/delete`,
        scene_id: created.id,
      });
      this._dropSceneFromList(created.id);
      return;
    }
    if (created.kind === "theme") {
      await this._hass.callWS({
        type: `${DOMAIN}/delete_theme`,
        theme_id: created.id,
      });
      this._themes = (this._themes || []).filter((item) => item.id !== created.id);
      if (this._themeId === created.id) {
        this._themeId = null;
        this._themeDraft = null;
      }
      return;
    }
    await this._hass.callWS({
      type: `${DOMAIN}/delete_variable`,
      variable_id: created.id,
    });
    this._variables = (this._variables || []).filter(
      (item) => item.id !== created.id
    );
    if (this._variableId === created.id) {
      this._variableId = null;
      this._variableDraft = null;
    }
  }

  async _recreateCreated(created) {
    if (!created?.record) {
      return;
    }
    if (created.kind === "scene") {
      const data = structuredClone(created.record.form || created.record);
      delete data.id;
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save`,
        data,
      });
      created.id = saved.id;
      created.record = saved;
      this._upsertSceneInList(saved);
      return;
    }
    if (created.kind === "theme") {
      const data = structuredClone(created.record);
      delete data.id;
      delete data.revision;
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save_theme`,
        data,
      });
      created.id = saved.id;
      created.record = saved;
      this._adoptSavedTheme(saved);
      return;
    }
    const data = structuredClone(created.record);
    delete data.id;
    delete data.revision;
    const saved = await this._hass.callWS({
      type: `${DOMAIN}/save_variable`,
      data,
    });
    created.id = saved.id;
    created.record = saved;
    const list = [...(this._variables || [])];
    const index = list.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      list[index] = saved;
    } else {
      list.push(saved);
    }
    this._variables = list;
  }

  _openVariableEditor(variable) {
    if (variable?.id) {
      this._go(
        variableIsPalette(variable)
          ? `palette/${variable.id}`
          : `variable/${variable.id}`
      );
      return;
    }
    void this._createLibraryItem("variable");
  }

  _openPaletteEditor(palette) {
    if (palette?.id) {
      this._go(`palette/${palette.id}`);
      return;
    }
    void this._createLibraryItem("palette");
  }

  _variableWorkingCopy(variable) {
    const paletteEditor = this._view === "palette";
    if (!variable) {
      if (paletteEditor) {
        this._pendingVariableFromDraft = null;
        return {
          kind: "palette",
          name: "",
          colorDraft: this._variableEditorDraft(null),
          slots: defaultPaletteSlots(),
        };
      }
      const from = this._pendingVariableFromDraft;
      this._pendingVariableFromDraft = null;
      const colorDraft = from
        ? {
            ...colorPayloadFromDraft(from),
            brightness: Number(from.brightness) || 255,
            state: "on",
          }
        : this._variableEditorDraft(null);
      return {
        kind: "color",
        name: "",
        colorDraft,
        slots: defaultPaletteSlots(),
      };
    }
    return {
      kind: paletteEditor || variableIsPalette(variable) ? "palette" : "color",
      name: variable.name || "",
      builtin_id: variable.builtin_id || null,
      colorDraft: this._variableEditorDraft(variable),
      slots: variableIsPalette(variable)
        ? structuredClone(variable.slots || defaultPaletteSlots())
        : defaultPaletteSlots(),
    };
  }

  _canonicalLibraryHash(item) {
    const prefix = variableIsPalette(item) ? "palette" : "variable";
    return `${prefix}/${item.id}`;
  }

  _alignLibraryView(item) {
    const want = variableIsPalette(item) ? "palette" : "variable";
    if (this._view === want) {
      return;
    }
    this._view = want;
    const hash = this._canonicalLibraryHash(item);
    if (this._currentHash() !== hash) {
      history.replaceState(null, "", this._hashHref(hash));
    }
  }

  async _loadVariable(variableId) {
    const token = this._startPanelLoad();
    await this._ensureChangeSubscription();
    if (!this._panelLoadIsCurrent(token)) return;
    this._sharedDeleted = false;
    try {
      const payload = await this._hass.callWS({ type: `${DOMAIN}/list` });
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._items = payload?.scenes || [];
      this._variables = payload?.variables || [];
      this._themes = payload?.themes || [];
      this._floors = payload?.floors || [];
      this._areaCatalogLoaded = Array.isArray(payload?.floors);
      this._adoptSettings(payload?.settings);
      if (variableId === "new") {
        this._variableId = null;
        this._variableBase = null;
        this._variableDraft = this._variableWorkingCopy(null);
        this._error = null;
        this._resetSession();
        this._render();
        return;
      }
      const variable = (this._variables || []).find((item) => item.id === variableId);
      if (!variable) {
        const missing =
          this._view === "palette"
            ? this._t("frontend.library.palette_missing", "Scene preset not found")
            : this._t("frontend.library.variable_missing", "Color preset not found");
        this._error = missing;
        this._view = "list";
        this._variableId = null;
        this._variableDraft = null;
        this._render();
        return;
      }
      this._variableId = variable.id;
      this._variableBase = structuredClone(variable);
      this._alignLibraryView(variable);
      this._variableDraft = this._variableWorkingCopy(variable);
      this._error = null;
      this._resetSession();
      this._render();
      return;
    } catch (err) {
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._error = err.message || String(err);
      this._variableDraft = null;
    }
    if (!this._panelLoadIsCurrent(token)) {
      return;
    }
    this._render();
  }

  _variableSavePayload() {
    const working = this._variableDraft;
    if (!working) {
      return null;
    }
    const name = (working.name || "").trim();
    if (!name) {
      return null;
    }
    if (working.kind === "palette") {
      return {
        id: this._variableId || undefined,
        name,
        kind: "palette",
        slots: working.slots,
        ...(working.builtin_id ? { builtin_id: working.builtin_id } : {}),
      };
    }
    const brightness = Number(working.colorDraft?.brightness);
    if (!Number.isFinite(brightness)) {
      return null;
    }
    return {
      id: this._variableId || undefined,
      name,
      kind: "color",
      brightness,
      color: colorPayloadFromDraft(working.colorDraft),
    };
  }

  async _saveLibraryItem(kind, data, baseItem = null) {
    const type = kind === "theme" ? "save_theme" : "save_variable";
    let base = baseItem || (kind === "theme" ? this._themes : this._variables)?.find((item) => item.id === data.id);
    let revision = base?.revision;
    if (base) {
      base = structuredClone(base);
      delete base.revision;
    }
    if (data.id && (!base || !revision)) {
      throw new Error(this._t("frontend.conflict.reload", "Reload this item before saving"));
    }
    let draft = structuredClone(data);
    for (;;) {
      const result = await this._hass.callWS({
        type: `${DOMAIN}/${type}`,
        data: draft,
        ...(data.id ? { base, base_revision: revision } : {}),
      });
      if (result.status !== "conflict") return result;
      this._sharedConflict = true;
      try {
        draft = await this._chooseConflictValues(
          { base, current: result.current, fields: result.fields },
          draft
        );
      } finally {
        this._sharedConflict = false;
      }
      base = structuredClone(result.current);
      revision = result.revision;
    }
  }

  async _saveSceneItem(scene, data) {
    let base = structuredClone(scene.form || scene);
    let revision = scene.revision;
    if (!revision) throw new Error(this._t("frontend.conflict.reload", "Reload this item before saving"));
    let draft = structuredClone(data);
    for (;;) {
      const result = await this._hass.callWS({
        type: `${DOMAIN}/save`,
        scene_id: scene.id,
        data: draft,
        base,
        base_revision: revision,
      });
      if (result.status !== "conflict") return result;
      this._sharedConflict = true;
      try {
        draft = await this._chooseConflictValues(
          { base, current: result.current, fields: result.fields },
          draft
        );
      } finally {
        this._sharedConflict = false;
      }
      base = structuredClone(result.current);
      revision = result.revision;
    }
  }

  async _saveVariableQuiet() {
    const payload = this._variableSavePayload();
    const data = payload && structuredClone(payload);
    if (!data) {
      return;
    }
    if (this._saving) {
      this._saveSoon();
      return;
    }
    this._saving = true;
    const editingId = this._variableId;
    const editingView = this._view;
    const savingRevision = this._variableBase?.revision;
    try {
      const saved = await this._saveLibraryItem("variable", data, this._variableBase);
      if (this._sharedDeleted) return;
      if (this._variableId === editingId && this._variableBase?.revision !== savingRevision) {
        if (!this._sharedConflict && !this._sharedDeleted) this._saveSoon();
        return;
      }
      const list = [...(this._variables || [])];
      const index = list.findIndex((item) => item.id === saved.id);
      if (index >= 0) {
        list[index] = saved;
      } else {
        list.push(saved);
      }
      this._variables = list;
      if (this._variableId !== editingId || this._view !== editingView) return;
      this._variableId = saved.id;
      this._variableBase = structuredClone(saved);
      this._alignLibraryView(saved);
      const latest = this._variableSavePayload();
      const next = reconcileSaveResponse(data, latest, saved);
      if (next.conflicts.length) {
        this._sharedConflict = true;
        try {
          const resolved = await this._chooseConflictValues(
            { base: data, current: saved, fields: next.conflicts }, latest
          );
          patchInPlace(this._variableDraft, this._variableWorkingCopy(resolved));
        } finally {
          this._sharedConflict = false;
        }
        this._saveSoon();
      } else {
        patchInPlace(this._variableDraft, this._variableWorkingCopy(next.value));
      }
      if (next.changedDuringSave && !next.conflicts.length) {
        this._saveSoon();
      } else if (!next.conflicts.length && (this._view === "variable" || this._view === "palette")) {
        this._sessionBaseline = this._snapshotSession();
      }
      const hash = this._canonicalLibraryHash(saved);
      if (this._currentHash() !== hash) {
        history.replaceState(null, "", this._hashHref(hash));
      }
    } catch (err) {
      this._error = err.message || String(err);
    } finally {
      this._saving = false;
    }
  }

  _libraryRailCanStay(page) {
    const rail = page?.querySelector(":scope > .area-rail");
    const stage = page?.querySelector(":scope > .stage-col");
    if (!rail || !stage || this._railTab !== "library") {
      return false;
    }
    const id = this._view === "theme" ? this._themeId : this._variableId;
    if (!id || (this._view !== "variable" && this._view !== "palette" && this._view !== "theme")) {
      return false;
    }
    // The open item is already a card in this rail. Rebuilding would start
    // the list at scroll 0 and the reveal would treat it as off-screen.
    return Boolean(rail.querySelector(`[data-item-id="${CSS.escape(id)}"]`));
  }

  _paintVariableEditorInPlace() {
    const page = this._contentEl?.querySelector(":scope > .workspace");
    if (!this._libraryRailCanStay(page) || (this._view !== "variable" && this._view !== "palette")) {
      return false;
    }
    const stage = page.querySelector(":scope > .stage-col");
    const isPalette = this._view === "palette";
    const working = this._variableDraft || this._variableWorkingCopy(null);
    working.kind = isPalette ? "palette" : "color";
    this._variableDraft = working;
    this._parkSunPath();
    const scroll = this._stageScrollEl(stage);
    if (scroll) {
      scroll.scrollTop = 0;
    }
    const host = document.createElement("div");
    host.className = isPalette ? "simple-editor-host" : "library-editor";
    if (this._error) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      host.appendChild(error);
    }
    scroll?.replaceChildren(host);
    this._mountPageBanners(stage);
    if (isPalette) {
      renderPaletteEditor(this, host, { glowHost: null });
      this._syncSceneUsed();
    } else {
      this._fillVariableEditor(host);
      this._syncLibraryUsedBy();
    }
    this._syncWorkspaceScrollport();
    this._playSimpleEnterIfNeeded(host);
    this._syncRailSelection();
    return true;
  }

  _paintThemeEditorInPlace() {
    const page = this._contentEl?.querySelector(":scope > .workspace");
    if (!this._libraryRailCanStay(page) || this._view !== "theme") {
      return false;
    }
    const stage = page.querySelector(":scope > .stage-col");
    const scroll = this._stageScrollEl(stage);
    this._parkSunPath();
    if (scroll) {
      for (const child of [...scroll.children]) {
        child.remove();
      }
      scroll.scrollTop = 0;
    }
    if (this._error && scroll) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      scroll.appendChild(error);
    }
    this._mountSunPath(stage);
    this._syncWorkspaceScrollport();
    this._syncSceneUsed();
    this._syncRailSelection();
    return true;
  }

  _renderVariableEditor({ keepRail = false } = {}) {
    this._syncAppBarTitle();
    this._setNavigationIcon(this._narrow ? this._backButton() : this._menuButton());
    this._setListActions();
    this._syncEditorChrome();
    this._syncSaveFab();
    this._contentEl.classList.add("wide");
    const split = !this._narrow;
    this._contentEl.classList.toggle("workspace-split", split);
    if (keepRail && this._paintVariableEditorInPlace()) {
      return;
    }
    this._parkSunPath();
    const isPalette = this._view === "palette";
    const working = this._variableDraft || this._variableWorkingCopy(null);
    working.kind = isPalette ? "palette" : "color";
    this._variableDraft = working;
    const page = renderLanding(this, { includeStage: true });
    const stage = page.querySelector(".stage-col");
    const host = document.createElement("div");
    host.className = isPalette ? "simple-editor-host" : "library-editor";
    if (this._error) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = this._error;
      host.appendChild(error);
    }
    if (isPalette) {
      if (this._narrow) {
        this._contentEl.classList.remove("workspace-split");
        this._contentEl.replaceChildren(host);
        renderPaletteEditor(this, host, { glowHost: null });
      } else {
        const scroll = this._stageScrollEl(stage);
        scroll?.replaceChildren(host);
        this._mountWorkspacePage(page);
        this._mountPageBanners(stage);
        renderPaletteEditor(this, host, { glowHost: null });
      }
      this._syncWorkspaceScrollport();
      this._playSimpleEnterIfNeeded(host);
      this._syncSceneUsed();
      this._syncRailSelection();
      return;
    }
    this._fillVariableEditor(host);
    if (this._narrow) {
      this._contentEl.classList.remove("workspace-split");
      this._contentEl.replaceChildren(host);
    } else {
      const scroll = this._stageScrollEl(stage);
      scroll?.replaceChildren(host);
      this._mountWorkspacePage(page);
      this._mountPageBanners(stage);
    }
    this._syncWorkspaceScrollport();
    this._playSimpleEnterIfNeeded(host);
    this._syncLibraryUsedBy();
    this._syncRailSelection();
  }

  _fillVariableEditor(host) {
    const working = this._variableDraft || this._variableWorkingCopy(null);
    working.kind = "color";
    this._variableDraft = working;
    const hint = document.createElement("p");
    hint.className = "library-hint";
    hint.textContent = this._t(
      "frontend.library.variable_edit_hint",
      "Color and brightness are shared by every circadian preset or light that still uses this color preset."
    );
    host.append(hint);
    const draft = working.colorDraft;
    const briInput = this._haInput(
      this._t("frontend.lights.brightness", "Brightness"),
      String(draft.brightness ?? 255),
      { type: "number", min: 0, max: 255 }
    );
    const bindBri = (value) => {
      if (Number.isFinite(value)) {
        this._beginSimpleUndo();
        draft.brightness = value;
        this._saveSoon();
      }
    };
    briInput.addEventListener("value-changed", (ev) => {
      bindBri(Number(ev.detail?.value ?? briInput.value));
    });
    briInput.addEventListener("change", () => bindBri(Number(briInput.value)));
    const wheel = createSceneColorWheel({
      t: (key, fallback, vars) => this._t(key, fallback, vars),
      pinFlip: this._wheelPinFlip || null,
      hasColor: true,
      hasTemp: true,
      tempMin: 2000,
      tempMax: 6500,
      getState: () => ({
        scenes: [{ id: "variable", index: 1, draft }],
        sequence: ["variable"],
        activeId: "variable",
      }),
      onChange: ({ dragging } = {}) => {
        if (dragging) {
          this._holdSimpleUndo(true);
        }
        try {
          this._beginSimpleUndo();
          delete draft.variable_ref;
          wheel.sync();
          this._saveSoon();
        } finally {
          if (!dragging) {
            this._holdSimpleUndo(false);
          }
        }
      },
    });
    this._variableWheel = wheel;
    host.append(briInput, wheel.el);
    wheel.sync();
  }

  _openThemeEditor(theme) {
    if (theme?.id) {
      this._go(`theme/${theme.id}`);
    }
  }

  async _loadTheme(themeId) {
    const token = this._startPanelLoad();
    await this._ensureChangeSubscription();
    if (!this._panelLoadIsCurrent(token)) return;
    this._sharedDeleted = false;
    try {
      const payload = await this._hass.callWS({ type: `${DOMAIN}/list` });
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._items = payload?.scenes || [];
      this._variables = payload?.variables || [];
      this._themes = payload?.themes || [];
      this._floors = payload?.floors || [];
      this._areaCatalogLoaded = Array.isArray(payload?.floors);
      this._adoptSettings(payload?.settings);
      if (themeId === "new") {
        const source = (this._themes || [])[0] || galleryTheme("default");
        this._themeId = null;
        this._themeBase = null;
        this._themeDraft = {
          name: "",
          events: structuredClone(source.events),
        };
        this._error = null;
        this._resetSession();
        this._render();
        return;
      }
      const theme = (this._themes || []).find((item) => item.id === themeId);
      if (!theme) {
        this._error = this._t("frontend.library.theme_missing", "Circadian preset not found");
        this._view = "list";
        this._themeId = null;
        this._render();
        return;
      }
      this._themeDraft = structuredClone(theme);
      delete this._themeDraft.revision;
      this._themeBase = structuredClone(theme);
      this._error = null;
    } catch (err) {
      if (!this._panelLoadIsCurrent(token)) {
        return;
      }
      this._error = err.message || String(err);
      this._themeDraft = null;
    }
    if (!this._panelLoadIsCurrent(token)) {
      return;
    }
    this._resetSession();
    this._render();
  }

  _renderThemeEditor({ keepRail = false } = {}) {
    if (!this._headerEl) {
      return;
    }
    this._syncAppBarTitle();
    this._setNavigationIcon(this._narrow ? this._backButton() : this._menuButton());
    this._setEditorActions();
    this._syncEditorChrome();
    this._syncSaveFab();
    this._contentEl.classList.add("wide");
    const split = !this._narrow;
    this._contentEl.classList.toggle("workspace-split", split);
    if (keepRail && this._paintThemeEditorInPlace()) {
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
    if (this._narrow) {
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
    this._syncWorkspaceScrollport();
    this._syncSceneUsed();
  }

  _adoptSavedTheme(saved, { adoptDraft = true } = {}) {
    if (adoptDraft) {
      this._themeDraft = structuredClone(saved);
      delete this._themeDraft.revision;
      this._themeBase = structuredClone(saved);
    }
    const themes = [...(this._themes || [])];
    const index = themes.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      themes[index] = structuredClone(saved);
    } else {
      themes.push(structuredClone(saved));
    }
    this._themes = themes;
    if (this._view === "edit" && this._sessionBaseline) {
      this._sessionBaseline = {
        ...this._sessionBaseline,
        theme: structuredClone(saved),
      };
    }
  }

  async _ensureThemeDraft() {
    if (this._view === "theme") {
      return Boolean(this._themeDraft);
    }
    if (this._formData?.kind === "simple") {
      return false;
    }
    const themeId = this._formData?.theme_id || "default";
    if (this._themeDraft?.id === themeId) {
      return true;
    }
    const theme = (this._themes || []).find((item) => item.id === themeId);
    if (!theme) {
      return false;
    }
    this._themeDraft = structuredClone(theme);
    delete this._themeDraft.revision;
    this._themeBase = structuredClone(theme);
    if (!this._themeDraft.id) {
      this._themeDraft.id = themeId;
    }
    if (this._sessionBaseline) {
      this._sessionBaseline = {
        ...this._sessionBaseline,
        theme: structuredClone(this._themeDraft),
      };
    }
    return true;
  }

  _themeEventDraft(eventId) {
    const ev = this._themeDraft?.events?.[eventId] || {};
    let color = { ...(ev.color || {}) };
    const ref = color.variable_ref;
    let brightness = ev.brightness ?? 200;
    if (ref) {
      const variable = (this._variables || []).find((item) => item.id === ref);
      if (variableIsPalette(variable)) {
        return {
          state: "on",
          brightness,
          variable_ref: ref,
          palette_t: color.palette_t,
          palette_r: color.palette_r,
          assignment_seed: ev.assignment_seed,
        };
      }
      color = { ...(variable?.color || {}), variable_ref: ref };
      if (variable?.brightness != null) {
        brightness = variable.brightness;
      }
    }
    return {
      state: "on",
      brightness,
      ...color,
    };
  }

  _writeThemeEventFromDraft(eventId, draft) {
    if (!this._themeDraft) {
      return;
    }
    const brightness = Number(draft.brightness);
    const value = Number.isFinite(brightness) ? brightness : 0;
    const prev = this._themeDraft.events[eventId] || {};
    if (draft.variable_ref) {
      const color = { variable_ref: draft.variable_ref };
      if (draft.palette_t != null) {
        color.palette_t = draft.palette_t;
      }
      if (draft.palette_r != null) {
        color.palette_r = draft.palette_r;
      }
      this._themeDraft.events[eventId] = {
        color,
        brightness: value,
        assignment_seed: draft.assignment_seed ?? prev.assignment_seed ?? 0,
      };
      this._syncPresetReset();
      return;
    }
    const color = {};
    if (draft.color_mode) {
      color.color_mode = draft.color_mode;
    }
    if (draft.color_temp_kelvin != null) {
      color.color_temp_kelvin = draft.color_temp_kelvin;
    }
    if (draft.hs_color) {
      color.hs_color = draft.hs_color;
    }
    if (draft.rgb_color) {
      color.rgb_color = draft.rgb_color;
    }
    this._themeDraft.events[eventId] = {
      color,
      brightness: value,
      assignment_seed: prev.assignment_seed ?? 0,
    };
    this._syncPresetReset();
  }

  _syncPresetReset() {
    const reset = this.shadowRoot?.querySelector(".scene-used-reset");
    if (!reset) {
      return;
    }
    const clean =
      this._view === "theme"
        ? themeMatchesGallery(this._themeDraft, this._variables)
        : this._view === "palette"
          ? paletteMatchesGallery(this._variableDraft)
          : true;
    reset.hidden = clean;
  }

  /** Selected lamp for dial brightness, else theme (including `theme:` ids). */
  _dialBrightnessLightId() {
    const id = this._sidebarLightId;
    if (id && String(id).startsWith("light.")) {
      return id;
    }
    return null;
  }

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
  }

  _dialEventBrightness(eventId, lightIdArg) {
    const lightId =
      lightIdArg !== undefined ? lightIdArg : this._dialBrightnessLightId();
    if (lightId) {
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
    if (this._themeDraft) {
      return Number(this._themeEventDraft(eventId).brightness) || 0;
    }
    const seed = EVENT_LIGHT_DEFAULTS[eventId];
    return seed ? seed[0] : 0;
  }

  _lightDraftLookFingerprint(draft) {
    return lightDraftFingerprint({
      ...draft,
      brightness: 0,
      state: "on",
    });
  }

  _themeEventBrightness(eventId) {
    return Number(this._themeEventDraft(eventId).brightness) || 0;
  }

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
  }

  _snapLightEventBrightness(eventId, brightness) {
    const themeBri = this._themeEventBrightness(eventId);
    if (Math.abs(Number(brightness) - themeBri) <= THEME_BRIGHTNESS_SNAP) {
      return themeBri;
    }
    return Number(brightness);
  }

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
  }

  _writeDialEventBrightness(eventId, brightness, { history = false, lightId: lightIdArg } = {}) {
    const value = Number(brightness);
    if (!Number.isFinite(value)) {
      return;
    }
    const lightId =
      lightIdArg !== undefined ? lightIdArg : this._dialBrightnessLightId();
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
  }

  _eventBrightnessIsLive() {
    return this._clockBrightDragging || this._brightnessScrubbing;
  }

  _beginBrightnessScrub() {
    if (this._brightnessScrubbing) {
      return;
    }
    this._brightnessScrubbing = true;
    this._clockLegendEl?.classList.add("bright-scrubbing");
    this._cancelClockBrightMotion();
  }

  _endBrightnessScrub() {
    if (!this._brightnessScrubbing) {
      return;
    }
    this._brightnessScrubbing = false;
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
  }

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
  }

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
  }

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
  }

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
    };
  }

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
    return source;
  }

  _lightEventStoredState(light, eventId) {
    const adapt = (state) => this._editorLightState(light.entity_id, state);
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
  }

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
  }

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
  }

  async _ensureThemeSunPath() {
    if (!this._hass || !this._sunPathEl || !this._themeDraft) {
      this._parkSunPath();
      return;
    }
    const solarKey = `theme-sun:${this._previewDate}:${this._duskMinimumSeconds()}`;
    if (!this._themeSolar || this._themeSolarKey !== solarKey) {
      const msg = {
        type: `${DOMAIN}/sun_path`,
        date: this._previewDate,
        dusk_minimum: this._duskMinimumSeconds(),
      };
      this._themeSolar = await this._hass.callWS(msg);
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
    this._sunPathEl.hidden = false;
    this._drawSunPath();
  }

  _themeLookId() {
    return (
      this._themeDraft?.id ||
      this._themeId ||
      this._formData?.theme_id ||
      "default"
    );
  }

  _editingThemeLook() {
    return this._view === "theme";
  }

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
  }

  _dialLightsFromSession(lights, events, { applyTheme = false } = {}) {
    const next = (lights || []).map((light) => {
      if (light.suggested || light.theme_ring) {
        return light;
      }
      const event_states = (light.event_states || []).map((row) => {
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
  }

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
  }

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
  }

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
  }

  async _openThemeEventSidebar(event) {
    const events = this._sunPath?.events || [];
    const drafts = new Map();
    for (const item of events) {
      drafts.set(item.id, this._themeEventDraft(item.id));
    }
    let currentId = event.id;
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
        if (this._dialBrightnessHook?.kind === "theme") {
          this._dialBrightnessHook = null;
        }
        brightnessGraphCtl?.disconnect();
        wheelCtl?.disconnect();
        this._setSidebarEvent(null);
        this._setSidebarLight(null);
        if (this._view === "edit") {
          this._sunPathKey = undefined;
          void this._ensureSunPath();
        }
        void this._saveNow();
      },
    });
    if (!opened) {
      return;
    }
    this._setSidebarEvent(event.id);
    this._setSidebarLight(`theme:${this._themeLookId()}`);
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
    body.appendChild(hint);

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
        Boolean(spec) &&
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
          const draft = drafts.get(item.id);
          return {
            eventId: item.id,
            sceneId: item.id,
            seconds: item.seconds,
            name: item.name,
            icon: item.icon,
            member: true,
            brightness: Number(draft?.brightness) || 0,
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
        draft.brightness = brightness;
        if (brightness > 0) {
          draft.state = "on";
        }
        persist();
        brightnessGraphCtl?.sync();
      },
      onDragEnd: () => {
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
      getState: () => ({
        scenes: events.map((item, index) => ({
          id: item.id,
          index: index + 1,
          draft: drafts.get(item.id),
          event: item,
          icon: item.icon,
        })),
        sequence: events.map((item) => item.id),
        activeId: currentId,
      }),
      onSelect: (eventId) => {
        currentId = eventId;
        this._setSidebarEvent(eventId);
        brightnessGraphCtl?.sync();
        wheelCtl?.sync();
        this._syncDuskMinimumSlot(duskSlot, eventId);
        syncRestore();
      },
      onChange: ({ fromPalette } = {}) => {
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
        Number(drafts.get(currentId)?.assignment_seed) ||
        Number(this._themeDraft?.events?.[currentId]?.assignment_seed) ||
        0,
      onRandomizeSeed: () => {
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
    body.append(duskSlot);
    this._syncDuskMinimumSlot(duskSlot, currentId);
    wheelCtl.sync();
    brightnessGraphCtl.sync();
    syncRestore();
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
      dusk_minimum_time_of_day: 22 * 3600,
      ...(settings || {}),
    };
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
      "After a scene is activated, keep updating the lights this often with the same transition length (target = how the room should look at the end of the transition). 0 turns automatic updates off for every room — same as the control at the top of the list."
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
      number: { min: 0, max: 30, step: 1, mode: "box", unit_of_measurement: "min" },
    };
    let intervalSaveTimer;
    const saveInterval = async () => {
      const minutes = Number(intervalField.value);
      const seconds = Number.isFinite(minutes)
        ? Math.max(0, Math.min(30, Math.round(minutes))) * 60
        : 300;
      try {
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

  _appendDuskMinimumPicker(parent) {
    const row = document.createElement("div");
    row.className = "setup-link-row dusk-minimum-row";
    const labelWrap = document.createElement("div");
    const label = document.createElement("div");
    label.className = "name";
    label.textContent = this._t(
      "frontend.settings.dusk_minimum_time_of_day",
      "Earliest time for dusk"
    );
    const helper = document.createElement("div");
    helper.className = "sidebar-note";
    helper.style.margin = "4px 0 0";
    helper.textContent = this._t(
      "frontend.settings.dusk_minimum_time_of_day_helper",
      "To avoid lights dimming too much, too early. Applies to every circadian scene and theme."
    );
    labelWrap.append(label, helper);
    const picker = document.createElement("ha-selector");
    picker.classList.add("dusk-minimum-picker");
    picker.hass = this._hass;
    picker.value = secondsToTime(this._duskMinimumSeconds());
    picker.selector = { time: {} };
    let saveTimer;
    const save = async () => {
      const next = timeToSeconds(picker.value);
      const seconds = Number.isFinite(next) ? next : 22 * 3600;
      try {
        const result = await this._hass.callWS({
          type: `${DOMAIN}/update_settings`,
          settings: { dusk_minimum_time_of_day: seconds },
        });
        this._adoptSettings(result?.settings);
        picker.value = secondsToTime(this._duskMinimumSeconds());
        this._refreshDuskVisuals();
        for (const el of this.shadowRoot?.querySelectorAll(
          "ha-selector.dusk-minimum-picker"
        ) || []) {
          if (el !== picker) {
            el.value = picker.value;
          }
        }
      } catch (err) {
        picker.value = secondsToTime(this._duskMinimumSeconds());
        window.alert(err.message || String(err));
      }
    };
    picker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(save, 400);
    });
    row.append(labelWrap, picker);
    parent.appendChild(row);
    return picker;
  }

  _syncDuskMinimumSlot(slot, eventId) {
    if (!slot) {
      return;
    }
    slot.replaceChildren();
    if (eventId === "dusk") {
      this._appendDuskMinimumPicker(slot);
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

  _undoRedoButton(kind) {
    const undo = kind === "undo";
    const button = document.createElement("ha-icon-button");
    button.id = undo ? "button-undo" : "button-redo";
    button.label = undo
      ? this._loc("ui.common.undo", "Undo")
      : this._loc("ui.common.redo", "Redo");
    button.disabled = undo ? !this._undoStack.length : !this._redoStack.length;
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", undo ? "mdi:undo" : "mdi:redo");
    button.appendChild(icon);
    button.addEventListener("click", () => {
      if (undo) {
        this._undo();
      } else {
        this._redo();
      }
    });
    if (customElements.get("ha-tooltip")) {
      const tip = document.createElement("ha-tooltip");
      tip.placement = "bottom";
      const label = document.createElement("span");
      label.textContent = `${button.label} `;
      const shortcut = document.createElement("span");
      shortcut.className = "shortcut";
      shortcut.textContent = this._shortcutLabel(undo ? "undo" : "redo");
      tip.append(label, shortcut);
      button.appendChild(tip);
      // `for` looks up an id on the root node. A disconnected button is not a
      // document, so set it only after the button is in the shadow root.
      const bindTip = () => {
        const root = button.getRootNode();
        if (typeof root?.getElementById !== "function") {
          return;
        }
        tip.setAttribute("for", button.id);
      };
      if (button.isConnected) {
        bindTip();
      } else {
        queueMicrotask(bindTip);
      }
    }
    return button;
  }

  _shortcutLabel(kind) {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    if (kind === "undo") {
      return mac ? "⌘Z" : "Ctrl+Z";
    }
    return mac ? "⌘⇧Z" : "Ctrl+Y";
  }

  _resetSession() {
    this._nativeDrafts = {};
    this._previewOverlay = null;
    this._sessionBaseline = this._snapshotSession();
    this._syncUndoButtons();
    this._syncSaveFab();
  }

  _historyTarget() {
    return {
      view: this._view,
      editId: this._editId,
      themeId: this._themeId,
      variableId: this._variableId,
    };
  }

  _sameHistoryTarget(target) {
    return (
      target &&
      target.view === this._view &&
      target.editId === this._editId &&
      target.themeId === this._themeId &&
      target.variableId === this._variableId
    );
  }

  _stampHistoryAfter() {
    const last = this._undoStack[this._undoStack.length - 1];
    if (!last || !this._sameHistoryTarget(last.target)) {
      return;
    }
    last.after = this._snapshotSession();
  }

  _saveSoon() {
    this._stampHistoryAfter();
    this._syncSaveFab();
    this._syncSceneUsed();
    if (this._historyRestoring) {
      return;
    }
    if (this._sceneConflict || this._sceneDeleted || this._sharedConflict || this._sharedDeleted) return;
    window.clearTimeout(this._saveSoonTimer);
    this._saveSoonTimer = window.setTimeout(() => {
      this._saveSoonTimer = null;
      void this._saveNow();
    }, 250);
  }

  _chooseConflictValues(conflict, localValue) {
    return new Promise((resolve) => {
    this.shadowRoot.querySelector("ha-dialog.scene-conflict-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "scene-conflict-dialog";
    dialog.setAttribute("header-title", this._t("frontend.conflict.title", "Another editor changed this item"));
    const detail = document.createElement("p");
    const mine = document.createElement("pre");
    const theirs = document.createElement("pre");
    let resolved = mergeFields(conflict.base, localValue, conflict.current).value;
    let index = 0;
    const fieldValue = (object, field) => field.split(".").reduce((value, key) => value?.[key], object);
    const show = () => {
      const field = conflict.fields[index];
      detail.textContent = this._t("frontend.conflict.field", "Choose a value for {field}", { field });
      mine.textContent = `${this._t("frontend.conflict.mine", "Your value")}: ${JSON.stringify(fieldValue(resolved, field))}`;
      theirs.textContent = `${this._t("frontend.conflict.saved", "Newly saved value")}: ${JSON.stringify(fieldValue(conflict.current, field))}`;
    };
    let finished = false;
    const finish = () => {
      index += 1;
      if (index < conflict.fields.length) { show(); return; }
      finished = true;
      dialog.open = false;
      resolve(resolved);
    };
    const footer = document.createElement("ha-dialog-footer");
    footer.slot = "footer";
    const local = document.createElement("ha-button");
    local.slot = "secondaryAction";
    local.appearance = "plain";
    local.textContent = this._t("frontend.conflict.use_mine", "Use my value");
    local.addEventListener("click", finish);
    const saved = document.createElement("ha-button");
    saved.slot = "primaryAction";
    saved.variant = "brand";
    saved.textContent = this._t("frontend.conflict.use_saved", "Use newly saved value");
    saved.addEventListener("click", () => {
      resolved = useSavedField(resolved, conflict.current, conflict.fields[index]);
      finish();
    });
    footer.append(local, saved);
    dialog.append(detail, mine, theirs, footer);
    dialog.addEventListener("closed", () => {
      if (!finished && dialog.isConnected) {
        dialog.open = true;
      } else {
        dialog.remove();
      }
    });
    this.shadowRoot.appendChild(dialog);
    show();
    dialog.open = true;
    });
  }

  async _showSceneConflict() {
    const conflict = this._sceneConflict;
    if (!conflict || !conflict.fields.length) return;
    const resolved = await this._chooseConflictValues(conflict, this._formData);
    if (this._sceneConflict !== conflict || this._sceneDeleted) return;
    patchInPlace(this._formData, resolved);
    this._sceneBase = structuredClone(conflict.current);
    this._sceneRevision = conflict.revision;
    this._sceneConflict = null;
    this._saveSoon();
  }

  async _saveNow({ fromHistory = false } = {}) {
    window.clearTimeout(this._saveSoonTimer);
    this._saveSoonTimer = null;
    this._stampHistoryAfter();
    if (this._sharedConflict || this._sharedDeleted) return;
    if (this._view === "theme" && this._themeDraft) {
      await this._saveThemeQuiet();
      return;
    }
    if (this._view === "variable" || this._view === "palette") {
      await this._saveVariableQuiet();
      return;
    }
    if (this._view !== "edit") {
      return;
    }
    if (this._sceneConflict || this._sceneDeleted) return;
    if (!this._formData?.area) {
      return;
    }
    if (this._saving) {
      this._saveSoon();
      return;
    }
    const savingId = this._editId;
    const savingBase = this._sceneBase ? structuredClone(this._sceneBase) : null;
    const savingRevision = this._sceneRevision;
    this._saving = true;
    this._error = null;
    try {
      await this._flushNativeDrafts();
      const savingData = structuredClone(this._formData);
      const saved = await this._hass.callWS({
        type: `${DOMAIN}/save`,
        scene_id: savingId || undefined,
        data: savingData,
        ...(savingId ? { base: savingBase, base_revision: savingRevision } : {}),
      });
      if (saved.status === "conflict") {
        if (this._view === "edit" && this._editId === savingId) {
          if (this._sceneRevision !== savingRevision) {
            this._saveSoon();
            return;
          }
          this._sceneConflict = {
            fields: [...saved.fields],
            current: saved.current,
            revision: saved.revision,
            base: savingBase,
          };
          this._showSceneConflict();
        }
        return;
      }
      // A collaborator's notification can arrive while this request is in
      // flight. Its newer revision must remain the editor's source of truth.
      const superseded = savingId && this._sceneRevision !== savingRevision;
      if (!superseded) this._upsertSceneInList(saved);
      // A solar-event sidebar closes with an unawaited save. If the user
      // already opened another scene, writing this id back deselects that card.
      const stayed = this._view === "edit" && this._editId === savingId;
      if (!stayed) {
        this._syncRailSelection();
        return;
      }
      if (superseded || this._sceneDeleted) {
        if (!this._sceneConflict && !this._sceneDeleted) this._saveSoon();
        return;
      }
      const wasNew = !savingId;
      this._editId = saved.id;
      this._sceneBase = structuredClone(saved.form || saved);
      this._sceneRevision = saved.revision;
      const next = reconcileSaveResponse(savingData, this._formData, this._sceneBase);
      if (next.conflicts.length) {
        this._sceneConflict = {
          fields: next.conflicts,
          current: this._sceneBase,
          revision: this._sceneRevision,
          base: savingData,
        };
        void this._showSceneConflict();
      } else {
        patchInPlace(this._formData, next.value);
        if (next.changedDuringSave) this._saveSoon();
        else this._sessionBaseline = this._snapshotSession();
      }
      if (!next.conflicts.length) {
        this._clearPersistedDraft();
        this._clearPersistedDraft("new");
      }
      if (wasNew) {
        for (const entry of [...this._undoStack, ...this._redoStack]) {
          if (entry.target?.view === "edit" && !entry.target.editId) {
            entry.target.editId = saved.id;
          }
        }
        if (!fromHistory) {
          this._leaveConfirmDone = true;
          history.replaceState(null, "", this._hashHref(`edit/${saved.id}`));
        }
      }
      if (this._themeDraft) {
        await this._saveThemeQuiet();
      }
      this._stampHistoryAfter();
    } catch (err) {
      this._error = err.message || String(err);
    } finally {
      this._saving = false;
    }
  }

  async _saveThemeQuiet() {
    if (!this._themeDraft) {
      return;
    }
    if (!(this._themeDraft.name || "").trim()) {
      return;
    }
    const savingThemeId = this._themeId;
    const savingDraft = structuredClone(this._themeDraft);
    const savingRevision = this._themeBase?.revision;
    try {
      const saved = await this._saveLibraryItem("theme", savingDraft, this._themeBase);
      if (this._sharedDeleted) return;
      if (this._themeBase?.revision !== savingRevision) {
        if (!this._sharedConflict && !this._sharedDeleted) this._saveSoon();
        return;
      }
      const stayed = this._view === "theme" && this._themeId === savingThemeId;
      const sameDraft = this._themeDraft?.id === savingDraft.id &&
        (this._view === "theme" || this._view === "edit");
      const next = sameDraft
        ? reconcileSaveResponse(savingDraft, this._themeDraft, saved)
        : null;
      this._adoptSavedTheme(saved, { adoptDraft: false });
      if (sameDraft) this._themeBase = structuredClone(saved);
      if (next?.conflicts.length) {
        this._sharedConflict = true;
        try {
          const resolved = await this._chooseConflictValues(
            { base: savingDraft, current: saved, fields: next.conflicts }, this._themeDraft
          );
          patchInPlace(this._themeDraft, resolved);
        } finally {
          this._sharedConflict = false;
        }
        this._saveSoon();
      } else if (next) {
        patchInPlace(this._themeDraft, next.value);
        if (next.changedDuringSave) this._saveSoon();
      }
      if (stayed) {
        this._themeId = saved.id;
        if (!next?.changedDuringSave && !next?.conflicts.length) {
          this._sessionBaseline = this._snapshotSession();
        }
        if (this._currentHash() !== `theme/${saved.id}`) {
          history.replaceState(null, "", this._hashHref(`theme/${saved.id}`));
        }
      }
      await this._refreshListItemsSilent();
      if (this._themeDraft) {
        this._syncThemePreviewSurfaces();
      }
    } catch (err) {
      this._error = err.message || String(err);
    }
  }

  async _refreshListItemsSilent() {
    try {
      const payload = await this._hass.callWS({ type: `${DOMAIN}/list` });
      this._items = payload?.scenes || this._items;
      this._themes = payload?.themes || this._themes;
      this._variables = payload?.variables || this._variables;
      this._syncRailCardBackgrounds();
    } catch (_err) {
      /* keep the current rail */
    }
  }

  _syncRailCardBackgrounds() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    for (const scene of this._items || []) {
      const card = root.querySelector(
        `.scene-card[data-scene-id="${CSS.escape(scene.id)}"]`
      );
      if (!card) {
        continue;
      }
      if (scene.kind === "simple") {
        const meshes = card.parentElement?.querySelectorAll("canvas.card-mesh");
        for (const mesh of meshes || []) {
          paintSimpleCardMesh(mesh, scene.card?.dots);
        }
        continue;
      }
      const bg = card.querySelector(".card-bg");
      if (!bg) {
        continue;
      }
      applyCircularRamp(bg, scene.card?.ramps);
    }
  }

  _syncThemePreviewSurfaces() {
    const theme = this._themeDraft;
    if (!theme) {
      return;
    }
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const variables = this._variables || [];
    const themeId = this._themeLookId();
    for (const scene of this._items || []) {
      if (scene.kind === "simple") {
        continue;
      }
      if ((scene.theme_id || "default") !== themeId) {
        continue;
      }
      const overrides =
        this._view === "edit" && scene.id === this._editId
          ? this._formData?.overrides || scene.overrides
          : scene.overrides;
      const ramps = previewRampsForTheme(scene, theme, variables, overrides);
      if (scene.card) {
        scene.card = { ...scene.card, ramps };
      }
      const card = root.querySelector(
        `.scene-card[data-scene-id="${CSS.escape(scene.id)}"]`
      );
      const bg = card?.querySelector(".card-bg");
      if (bg) {
        applyCircularRamp(bg, ramps);
      }
      const glow = card?.parentElement?.querySelector(":scope > .card-glow");
      if (glow?.classList.contains("card-bg")) {
        applyCircularRamp(glow, ramps);
      }
    }
    const chipDial = root.querySelector(
      `.theme-chip[data-theme-id="${CSS.escape(themeId)}"] .theme-dial`
    );
    if (chipDial) {
      paintThemeDial(chipDial, theme, variables);
    }
  }

  _snapshotSession() {
    return {
      form: structuredClone(this._formData),
      nativeDrafts: structuredClone(this._nativeDrafts),
      theme: this._themeDraft ? structuredClone(this._themeDraft) : null,
      variable: this._variableDraft ? structuredClone(this._variableDraft) : null,
    };
  }

  _needsLeaveConfirm() {
    return false;
  }

  async _confirmLeaveEditor() {
    this._forceCloseSceneSidebar();
    window.clearTimeout(this._saveSoonTimer);
    this._saveSoonTimer = null;
    await this._saveNow();
    return true;
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

  _commitUndo(focus = null) {
    this._undoStack.push({
      session: this._snapshotSession(),
      after: null,
      target: this._historyTarget(),
      focus: focus || this._currentUndoFocus(),
    });
    if (this._undoStack.length > UNDO_STACK_LIMIT) {
      this._undoStack.shift();
    }
    this._redoStack = [];
    this._syncUndoButtons();
    queueMicrotask(() => {
      this._saveSoon();
    });
  }

  _currentUndoFocus() {
    const lightId = this._sidebarLightId;
    const themeLight =
      typeof lightId === "string" && lightId.startsWith("theme:");
    if (lightId && !themeLight) {
      return {
        type: "light",
        lightId,
        eventId: this._sidebarEventId,
      };
    }
    if (this._sidebarEventId) {
      return {
        type: "theme-event",
        eventId: this._sidebarEventId,
      };
    }
    return null;
  }

  _applySession(snapshot, { remount = true, keepLightSidebar = false } = {}) {
    if (!keepLightSidebar) {
      this._forceCloseSceneSidebar();
    }
    this._formData = structuredClone(snapshot.form);
    this._nativeDrafts = structuredClone(snapshot.nativeDrafts);
    this._removedLights = [];
    if (snapshot.theme) {
      this._themeDraft = structuredClone(snapshot.theme);
    } else {
      this._themeDraft = null;
    }
    if (Object.prototype.hasOwnProperty.call(snapshot, "variable")) {
      this._variableDraft = snapshot.variable
        ? structuredClone(snapshot.variable)
        : null;
    }
    this._syncAppBarTitle();
    this._syncPreviewOverlay();
    this._sunPath = null;
    this._clearPreviewCache();
    this._syncUndoButtons();
    this._syncSaveFab();
    if (
      remount &&
      (this._view === "edit" ||
        this._view === "theme" ||
        this._view === "palette" ||
        this._view === "variable")
    ) {
      this._render();
    }
  }

  _revealHistoryFocus(focus) {
    const event =
      (this._sunPath?.events || []).find((row) => row.id === focus?.eventId) ||
      (this._sunPath?.events || [])[0];
    if (focus?.type === "light" && focus.lightId) {
      const light = (this._sunPath?.lights || []).find(
        (row) => row.entity_id === focus.lightId
      );
      if (light && event) {
        this._openLightEditDialog(light, event);
      }
      return;
    }
    if (focus?.type === "theme-event" && event) {
      void this._openThemeEventSidebar(event);
    }
  }

  async _openHistoryTarget(target) {
    if (!target || this._sameHistoryTarget(target)) {
      return;
    }
    this._leaveConfirmDone = true;
    if (target.view === "theme" && target.themeId) {
      this._view = "theme";
      this._themeId = target.themeId;
      this._editId = null;
      this._variableId = null;
      history.replaceState(null, "", this._hashHref(`theme/${target.themeId}`));
      await this._loadTheme(target.themeId);
      return;
    }
    if (target.view === "variable" || target.view === "palette") {
      this._view = target.view;
      this._editId = null;
      this._themeId = null;
      const id = target.variableId;
      if (id) {
        this._variableId = id;
        const prefix = target.view === "palette" ? "palette" : "variable";
        history.replaceState(null, "", this._hashHref(`${prefix}/${id}`));
        await this._loadVariable(id);
        return;
      }
    }
    if (target.view === "edit") {
      this._view = "edit";
      this._themeId = null;
      if (target.editId) {
        this._editId = target.editId;
        history.replaceState(null, "", this._hashHref(`edit/${target.editId}`));
        await this._loadItem(target.editId);
        return;
      }
      this._editId = null;
      history.replaceState(null, "", this._hashHref("new"));
      this._render();
      return;
    }
    this._view = "list";
    this._editId = null;
    this._themeId = null;
    history.replaceState(null, "", this._hashHref(""));
    await this._loadList();
  }

  async _restoreHistory(entry, which) {
    if (entry?.created) {
      this._historyRestoring = true;
      try {
        if (which === "before") {
          await this._deleteCreated(entry.created);
          await this._openHistoryTarget(entry.target);
        } else {
          await this._recreateCreated(entry.created);
          await this._openHistoryTarget(this._createdHistoryTarget(entry.created));
        }
      } finally {
        this._historyRestoring = false;
      }
      return;
    }
    const snap = which === "after" ? entry.after || entry.session : entry.session;
    if (!snap) {
      return;
    }
    const focus = entry.focus || null;
    const lightSidebar = this.shadowRoot?.querySelector(
      ".scene-sidebar.light-dialog"
    );
    const keepLightSidebar =
      which === "before" &&
      focus?.type === "light" &&
      focus.lightId &&
      lightSidebar &&
      !lightSidebar._closing &&
      lightSidebar._lightEntityId === focus.lightId &&
      typeof lightSidebar._reloadDrafts === "function";
    this._historyRestoring = true;
    try {
      await this._openHistoryTarget(entry.target);
      this._applySession(snap, { remount: false, keepLightSidebar });
      await this._saveNow({ fromHistory: true });
      if (
        this._view === "edit" ||
        this._view === "theme" ||
        this._view === "palette" ||
        this._view === "variable"
      ) {
        this._wheelPinFlip = captureWheelPinPositions(this.shadowRoot);
        this._render();
        this._wheelPinFlip = null;
      }
      this._clearPreviewCache();
      await this._ensureSunPath();
      if (keepLightSidebar && lightSidebar.isConnected) {
        lightSidebar._reloadDrafts();
      } else {
        this._revealHistoryFocus(focus);
      }
    } finally {
      this._historyRestoring = false;
    }
  }

  _undo() {
    this._finishSimpleUndo();
    if (!this._undoStack.length || this._historyRestoring) {
      return;
    }
    const entry = this._undoStack.pop();
    if (entry && this._sameHistoryTarget(entry.target)) {
      entry.after = this._snapshotSession();
    }
    this._redoStack.push({
      session: entry.session,
      after: entry.after || this._snapshotSession(),
      target: entry.target || this._historyTarget(),
      focus: entry.focus || null,
      created: entry.created || null,
    });
    void this._restoreHistory(entry, "before");
    this._syncUndoButtons();
  }

  _redo() {
    this._finishSimpleUndo();
    if (!this._redoStack.length || this._historyRestoring) {
      return;
    }
    const entry = this._redoStack.pop();
    this._undoStack.push(entry);
    void this._restoreHistory(entry, "after");
    this._syncUndoButtons();
  }

  _syncUndoButtons() {
    if (this._undoBtn) {
      this._undoBtn.disabled = !this._undoStack.length;
    }
    if (this._redoBtn) {
      this._redoBtn.disabled = !this._redoStack.length;
    }
    if (this._sidebarUndoBtn) {
      this._sidebarUndoBtn.disabled = !this._undoStack.length;
    }
    if (this._sidebarRedoBtn) {
      this._sidebarRedoBtn.disabled = !this._redoStack.length;
    }
  }

  _handleEditorShortcut(ev) {
    if (!this.isConnected) {
      return;
    }
    if (
      this._view !== "edit" &&
      this._view !== "theme" &&
      this._view !== "list" &&
      this._view !== "variables" &&
      this._view !== "variable" &&
      this._view !== "palette"
    ) {
      return;
    }
    if (!ev.ctrlKey && !ev.metaKey) {
      return;
    }
    if (ev.altKey) {
      return;
    }
    const path = ev.composedPath();
    if (
      path.some((node) => {
        const tag = node.tagName;
        return (
          node.isContentEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT"
        );
      })
    ) {
      return;
    }
    const key = ev.key.toLowerCase();
    if (key === "z" && ev.shiftKey) {
      ev.preventDefault();
      this._redo();
      return;
    }
    if (key === "z") {
      ev.preventDefault();
      this._undo();
      return;
    }
    if (key === "y") {
      ev.preventDefault();
      this._redo();
    }
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

  async _openAddLightPicker(anchor, { simple = false } = {}) {
    const listed = new Set(
      simple
        ? this._simpleMembers || []
        : (this._sunPath?.lights || [])
            .filter((light) => !light.suggested)
            .map((light) => light.entity_id)
    );
    this.shadowRoot.querySelector(".light-add-picker-host")?.remove();
    const host = document.createElement("div");
    host.className = "light-add-picker-host is-menu";
    const search = document.createElement("input");
    search.type = "search";
    search.className = "light-add-menu-search";
    search.placeholder = this._t("frontend.common.search", "Search");
    search.setAttribute(
      "aria-label",
      this._t("frontend.lights.add_light", "Add light")
    );
    const list = document.createElement("div");
    list.className = "light-add-menu-list";
    const choices = this._addLightChoices(listed);
    const paint = () => {
      const query = (search.value || "").trim().toLocaleLowerCase();
      list.replaceChildren();
      let lastArea = null;
      let shown = 0;
      for (const row of choices) {
        const haystack = [row.name, row.friendly, row.deviceName, row.areaName, row.entityId]
          .join(" ")
          .toLocaleLowerCase();
        if (query && !haystack.includes(query)) {
          continue;
        }
        const areaKey = row.areaName || "";
        if (areaKey !== lastArea) {
          lastArea = areaKey;
          const heading = document.createElement("div");
          heading.className = "light-add-menu-area";
          heading.textContent =
            row.areaName || this._t("frontend.common.no_area", "No area");
          list.appendChild(heading);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "light-add-menu-item";
        button.textContent = row.name;
        button.addEventListener("click", () => {
          cleanup();
          if (simple) {
            this._addLightToSimpleMembers(row.entityId);
            return;
          }
          void this._addLightToAssignedScenes(row.entityId);
        });
        list.appendChild(button);
        shown += 1;
      }
      if (!shown) {
        const empty = document.createElement("div");
        empty.className = "light-add-menu-area";
        empty.textContent = this._t("frontend.lights.none", "No lights");
        list.appendChild(empty);
      }
    };
    const cleanup = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      host.remove();
    };
    const onPointerDown = (ev) => {
      if (!host.contains(ev.target)) {
        cleanup();
      }
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        cleanup();
      }
    };
    search.addEventListener("input", paint);
    host.append(search, list);
    paint();
    if (anchor?.parentElement) {
      anchor.parentElement.appendChild(host);
    } else {
      this.shadowRoot.appendChild(host);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    search.focus();
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

  async _openListSceneMetaDialog(scene, { focus } = {}) {
    const form = { ...(scene.form || {}) };
    this.shadowRoot.querySelector("ha-dialog.save-dialog")?.remove();
    const data = {
      scene_name: this._nameIsPlaceholder(form.scene_name || scene.scene_name)
        ? this._suggestedSceneName(scene)
        : form.scene_name || scene.scene_name || this._suggestedSceneName(scene),
      description: form.description || "",
      labels: [...(form.labels || scene.labels || [])],
      category: form.category || scene.category || "",
      icon:
        form.icon ||
        scene.icon ||
        this._hass?.entities?.[scene.entity_id]?.icon ||
        "",
    };
    const dialog = document.createElement("ha-dialog");
    dialog.className = "save-dialog";
    dialog.setAttribute(
      "header-title",
      this._loc("ui.panel.config.scene.editor.rename", "Rename")
    );
    dialog.open = true;
    const nameInput = await this._appendSceneRenameFields(dialog, data, {
      focus,
    });
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._t("frontend.common.cancel", "Cancel");
    const save = document.createElement("ha-button");
    save.slot = "primaryAction";
    save.variant = "brand";
    save.textContent = this._t("frontend.common.save", "Save");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    save.addEventListener("click", async () => {
      const name = (nameInput.value || data.scene_name || "").trim();
      if (!name) {
        nameInput.reportValidity?.();
        return;
      }
      try {
        const saved = await this._saveSceneItem(scene, {
            ...form,
            scene_name: name,
            description: data.description,
            labels: data.labels,
            category: data.category || null,
            icon: data.icon || null,
        });
        dialog.open = false;
        if (this._editId === scene.id && this._formData) {
          this._formData.scene_name = name;
          this._formData.description = data.description;
          this._formData.labels = data.labels;
          this._formData.category = data.category || null;
          this._formData.icon = data.icon || null;
        }
        this._upsertSceneInList(saved);
        this._refreshVisibleSceneList();
        await this._loadList();
      } catch (err) {
        this._error = err.message || String(err);
        dialog.open = false;
        this._renderList();
      }
    });
    footer.append(cancel, save);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
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

  _confirmDeleteScene(scene) {
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute(
      "header-title",
      this._loc(
        "ui.panel.config.scene.picker.delete_confirm_title",
        "Delete scene?"
      )
    );
    dialog.open = true;
    const displayName = scene.scene_name || scene.name || "Scene";
    const text = document.createElement("p");
    text.textContent = this._loc(
      "ui.panel.config.scene.picker.delete_confirm_text",
      `Are you sure you want to delete ${displayName}?`,
      { name: displayName }
    );
    dialog.appendChild(text);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const confirm = document.createElement("ha-button");
    confirm.slot = "primaryAction";
    confirm.variant = "danger";
    confirm.textContent = this._loc("ui.common.delete", "Delete");
    confirm.addEventListener("click", async () => {
      dialog.open = false;
      try {
        this._captureAreaRailScroll();
        this._areaRailSkipReveal = true;
        this._invalidatePanelLoads();
        await this._hass.callWS({
          type: `${DOMAIN}/delete`,
          scene_id: scene.id,
        });
        this._dropSceneFromList(scene.id);
        if (this._editId === scene.id) {
          await this._go("");
        } else {
          this._refreshVisibleSceneList();
        }
        await this._loadList();
      } catch (err) {
        this._error = err.message || String(err);
        this._renderList();
      }
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  }

  _renameLibraryItem(kind, item) {
    if (!item?.id || (kind !== "variable" && kind !== "palette")) {
      return;
    }
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute(
      "header-title",
      this._t("frontend.common.rename", "Rename")
    );
    dialog.open = true;
    const field = document.createElement("ha-textfield");
    field.label = this._t("frontend.common.name", "Name");
    field.value = item.name || "";
    dialog.appendChild(field);
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
    const save = document.createElement("ha-button");
    save.slot = "primaryAction";
    save.variant = "brand";
    save.textContent = this._t("frontend.common.rename", "Rename");
    save.addEventListener("click", async () => {
      const name = String(field.value || "").trim();
      if (!name || name === item.name) {
        dialog.open = false;
        return;
      }
      save.disabled = true;
      try {
        const saved = await this._saveLibraryItem("variable", { ...item, name }, item);
        this._variables = (this._variables || []).map((row) =>
          row.id === saved.id ? saved : row
        );
        if (this._variableId === saved.id && this._variableDraft) {
          this._variableDraft = { ...this._variableDraft, name: saved.name };
        }
        dialog.open = false;
        this._render();
      } catch (err) {
        save.disabled = false;
        let note = dialog.querySelector(".error");
        if (!note) {
          note = document.createElement("p");
          note.className = "error";
          field.insertAdjacentElement("afterend", note);
        }
        note.textContent = err.message || String(err);
      }
    });
    footer.append(cancel, save);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
    requestAnimationFrame(() => field.focus?.());
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

  _confirmDeleteLibraryItem(kind, item) {
    if (!item?.id) {
      return;
    }
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    const titleKey =
      kind === "theme"
        ? "frontend.library.delete_theme"
        : kind === "palette"
          ? "frontend.library.delete_palette"
          : "frontend.library.delete_variable";
    const titleFallback =
      kind === "theme"
        ? "Delete circadian preset?"
        : kind === "palette"
          ? "Delete scene preset?"
          : "Delete color preset?";
    dialog.setAttribute("header-title", this._t(titleKey, titleFallback));
    dialog.open = true;
    const name = item.name || "";
    const text = document.createElement("p");
    text.textContent = this._t(
      "frontend.library.delete_confirm",
      "Are you sure you want to delete {name}?",
      { name }
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
    confirm.textContent = this._t("frontend.common.delete", "Delete");
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        await this._deleteLibraryItem(kind, item);
        dialog.open = false;
      } catch (err) {
        confirm.disabled = false;
        let note = dialog.querySelector(".error");
        if (!note) {
          note = document.createElement("p");
          note.className = "error";
          text.insertAdjacentElement("afterend", note);
        }
        note.textContent = err.message || String(err);
      }
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
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
    // The drawer overlays full-width background graphics. Only the dial's
    // content stage yields, then FLIP animates its scale/position smoothly.
    const on = Boolean(docked && !this._isEditorNarrow());
    const wasOn = this.hasAttribute("data-sidebar-docked");
    if (on === wasOn) {
      return;
    }
    const face = this.shadowRoot?.querySelector(".sun-light-clock-face");
    const before = face?.getBoundingClientRect();
    this._sidebarLayoutInProgress = true;
    this.style.setProperty("--scene-sidebar-gutter", "0px");
    this.style.setProperty(
      "--scene-sidebar-content-gutter",
      on ? "calc(var(--scene-sidebar-width, 375px) + 16px)" : "0px"
    );
    this.toggleAttribute("data-sidebar-docked", on);
    this._syncYearScrubLayout();
    const after = face?.getBoundingClientRect();
    this._animateSidebarDial(face, before, after);
  }

  _animateSidebarDial(face, before, after) {
    this._sidebarMotionGeneration += 1;
    const generation = this._sidebarMotionGeneration;
    const duration = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches
      ? 1
      : SIDEBAR_ANIMATION_MS;
    if (this._sidebarMotionRaf) {
      cancelAnimationFrame(this._sidebarMotionRaf);
    }
    if (this._sidebarMotionTimer) {
      clearTimeout(this._sidebarMotionTimer);
    }
    const finish = () => {
      if (generation !== this._sidebarMotionGeneration) {
        return;
      }
      this._sidebarMotionRaf = undefined;
      this._sidebarMotionTimer = undefined;
      this._sidebarLayoutInProgress = false;
      if (face) {
        face.style.transition = "";
        face.style.transform = "";
        face.style.willChange = "";
      }
      this._layoutDialChromeFn?.();
    };
    if (!face || !before || !after || after.width < 1) {
      finish();
      return;
    }
    const dx =
      before.left + before.width / 2 - (after.left + after.width / 2);
    const dy =
      before.top + before.height / 2 - (after.top + after.height / 2);
    const scale = before.width / after.width;
    if (
      Math.abs(dx) < 0.5 &&
      Math.abs(dy) < 0.5 &&
      Math.abs(scale - 1) < 0.001
    ) {
      finish();
      return;
    }
    face.style.transition = "none";
    face.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
    face.style.willChange = "transform";
    face.getBoundingClientRect();
    this._sidebarMotionRaf = requestAnimationFrame(() => {
      if (generation !== this._sidebarMotionGeneration) {
        return;
      }
      face.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0, 0, 1)`;
      face.style.transform = "translate3d(0, 0, 0) scale(1)";
      this._sidebarMotionTimer = window.setTimeout(finish, duration + 50);
    });
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

  _setSidebarEvent(eventId) {
    this._sidebarEventId = eventId || null;
    if (eventId) {
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
  }

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
  }

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
  }

  _syncClockLightSelection() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }
    const selected = this._sidebarLightId;
    for (const ring of root.querySelectorAll(".clock-ring[data-entity-id]")) {
      const on = ring.dataset.entityId === selected;
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
  }

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
  }

  _syncClockLegendBrightEdit() {
    const editing = Boolean(this._sidebarEventId) && this._view === "edit";
    this._clockLegendEl?.classList.toggle("event-bright-edit", editing);
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
  }

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
  }

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
  }

  _closeSceneSidebar({ animate = false, clearSelection = true } = {}) {
    // Opening a replacement sidebar passes clearSelection:false — otherwise the
    // pre-await ring highlight (_setSidebarLight before _openSceneSidebar) is
    // wiped and the band looks deselected until a second click.
    if (clearSelection) {
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
    this._setSidebarEvent(null);
    this._setSidebarLight(null);
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
    this._setSidebarEvent(null);
    if (target?.localName === "ha-bottom-sheet") {
      target.open = false;
      this._setSidebarLight(null);
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
      if (this._sidebarEventId && this._sidebarEventId === host._eventId) {
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
        this._go("");
      });
      return button;
    }
    if (customElements.get("ha-icon-button")) {
      const button = document.createElement("ha-icon-button");
      button.label = "Back";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", "mdi:arrow-left");
      button.appendChild(icon);
      button.addEventListener("click", () => this._go(""));
      return button;
    }
    const button = document.createElement("button");
    button.className = "fallback ghost";
    button.textContent = "Back";
    button.addEventListener("click", () => this._go(""));
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

  async _toggleEventSceneDialog(event) {
    await this._toggleThemeEventSidebar(event);
  }

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
  }

  async _applyLightState(entityId, stored, { transition } = {}) {
    if (!this._isPhysicalLightEntityId(entityId)) {
      return;
    }
    const payload = this._lightServicePayload(entityId, stored);
    if (transition != null && Number(transition) > 0) {
      payload.data.transition = Number(transition);
    }
    await this._hass.callService("light", payload.service, payload.data);
  }

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
  }

  _isPhysicalLightEntityId(entityId) {
    return String(entityId || "").startsWith("light.");
  }

  /** Theme rings (`theme:…`) and suggested/removed rows are not HA lights. */
  _isScenePreviewLight(light) {
    return Boolean(
      light &&
        !light.suggested &&
        !light.removed &&
        !light.theme_ring &&
        this._isPhysicalLightEntityId(light.entity_id)
    );
  }

  _perLightLiveEditOn() {
    return Boolean(this._liveEdit) && !this._readRoomPreviewPref();
  }

  _scenePlayActive() {
    return Boolean(this._scenePlay);
  }

  _simplePreviewEntityIds() {
    if (this._view !== "edit" || this._formData?.kind !== "simple") {
      return [];
    }
    const members = this._simpleMembershipLists().members;
    return members.filter((id) => this._isPhysicalLightEntityId(id));
  }

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
  }

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
  }

  _canPlayScenePreview() {
    return (
      this._view === "edit" &&
      this._formData?.kind !== "simple" &&
      Boolean(this._sunPath?.lights?.some((light) => this._isScenePreviewLight(light)))
    );
  }

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
  }

  _clearScenePreviewApplyTimer() {
    if (this._scenePreviewApplyTimer) {
      window.clearTimeout(this._scenePreviewApplyTimer);
      this._scenePreviewApplyTimer = undefined;
    }
    this._scenePreviewApplyPending = null;
  }

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
  }

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
  }

  async _abandonScenePreview() {
    this._scenePreviewEpoch += 1;
    this._stopScenePlay({ restore: false });
    this._clearScenePreviewApplyTimer();
    this._roomPreview = false;
    await this._restoreScenePreviewSnapshots();
    this._syncRoomPreviewControl();
    this._syncScenePlayButton();
  }

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
  }

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
  }

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
  }

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
  }

  _stopScenePlayBecauseTimeChanged() {
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
  }

  _toggleScenePlay() {
    if (this._scenePlayActive()) {
      this._stopScenePlay({ restore: !this._roomPreview });
      this._fillHoverReadout(this._clockSunIdleSeconds(), { hovering: false });
      return;
    }
    this._startScenePlay();
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }
  async _openLightEditDialog(light, event) {
    if (!this._eventSceneId(event.id)) {
      return;
    }
    const existing = this.shadowRoot?.querySelector(".scene-sidebar.light-dialog");
    if (
      existing &&
      !existing._closing &&
      existing._lightEntityId === light.entity_id &&
      existing._switchLightEvent
    ) {
      existing._switchLightEvent(event);
      return;
    }

    // Highlight before any await (sidebar swap is ~160ms). Otherwise clearing
    // ring hover (touch pointerup / leave) re-lights the previous .selected
    // band for a frame and reads as a flash.
    const previousLightId = this._sidebarLightId;
    this._setSidebarLight(light.entity_id);
    this._clearClockRingHover();

    const snapshot = this._snapshotLight(light.entity_id);
    const attrs = this._hass.states[light.entity_id]?.attributes || {};
    const supported = attrs.supported_color_modes || [];
    const onOffOnly = supported.length > 0 && supported.every((mode) => mode === "onoff");
    const hasColor = supported.some((mode) =>
      ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode)
    );
    // rgbww exposes white channels, not always `color_temp` in supported_color_modes.
    const hasTemp =
      supported.includes("color_temp") ||
      supported.includes("rgbww") ||
      attrs.min_color_temp_kelvin != null;
    const events = this._sunPath?.events || [];
    const drafts = new Map();
    const member = !light.suggested && !light.removed;
    for (const [index, item] of events.entries()) {
      const stored = this._lightEventStoredState(light, item.id);
      drafts.set(item.id, {
        draft: member ? { ...stored } : null,
        saved: member ? lightDraftFingerprint(stored) : "absent",
        member,
        event: item,
        index: index + 1,
      });
    }
    let currentEvent = event;
    let liveApplied = false;
    let wheelCtl = null;
    let brightnessGraphCtl = null;
    let colorBriGraphCtl = null;
    let whiteBriGraphCtl = null;
    const whiteKind = supported.includes("rgbww")
      ? "rgbww"
      : supported.includes("rgbw")
        ? "rgbw"
        : null;

    const currentEntry = () => drafts.get(currentEvent.id);
    const currentDraft = () => currentEntry()?.draft;
    const dirtyEntries = () =>
      [...drafts.entries()].filter(([, entry]) => {
        if (!entry.member || !entry.draft) {
          return false;
        }
        if (entry.saved === "absent") {
          return true;
        }
        return lightDraftFingerprint(entry.draft) !== entry.saved;
      });
    // One undo point for the first edit in this sidebar open; later ticks
    // (drag, wheel) update the same session drafts until close.
    let undoCommitted = false;
    const applyToSession = ({ eventId: editedEventId = currentEvent.id } = {}) => {
      const dirty = dirtyEntries();
      if (!dirty.length) {
        return;
      }
      if (!undoCommitted) {
        this._commitUndo({
          type: "light",
          lightId: light.entity_id,
          eventId: editedEventId,
        });
        undoCommitted = true;
      }
      for (const [eventId, entry] of dirty) {
        // Drop undefined keys so kelvin converts do not reintroduce rgb/hs
        // as nullish fields in the session draft / WS payload.
        const cleaned = {};
        for (const [key, value] of Object.entries(entry.draft)) {
          if (value !== undefined) {
            cleaned[key] = value;
          }
        }
        this._writeLightEventOverride(light.entity_id, eventId, cleaned);
        entry.saved = lightDraftFingerprint(entry.draft);
      }
      if (this._eventBrightnessIsLive()) {
        this._paintLiveEventBrightness();
        return;
      }
      this._syncPreviewOverlay();
      this._patchDialFromSession();
      this._syncThemePreviewSurfaces();
      this._saveSoon();
      paintOverrides();
    };
    // One queue so a restore cannot be overwritten by an apply that was
    // already in flight when the sidebar closed.
    let liveQueue = Promise.resolve();
    let sidebarLiveClosed = false;
    const enqueueLive = (task) => {
      const run = liveQueue.then(task, task);
      liveQueue = run.then(
        () => {},
        () => {}
      );
      return run;
    };
    const LIVE_PREVIEW_MS = 500;
    let liveLastSent = 0;
    let liveTimer = null;
    let livePending = false;
    const applySnapshot = () =>
      enqueueLive(async () => {
        if (!liveApplied) {
          return;
        }
        liveApplied = false;
        if (this._roomPreview || this._readRoomPreviewPref()) {
          return;
        }
        await this._applyLightState(light.entity_id, snapshot);
      });
    const restoreLive = () => {
      sidebarLiveClosed = true;
      if (liveTimer) {
        clearTimeout(liveTimer);
        liveTimer = null;
      }
      livePending = false;
      return applySnapshot();
    };
    const flushLive = ({ transitionSec = 0 } = {}) =>
      enqueueLive(async () => {
        if (sidebarLiveClosed || !this._perLightLiveEditOn()) {
          return;
        }
        livePending = false;
        liveLastSent = performance.now();
        liveApplied = true;
        await this._applyLightState(light.entity_id, currentDraft(), {
          transition: transitionSec,
        });
      });
    const scheduleLive = async ({ dragging = false } = {}) => {
      if (!this._perLightLiveEditOn()) {
        return;
      }
      if (!dragging) {
        if (liveTimer) {
          clearTimeout(liveTimer);
          liveTimer = null;
        }
        await flushLive({ transitionSec: 0 });
        return;
      }
      const now = performance.now();
      const elapsed = now - liveLastSent;
      if (elapsed >= LIVE_PREVIEW_MS) {
        await flushLive({ transitionSec: LIVE_PREVIEW_MS / 1000 });
        return;
      }
      livePending = true;
      if (!liveTimer) {
        liveTimer = setTimeout(() => {
          liveTimer = null;
          if (livePending) {
            void flushLive({ transitionSec: LIVE_PREVIEW_MS / 1000 });
          }
        }, LIVE_PREVIEW_MS - elapsed);
      }
    };
    const applyLive = async () => scheduleLive({ dragging: false });

    const activateBtn = document.createElement("ha-button");
    activateBtn.className = "activate-scene-btn";
    activateBtn.appearance = "filled";
    activateBtn.textContent = this._t(
      "frontend.actions.activate_scene",
      "Activate scene"
    );
    activateBtn.addEventListener("click", async () => {
      activateBtn.disabled = true;
      try {
        await this._activateNativeSceneWithDrafts(this._entityId);
      } finally {
        activateBtn.disabled = false;
      }
    });
    this._activateSceneBtn = activateBtn;
    this._syncActivateSceneButton();

    const liveToggle = document.createElement("label");
    liveToggle.className = "live-edit-toggle";
    const liveLabel = document.createElement("span");
    liveLabel.textContent = this._t(
      "frontend.actions.live_preview",
      "Live edit light"
    );
    const liveSwitch = document.createElement("ha-switch");
    liveSwitch.checked = Boolean(this._liveEdit);
    liveSwitch.addEventListener("change", () => {
      void this._setLiveEdit(Boolean(liveSwitch.checked));
    });
    liveToggle.append(liveLabel, liveSwitch);
    this._liveEditSwitch = liveSwitch;
    this._sidebarLiveEditToggle = liveToggle;
    this._syncSidebarLiveEditToggle();

    const infoBtn = document.createElement("ha-icon-button");
    infoBtn.label = this._loc(
      "ui.panel.config.automation.picker.show_settings",
      "Settings"
    );
    const infoIcon = document.createElement("ha-icon");
    infoIcon.setAttribute("icon", "mdi:information-outline");
    infoBtn.appendChild(infoIcon);
    infoBtn.addEventListener("click", () =>
      this._showEntityMoreInfo(light.entity_id, "settings")
    );

    const onLiveEditChange = async (on) => {
      if (on) {
        await applyLive();
      } else if (liveApplied) {
        await applySnapshot();
      }
    };

    this._syncRoomPreviewControl();

    const opened = await this._openSceneSidebar({
      title: this._lightDisplayName(light.entity_id, { fallback: light.name }),
      subtitle: this._lightSupportsSubtitle(light.entity_id),
      className: "light-dialog",
      actionItems: [infoBtn],
      onDismiss: () => {
        if (this._liveEditSidebarHandler === onLiveEditChange) {
          this._liveEditSidebarHandler = null;
        }
        if (this._liveEditSwitch === liveSwitch) {
          this._liveEditSwitch = null;
        }
        if (this._sidebarLiveEditToggle === liveToggle) {
          this._sidebarLiveEditToggle = null;
        }
        if (this._activateSceneBtn === activateBtn) {
          this._activateSceneBtn = null;
        }
        this._sidebarUndoBtn = null;
        this._sidebarRedoBtn = null;
        this._assignOpenLightToPalette = null;
        this._syncPreviewOverlay();
        this._sunPathKey = undefined;
        this._ensureSunPath().then(async () => {
          if (this._readRoomPreviewPref()) {
            await this._setRoomPreview(true);
          }
          this._syncRoomPreviewControl();
        });
        if (liveTimer) {
          clearTimeout(liveTimer);
          liveTimer = null;
        }
        restoreLive();
        brightnessGraphCtl?.disconnect();
        colorBriGraphCtl?.disconnect();
        whiteBriGraphCtl?.disconnect();
        wheelCtl?.disconnect();
        if (this._dialBrightnessHook?.kind === "light") {
          this._dialBrightnessHook = null;
        }
      },
    });
    if (!opened) {
      this._setSidebarLight(previousLightId);
      if (this._readRoomPreviewPref()) {
        await this._setRoomPreview(true);
      }
      return;
    }
    this._liveEditSidebarHandler = onLiveEditChange;
    // Re-assert: _openSceneSidebar may close a prior host whose `closed`
    // handler clears a matching _sidebarLightId.
    this._setSidebarLight(light.entity_id);
    this._setSidebarEvent(event.id);
    let paintOverrides = () => {};
    this._dialBrightnessHook = {
      kind: "light",
      lightId: light.entity_id,
      drafts,
      sync: () => {
        brightnessGraphCtl?.sync();
        colorBriGraphCtl?.sync();
        whiteBriGraphCtl?.sync();
        wheelCtl?.sync();
        paintOverrides();
      },
    };
    const { host, header, body, footer } = opened;
    host._lightEntityId = light.entity_id;
    host._sceneId = this._editId;
    host._restoreLive = restoreLive;
    const subtitleEl = header.querySelector("[slot='subtitle']");
    const duskSlot = document.createElement("div");
    const chipsHost = document.createElement("div");
    const brightnessGraphMount = document.createElement("div");
    const overridesMount = document.createElement("div");
    overridesMount.className = "light-overrides";
    const colorBriMount = document.createElement("div");
    const whiteBriMount = document.createElement("div");
    const wheelMount = document.createElement("div");
    const effectMount = document.createElement("div");
    effectMount.className = "light-effect-row";
    body.append(
      chipsHost,
      brightnessGraphMount,
      overridesMount,
      colorBriMount,
      whiteBriMount,
      wheelMount,
      effectMount,
      duskSlot
    );

    let effectMenu = null;
    const effectList = Array.isArray(attrs.effect_list) ? attrs.effect_list : [];
    const formatEffect = (effect) => {
      try {
        if (typeof this._hass?.formatEntityAttributeValue === "function") {
          return this._hass.formatEntityAttributeValue(
            this._hass.states[light.entity_id],
            "effect",
            effect
          );
        }
      } catch (_err) {
        /* fall through */
      }
      return effect;
    };
    const applyEffect = (next) => {
      const draft = currentDraft();
      if (!draft || next == null || next === "") {
        return;
      }
      if (draft.effect === next) {
        return;
      }
      draft.effect = next;
      draft.state = "on";
      applyToSession();
      syncEffectControl();
      void applyLive();
    };
    const bindEffectMenuSelect = (el) => {
      const dropdown = el.shadowRoot?.querySelector("ha-dropdown");
      if (!dropdown || dropdown._effectBound) {
        return Boolean(dropdown);
      }
      dropdown._effectBound = true;
      // ha-control-select-menu no longer fires `select`; the inner
      // ha-dropdown emits wa-select and that event is not composed.
      dropdown.addEventListener("wa-select", (ev) => {
        applyEffect(ev.detail?.item?.value);
      });
      return true;
    };
    const syncEffectControl = () => {
      if (!effectMenu) {
        return;
      }
      const draft = currentDraft();
      const value =
        draft?.effect && draft.effect !== "none" ? draft.effect : undefined;
      effectMenu.value = value;
      effectMenu.disabled = !draft || draft.state === "off";
      if (effectMenu.localName === "ha-control-select-menu") {
        bindEffectMenuSelect(effectMenu);
      }
    };
    if (effectList.length && customElements.get("ha-control-select-menu")) {
      const menu = document.createElement("ha-control-select-menu");
      menu.label = this._loc("ui.card.light.effect", "Effect");
      menu.options = effectList.map((effect) => ({
        value: effect,
        label: formatEffect(effect),
        icon: "mdi:creation",
      }));
      const icon = document.createElement("ha-icon");
      icon.slot = "icon";
      icon.setAttribute("icon", "mdi:creation");
      menu.appendChild(icon);
      menu.addEventListener("wa-select", (ev) => {
        applyEffect(ev.detail?.item?.value);
      });
      menu.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        applyEffect(ev.detail?.value);
      });
      effectMenu = menu;
      if (customElements.get("ha-more-info-control-select-container")) {
        const wrap = document.createElement("ha-more-info-control-select-container");
        wrap.appendChild(menu);
        effectMount.appendChild(wrap);
      } else {
        effectMount.appendChild(menu);
      }
      syncEffectControl();
      window.requestAnimationFrame(() => bindEffectMenuSelect(menu));
    } else if (effectList.length) {
      // Fallback when more-info controls are not registered yet.
      const sel = document.createElement("ha-selector");
      sel.hass = this._hass;
      sel.label = this._loc("ui.card.light.effect", "Effect");
      sel.selector = {
        select: {
          mode: "dropdown",
          options: effectList.map((effect) => ({
            value: effect,
            label: formatEffect(effect),
          })),
        },
      };
      sel.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        applyEffect(ev.detail?.value);
      });
      effectMenu = sel;
      effectMount.appendChild(sel);
      syncEffectControl();
    } else {
      effectMount.hidden = true;
    }

    const selectScene = async (next, { fromWheel = false } = {}) => {
      currentEvent = next;
      this._setSidebarEvent(next.id);
      if (subtitleEl) {
        subtitleEl.textContent = this._lightSupportsSubtitle(light.entity_id);
      }
      this._syncDuskMinimumSlot(duskSlot, next.id);
      const entry = drafts.get(next.id);
      paintChips();
      paintOverrides();
      brightnessGraphCtl?.sync();
      colorBriGraphCtl?.sync();
      whiteBriGraphCtl?.sync();
      if (!entry?.member || !entry.draft) {
        return;
      }
      if (!fromWheel) {
        const mode = draftWheelMode(currentDraft(), hasColor, hasTemp);
        wheelCtl?.setMode(mode, { convertDraft: false });
      }
      wheelCtl?.sync();
      syncEffectControl();
      if (this._perLightLiveEditOn()) {
        await applyLive();
      }
    };

    paintOverrides = () => {
      const stored = this._formData.overrides?.[light.entity_id] || {};
      const rows = events.filter((item) => {
        const payload = stored[item.id];
        if (!payload) {
          return false;
        }
        const theme = this._themeEventDraft(item.id);
        const bri = Number(payload.brightness);
        const themeBri = this._themeEventBrightness(item.id);
        const briOver = !onOffOnly &&
          Number.isFinite(bri) &&
          Math.abs(bri - themeBri) > THEME_BRIGHTNESS_SNAP;
        const colorOver = !onOffOnly &&
          this._lightDraftLookFingerprint(payload) !==
          this._lightDraftLookFingerprint(theme);
        const powerOver = onOffOnly && (payload.state === "off") !== (theme.state === "off");
        return briOver || colorOver || powerOver;
      });
      overridesMount.replaceChildren();
      if (!rows.length) {
        overridesMount.hidden = true;
        return;
      }
      overridesMount.hidden = false;
      const heading = document.createElement("div");
      heading.className = "light-overrides-title";
      heading.textContent = this._t("frontend.lights.overrides", "Overrides");
      overridesMount.appendChild(heading);
      for (const item of rows) {
        const payload = stored[item.id];
        const theme = this._themeEventDraft(item.id);
        const bri = Number(payload?.brightness);
        const themeBri = this._themeEventBrightness(item.id);
        const briOver = !onOffOnly &&
          Number.isFinite(bri) &&
          Math.abs(bri - themeBri) > THEME_BRIGHTNESS_SNAP;
        const colorOver = !onOffOnly &&
          this._lightDraftLookFingerprint(payload) !==
          this._lightDraftLookFingerprint(theme);
        const powerOver = onOffOnly && (payload.state === "off") !== (theme.state === "off");
        if (!briOver && !colorOver && !powerOver) {
          continue;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "light-override-row";
        const name = document.createElement("span");
        name.className = "light-override-name";
        name.textContent = item.name;
        const meta = document.createElement("span");
        meta.className = "light-override-meta";
        const bits = [];
        if (briOver) {
          bits.push(
            this._t(
              "frontend.lights.override_brightness",
              "Brightness {percent}% · theme {theme}%",
              {
                percent: String(Math.round((bri / 255) * 100)),
                theme: String(Math.round((themeBri / 255) * 100)),
              }
            )
          );
        }
        if (colorOver) {
          bits.push(this._t("frontend.lights.override_color", "Color"));
        }
        if (powerOver) {
          bits.push(payload.state === "off"
            ? this._t("frontend.lights.off", "Off")
            : this._t("frontend.lights.power", "On"));
        }
        meta.textContent = bits.join(" · ");
        btn.append(name, meta);
        btn.addEventListener("click", () => {
          void selectScene(item);
        });
        overridesMount.appendChild(btn);
      }
    };

    const paintChips = () => {
      chipsHost.replaceChildren();
      if (!events.length) {
        return;
      }
      const list = document.createElement("div");
      list.className = "light-scene-list";
      list.setAttribute("role", "listbox");
      list.setAttribute(
        "aria-label",
        this._t("frontend.lights.solar_events", "Solar events")
      );
      let selectedBtn = null;
      for (const item of events) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sun-event clickable";
        btn.setAttribute("role", "option");
        if (item.id === currentEvent.id) {
          btn.setAttribute("aria-current", "true");
          selectedBtn = btn;
        }
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", item.icon || "mdi:weather-sunset");
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = item.name;
        btn.append(icon, name);
        btn.addEventListener("click", () => {
          if (item.id !== currentEvent.id) {
            host._switchLightEvent(item);
          }
        });
        list.appendChild(btn);
      }
      chipsHost.appendChild(list);
      if (selectedBtn) {
        requestAnimationFrame(() => {
          const left = Math.max(
            0,
            selectedBtn.offsetLeft -
              (list.clientWidth - selectedBtn.offsetWidth) / 2
          );
          // scrollIntoView also pans HA's outer panel scrollport, making the
          // entire page rebound while this drawer opens. Scroll only this row.
          list.scrollTo({
            left,
            behavior: "smooth",
          });
        });
      }
    };

    const onWheelChange = async (meta = {}) => {
      if (!meta.fromPalette) {
        const entry = currentEntry();
        if (entry?.draft) {
          delete entry.draft.variable_ref;
          delete entry.draft.palette_t;
          delete entry.draft.palette_r;
        }
      }
      applyToSession();
      wheelCtl?.syncPresets();
      brightnessGraphCtl?.sync();
      colorBriGraphCtl?.sync();
      whiteBriGraphCtl?.sync();
      syncEffectControl();
      this._placeLegendModeGroups(this._clockLegendEl?.querySelector(".light-tiles"));
      await scheduleLive({ dragging: Boolean(meta.dragging) });
    };

    if (onOffOnly) {
      brightnessGraphCtl = createOnOffEventGraph({
        title: this._t("frontend.lights.group_onoff", "On/off"),
        subtitle: this._t("frontend.lights.onoff_events_hint", "Switch each solar event on or off"),
        onLabel: this._t("frontend.lights.power", "On"),
        offLabel: this._t("frontend.lights.off", "Off"),
        getEvents: () => events.map((item) => {
          const entry = drafts.get(item.id);
          return {
            id: item.id,
            name: item.name,
            member: Boolean(entry?.member && entry.draft),
            on: Boolean(entry?.member && entry.draft && entry.draft.state !== "off"),
            active: item.id === currentEvent.id,
          };
        }),
        onToggle: async (eventId) => {
          const entry = drafts.get(eventId);
          if (!entry?.member || !entry.draft) return;
          toggleOnOffDraft(entry.draft);
          applyToSession({ eventId });
          brightnessGraphCtl.sync();
          paintOverrides();
          if (eventId === currentEvent.id) await applyLive();
        },
      });
    } else {
      brightnessGraphCtl = createLightBrightnessGraph({
        title: this._t("frontend.lights.brightness", "Brightness"),
        subtitle: this._t("frontend.lights.graph_sub", "0–100% by solar event"),
        getPoints: () => {
          return events.map((item) => {
            const entry = drafts.get(item.id);
            const member = Boolean(entry?.member && entry.draft);
            const draft = entry?.draft;
            const brightness = member
              ? draft.state === "off"
                ? 0
                : Number(draft.brightness) || 0
              : 0;
            return {
              eventId: item.id,
              sceneId: item.id,
              seconds: item.seconds,
              name: item.name,
              icon: item.icon,
              member,
              brightness,
              themeBrightness: this._themeEventBrightness(item.id),
              rgb: member ? draftRgb(draft) : [128, 128, 128],
              draft: member ? draft : null,
              active: member && item.id === currentEvent.id,
            };
          });
        },
        onSelect: (eventId) => {
          const next = events.find((item) => item.id === eventId);
          if (next) {
            selectScene(next);
          }
        },
        onBrightness: async (sceneId, brightness) => {
          const entry = drafts.get(sceneId);
          if (!entry?.member || !entry.draft) {
            return;
          }
          this._beginBrightnessScrub();
          const theme = this._themeEventDraft(sceneId);
          const snapped = this._snapLightEventBrightness(sceneId, brightness);
          entry.draft.brightness = snapped;
          if (snapped > 0) {
            entry.draft.state = "on";
          }
          delete entry.draft.variable_ref;
          const lookMatchesTheme =
            this._lightDraftLookFingerprint(entry.draft) ===
            this._lightDraftLookFingerprint(theme);
          if (
            snapped === this._themeEventBrightness(sceneId) &&
            lookMatchesTheme
          ) {
            entry.draft = { ...theme };
            this._deleteLightEventOverride(light.entity_id, sceneId);
            entry.saved = lightDraftFingerprint(entry.draft);
          }
          applyToSession();
          if (this._eventBrightnessIsLive()) {
            this._paintLiveEventBrightness();
          }
          brightnessGraphCtl?.sync();
          colorBriGraphCtl?.sync();
          whiteBriGraphCtl?.sync();
          paintOverrides();
          await applyLive();
        },
        onDragEnd: () => {
          this._endBrightnessScrub();
          wheelCtl?.sync();
        },
      });
    }
    brightnessGraphMount.appendChild(brightnessGraphCtl.el);

    if (whiteKind) {
      const extraPoints = (valueOf) => () => {
        return events.map((item) => {
          const entry = drafts.get(item.id);
          const member = Boolean(entry?.member && entry.draft);
          const draft = entry?.draft;
          return {
            eventId: item.id,
            sceneId: item.id,
            seconds: item.seconds,
            name: item.name,
            icon: item.icon,
            member,
            brightness: member ? valueOf(draft) : 0,
            rgb: member ? draftRgb(draft) : [128, 128, 128],
            draft: member ? draft : null,
            active: member && item.id === currentEvent.id,
          };
        });
      };
      colorBriGraphCtl = createLightBrightnessGraph({
        title: this._t("frontend.lights.color_brightness", "Color brightness"),
        subtitle: this._t("frontend.lights.graph_sub", "0–100% by solar event"),
        getPoints: extraPoints(colorBrightnessFromDraft),
        onSelect: (eventId) => {
          const next = events.find((item) => item.id === eventId);
          if (next) {
            selectScene(next);
          }
        },
        onBrightness: async (sceneId, brightness) => {
          const entry = drafts.get(sceneId);
          if (!entry?.member || !entry.draft) {
            return;
          }
          this._beginBrightnessScrub();
          setColorBrightnessOnDraft(entry.draft, brightness, whiteKind);
          applyToSession();
          brightnessGraphCtl?.sync();
          colorBriGraphCtl?.sync();
          whiteBriGraphCtl?.sync();
          wheelCtl?.sync();
          await applyLive();
        },
        onDragEnd: () => {
          this._endBrightnessScrub();
          wheelCtl?.sync();
        },
      });
      whiteBriGraphCtl = createLightBrightnessGraph({
        title: this._t("frontend.lights.white_brightness", "White brightness"),
        subtitle: this._t("frontend.lights.graph_sub", "0–100% by solar event"),
        getPoints: extraPoints(whiteBrightnessFromDraft),
        onSelect: (eventId) => {
          const next = events.find((item) => item.id === eventId);
          if (next) {
            selectScene(next);
          }
        },
        onBrightness: async (sceneId, brightness) => {
          const entry = drafts.get(sceneId);
          if (!entry?.member || !entry.draft) {
            return;
          }
          this._beginBrightnessScrub();
          setWhiteBrightnessOnDraft(entry.draft, brightness, whiteKind);
          applyToSession();
          brightnessGraphCtl?.sync();
          colorBriGraphCtl?.sync();
          whiteBriGraphCtl?.sync();
          wheelCtl?.sync();
          await applyLive();
        },
        onDragEnd: () => {
          this._endBrightnessScrub();
          wheelCtl?.sync();
        },
      });
      colorBriMount.appendChild(colorBriGraphCtl.el);
      whiteBriMount.appendChild(whiteBriGraphCtl.el);
    }

    if (hasColor || hasTemp) {
      wheelCtl = createSceneColorWheel({
        t: (key, fallback, vars) => this._t(key, fallback, vars),
        pinFlip: this._wheelPinFlip || null,
        hasColor,
        hasTemp,
        tempMin: attrs.min_color_temp_kelvin || 2000,
        tempMax: attrs.max_color_temp_kelvin || 6500,
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
        getAssignmentEntityId: () => light.entity_id,
        getAssignmentSeed: () => {
          const draft = currentDraft();
          const themeEv = this._themeDraft?.events?.[currentEvent.id];
          return (
            Number(draft?.assignment_seed) ||
            Number(themeEv?.assignment_seed) ||
            0
          );
        },
        onRandomizeSeed: () => {
          const draft = currentDraft();
          if (!draft) {
            return;
          }
          draft.assignment_seed = (Math.random() * 0xffffffff) >>> 0;
          delete draft.palette_t;
          delete draft.palette_r;
          const linked = (this._variables || []).find(
            (item) => item.id === draft.variable_ref
          );
          if (variableIsPalette(linked)) {
            applyVariableToDraft(draft, linked, {
              entityId: light.entity_id,
              seed: draft.assignment_seed,
              catalog: this._variables,
            });
          }
          applyToSession();
          wheelCtl?.sync();
          brightnessGraphCtl?.sync();
          colorBriGraphCtl?.sync();
          whiteBriGraphCtl?.sync();
        },
        getState: () => ({
          scenes: events
            .filter((item) => drafts.get(item.id)?.member)
            .map((item) => {
              const entry = drafts.get(item.id);
              return {
                id: item.id,
                index: entry.index,
                draft: entry.draft,
                event: item,
                icon: item.icon,
              };
            }),
          sequence: events
            .map((item) => item.id)
            .filter((id) => drafts.get(id)?.member),
          activeId: currentEvent.id,
        }),
        onSelect: (eventId) => {
          const entry = drafts.get(eventId);
          if (entry) {
            selectScene(entry.event, { fromWheel: true });
          }
        },
        onChange: onWheelChange,
      });
      wheelMount.appendChild(wheelCtl.el);
      this._syncOpenSceneWheel = () => {
        if (wheelCtl?.el?.isConnected) {
          wheelCtl.sync();
        }
      };
      this._assignOpenLightToPalette = (paletteId, seed) => {
        const draft = currentDraft();
        const palette = (this._variables || []).find((item) => item.id === paletteId);
        if (!draft || !palette) {
          return;
        }
        applyVariableToDraft(draft, palette, {
          entityId: light.entity_id,
          seed: seed || 0,
          catalog: this._variables,
        });
        wheelCtl?.sync();
      };
      wheelCtl.setMode(draftWheelMode(currentDraft(), hasColor, hasTemp), {
        convertDraft: false,
      });
    }

    const bar = document.createElement("div");
    bar.className = "sidebar-actions-bar";
    const removeFromSceneBtn = document.createElement("ha-button");
    removeFromSceneBtn.className = "remove-light-from-scene-btn";
    removeFromSceneBtn.appearance = "plain";
    removeFromSceneBtn.textContent = this._t(
      "frontend.lights.remove_from_scene",
      "Remove light from scene"
    );
    removeFromSceneBtn.hidden = Boolean(this._editingThemeLook());
    removeFromSceneBtn.addEventListener("click", () => {
      this._removeLightFromAssignedScenes(light.entity_id);
    });
    const removeRow = document.createElement("div");
    removeRow.className = "sidebar-remove-light";
    removeRow.appendChild(removeFromSceneBtn);
    body.appendChild(removeRow);
    if (this._narrow) {
      const undo = this._undoRedoButton("undo");
      const redo = this._undoRedoButton("redo");
      undo.id = "sidebar-button-undo";
      redo.id = "sidebar-button-redo";
      bar.append(undo, redo, liveToggle, activateBtn);
      this._sidebarUndoBtn = undo;
      this._sidebarRedoBtn = redo;
    } else {
      bar.append(liveToggle, activateBtn);
      this._sidebarUndoBtn = null;
      this._sidebarRedoBtn = null;
    }
    footer.append(bar);
    host._reloadDrafts = () => {
      const fresh =
        (this._sunPath?.lights || []).find(
          (row) => row.entity_id === light.entity_id
        ) || light;
      const member = !fresh.suggested && !fresh.removed;
      for (const [index, item] of events.entries()) {
        const stored = this._lightEventStoredState(fresh, item.id);
        drafts.set(item.id, {
          draft: member ? { ...stored } : null,
          saved: member ? lightDraftFingerprint(stored) : "absent",
          member,
          event: item,
          index: index + 1,
        });
      }
      undoCommitted = false;
      paintChips();
      paintOverrides();
      brightnessGraphCtl?.sync();
      colorBriGraphCtl?.sync();
      whiteBriGraphCtl?.sync();
      wheelCtl?.sync();
      syncEffectControl();
      if (this._perLightLiveEditOn()) {
        void applyLive();
      }
    };
    this._syncDuskMinimumSlot(duskSlot, currentEvent.id);
    this._syncUndoButtons();

    host._switchLightEvent = async (next) => {
      await selectScene(next);
    };

    paintChips();
    paintOverrides();
    brightnessGraphCtl?.sync();
    wheelCtl?.sync();
    this._syncRoomPreviewControl();
    if (this._perLightLiveEditOn()) {
      await applyLive();
    }
  }

  async _appendSceneRenameFields(dialog, data, { focus } = {}) {
    const chipsAvailable = Boolean(customElements.get("ha-assist-chip"));
    const visible = new Set();
    if (focus === "category") {
      visible.add("category");
    }
    if (!chipsAvailable || data.description) {
      visible.add("description");
    }
    if (!chipsAvailable || data.category) {
      visible.add("category");
    }
    if (!chipsAvailable || (data.labels || []).length) {
      visible.add("labels");
    }
    let categories = [];
    try {
      categories = await this._hass.callWS({
        type: "config/category_registry/list",
        scope: "scene",
      });
    } catch (_err) {
      categories = [];
    }
    const bindValue = (el, onValue) => {
      el.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        onValue(ev.detail?.value);
      });
      el.addEventListener("input", () => onValue(el.value));
    };
    const nameInput = customElements.get("ha-input")
      ? document.createElement("ha-input")
      : document.createElement("ha-selector");
    nameInput.label = this._t("frontend.common.name", "Name");
    nameInput.required = true;
    nameInput.value = data.scene_name;
    if (nameInput.localName === "ha-selector") {
      nameInput.hass = this._hass;
      nameInput.selector = { text: {} };
    }
    nameInput.setAttribute("autofocus", "");
    bindValue(nameInput, (value) => {
      data.scene_name = value ?? "";
    });
    const iconPicker = customElements.get("ha-icon-picker")
      ? document.createElement("ha-icon-picker")
      : document.createElement("ha-selector");
    iconPicker.hass = this._hass;
    iconPicker.label = this._t("frontend.common.icon", "Icon");
    iconPicker.value = data.icon || "";
    if (iconPicker.localName === "ha-selector") {
      iconPicker.selector = { icon: {} };
    }
    bindValue(iconPicker, (value) => {
      data.icon = value || "";
    });
    dialog.append(nameInput, iconPicker);

    const optional = document.createElement("div");
    const chips = document.createElement(
      customElements.get("ha-chip-set") ? "ha-chip-set" : "div"
    );
    const addChip = (id, label, build) => {
      if (visible.has(id)) {
        optional.appendChild(build());
        return;
      }
      const chip = document.createElement("ha-assist-chip");
      chip.id = id;
      chip.label = label;
      const plus = document.createElement("ha-icon");
      plus.setAttribute("icon", "mdi:plus");
      plus.slot = "icon";
      chip.appendChild(plus);
      chip.addEventListener("click", () => {
        chip.remove();
        visible.add(id);
        optional.appendChild(build());
      });
      chips.appendChild(chip);
    };
    addChip(
      "description",
      this._t("frontend.common.add_description", "Add description"),
      () => {
        const field = customElements.get("ha-textarea")
          ? document.createElement("ha-textarea")
          : document.createElement("ha-selector");
        field.label = this._t("frontend.common.description", "Description");
        field.value = data.description;
        if (field.localName === "ha-selector") {
          field.hass = this._hass;
          field.selector = { text: { multiline: true } };
        }
        bindValue(field, (value) => {
          data.description = value ?? "";
        });
        return field;
      }
    );
    addChip(
      "category",
      this._t("frontend.common.add_category", "Add category"),
      () => {
        if (customElements.get("ha-category-picker")) {
          const picker = document.createElement("ha-category-picker");
          picker.hass = this._hass;
          picker.scope = "scene";
          picker.label = this._t("frontend.common.category", "Category");
          picker.value = data.category || "";
          bindValue(picker, (value) => {
            data.category = value || "";
          });
          return picker;
        }
        const picker = document.createElement("ha-selector");
        picker.hass = this._hass;
        picker.label = this._t("frontend.common.category", "Category");
        picker.value = data.category || "";
        picker.selector = {
          select: {
            mode: "dropdown",
            options: categories.map((item) => ({
              value: item.category_id,
              label: item.name,
            })),
          },
        };
        bindValue(picker, (value) => {
          data.category = value || "";
        });
        return picker;
      }
    );
    addChip("labels", this._t("frontend.common.add_labels", "Add labels"), () => {
      const picker = customElements.get("ha-labels-picker")
        ? document.createElement("ha-labels-picker")
        : document.createElement("ha-selector");
      picker.hass = this._hass;
      picker.value = data.labels;
      if (picker.localName === "ha-selector") {
        picker.label = this._t("frontend.common.labels", "Labels");
        picker.selector = { label: { multiple: true } };
      }
      bindValue(picker, (value) => {
        data.labels = value || [];
      });
      return picker;
    });
    dialog.append(optional, chips);
    return nameInput;
  }

  async _openSaveDialog({ rename = false, focus } = {}) {
    this.shadowRoot.querySelector("ha-dialog.save-dialog")?.remove();
    const data = {
      scene_name: this._nameIsPlaceholder(this._formData.scene_name)
        ? this._suggestedSceneName(this._formData)
        : this._formData.scene_name || this._suggestedSceneName(this._formData),
      description: this._formData.description || "",
      labels: [...(this._formData.labels || [])],
      category: this._formData.category || "",
      icon:
        this._formData.icon ||
        this._hass?.entities?.[this._entityId]?.icon ||
        "",
    };
    const dialog = document.createElement("ha-dialog");
    dialog.className = "save-dialog";
    dialog.setAttribute(
      "header-title",
      rename
        ? this._t("frontend.common.rename", "Rename")
        : this._t("frontend.common.save", "Save")
    );
    dialog.open = true;
    const nameInput = await this._appendSceneRenameFields(dialog, data, {
      focus,
    });

    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = "Cancel";
    cancel.setAttribute("data-dialog", "close");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const save = document.createElement("ha-button");
    save.slot = "primaryAction";
    save.variant = "brand";
    save.textContent = rename ? "Rename" : "Save";
    save.addEventListener("click", async () => {
      const name = (nameInput.value || data.scene_name || "").trim();
      if (!name) {
        nameInput.reportValidity?.();
        return;
      }
      this._formData.scene_name = name;
      this._formData.description = data.description;
      this._formData.labels = data.labels;
      this._formData.category = data.category || null;
      this._formData.icon = data.icon || null;
      this._syncEditorSceneTitle();
      dialog.open = false;
      await this._save();
    });
    footer.append(cancel, save);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
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

  _confirmDelete() {
    if (!this._editId) {
      return;
    }
    this.shadowRoot.querySelector("ha-dialog.confirm-dialog")?.remove();
    const dialog = document.createElement("ha-dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute(
      "header-title",
      this._loc(
        "ui.panel.config.scene.picker.delete_confirm_title",
        "Delete scene?"
      )
    );
    dialog.open = true;
    const text = document.createElement("p");
    const displayName = this._editorSceneTitle();
    text.textContent = this._loc(
      "ui.panel.config.scene.picker.delete_confirm_text",
      `Are you sure you want to delete ${displayName}?`,
      { name: displayName }
    );
    dialog.appendChild(text);
    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const confirm = document.createElement("ha-button");
    confirm.slot = "primaryAction";
    confirm.variant = "danger";
    confirm.textContent = this._loc("ui.common.delete", "Delete");
    confirm.addEventListener("click", () => {
      dialog.open = false;
      this._delete();
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  }

  _duskMinimumSeconds() {
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

  _sunPathMatchesChart() {
    return Boolean(
      this._sunPath?.curve?.length && this._sunPathKey === this._chartKey()
    );
  }

  _chartKey() {
    if (this._view !== "edit") {
      // List chart is solar-only and always “today” — not the editor date scrub.
      return `list-sun:${todayIso()}:${this._duskMinimumSeconds()}`;
    }
    return JSON.stringify({
      date: this._previewDate,
      dusk: this._duskMinimumSeconds(),
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
  }

  _schedulePreview() {
    if (this._previewTimer) {
      window.clearTimeout(this._previewTimer);
    }
    this._previewTimer = window.setTimeout(() => {
      this._previewTimer = undefined;
      this._ensureSunPath();
    }, 80);
  }

  _rememberPreview(key, payload) {
    this._previewCache.set(key, payload);
    if (this._previewCache.size <= 64) {
      return;
    }
    this._previewCache.delete(this._previewCache.keys().next().value);
  }

  _clearPreviewCache() {
    this._previewCache.clear();
    this._sunPathKey = undefined;
  }

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
  }

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
  }

  _cancelSunPathMorph() {
    if (this._sunPathMorphRaf) {
      window.cancelAnimationFrame(this._sunPathMorphRaf);
      this._sunPathMorphRaf = undefined;
    }
  }

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
  }

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
  }

  _shiftPreviewDate(days) {
    this._setPreviewDate(shiftIsoDate(this._previewDate, days));
  }

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
  }

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
  }

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
  }

  _buildDateToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = "sun-toolbar";

    const year = new Date().getFullYear();
    const presets = [
      ["Today", todayIso()],
      ["21 Jun", `${year}-06-21`],
      ["21 Dec", `${year}-12-21`],
    ];
    const chipRow = document.createElement("div");
    chipRow.className = "sun-chip-row";
    for (const [name, value] of presets) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sun-chip";
      chip.textContent = name;
      chip.addEventListener("click", () => {
        this._setPreviewDate(value);
      });
      chipRow.appendChild(chip);
    }

    // Visually hidden HA date field — opened from the day/month label click.
    const pickerHost = document.createElement("div");
    pickerHost.className = "sun-date-picker-host";
    pickerHost.setAttribute("aria-hidden", "true");
    const picker = document.createElement("ha-selector");
    picker.hass = this._hass;
    picker.label = "Date";
    picker.required = true;
    picker.selector = { date: {} };
    picker.value = this._previewDate;
    picker.addEventListener("value-changed", (ev) => {
      const value = ev.detail?.value;
      if (!value || value === this._previewDate) {
        return;
      }
      this._setPreviewDate(value);
    });
    pickerHost.appendChild(picker);

    const dateBtn = document.createElement("div");
    dateBtn.className = "sun-scrub-date";
    dateBtn.setAttribute("role", "button");
    dateBtn.setAttribute("aria-label", "Choose preview date");
    dateBtn.tabIndex = 0;
    const dateLabel = document.createElement("span");
    dateLabel.className = "sun-scrub-date-label";
    const dateReset = document.createElement("ha-icon");
    dateReset.className = "sun-scrub-date-reset";
    dateReset.setAttribute("icon", "mdi:restore");
    dateReset.hidden = true;
    dateBtn.append(dateLabel, dateReset, pickerHost);
    const onDateActivate = () => {
      if (this._previewDate !== todayIso()) {
        this._setPreviewDate(todayIso());
        return;
      }
      this._openPreviewDatePicker();
    };
    dateBtn.addEventListener("click", onDateActivate);
    dateBtn.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") {
        return;
      }
      ev.preventDefault();
      onDateActivate();
    });

    const dateTools = document.createElement("div");
    dateTools.className = "sun-date-tools";
    // Chips first: left of the date in portrait/table row; above the date in
    // the landscape rail (column + align-end).
    dateTools.append(chipRow, dateBtn);

    const scrubBlock = document.createElement("div");
    scrubBlock.className = "sun-scrub-block";
    scrubBlock.append(dateTools, this._buildYearScrub());

    this._datePicker = picker;
    this._dateChips = chipRow.querySelectorAll(".sun-chip");
    this._scrubDateBtn = dateBtn;
    this._scrubDateLabel = dateLabel;
    this._scrubDateReset = dateReset;
    this._dateTools = dateTools;
    this._chipRow = chipRow;
    this._scrubBlock = scrubBlock;
    // Location banner is in .page-banners (wired in first render), not toolbar.
    toolbar.append(scrubBlock);
    this._syncLocationToolbar();
    this._syncScrubDateLabel();
    return toolbar;
  }

  _syncScrubDateLabel() {
    if (!this._scrubDateLabel) {
      return;
    }
    const otherDay = this._previewDate !== todayIso();
    this._scrubDateLabel.textContent = formatPreviewDayMonth(this._previewDate);
    if (this._scrubDateReset) {
      this._scrubDateReset.hidden = !otherDay;
    }
    if (this._scrubDateBtn) {
      this._scrubDateBtn.classList.toggle("is-other-day", otherDay);
      const choose = this._t(
        "frontend.actions.choose_preview_date",
        "Choose preview date"
      );
      const back = this._t("frontend.actions.back_to_today", "Back to today");
      this._scrubDateBtn.title = otherDay ? back : this._previewDate;
      this._scrubDateBtn.setAttribute("aria-label", otherDay ? back : choose);
    }
  }

  _openPreviewDatePicker() {
    const picker = this._datePicker;
    if (!picker) {
      return;
    }
    const openFrom = (el) => {
      if (!el) {
        return false;
      }
      // HA’s date input opens ha-dialog-date-picker from this private helper.
      if (typeof el._openDialog === "function") {
        el._openDialog();
        return true;
      }
      el.click?.();
      return true;
    };
    const findDateInput = () =>
      picker.shadowRoot
        ?.querySelector("ha-selector-date")
        ?.shadowRoot?.querySelector("ha-date-input") ||
      picker.shadowRoot?.querySelector("ha-date-input");
    const run = () => {
      const dateInput = findDateInput();
      if (openFrom(dateInput)) {
        return;
      }
      // Selector may still be upgrading — click through known hosts.
      const selDate = picker.shadowRoot?.querySelector("ha-selector-date");
      if (openFrom(selDate) || openFrom(picker)) {
        return;
      }
    };
    if (!picker.shadowRoot?.querySelector("ha-selector-date")) {
      customElements.whenDefined("ha-selector").then(() => {
        requestAnimationFrame(run);
      });
      return;
    }
    run();
  }

  _homeLocation() {
    const cfg = this._hass?.config;
    if (cfg?.latitude == null || cfg?.longitude == null) {
      return null;
    }
    return {
      latitude: Number(cfg.latitude),
      longitude: Number(cfg.longitude),
    };
  }

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

  _syncLocationToolbar() {
    const active = Boolean(this._previewLocation);
    if (this._locationBtn) {
      this._locationBtn.hidden = active;
    }
    if (this._locationBanner) {
      this._locationBanner.hidden = !active;
    }
    this._syncPageBannersVisibility();
    if (this._locationCoords && this._previewLocation) {
      this._locationCoords.textContent = formatLatLng(
        this._previewLocation.latitude,
        this._previewLocation.longitude
      );
    }
    const homeName = this._hass?.config?.location_name || "home";
    if (this._locationBanner) {
      const reset = this._locationBanner.querySelector("ha-icon-button");
      if (reset) {
        reset.label = `Use ${homeName} location`;
      }
    }
  }

  _openLocationDialog() {
    this.shadowRoot.querySelector("ha-dialog.location-dialog")?.remove();
    const home = this._homeLocation() || { latitude: 0, longitude: 0 };
    const data = {
      latitude: this._previewLocation?.latitude ?? home.latitude,
      longitude: this._previewLocation?.longitude ?? home.longitude,
    };
    const dialog = document.createElement("ha-dialog");
    dialog.className = "location-dialog";
    dialog.setAttribute("header-title", "Preview location");
    dialog.open = true;

    const help = document.createElement("p");
    help.textContent =
      "Sun times and light graphs use this place. The clock stays on your Home Assistant timezone.";

    const searchRow = document.createElement("div");
    searchRow.className = "location-search";
    const searchField = this._haInput("Search", "");
    searchField.placeholder = this._t(
      "frontend.location.search_placeholder",
      "City or address"
    );
    const searchBtn = document.createElement("ha-button");
    searchBtn.textContent = "Search";
    searchRow.append(searchField, searchBtn);
    const searchDisclosure = document.createElement("p");
    searchDisclosure.textContent = this._t(
      "frontend.location.search_disclosure",
      "Search sends your query and browser IP to Photon (Komoot) when you search."
    );

    const searchError = document.createElement("p");
    searchError.className = "error";
    searchError.hidden = true;
    const results = document.createElement("div");
    results.className = "location-search-results";

    const picker = document.createElement("ha-selector");
    picker.hass = this._hass;
    picker.label = "Location";
    picker.selector = { location: { radius: false } };
    picker.value = { latitude: data.latitude, longitude: data.longitude };
    const applyCoords = (latitude, longitude) => {
      data.latitude = latitude;
      data.longitude = longitude;
      picker.value = { latitude, longitude };
    };
    picker.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const value = ev.detail?.value;
      if (value?.latitude == null || value?.longitude == null) {
        return;
      }
      data.latitude = value.latitude;
      data.longitude = value.longitude;
    });

    const runSearch = async () => {
      const query = (searchField.value || "").trim();
      searchError.hidden = true;
      results.replaceChildren();
      if (!query) {
        return;
      }
      searchBtn.disabled = true;
      try {
        const hits = await this._searchLocations(query);
        if (!hits.length) {
          searchError.textContent = "No matching places. Try a city name or move the map.";
          searchError.hidden = false;
          return;
        }
        if (hits.length === 1) {
          applyCoords(hits[0].latitude, hits[0].longitude);
          return;
        }
        for (const hit of hits) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = hit.label;
          btn.addEventListener("click", () => {
            applyCoords(hit.latitude, hit.longitude);
            results.replaceChildren();
          });
          results.appendChild(btn);
        }
      } catch (err) {
        searchError.textContent = err.message || String(err);
        searchError.hidden = false;
      } finally {
        searchBtn.disabled = false;
      }
    };
    searchBtn.addEventListener("click", () => {
      runSearch();
    });
    searchField.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        runSearch();
      }
    });

    dialog.append(help, searchRow, searchDisclosure, searchError, results, picker);

    const footer = customElements.get("ha-dialog-footer")
      ? document.createElement("ha-dialog-footer")
      : document.createElement("div");
    footer.slot = "footer";
    const cancel = document.createElement("ha-button");
    cancel.slot = "secondaryAction";
    cancel.appearance = "plain";
    cancel.textContent = this._loc("ui.common.cancel", "Cancel");
    cancel.addEventListener("click", () => {
      dialog.open = false;
    });
    const apply = document.createElement("ha-button");
    apply.slot = "primaryAction";
    apply.variant = "brand";
    apply.textContent = "Preview";
    apply.addEventListener("click", () => {
      this._setPreviewLocation(data);
      dialog.open = false;
    });
    footer.append(cancel, apply);
    dialog.appendChild(footer);
    dialog.addEventListener("closed", () => dialog.remove());
    this.shadowRoot.appendChild(dialog);
  }

  async _searchLocations(query) {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Location search failed (${response.status})`);
    }
    const payload = await response.json();
    return (payload.features || []).map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const label = [
        props.name,
        props.street,
        props.city || props.county,
        props.state,
        props.country,
      ]
        .filter(Boolean)
        .filter((part, index, all) => all.indexOf(part) === index)
        .join(", ");
      return { latitude, longitude, label: label || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}` };
    });
  }

  _buildYearScrub() {
    const scrub = document.createElement("div");
    scrub.className = "sun-year-scrub";
    scrub.tabIndex = 0;
    scrub.setAttribute("role", "slider");
    scrub.setAttribute("aria-label", "Preview day");
    const months = document.createElement("div");
    months.className = "sun-year-months";
    const track = document.createElement("div");
    track.className = "sun-year-track";
    const bar = document.createElement("div");
    bar.className = "sun-year-bar";
    const fill = document.createElement("div");
    fill.className = "sun-year-fill";
    const todayMark = document.createElement("div");
    todayMark.className = "sun-year-today";
    const thumb = document.createElement("div");
    thumb.className = "sun-year-thumb";
    track.append(bar, fill, todayMark, thumb);
    scrub.append(months, track);

    const dateFromEvent = (ev) => {
      const rect = track.getBoundingClientRect();
      const vertical = scrub.classList.contains("vertical");
      const t = vertical
        ? rect.height
          ? (ev.clientY - rect.top) / rect.height
          : 0
        : rect.width
          ? (ev.clientX - rect.left) / rect.width
          : 0;
      const year = isoYear(this._previewDate);
      const days = daysInYear(year);
      const dayIndex = Math.max(0, Math.min(days - 1, Math.floor(t * days)));
      return isoFromDayOfYear(year, dayIndex);
    };
    const applyPointer = (ev) => {
      this._setPreviewDate(dateFromEvent(ev), { debounce: true });
    };

    scrub.addEventListener("pointerdown", (ev) => {
      if (ev.button != null && ev.button !== 0) {
        return;
      }
      ev.preventDefault();
      // Do not focus on pointer — :focus-visible still rings in some browsers
      // after programmatic focus from click. Tab / arrows keep working via tabindex.
      scrub.setPointerCapture(ev.pointerId);
      this._yearScrubbing = true;
      this._stopScenePlayBecauseTimeChanged();
      applyPointer(ev);
    });
    scrub.addEventListener("pointermove", (ev) => {
      if (!scrub.hasPointerCapture(ev.pointerId)) {
        return;
      }
      this._pendingScrubPoint = { clientX: ev.clientX, clientY: ev.clientY };
      if (this._scrubRaf) {
        return;
      }
      this._scrubRaf = window.requestAnimationFrame(() => {
        this._scrubRaf = undefined;
        if (!this._yearScrubbing || !this._pendingScrubPoint) {
          return;
        }
        applyPointer(this._pendingScrubPoint);
      });
    });
    const endScrub = (ev) => {
      if (!this._yearScrubbing) {
        return;
      }
      this._yearScrubbing = false;
      if (this._scrubRaf) {
        window.cancelAnimationFrame(this._scrubRaf);
        this._scrubRaf = undefined;
      }
      if (this._pendingScrubPoint) {
        applyPointer(this._pendingScrubPoint);
        this._pendingScrubPoint = undefined;
      }
      if (ev?.pointerId != null && scrub.hasPointerCapture(ev.pointerId)) {
        scrub.releasePointerCapture(ev.pointerId);
      }
      this._syncDateToolbar();
      this._syncYearScrubLayout();
      this._pathMorphMs = PREVIEW_REFINE_MS;
      this._ensureSunPath().then(() => this._resumeRoomPreviewIfPreferred());
    };
    scrub.addEventListener("pointerup", endScrub);
    scrub.addEventListener("pointercancel", endScrub);
    scrub.addEventListener("keydown", (ev) => {
      const year = isoYear(this._previewDate);
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
        ev.preventDefault();
        this._shiftPreviewDate(-1);
      } else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
        ev.preventDefault();
        this._shiftPreviewDate(1);
      } else if (ev.key === "PageDown") {
        ev.preventDefault();
        this._shiftPreviewDate(30);
      } else if (ev.key === "PageUp") {
        ev.preventDefault();
        this._shiftPreviewDate(-30);
      } else if (ev.key === "Home") {
        ev.preventDefault();
        this._setPreviewDate(`${year}-01-01`);
      } else if (ev.key === "End") {
        ev.preventDefault();
        this._setPreviewDate(`${year}-12-31`);
      }
    });

    this._yearScrub = scrub;
    this._yearMonths = months;
    this._yearFill = fill;
    this._yearTodayMark = todayMark;
    this._yearThumb = thumb;
    this._yearMonthsYear = undefined;
    return scrub;
  }

  _syncDateToolbar() {
    if (this._datePicker) {
      this._datePicker.hass = this._hass;
      this._datePicker.value = this._previewDate;
    }
    const year = new Date().getFullYear();
    const presets = [todayIso(), `${year}-06-21`, `${year}-12-21`];
    this._dateChips?.forEach((chip, index) => {
      if (presets[index] === this._previewDate) {
        chip.setAttribute("selected", "");
      } else {
        chip.removeAttribute("selected");
      }
    });
    this._syncScrubDateLabel();
    this._syncLocationToolbar();
    this._syncYearScrub();
  }

  _syncYearScrub() {
    if (!this._yearScrub) {
      return;
    }
    const iso = this._previewDate;
    const year = isoYear(iso);
    const days = daysInYear(year);
    const dayIndex = dayOfYear(iso);
    const thumbT = ((dayIndex + 0.5) / days) * 100;
    const vertical = this._yearScrub.classList.contains("vertical");
    if (vertical) {
      this._yearThumb.style.left = "";
      this._yearThumb.style.top = `${thumbT}%`;
      this._yearFill.style.width = "";
      this._yearFill.style.height = `${thumbT}%`;
    } else {
      this._yearThumb.style.top = "";
      this._yearThumb.style.left = `${thumbT}%`;
      this._yearFill.style.height = "";
      this._yearFill.style.width = `${thumbT}%`;
    }
    this._yearScrub.setAttribute("aria-valuemin", "1");
    this._yearScrub.setAttribute("aria-valuemax", String(days));
    this._yearScrub.setAttribute("aria-valuenow", String(dayIndex + 1));
    this._yearScrub.setAttribute("aria-valuetext", iso);
    this._yearScrub.setAttribute(
      "aria-orientation",
      vertical ? "vertical" : "horizontal"
    );
    this._yearScrub.title = iso;

    const today = todayIso();
    if (isoYear(today) === year) {
      this._yearTodayMark.hidden = false;
      const todayT = ((dayOfYear(today) + 0.5) / days) * 100;
      if (vertical) {
        this._yearTodayMark.style.left = "";
        this._yearTodayMark.style.top = `${todayT}%`;
      } else {
        this._yearTodayMark.style.top = "";
        this._yearTodayMark.style.left = `${todayT}%`;
      }
    } else {
      this._yearTodayMark.hidden = true;
    }

    if (this._yearMonthsYear === year && this._yearMonthsVertical === vertical) {
      return;
    }
    this._yearMonthsYear = year;
    this._yearMonthsVertical = vertical;
    const locale = this._hass?.locale?.language || this._hass?.language || "en";
    this._yearMonths.replaceChildren();
    for (let month = 0; month < 12; month += 1) {
      const label = document.createElement("span");
      label.textContent = new Date(year, month, 1).toLocaleDateString(locale, {
        month: "short",
      });
      const startDay = dayOfYear(`${year}-${String(month + 1).padStart(2, "0")}-01`);
      const pos = (startDay / days) * 100;
      if (vertical) {
        label.style.left = "auto";
        label.style.right = "0";
        label.style.top = `${pos}%`;
        if (month === 0) {
          label.style.transform = "none";
        } else if (month === 11) {
          label.style.transform = "translateY(-100%)";
        } else {
          label.style.transform = "translateY(-50%)";
        }
      } else {
        label.style.right = "";
        label.style.top = "";
        label.style.left = `${pos}%`;
        if (month === 0) {
          label.style.transform = "none";
        } else if (month === 11) {
          label.style.transform = "translateX(-100%)";
        } else {
          label.style.transform = "translateX(-50%)";
        }
      }
      this._yearMonths.appendChild(label);
    }
  }

  _isLandscape() {
    return Boolean(this._landscapeMq?.matches) ||
      window.matchMedia("(orientation: landscape)").matches;
  }

  /** Wide enough for the dual-gutter landscape scrub rail. */
  _landscapeScrubFits() {
    return window.matchMedia(
      `(min-width: ${CLOCK_LANDSCAPE_SCRUB_MIN_WIDTH_PX}px)`
    ).matches;
  }

  _sceneSidebarIsOpen() {
    const el = this.shadowRoot?.querySelector(".scene-sidebar");
    if (!el || el._closing) {
      return false;
    }
    if (el.localName === "ha-bottom-sheet") {
      return Boolean(el.open);
    }
    return el.classList.contains("open");
  }

  _ensureToolbarChrome() {
    if (this._toolbarChrome?.isConnected) {
      return this._toolbarChrome;
    }
    const chrome = document.createElement("div");
    chrome.className = "sun-toolbar-chrome";
    this._toolbarChrome = chrome;
    return chrome;
  }

  _placeDateWithReadout() {
    if (!this._dateTools || !this._scrubDateBtn) {
      return;
    }
    const row = [this._scrubDateBtn];
    if (this._hoverReadout) {
      row.push(this._hoverReadout);
    }
    this._dateTools.replaceChildren(...row);
  }

  _dialChromeOverlaysFace() {
    return (
      !this._isEditorNarrow() &&
      Boolean(this._sunPathStage?.classList.contains("landscape-clock-scrub"))
    );
  }

  _syncYearScrubLayout() {
    if (!this._yearScrub || !this._dateToolbar || !this._scrubBlock) {
      return;
    }
    // Keep the scrub node where it is while dragging so pointer capture and
    // axis stay stable across preview redraws.
    if (this._yearScrubbing) {
      return;
    }
    const landscape = this._isLandscape();
    const clock =
      this._isDialView() &&
      Boolean(this._clockScrubRail) &&
      Boolean(this.shadowRoot?.querySelector(".sun-light-clock-face"));
    const sidebarOpen = this._sceneSidebarIsOpen();
    // Portrait chrome below this width — empty left rail reads as a black bar.
    const landscapeClock = landscape && clock && this._landscapeScrubFits();
    // The drawer owns the right-side space while open; the face FLIP absorbs
    // this rail collapse into the same smooth scale/translation.
    const collapse = landscapeClock && sidebarOpen;
    const hideToolbarScrub = landscape && sidebarOpen && !clock;

    this._yearScrub.classList.toggle("vertical", landscapeClock);
    this._sunPathStage?.classList.toggle("landscape-clock-scrub", landscapeClock);
    this._sunPathStage?.classList.toggle("scrub-collapsed", collapse);
    this._yearScrub.setAttribute("aria-hidden", collapse || hideToolbarScrub ? "true" : "false");
    if (this._scrubDateBtn) {
      this._scrubDateBtn.hidden = collapse || hideToolbarScrub;
    }
    if (this._chipRow) {
      this._chipRow.hidden = collapse || hideToolbarScrub;
    }

    if (landscapeClock) {
      this._clockScrubRail.hidden = false;
      // Stay in the rail while collapsed so width can animate; do not use hidden.
      this._scrubBlock.hidden = false;
      if (this._scrubBlock.parentNode !== this._clockScrubRail) {
        this._clockScrubRail.appendChild(this._scrubBlock);
      }
      if (this._narrow) {
        // Chips are hidden. Now and sun angle sit on the date row.
        this._toolbarChrome?.remove();
        this._placeDateWithReadout();
      } else {
        // Time + date chips stay in the stage toolbar (full column). The rail
        // only holds the date label and year slider beside the face.
        const chrome = this._ensureToolbarChrome();
        [...chrome.querySelectorAll(".sun-hover-readout")].forEach((el) => {
          if (el !== this._hoverReadout) {
            el.remove();
          }
        });
        if (this._hoverReadout && this._hoverReadout.parentNode !== chrome) {
          chrome.appendChild(this._hoverReadout);
        }
        if (this._chipRow && this._chipRow.parentNode !== chrome) {
          chrome.appendChild(this._chipRow);
        }
        if (chrome.parentNode !== this._dateToolbar) {
          this._dateToolbar.insertBefore(chrome, this._dateToolbar.firstChild);
        }
        if (this._dateTools && this._scrubDateBtn) {
          this._dateTools.replaceChildren(this._scrubDateBtn);
        }
      }
    } else {
      this._sunPathStage?.classList.remove("scrub-collapsed");
      if (this._clockScrubRail) {
        this._clockScrubRail.hidden = true;
        this._clockScrubRail.style.height = "";
        this._clockScrubRail.style.paddingBottom = "";
        this._clockScrubRail.style.marginTop = "";
        this._clockScrubRail.style.top = "";
        this._clockScrubRail.style.left = "";
      }
      if (this._scrubBlock.parentNode !== this._dateToolbar) {
        this._dateToolbar.appendChild(this._scrubBlock);
      }
      this._scrubBlock.hidden = hideToolbarScrub;
      this._yearScrub.classList.remove("vertical");

      if (clock && this._narrow) {
        this._toolbarChrome?.remove();
        this._placeDateWithReadout();
      } else if (clock) {
        // Portrait dial: time/sun + chips in one wrapping chrome row; date +
        // year scrub below (in-flow so the timeline pushes the dial down).
        const chrome = this._ensureToolbarChrome();
        [...chrome.querySelectorAll(".sun-hover-readout")].forEach((el) => {
          if (el !== this._hoverReadout) {
            el.remove();
          }
        });
        if (this._hoverReadout && this._hoverReadout.parentNode !== chrome) {
          chrome.appendChild(this._hoverReadout);
        }
        if (this._chipRow && this._chipRow.parentNode !== chrome) {
          chrome.appendChild(this._chipRow);
        }
        if (chrome.parentNode !== this._dateToolbar) {
          this._dateToolbar.insertBefore(chrome, this._scrubBlock);
        }
        if (this._dateTools && this._scrubDateBtn) {
          this._dateTools.replaceChildren(this._scrubDateBtn);
        }
      } else {
        // Table / list chart: chips with date; readout stays in the body.
        if (this._toolbarChrome) {
          this._toolbarChrome.remove();
        }
        if (
          this._hoverReadout &&
          this._sunPathBodyEl &&
          this._hoverReadout.parentNode !== this._sunPathBodyEl
        ) {
          this._sunPathBodyEl.insertBefore(
            this._hoverReadout,
            this._sunPathBodyEl.firstChild
          );
        }
        if (this._dateTools && this._chipRow && this._scrubDateBtn) {
          this._dateTools.append(this._scrubDateBtn, this._chipRow);
        }
      }
    }
    this._syncYearScrub();
    if (
      this._toolbarChrome?.isConnected &&
      (this._view === "theme" ||
        (this._view === "edit" && this._formData?.kind !== "simple"))
    ) {
      this._syncSceneUsed();
    }
    if (landscapeClock) {
      requestAnimationFrame(() => this._alignYearScrubRail());
    }
    // Portrait timeline is in-flow — remeasure face budget after chrome settles.
    requestAnimationFrame(() => this._syncDialHeightBudget(landscapeClock));
  }

  _syncDialHeightBudget(landscapeClock) {
    const path = this._sunPathEl;
    if (!path) {
      return;
    }
    if (!path.classList.contains("dial-view")) {
      path.style.removeProperty("--dial-timeline-h");
      path.style.removeProperty("--dial-face-max");
      path.style.removeProperty("--dial-banner-h");
      return;
    }
    // Toolbar (time + chips; portrait also date + year scrub) is in-flow so
    // the face shrinks, then scrolls at DIAL_FACE_MIN. Landscape year rail
    // sits beside the face (not in the toolbar).
    let toolbarH = 0;
    if (this._dateToolbar?.isConnected && !this._dialChromeOverlaysFace()) {
      toolbarH = Math.ceil(this._dateToolbar.getBoundingClientRect().height) || 0;
    }
    path.style.setProperty("--dial-timeline-h", `${toolbarH}px`);

    // Draft/location banners live in .stage-col above the scrollport.
    // Face size (fits light tiles, same floor as the color wheel) is _syncStageFaceMax.
    const hostRect = this.getBoundingClientRect();
    const pathTop = path.getBoundingClientRect().top;
    const vignetteReach = Math.max(0, Math.round(pathTop - hostRect.top));
    path.style.setProperty("--dial-banner-h", `${vignetteReach}px`);
    this._syncStageFaceMax();
    // Face size may have changed — re-align landscape rail / chrome next frame.
    requestAnimationFrame(() => this._alignYearScrubRail());
  }

  _alignYearScrubRail() {
    if (
      !this._clockScrubRail ||
      this._clockScrubRail.hidden ||
      !this._sunPathStage?.classList.contains("landscape-clock-scrub")
    ) {
      return;
    }
    const face = this.shadowRoot?.querySelector(".sun-light-clock-face");
    if (!face) {
      return;
    }
    const faceRect = face.getBoundingClientRect();
    if (!faceRect.height) {
      return;
    }
    // Match the dial height; grid columns handle horizontal centering.
    // Pad the bottom so the Save FAB does not cover the year scrub track.
    let padBottom = 0;
    const fab = this._fabEl;
    if (fab && !fab.hidden) {
      const fabRect = fab.getBoundingClientRect();
      const railRect = this._clockScrubRail.getBoundingClientRect();
      if (
        fabRect.height > 0 &&
        fabRect.left < railRect.right &&
        fabRect.right > railRect.left &&
        fabRect.top < faceRect.bottom
      ) {
        padBottom = Math.max(0, faceRect.bottom - fabRect.top + 12);
      }
    }
    this._clockScrubRail.style.height = `${faceRect.height}px`;
    this._clockScrubRail.style.paddingBottom = padBottom ? `${padBottom}px` : "";
    this._clockScrubRail.style.top = "";
    this._clockScrubRail.style.left = "";
    this._clockScrubRail.style.marginTop = "";
  }

  _ensureHoverReadout() {
    if (this._hoverReadout) {
      return this._hoverReadout;
    }
    const readout = document.createElement("div");
    readout.className = "sun-hover-readout";
    readout.setAttribute("aria-live", "polite");
    this._hoverReadout = readout;
    return readout;
  }

  _syncSceneUsed() {
    if (this._view === "theme") {
      const strip = renderThemePresetSource(this);
      const host = this._toolbarChrome;
      const previous = this.shadowRoot?.querySelector(".scene-used");
      if (!host || !strip) {
        previous?.remove();
      } else if (previous && previous.parentNode === host) {
        previous.replaceWith(strip);
      } else {
        previous?.remove();
        host.append(strip);
      }
      this._syncLibraryUsedBy();
      return;
    }
    if (this._view === "palette") {
      const strip = renderPaletteUsed(this);
      const host = this.shadowRoot?.querySelector(".simple-editor");
      const previous = this.shadowRoot?.querySelector(".scene-used");
      if (!host || !strip) {
        previous?.remove();
      } else if (previous && previous.parentNode === host) {
        previous.replaceWith(strip);
      } else {
        previous?.remove();
        host.append(strip);
      }
      this._syncLibraryUsedBy();
      return;
    }
    const strip = renderSceneUsed(this);
    const simple =
      this._view === "edit" && this._formData?.kind === "simple"
        ? this.shadowRoot?.querySelector(".simple-editor")
        : null;
    const chrome = this._toolbarChrome;
    const host =
      simple ||
      (this._view === "edit" && this._formData?.kind !== "simple" ? chrome : null);
    const previous = this.shadowRoot?.querySelector(".scene-used");
    if (!host || !strip) {
      previous?.remove();
    } else if (previous && previous.parentNode === host) {
      previous.replaceWith(strip);
    } else {
      previous?.remove();
      host.append(strip);
    }
    this._syncLibraryUsedBy();
  }

  _syncLibraryUsedBy() {
    // The scene editor's "Uses N presets" row shares this class. Leave it.
    for (const row of this.shadowRoot?.querySelectorAll(
      ".library-used-by:not(.scene-preset-uses)"
    ) || []) {
      row.remove();
    }
    let kind = null;
    let id = null;
    let host = null;
    if (this._view === "theme" && this._themeId) {
      kind = "theme";
      id = this._themeId;
      host = this._toolbarChrome;
    } else if (this._view === "palette" && this._variableId) {
      kind = "palette";
      id = this._variableId;
      host = this.shadowRoot?.querySelector(".simple-editor");
    } else if (this._view === "variable" && this._variableId) {
      kind = "variable";
      id = this._variableId;
      host = this.shadowRoot?.querySelector(".library-editor");
    }
    if (!kind || !id || !host) {
      return;
    }
    const row = renderLibraryUsedBy(this, { kind, id });
    if (!row) {
      return;
    }
    const used = host.querySelector(":scope > .scene-used");
    if (used) {
      used.appendChild(row);
      return;
    }
    if (this._view === "theme") {
      host.append(row);
    } else {
      host.prepend(row);
    }
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
    }
  }

  _drawSunPath() {
    if (this._view === "theme") {
      /* Theme editor uses the same dial as circadian scenes. */
    } else if (this._view !== "edit" || this._formData?.kind === "simple") {
      this._parkSunPath();
      return;
    }
    if (!this._sunPathEl || !this._sunPath || !this._sunPath.curve?.length) {
      return;
    }
    if (
      this._clockRingsHost?.isConnected &&
      this._patchLightClock(this._sunPath)
    ) {
      this._displayedSunPath = this._sunPath;
      if (this._dateToolbar) {
        if (this._yearScrubbing) {
          this._syncYearScrub();
        } else {
          this._syncDateToolbar();
        }
      }
      this._syncEditorChrome();
      this._ensureHoverReadout();
      this._syncYearScrubLayout();
      this._fillHoverReadout(this._idleReadoutSeconds(), { hovering: false });
      this._syncSceneUsed();
      return;
    }
    const { events } = this._sunPath;
    const tileSnap = captureLightStripLayout(
      this._clockLegendEl?.querySelector(".light-tiles")
    );
    const clockEl = this._buildLightClock(events);
    if (!this._dateToolbar) {
      this._dateToolbar = this._buildDateToolbar();
    }
    if (this._dateToolbar.parentNode !== this._sunPathEl) {
      const before = this._sunPathStage || this._sunPathBodyEl;
      this._sunPathEl.insertBefore(this._dateToolbar, before);
    }
    if (this._yearScrubbing) {
      this._syncYearScrub();
    } else {
      this._syncDateToolbar();
    }
    const children = [];
    if (events.some((event) => event.fallback)) {
      const note = document.createElement("p");
      note.className = "sun-fallback-note";
      note.textContent = this._t(
        "frontend.chart.fallback_note",
        "* Time uses a seasonal fallback because the sun does not rise or set that day."
      );
      children.push(note);
    }
    children.push(clockEl);
    this._sunPathEl.hidden = false;
    this._sunPathBodyEl.replaceChildren(...children);
    if (this._clockLegendEl) {
      this._sunPathEl.appendChild(this._clockLegendEl);
    }
    playLightStripLayout(
      this._clockLegendEl?.querySelector(".light-tiles"),
      tileSnap
    );
    this._syncEditorChrome();
    this._ensureHoverReadout();
    this._syncYearScrubLayout();
    this._fillHoverReadout(this._idleReadoutSeconds(), { hovering: false });
    this._syncSceneUsed();
    this._displayedSunPath = this._sunPath;
    this._restoreHeldTileScroll();
  }
  _patchHoverReadoutClock(seconds) {
    this._updateLightNameBrightness(seconds);
    const readout = this._hoverReadout;
    if (!readout) {
      return;
    }
    const time = readout.querySelector(".sun-hover-time");
    const sun = readout.querySelector(".sun-hover-elev");
    if (time) {
      time.textContent = formatClock(seconds);
    }
    if (sun && this._sunPath?.curve) {
      const elev = interpolateElevation(this._sunPath.curve, seconds);
      sun.textContent = `Sun ${elev.toFixed(1)}°`;
    }
  }

  _fillHoverReadout(seconds, { hovering }) {
    this._updateLightNameBrightness(seconds);
    const readout = this._hoverReadout;
    if (!readout) {
      return;
    }
    if (seconds == null) {
      seconds = nowSecondsSinceMidnight();
    }
    if (hovering) {
      readout.setAttribute("data-active", "");
    } else {
      readout.removeAttribute("data-active");
    }
    const eventIdle =
      !hovering &&
      this._sidebarEventId &&
      (this._sunPath?.events || []).some((e) => e.id === this._sidebarEventId);
    const sticky = this._clockStickySeconds != null;
    const timeLabel =
      hovering || eventIdle || sticky
        ? formatClock(seconds)
        : `Now ${formatClock(seconds)}`;
    const curve = this._sunPath?.curve;
    const elev = curve ? interpolateElevation(curve, seconds) : null;
    const sunLabel = elev == null ? "" : `Sun ${elev.toFixed(1)}°`;
    readout.replaceChildren();
    const time = document.createElement("span");
    time.className = "sun-hover-time";
    time.textContent = timeLabel;
    const sun = document.createElement("span");
    sun.className = "sun-hover-elev";
    sun.textContent = sunLabel;
    // Always reserve the reset slot so time/° do not shift when sticky.
    const resetSlot = document.createElement("span");
    resetSlot.className = "sun-hover-reset-slot";
    if (sticky && this._isDialView()) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "sun-hover-reset";
      reset.title = "Reset to now";
      reset.setAttribute("aria-label", "Reset sun to current time");
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", "mdi:restore");
      reset.appendChild(icon);
      reset.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._resetClockSunToNow();
      });
      resetSlot.appendChild(reset);
    }
    if (this._canPlayScenePreview() && !this._narrow) {
      readout.append(this._ensureScenePlayButton(), time, sun, resetSlot);
    } else {
      readout.append(time, sun, resetSlot);
    }
    this._syncNarrowPlayAction();
  }

  _resetClockSunToNow() {
    if (this._scenePlayActive()) {
      this._stopScenePlay({ restore: !this._roomPreview });
    }
    this._clockStickySeconds = undefined;
    this._clockOverrideArcSweep = null;
    this._clockSunDragging = false;
    this._hoverSeconds = undefined;
    this._clockSunLive = false;
    const now = nowSecondsSinceMidnight();
    this._moveClockSunTo(now, { durationMs: CLOCK_SUN_MOVE_MS });
    this._fillHoverReadout(now, { hovering: false });
    this._scheduleScenePreviewApply({
      force: true,
      transition: SCENE_PLAY_TRANSITION_SEC,
    });
  }

  /** Ease the sun along the path when it relocates (event pin, reset, etc.). */
  _moveClockSunTo(toSeconds, { durationMs = CLOCK_SUN_MOVE_MS } = {}) {
    if (!this._clockSunEl || toSeconds == null) {
      return;
    }
    const to =
      ((toSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const from = this._clockSunDisplayedSeconds ?? to;
    this._cancelClockSunArc();
    if (Math.abs(this._shortestSecondsDelta(from, to)) < 1) {
      this._applyClockSunAppearance(to);
      return;
    }
    this._animateClockSunArc(from, to, durationMs);
  }

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
    this._placeLegendModeGroups(this._clockLegendEl?.querySelector(".light-tiles"));
  }

  _secondsFromClockPointer(ev, face) {
    const rect = face.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    // 0° at midnight (bottom), clockwise — matches conic-gradient(from 180deg).
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI + 180;
    deg = ((deg % 360) + 360) % 360;
    return (deg / 360) * SECONDS_PER_DAY;
  }

  _clockAngleDeg(seconds) {
    // Noon at top, midnight at bottom (180° offset from CSS 12-o'clock).
    const s =
      ((Number(seconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    return (s / SECONDS_PER_DAY) * 360 + 180;
  }

  _lightAtClockPointer(ev, ringsHost, ringLights) {
    if (!ringLights.length || !ringsHost) {
      return null;
    }
    const rect = ringsHost.getBoundingClientRect();
    const ringsRadius = Math.min(rect.width, rect.height) / 2;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = Math.hypot(ev.clientX - cx, ev.clientY - cy);
    if (r > ringsRadius || ringsRadius <= 0) {
      return null;
    }
    const pct = (r / ringsRadius) * 100;
    const n = ringLights.length;
    const hole = 0;
    const stroke = (100 - hole) / n;
    for (let index = 0; index < n; index += 1) {
      const midOuter = 100 - index * stroke;
      const midInner = Math.max(hole, midOuter - stroke);
      if (pct <= midOuter && pct >= midInner) {
        return ringLights[index];
      }
    }
    // Center falls in the innermost ring when the hole is filled.
    if (pct < hole && n) {
      return ringLights[n - 1];
    }
    return null;
  }

  _clockSunIdleSeconds() {
    if (this._clockStickySeconds != null) {
      return this._clockStickySeconds;
    }
    const id = this._sidebarEventId;
    if (id) {
      const event = (this._sunPath?.events || []).find((item) => item.id === id);
      if (event?.seconds != null) {
        return event.seconds;
      }
    }
    return nowSecondsSinceMidnight();
  }

  _idleReadoutSeconds() {
    if (this._clockStickySeconds != null) {
      return this._clockStickySeconds;
    }
    if (this._sidebarEventId) {
      const event = (this._sunPath?.events || []).find(
        (item) => item.id === this._sidebarEventId
      );
      if (event?.seconds != null) {
        return event.seconds;
      }
    }
    // Wall-clock “now” on any preview date — sun elev comes from that day’s curve.
    return nowSecondsSinceMidnight();
  }

  /** Shortest signed seconds delta on the 24h circle (for arc lerps). */
  _shortestSecondsDelta(from, to) {
    let d =
      ((((to - from) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY);
    if (d > SECONDS_PER_DAY / 2) {
      d -= SECONDS_PER_DAY;
    }
    return d;
  }

  /** Clockwise seconds from `from` to `to` on the 24h circle (0..86400). */
  _clockwiseSecondsDelta(from, to) {
    return (
      (((to - from) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY
    );
  }

  _cancelClockSunArc() {
    if (this._clockSunArcRaf) {
      window.cancelAnimationFrame(this._clockSunArcRaf);
      this._clockSunArcRaf = undefined;
    }
  }

  /**
   * Ease the sun along the elevation curve by chasing time-of-day.
   * Retargeting mid-flight only updates the goal — exponential smoothing
   * keeps motion on the arc without restarting a CSS/tween chord.
   */
  _tickClockSunArc(now) {
    const last = this._clockSunArcLastTick ?? now;
    this._clockSunArcLastTick = now;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    const cur =
      this._clockSunDisplayedSeconds ?? this._clockSunIdleSeconds();
    const target = this._clockSunArcTo;
    const d = this._shortestSecondsDelta(cur, target);
    // Don't treat a zero-dt first frame as "arrived" (that snapped the
    // return-to-idle motion when hover ended).
    if (dt < 0.001) {
      this._clockSunArcRaf = window.requestAnimationFrame((t) =>
        this._tickClockSunArc(t)
      );
      return;
    }
    // ~0.11s time-constant ≈ settles in ~300ms; follows a moving pointer.
    const tau = 0.11;
    const step = d * (1 - Math.exp(-dt / tau));
    if (Math.abs(d) < 0.75) {
      this._clockSunArcRaf = undefined;
      this._applyClockSunAppearance(target);
      if (this._clockSunArcThenLive && this._hoverSeconds != null) {
        this._clockSunLive = true;
        this._applyClockSunAppearance(this._hoverSeconds);
      }
      return;
    }
    let s = cur + step;
    s = ((s % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    this._applyClockSunAppearance(s);
    this._clockSunArcRaf = window.requestAnimationFrame((t) =>
      this._tickClockSunArc(t)
    );
  }

  /** Today's peak elevation from the sun curve (may be ≤0 in polar night). */
  _clockDayPeakElevation() {
    const curve = this._sunPath?.curve;
    if (!curve?.length) {
      return 0;
    }
    let peak = -Infinity;
    for (const [, elev] of curve) {
      peak = Math.max(peak, elev);
    }
    return peak;
  }

  /**
   * Perfect-circle path radius for the preview day: larger in summer (high
   * peak), smaller in winter. Clamped between planet+pad and face−pad so the
   * stroke (and large night sun) clear the dial and the core edge.
   */
  _clockSunPathRadius() {
    const sunClear = CLOCK_SUN_R_VIEW * CLOCK_SUN_SCALE_MAX;
    const rMin = CLOCK_RINGS_OUTER + CLOCK_SUN_PATH_PAD + sunClear;
    // Mobile uses more of the core toward the ticks; brightness 100% sits
    // outside the path in face chrome, not on this radius.
    const narrow =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 870px)").matches;
    const edgeScale = narrow ? 0.97 : 0.9;
    const rMax =
      (CLOCK_VIEW / 2 - CLOCK_SUN_PATH_PAD - sunClear) * edgeScale;
    const lo = Math.min(rMin, rMax);
    const hi = Math.max(rMin, rMax);
    const annual = Math.max(this._sunPath?.max_elevation || 0, 1e-6);
    const dayPeak = this._clockDayPeakElevation();
    const t = Math.min(1, Math.max(0, dayPeak / annual));
    return lo + t * (hi - lo);
  }

  _clockSunPathRadiusOf(_elevation) {
    return this._clockSunPathRadius();
  }

  /** Smallest at daytime zenith; largest at sunrise/sunset; fixed max at night. */
  _clockSunScale(elevation) {
    if (elevation < 0) {
      return CLOCK_SUN_SCALE_MAX;
    }
    const peak = Math.max(this._sunPath?.max_elevation || 0, 1e-6);
    const t = Math.min(1, Math.max(0, elevation / peak));
    return CLOCK_SUN_SCALE_MAX + (1 - CLOCK_SUN_SCALE_MAX) * t;
  }

  _clockSunXy(seconds, elevation) {
    const elev =
      elevation ?? interpolateElevation(this._sunPath?.curve || [], seconds);
    const deg = this._clockAngleDeg(seconds);
    const rad = ((deg - 90) * Math.PI) / 180;
    const r = this._clockSunPathRadiusOf(elev);
    return {
      x: CLOCK_CX + Math.cos(rad) * r,
      y: CLOCK_CY + Math.sin(rad) * r,
      r,
      rad,
      elev,
    };
  }

  _clockPolar(seconds, radius) {
    const deg = this._clockAngleDeg(seconds);
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      deg,
      rad,
      cos: Math.cos(rad),
      sin: Math.sin(rad),
      x: CLOCK_CX + Math.cos(rad) * radius,
      y: CLOCK_CY + Math.sin(rad) * radius,
    };
  }

  _clockWedgePath(fromSeconds, toSeconds, radius = CLOCK_SKY_R) {
    let span =
      (((toSeconds - fromSeconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
      SECONDS_PER_DAY;
    if (span < 1) {
      span = SECONDS_PER_DAY;
    }
    const start = this._clockPolar(fromSeconds, radius);
    const end = this._clockPolar(fromSeconds + span, radius);
    const large = span / SECONDS_PER_DAY > 0.5 ? 1 : 0;
    return `M ${CLOCK_CX} ${CLOCK_CY} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
  }

  _clockEventSeconds(events, id) {
    const event = (events || []).find((item) => item.id === id);
    return this._eventMarkSeconds(event);
  }

  /** True solar time for path/sky marks (ignores earliest-dusk clamp). */
  _eventMarkSeconds(event) {
    if (!event || event.seconds == null) {
      return null;
    }
    if (event.overridden && event.solar_seconds != null) {
      return event.solar_seconds;
    }
    return event.seconds;
  }

  /** Effective scene time (clamped when earliest-dusk applies). */
  _eventButtonSeconds(event) {
    return event?.seconds != null ? event.seconds : null;
  }

  _applyClockSunAppearance(seconds, { skipHorizonGlow = false } = {}) {
    const curve = this._sunPath?.curve;
    if (!curve?.length) {
      return;
    }
    this._clockSunDisplayedSeconds = seconds;
    const elev = interpolateElevation(curve, seconds);
    const glowLook = skyLookFromElevation(elev);
    const pos = this._clockSunXy(seconds, elev);
    // Year-scrub must never leave us updating a detached sun while the visible
    // outline stays put — reattach refs to the live core nodes if needed.
    this._ensureLiveClockSunEls();
    const sun = this._clockSunEl;
    const sunHit = this._clockSunHitEl;
    const scale = this._clockSunScale(elev);
    if (sun) {
      sun.style.left = `${(pos.x / CLOCK_VIEW) * 100}%`;
      sun.style.top = `${(pos.y / CLOCK_VIEW) * 100}%`;
      sun.style.setProperty("--sun-scale", String(scale));
      sun.classList.toggle("below-horizon", elev < 0);
      sun.setAttribute(
        "aria-label",
        `Sun ${elev >= 0 ? "above" : "below"} horizon`
      );
      this._layoutClockSunFill(pos, scale);
      this._layoutClockHandle(seconds, elev, scale);
    } else {
      this._layoutClockHandle(seconds, elev, 1);
    }
    if (sunHit) {
      sunHit.style.left = `${(pos.x / CLOCK_VIEW) * 100}%`;
      sunHit.style.top = `${(pos.y / CLOCK_VIEW) * 100}%`;
      sunHit.style.setProperty("--sun-scale", String(scale));
    }
    const handleHit = this._clockHandleHitEl;
    if (handleHit) {
      handleHit.style.setProperty(
        "--handle-deg",
        `${this._clockAngleDeg(seconds)}deg`
      );
    }
    // Dial glow is a blurred clone of the rings — not elevation-tinted.
    // Skip rim rebuild mid-morph — sunrise/sunset lerps made the bottom flash.
    if (!skipHorizonGlow) {
      this._updateHorizonGlow(elev, glowLook);
    }
    this._updateOverrideArc(this._clockStickySeconds);
    this._updateLightNameBrightness(seconds);
  }

  /** Prefer connected core sun/hit nodes over detached paint leftovers. */
  _ensureLiveClockSunEls() {
    const core =
      this._clockFaceEl?.querySelector(".sun-light-clock-core") ||
      this._clockSunEl?.parentElement;
    if (!core) {
      return;
    }
    if (!this._clockSunEl?.isConnected) {
      const live = core.querySelector(":scope > .clock-sun");
      if (live) {
        this._clockSunEl = live;
      }
    }
    if (!this._clockSunHitEl?.isConnected) {
      const liveHit = core.querySelector(":scope > .clock-sun-hit");
      if (liveHit) {
        this._clockSunHitEl = liveHit;
      }
    }
    if (!this._clockSunFillEl?.isConnected) {
      const liveFill = this._clockOverlayEl?.querySelector(
        ".clock-sun-day-group .clock-sun-fill"
      );
      if (liveFill) {
        const group = liveFill.parentElement;
        this._clockSunFillEl = liveFill;
        this._clockSunGlowEl = group?.querySelector(".clock-sun-glow-disc") || null;
        this._clockSunShadowEl =
          group?.querySelector(".clock-sun-shadow-disc") || null;
      }
    }
  }

  _layoutClockHorizonBack() {
    if (this._editorMotionKind() !== "dial") {
      return;
    }
    const back = this._clockHorizonBackEl;
    const face = this._clockFaceEl;
    if (!back || !face) {
      return;
    }
    const overlay = this._outgoingStageLayer;
    // Do not steal the fading-out dial's sky. Incoming circadian still needs
    // layout while a simple-editor overlay is exiting.
    if (overlay && (overlay.contains(back) || overlay.contains(face))) {
      return;
    }
    const stage = this._contentEl?.querySelector(".stage-col");
    const bg = this._stageBgEl(stage);
    // Wide: the sky sits on .stage-bg so it can span the rail while the stage
    // scrolls. Narrow: keep it in the face. Page-relative coordinates put the
    // wash at the bottom of the screen instead of on the dial.
    if (bg) {
      if (back.parentNode !== bg) {
        bg.appendChild(back);
      }
    } else if (face && back.parentNode !== face) {
      face.appendChild(back);
    }
    const host = this.getBoundingClientRect();
    const originRect = (bg || face).getBoundingClientRect();
    const clip = this._contentEl?.querySelector(".workspace")?.getBoundingClientRect() || host;
    const fr = face.getBoundingClientRect();
    if (fr.width < 8 || host.width < 8) {
      return;
    }
    const cx = fr.left + fr.width / 2;
    const cy = fr.top + fr.height / 2;
    back.style.left = `${cx - originRect.left}px`;
    back.style.top = `${cy - originRect.top}px`;
    // Reach the light list under the face so horizon/bloom fill behind it —
    // but stop ~156px past the list so an abspos back cannot inflate scroll
    // height when an ancestor becomes a scrollport (overflow-x: clip quirk).
    const clock = face.closest(".sun-light-clock");
    const legend = this._clockLegendEl;
    const listBottom =
      legend?.getBoundingClientRect().bottom ??
      clock?.getBoundingClientRect().bottom ??
      fr.bottom;
    const contentBottom = listBottom + 156;
    // Cover the workspace from the face center, including under the frosted
    // area rail. Rails sit at a higher z-index; glow paints through the frost.
    const reach = Math.max(
      cx - clip.left,
      clip.right - cx,
      cy - clip.top,
      Math.min(clip.bottom, contentBottom) - cy,
      contentBottom - cy,
      Math.hypot(cx - clip.left, cy - clip.top),
      Math.hypot(clip.right - cx, cy - clip.top),
      Math.hypot(cx - clip.left, Math.min(clip.bottom, contentBottom) - cy),
      Math.hypot(clip.right - cx, Math.min(clip.bottom, contentBottom) - cy),
      fr.width * 0.62
    );
    const side = reach * 2 + 2;
    back.style.width = `${side}px`;
    back.style.height = `${side}px`;
  }

  _ensureOverrideArc(overlay) {
    const defs =
      overlay.querySelector("defs") ||
      overlay.insertBefore(
        document.createElementNS("http://www.w3.org/2000/svg", "defs"),
        overlay.firstChild
      );
    let grad = defs.querySelector("#clock-override-glow-grad");
    if (!grad) {
      grad = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "radialGradient"
      );
      grad.setAttribute("id", "clock-override-glow-grad");
      grad.setAttribute("cx", "50%");
      grad.setAttribute("cy", "50%");
      grad.setAttribute("r", "50%");
      defs.appendChild(grad);
    }
    while (grad.firstChild) {
      grad.removeChild(grad.firstChild);
    }
    const mk = (offset, opacity) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", offset);
      // Warm white–gold; a touch more opaque than the prior soft wash.
      stop.setAttribute("stop-color", "#ffe08a");
      stop.setAttribute("stop-opacity", String(opacity));
      grad.appendChild(stop);
    };
    // Half the prior inward reach; slightly less transparent than rev 121.
    mk("0%", 0);
    mk("78%", 0);
    mk("90%", 0.1);
    mk("100%", 0.24);
    let clip = defs.querySelector("#clock-override-wedge");
    if (!clip) {
      clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.setAttribute("id", "clock-override-wedge");
      clip.setAttribute("clipPathUnits", "userSpaceOnUse");
      const slice = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      clip.appendChild(slice);
      defs.appendChild(clip);
      this._clockOverrideWedgePathEl = slice;
    } else {
      this._clockOverrideWedgePathEl = clip.querySelector("path");
    }
    let glow = overlay.querySelector(".clock-override-glow");
    if (!glow) {
      glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      glow.setAttribute("class", "clock-override-glow");
      glow.setAttribute("cx", String(CLOCK_CX));
      glow.setAttribute("cy", String(CLOCK_CY));
      glow.setAttribute("r", String(CLOCK_OVERRIDE_R));
      glow.setAttribute("fill", "url(#clock-override-glow-grad)");
      glow.setAttribute("clip-path", "url(#clock-override-wedge)");
      glow.setAttribute("visibility", "hidden");
      overlay.appendChild(glow);
    }
    let arc = overlay.querySelector(".clock-override-arc");
    if (!arc) {
      arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
      arc.setAttribute("class", "clock-override-arc");
      arc.setAttribute("vector-effect", "non-scaling-stroke");
      arc.setAttribute("stroke-width", "1px");
      arc.setAttribute("visibility", "hidden");
      overlay.appendChild(arc);
    }
    this._clockOverrideGlowEl = glow;
    this._clockOverrideArcEl = arc;
  }

  _updateOverrideArc(overrideSeconds) {
    const glow = this._clockOverrideGlowEl;
    const arc = this._clockOverrideArcEl;
    const wedge = this._clockOverrideWedgePathEl;
    if (!glow || !arc || !wedge) {
      return;
    }
    if (overrideSeconds == null) {
      glow.setAttribute("visibility", "hidden");
      arc.setAttribute("visibility", "hidden");
      this._clockOverrideArcSweep = null;
      return;
    }
    const now = nowSecondsSinceMidnight();
    const cw = this._clockwiseSecondsDelta(now, overrideSeconds);
    const ccw = (SECONDS_PER_DAY - cw) % SECONDS_PER_DAY;
    if (Math.min(cw, ccw) < 45) {
      glow.setAttribute("visibility", "hidden");
      arc.setAttribute("visibility", "hidden");
      this._clockOverrideArcSweep = null;
      return;
    }
    // Keep the sweep that was already growing so the wedge does not flip
    // to the short arc at 12h (play / long sun drags wrap past halfway).
    let sweep = this._clockOverrideArcSweep;
    if (sweep !== 0 && sweep !== 1) {
      sweep = cw <= ccw ? 1 : 0;
    }
    this._clockOverrideArcSweep = sweep;
    const r = this._clockOverrideR ?? CLOCK_OVERRIDE_R;
    glow.setAttribute("r", String(r));
    const start = this._clockPolar(now, r);
    const end = this._clockPolar(overrideSeconds, r);
    const absSpan = sweep === 1 ? cw : ccw;
    const large = absSpan / SECONDS_PER_DAY > 0.5 ? 1 : 0;
    const arcD = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    const wedgeD = `M ${CLOCK_CX} ${CLOCK_CY} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
    arc.setAttribute("d", arcD);
    wedge.setAttribute("d", wedgeD);
    glow.setAttribute("visibility", "visible");
    arc.setAttribute("visibility", "visible");
  }

  _layoutClockHandle(seconds, elev, scale = 1) {
    const inner = this._clockHandleInnerEl;
    const outer = this._clockHandleOuterEl;
    if (!inner || !outer) {
      return;
    }
    const pos = this._clockSunXy(seconds, elev);
    const sunR = CLOCK_SUN_R_VIEW * scale;
    const dist = Math.hypot(pos.x - CLOCK_CX, pos.y - CLOCK_CY);
    const near = this._clockPolar(seconds, Math.max(0, dist - sunR));
    const far = this._clockPolar(seconds, dist + sunR);
    const tip = this._clockPolar(
      seconds,
      Math.max(CLOCK_TICK_OUTER, dist + sunR + 4)
    );
    inner.setAttribute("x1", String(CLOCK_CX));
    inner.setAttribute("y1", String(CLOCK_CY));
    inner.setAttribute("x2", near.x.toFixed(2));
    inner.setAttribute("y2", near.y.toFixed(2));
    outer.setAttribute("x1", far.x.toFixed(2));
    outer.setAttribute("y1", far.y.toFixed(2));
    outer.setAttribute("x2", tip.x.toFixed(2));
    outer.setAttribute("y2", tip.y.toFixed(2));
  }

  _horizonWeight(seconds, center, band) {
    let delta = Math.abs(seconds - center);
    delta = Math.min(delta, SECONDS_PER_DAY - delta);
    if (delta >= band) {
      return 0;
    }
    return 0.5 * (1 + Math.cos((delta / band) * Math.PI));
  }

  _rgbCss(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  _lerpRgb(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  /**
   * Continuous core→outer RGB stops for the horizon rim (then → surface).
   * Colorful gold→pink→purple only through civil twilight; at dusk (sun −6°,
   * “last light”) and below the rim is dark blue only — no afterglow pinks.
   * Elevation keyframes share the same stop count so scrub never jumps.
   */
  _horizonSpectrumStops(elev) {
    const light = !this.hasAttribute("data-dark-mode");
    // 5 stops: near-sun → mid → far, then caller mixes into surface.
    // Dusk/dawn in this product = civil ±6° (see scene_dusk helper copy).
    const keys = light
      ? [
          {
            e: -90,
            stops: [
              [130, 145, 175],
              [145, 158, 185],
              [160, 172, 198],
              [175, 185, 208],
              [190, 198, 218],
            ],
          },
          {
            // At/after dusk: dark-blue wash only (soft for light surfaces).
            e: -6,
            stops: [
              [120, 140, 180],
              [135, 152, 188],
              [150, 165, 198],
              [168, 180, 208],
              [185, 195, 218],
            ],
          },
          {
            e: 0,
            // Gold → coral → pink → mauve → soft sky (sunset / last civil light).
            stops: [
              [255, 178, 88],
              [245, 140, 96],
              [236, 120, 150],
              [196, 148, 210],
              [158, 200, 245],
            ],
          },
          {
            e: 8,
            stops: [
              [126, 200, 255],
              [140, 206, 255],
              [168, 216, 250],
              [196, 228, 252],
              [220, 238, 255],
            ],
          },
          {
            e: 90,
            stops: [
              [79, 179, 255],
              [120, 198, 255],
              [158, 214, 252],
              [190, 226, 255],
              [220, 238, 255],
            ],
          },
        ]
      : [
          {
            e: -90,
            stops: [
              [8, 12, 28],
              [10, 16, 40],
              [12, 20, 48],
              [14, 24, 56],
              [18, 30, 68],
            ],
          },
          {
            // At/after dusk (−6°): dark blue only — pink/purple end with last light.
            e: -6,
            stops: [
              [28, 45, 100],
              [22, 38, 85],
              [16, 30, 70],
              [12, 22, 55],
              [10, 16, 42],
            ],
          },
          {
            e: 0,
            // Gold/orange core (Rayleigh), then pink, mauve, blue through twilight.
            stops: [
              [255, 170, 85],
              [245, 140, 100],
              [232, 120, 160],
              [150, 90, 180],
              [70, 120, 200],
            ],
          },
          {
            e: 8,
            stops: [
              [100, 185, 250],
              [79, 179, 255],
              [70, 150, 230],
              [50, 110, 190],
              [36, 80, 150],
            ],
          },
          {
            e: 90,
            stops: [
              [79, 179, 255],
              [64, 165, 250],
              [50, 130, 220],
              [36, 90, 170],
              [28, 64, 120],
            ],
          },
        ];
    let lo = keys[0];
    let hi = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i += 1) {
      if (elev >= keys[i].e && elev <= keys[i + 1].e) {
        lo = keys[i];
        hi = keys[i + 1];
        break;
      }
      if (elev < keys[0].e) {
        lo = hi = keys[0];
        break;
      }
    }
    if (elev > keys[keys.length - 1].e) {
      lo = hi = keys[keys.length - 1];
    }
    const span = hi.e - lo.e || 1;
    const t = lo === hi ? 0 : (elev - lo.e) / span;
    return lo.stops.map((a, i) => this._lerpRgb(a, hi.stops[i], t));
  }

  /** Color along spectrum for band weight 1 (event) → 0 (surface). */
  _horizonBandColor(weight, spectrumStops) {
    const SURFACE = "var(--primary-background-color)";
    const u = 1 - Math.min(1, Math.max(0, weight));
    // Evenly space RGB stops, then a final segment into the surface color.
    const n = spectrumStops.length;
    const pos = u * n;
    if (pos >= n - 1e-6) {
      return SURFACE;
    }
    const i = Math.min(n - 1, Math.floor(pos));
    const f = pos - i;
    if (i >= n - 1) {
      const pct = Math.round((1 - f) * 100);
      if (pct >= 100) {
        return this._rgbCss(spectrumStops[n - 1]);
      }
      if (pct <= 0) {
        return SURFACE;
      }
      return `color-mix(in srgb, ${this._rgbCss(spectrumStops[n - 1])} ${pct}%, ${SURFACE})`;
    }
    return this._rgbCss(this._lerpRgb(spectrumStops[i], spectrumStops[i + 1], f));
  }

  /**
   * Day-wedge sky from elevation (smooth; light = crispy blue).
   */
  _horizonDaySky(elev, spectrumStops) {
    const light = !this.hasAttribute("data-dark-mode");
    if (light) {
      return CLOCK_DAY_SKY_LIGHT;
    }
    return elev >= 4
      ? this._rgbCss(spectrumStops[0])
      : "rgb(79, 179, 255)";
  }

  _updateHorizonGlow(elev, _glowLook) {
    const el = this._clockHorizonGlowEl;
    if (!el) {
      return;
    }
    const sunrise = this._clockSunriseSeconds;
    const sunset = this._clockSunsetSeconds;
    if (sunrise == null && sunset == null) {
      this._horizonGlowCacheKey = null;
      el.style.background = "transparent";
      el.style.opacity = "";
      if (this._clockSkyDayEl) {
        this._clockSkyDayEl.setAttribute("fill", "transparent");
      }
      return;
    }
    const maxElev = Math.max(this._sunPath?.max_elevation || 0, 1e-6);
    // Skip rebuild when scrub elev has not moved enough to change the wash.
    const elevQ = Math.round(elev / 0.25) * 0.25;
    const cacheKey = `${elevQ}|${sunrise}|${sunset}|${maxElev.toFixed(2)}`;
    if (cacheKey === this._horizonGlowCacheKey) {
      return;
    }
    this._horizonGlowCacheKey = cacheKey;
    // Climb 0 at/below horizon → 1 at that day's peak (smooth; no hard palette cut).
    const climb = Math.min(1, Math.max(0, elev) / maxElev);
    const nearHorizon = elev < 0 ? 1 : 1 - climb;
    // Keep some wash at noon so sky blue still peeks; stronger near horizon.
    const strength = 0.42 + 0.58 * nearHorizon;
    // Wider band so gold→pink→purple→blue can stretch into surface.
    const band = 5 * 3600;
    const steps = 48;
    const stops = [];
    const spectrum = this._horizonSpectrumStops(elev);
    const daySky = this._horizonDaySky(elev, spectrum);
    for (let i = 0; i <= steps; i += 1) {
      const seconds = (i / steps) * SECONDS_PER_DAY;
      let weight = 0;
      if (sunrise != null) {
        weight = Math.max(weight, this._horizonWeight(seconds, sunrise, band));
      }
      if (sunset != null) {
        weight = Math.max(weight, this._horizonWeight(seconds, sunset, band));
      }
      const mix = Math.min(1, weight * strength);
      stops.push(
        `${this._horizonBandColor(mix, spectrum)} ${((i / steps) * 100).toFixed(2)}%`
      );
    }
    el.style.background = `conic-gradient(from 180deg, ${stops.join(", ")})`;
    // Quiet day/night blue rim wash; keep civil-twilight gold→pink at full
    // strength (do not blanket-dim the conic — that washed out sunrise/sunset).
    const fancy = Math.max(0, 1 - Math.abs(elev) / 6);
    el.style.opacity = String(0.15 + 0.85 * fancy);

    // Day wedge (sunrise→sunset): crispy sky blue in light; elevation sky in dark.
    const dayEl = this._clockSkyDayEl;
    if (dayEl) {
      // Bridge civil twilight so fill alpha does not jump at elev=0.
      const twilight =
        elev >= 0 ? 1 : Math.min(1, Math.max(0, (elev + 6) / 6));
      // Half of the prior peak (~80%) so the sky fill stays visible; glow
      // opacity above is what quiets noon/midnight blue.
      const dayAlpha = (0.16 + 0.26 * twilight + 0.38 * climb) * 0.5;
      dayEl.setAttribute(
        "fill",
        `color-mix(in srgb, ${daySky} ${Math.round(dayAlpha * 100)}%, transparent)`
      );
    }
  }

  /** Sky wash removed — dial relies on night wedges + horizon rim glow only. */
  _layoutClockSunFill(pos, scale) {
    const fill = this._clockSunFillEl;
    const glow = this._clockSunGlowEl;
    const shadow = this._clockSunShadowEl;
    if (!fill) {
      return;
    }
    const r = CLOCK_SUN_R_VIEW * scale * 0.94;
    fill.setAttribute("cx", pos.x.toFixed(2));
    fill.setAttribute("cy", pos.y.toFixed(2));
    fill.setAttribute("r", r.toFixed(2));
    if (glow) {
      // 50% larger than the prior 2.2× halo; shares the day-wedge clip.
      const glowR = r * 3.3;
      glow.setAttribute("cx", pos.x.toFixed(2));
      glow.setAttribute("cy", pos.y.toFixed(2));
      glow.setAttribute("r", glowR.toFixed(2));
    }
    if (shadow) {
      // Keep shadow inside the glow so the halo stays visible around it.
      const shadowR = r * 1.85;
      shadow.setAttribute("cx", pos.x.toFixed(2));
      shadow.setAttribute("cy", pos.y.toFixed(2));
      shadow.setAttribute("r", shadowR.toFixed(2));
    }
    // Without a sunrise/sunset wedge, hide fill+glow entirely below horizon.
    if (!this._clockSunDayClipId) {
      const below = this._clockSunEl?.classList.contains("below-horizon");
      const vis = below ? "hidden" : "visible";
      fill.setAttribute("visibility", vis);
      if (glow) {
        glow.setAttribute("visibility", vis);
      }
    }
  }

  _paintSunDayClip(overlay, events) {
    const sunrise = this._clockEventSeconds(events, "sunrise");
    const sunset = this._clockEventSeconds(events, "sunset");
    this._clockSunDayClipId = null;
    const defs =
      overlay.querySelector("defs") ||
      overlay.insertBefore(
        document.createElementNS("http://www.w3.org/2000/svg", "defs"),
        overlay.firstChild
      );
    let clip = defs.querySelector("#clock-sun-day-clip");
    if (sunset == null || sunrise == null) {
      clip?.remove();
      return;
    }
    if (!clip) {
      clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.setAttribute("id", "clock-sun-day-clip");
      clip.setAttribute("clipPathUnits", "userSpaceOnUse");
      defs.appendChild(clip);
    }
    let slice = clip.querySelector("path");
    if (!slice) {
      slice = document.createElementNS("http://www.w3.org/2000/svg", "path");
      clip.appendChild(slice);
    }
    slice.setAttribute("d", this._clockWedgePath(sunrise, sunset, CLOCK_SKY_R));
    this._clockSunDayClipId = "clock-sun-day-clip";
  }

  _paintHorizonShadow(overlay, events) {
    const sunrise = this._clockEventSeconds(events, "sunrise");
    const sunset = this._clockEventSeconds(events, "sunset");
    const dawn = this._clockEventSeconds(events, "dawn");
    const dusk = this._clockEventSeconds(events, "dusk");
    this._clockSunriseSeconds = sunrise;
    this._clockSunsetSeconds = sunset;
    this._clockSkyDayEl = null;
    if (sunset != null && sunrise != null) {
      // Day sector first (under night wedges) — sky-blue wash updates with elev.
      const day = document.createElementNS("http://www.w3.org/2000/svg", "path");
      day.setAttribute("class", "clock-sky-day");
      day.setAttribute("d", this._clockWedgePath(sunrise, sunset, CLOCK_SKY_R));
      overlay.appendChild(day);
      this._clockSkyDayEl = day;
      const night = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      night.setAttribute("class", "clock-sky-night");
      night.setAttribute("d", this._clockWedgePath(sunset, sunrise, CLOCK_SKY_R));
      overlay.appendChild(night);
    }
    if (dusk != null && dawn != null) {
      const deep = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      deep.setAttribute("class", "clock-sky-deep");
      deep.setAttribute("d", this._clockWedgePath(dusk, dawn, CLOCK_SKY_R));
      overlay.appendChild(deep);
    }
  }

  /** Timed ease along the elevation curve (used for the clock enter sweep). */
  _animateClockSunArc(fromSeconds, toSeconds, durationMs, { forward = false } = {}) {
    this._cancelClockSunArc();
    this._clockSunLive = false;
    const from =
      ((fromSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const to =
      ((toSeconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    // Enter sweep wants a fixed 6h forward run; hover uses shortest arc.
    const delta = forward
      ? (((to - from) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY
      : this._shortestSecondsDelta(from, to);
    const started = performance.now();
    this._applyClockSunAppearance(from);
    const tick = (now) => {
      const u = Math.min(1, (now - started) / durationMs);
      // Cubic ease-out: decelerates across more of the 1.5s than quintic.
      const eased = easeOutCubic(u);
      let s = from + delta * eased;
      s = ((s % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
      this._applyClockSunAppearance(s);
      if (u < 1) {
        this._clockSunArcRaf = window.requestAnimationFrame(tick);
        return;
      }
      this._clockSunArcRaf = undefined;
      this._applyClockSunAppearance(to);
    };
    this._clockSunArcRaf = window.requestAnimationFrame(tick);
  }

  _playClockEnterAnimation(face) {
    const idle = this._clockSunIdleSeconds();
    const from =
      (((idle - 6 * 3600) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
      SECONDS_PER_DAY;
    face.classList.remove("clock-face-enter");
    // Restart CSS enter if the face was recycled in the same document.
    void face.offsetWidth;
    face.classList.add("clock-face-enter");
    const finish = () => {
      face.classList.remove("clock-face-enter");
      face.removeEventListener("animationend", clearEnter);
    };
    const clearEnter = (ev) => {
      if (ev.animationName && ev.animationName !== "clock-overlay-spin") {
        return;
      }
      finish();
    };
    face.addEventListener("animationend", clearEnter);
    window.setTimeout(finish, 480);
    this._animateClockSunArc(from, idle, 700, { forward: true });
  }

  _paintClockSunPath(overlay, events, { includeSun = true } = {}) {
    const curve = this._sunPath?.curve;
    if (!curve?.length) {
      return;
    }
    this._paintSunDayClip(overlay, events);

    const r = this._clockSunPathRadius();
    const arcPath = (fromSeconds, toSeconds) => {
      let span =
        (((toSeconds - fromSeconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
        SECONDS_PER_DAY;
      if (span < 1) {
        return null;
      }
      const start = this._clockPolar(fromSeconds, r);
      const end = this._clockPolar(fromSeconds + span, r);
      const large = span / SECONDS_PER_DAY > 0.5 ? 1 : 0;
      return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    };
    // Night dashed arcs only below the horizon (no full-circle underlay).
    for (const run of sunStrokePathRuns(curve, () => CLOCK_SUN_PATH_WIDTH_PX)) {
      const from = run.points[0][0];
      const to = run.points[run.points.length - 1][0];
      const d = arcPath(from, to);
      if (!d) {
        continue;
      }
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      if (run.night) {
        path.setAttribute("class", "clock-sun-path-night");
      } else {
        path.setAttribute("class", "clock-sun-day");
      }
      path.setAttribute("d", d);
      path.setAttribute("vector-effect", "non-scaling-stroke");
      path.setAttribute("stroke-width", "1px");
      overlay.appendChild(path);
    }

    const spokeOuter = Math.min(96, CLOCK_TICK_OUTER - 1);
    this._clockEventDotEls = [];
    this._clockEventSpokeEls = [];
    this._clockEventClampLinkEls = [];
    for (const event of events || []) {
      const markSeconds = this._eventMarkSeconds(event);
      if (markSeconds == null) {
        continue;
      }
      const pos = this._clockSunXy(markSeconds);
      const outer = this._clockPolar(markSeconds, spokeOuter);
      const spoke = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      spoke.setAttribute("class", "clock-event-ray");
      // Outer tip retargeted to mark chrome (ghost or button) in layout.
      spoke.setAttribute("x1", outer.x.toFixed(2));
      spoke.setAttribute("y1", outer.y.toFixed(2));
      spoke.setAttribute("x2", pos.x.toFixed(2));
      spoke.setAttribute("y2", pos.y.toFixed(2));
      spoke.dataset.eventId = event.id;
      overlay.appendChild(spoke);
      this._clockEventSpokeEls.push(spoke);
      const dot = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      dot.setAttribute("class", "clock-event-dot");
      dot.setAttribute("cx", pos.x.toFixed(2));
      dot.setAttribute("cy", pos.y.toFixed(2));
      // r set in _layoutClockEventDots for a fixed screen size.
      overlay.appendChild(dot);
      this._clockEventDotEls.push(dot);
      const buttonSeconds = this._eventButtonSeconds(event);
      if (
        event.overridden &&
        buttonSeconds != null &&
        buttonSeconds !== markSeconds
      ) {
        const link = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        link.setAttribute("class", "clock-event-clamp-link");
        link.setAttribute("fill", "none");
        link.dataset.eventId = event.id;
        overlay.appendChild(link);
        this._clockEventClampLinkEls.push(link);
      }
    }

    // Year-scrub patch only refreshes path/marks — recreating sun chrome here
    // would replace _clockSunEl with a detached node and skip spoke layout.
    // Re-append the fill group so new paths stay *under* the sun (append order
    // otherwise paints the path on top of the fill; HTML outline is separate).
    if (!includeSun) {
      const dayGroup = overlay.querySelector(".clock-sun-day-group");
      if (dayGroup) {
        overlay.appendChild(dayGroup);
      }
      return;
    }

    const defs =
      overlay.querySelector("defs") ||
      overlay.insertBefore(
        document.createElementNS("http://www.w3.org/2000/svg", "defs"),
        overlay.firstChild
      );
    let glowGrad = defs.querySelector("#clock-sun-glow-grad");
    if (!glowGrad) {
      glowGrad = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "radialGradient"
      );
      glowGrad.setAttribute("id", "clock-sun-glow-grad");
      glowGrad.setAttribute("cx", "50%");
      glowGrad.setAttribute("cy", "50%");
      glowGrad.setAttribute("r", "50%");
      defs.appendChild(glowGrad);
    }
    while (glowGrad.firstChild) {
      glowGrad.removeChild(glowGrad.firstChild);
    }
    const mkGlow = (offset, color, opacity) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", color);
      stop.setAttribute("stop-opacity", String(opacity));
      glowGrad.appendChild(stop);
    };
    // Soft warm halo via gradient only (no CSS blur — that trailed on scrub).
    mkGlow("0%", "#ffffff", 0.28);
    mkGlow("22%", "#ffffff", 0.9);
    mkGlow("48%", "#fff1c2", 0.58);
    mkGlow("72%", "#ffd27a", 0.28);
    mkGlow("100%", "#ffc878", 0);

    let shadowGrad = defs.querySelector("#clock-sun-shadow-grad");
    if (!shadowGrad) {
      shadowGrad = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "radialGradient"
      );
      shadowGrad.setAttribute("id", "clock-sun-shadow-grad");
      shadowGrad.setAttribute("cx", "50%");
      shadowGrad.setAttribute("cy", "50%");
      shadowGrad.setAttribute("r", "50%");
      defs.appendChild(shadowGrad);
    }
    while (shadowGrad.firstChild) {
      shadowGrad.removeChild(shadowGrad.firstChild);
    }
    const mkShadow = (offset, opacity) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", "#000");
      stop.setAttribute("stop-opacity", String(opacity));
      shadowGrad.appendChild(stop);
    };
    mkShadow("0%", 0.22);
    mkShadow("55%", 0.12);
    mkShadow("100%", 0);

    const clipUrl = this._clockSunDayClipId
      ? `url(#${this._clockSunDayClipId})`
      : null;

    // Shadow + glow + fill share the day wedge clip so they fade together
    // across the horizon (no hard on/off). Outline ring stays unclipped.
    overlay.querySelectorAll(".clock-sun-day-group").forEach((el) => el.remove());
    const shadow = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    shadow.setAttribute("class", "clock-sun-shadow-disc");
    shadow.setAttribute("fill", "url(#clock-sun-shadow-grad)");
    const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    glow.setAttribute("class", "clock-sun-glow-disc");
    glow.setAttribute("fill", "url(#clock-sun-glow-grad)");
    const fill = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    fill.setAttribute("class", "clock-sun-fill");
    fill.setAttribute("fill", "#fff");
    const dayGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dayGroup.setAttribute("class", "clock-sun-day-group");
    if (clipUrl) {
      dayGroup.setAttribute("clip-path", clipUrl);
    }
    dayGroup.append(shadow, glow, fill);
    overlay.append(dayGroup);
    this._clockSunShadowEl = shadow;
    this._clockSunGlowEl = glow;
    this._clockSunFillEl = fill;
    this._clockSunNightEl = null;

    // Full build only — caller appends these to the core. Never create them
    // during year-scrub patch (includeSun: false) or the visible outline sticks.
    const marker = document.createElement("div");
    marker.className = "clock-sun";
    marker.setAttribute("aria-hidden", "true");
    const ring = document.createElement("span");
    ring.className = "clock-sun-ring";
    marker.appendChild(ring);
    this._clockSunEl = marker;

    const hit = document.createElement("div");
    hit.className = "clock-sun-hit";
    hit.setAttribute("role", "slider");
    hit.setAttribute("aria-label", "Drag to preview time of day");
    this._clockSunHitEl = hit;
    this._clockSunLive = false;
    this._cancelClockSunArc();
  }

  _layoutClockEventDots() {
    const core = this._clockSunEl?.parentElement;
    const dots = this._clockEventDotEls;
    if (!core || !dots?.length) {
      return;
    }
    const w = core.clientWidth;
    if (w < 8) {
      return;
    }
    // 6px screen diameter, independent of dial size.
    const r = (3 / w) * CLOCK_VIEW;
    for (const dot of dots) {
      dot.setAttribute("r", r.toFixed(3));
    }
  }

  _clockFacePctToCore(faceXPct, faceYPct, faceW, coreW, chrome) {
    const faceX = (faceXPct / 100) * faceW;
    const faceY = (faceYPct / 100) * faceW;
    return {
      x: ((faceX - chrome) / coreW) * CLOCK_VIEW,
      y: ((faceY - chrome) / coreW) * CLOCK_VIEW,
    };
  }

  _clockEventAnchorRadius(eventId, { ghost = false } = {}) {
    const hit = (this._clockEventAnchors || []).find(
      (anchor) =>
        anchor.dataset.eventId === eventId &&
        anchor.classList.contains("ghost") === ghost
    );
    if (hit?._clockIconR != null) {
      return hit._clockIconR;
    }
    return this._clockEventIconR;
  }

  _shownEventBrightness(eventId) {
    const shown = this._clockBrightShown?.[eventId];
    if (shown != null && Number.isFinite(shown)) {
      return shown;
    }
    return this._dialEventBrightness(eventId);
  }

  _clockBrightPct(bri) {
    return Math.round((Number(bri) / 255) * 100);
  }

  _clockBrightValuesEqual(a, b) {
    const ids = new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {}),
    ]);
    for (const id of ids) {
      if (Math.abs((a?.[id] ?? 0) - (b?.[id] ?? 0)) > 0.5) {
        return false;
      }
    }
    return true;
  }

  _cancelClockBrightMotion() {
    if (this._clockBrightAnimRaf) {
      window.cancelAnimationFrame(this._clockBrightAnimRaf);
      this._clockBrightAnimRaf = undefined;
    }
  }

  _syncClockBrightMotion(targets) {
    const next = { ...targets };
    if (
      this._clockBrightDragging ||
      this._brightnessScrubbing ||
      !Object.keys(this._clockBrightShown || {}).length
    ) {
      this._cancelClockBrightMotion();
      this._clockBrightShown = next;
      this._clockBrightTarget = next;
      this._clockBrightFrom = next;
      return;
    }
    if (this._clockBrightValuesEqual(this._clockBrightTarget, next)) {
      return;
    }
    this._clockBrightFrom = { ...this._clockBrightShown };
    this._clockBrightTarget = next;
    this._clockBrightAnimT0 = performance.now();
    this._cancelClockBrightMotion();
    const tick = (now) => {
      const u = Math.min(1, (now - this._clockBrightAnimT0) / CLOCK_BRIGHT_MOVE_MS);
      const eased = easeOutCubic(u);
      const shown = {};
      const ids = new Set([
        ...Object.keys(this._clockBrightFrom),
        ...Object.keys(this._clockBrightTarget),
      ]);
      for (const id of ids) {
        const a = this._clockBrightFrom[id] ?? this._clockBrightTarget[id] ?? 0;
        const b = this._clockBrightTarget[id] ?? a;
        shown[id] = a + (b - a) * eased;
      }
      this._clockBrightShown = shown;
      this._placeClockBrightnessHandles();
      this._layoutClockEventSpokes();
      this._layoutClockBrightnessCurve();
      if (u < 1) {
        this._clockBrightAnimRaf = window.requestAnimationFrame(tick);
        return;
      }
      this._clockBrightAnimRaf = undefined;
      this._clockBrightShown = { ...this._clockBrightTarget };
      this._placeClockBrightnessHandles();
      this._layoutClockEventSpokes();
      this._layoutClockBrightnessCurve();
    };
    this._clockBrightAnimRaf = window.requestAnimationFrame(tick);
  }

  _paintClockEventAnchorCopy(anchor, event, bri) {
    const timeText = event.fallback ? `${event.time}*` : event.time;
    const pct = this._clockBrightPct(bri);
    const heading = anchor.querySelector(".clock-event-heading");
    if (heading) {
      heading.textContent = `${event.name} · ${timeText}`;
    }
    const brightEl = anchor.querySelector(".clock-event-bright");
    if (brightEl) {
      brightEl.textContent = this._t(
        "frontend.clock.event_bright_pct",
        "{percent}%",
        { percent: pct }
      );
    }
    const btn = anchor.querySelector(".clock-event");
    if (!btn) {
      return;
    }
    const solarHint =
      event.overridden && event.solar_time
        ? ` (solar ${event.solar_time})`
        : "";
    btn.title = `${event.name} · ${timeText}${solarHint} · ${pct}%`;
    const nameTime = heading?.textContent || `${event.name} ${timeText}`;
    btn.setAttribute(
      "aria-label",
      this._t(
        "frontend.clock.event_brightness",
        "{label}, brightness {percent}%",
        { label: nameTime, percent: pct }
      )
    );
  }

  _placeClockBrightnessHandles() {
    const anchors = this._clockEventAnchors || [];
    const r0 = this._clockBrightR0;
    const r1 = this._clockBrightR1;
    if (!anchors.length || r0 == null || r1 == null) {
      return;
    }
    for (const anchor of anchors) {
      const { cos, sin } = anchor._clockPolar || {};
      if (cos == null || sin == null) {
        continue;
      }
      const bri = this._shownEventBrightness(anchor.dataset.eventId);
      const iconR = r1 > r0 ? r0 + (bri / 255) * (r1 - r0) : r0;
      anchor._clockIconR = iconR;
      anchor.style.left = `${50 + cos * iconR}%`;
      anchor.style.top = `${50 + sin * iconR}%`;
      if (anchor.classList.contains("ghost")) {
        continue;
      }
      const event = (this._sunPath?.events || []).find(
        (item) => item.id === anchor.dataset.eventId
      );
      if (event) {
        this._paintClockEventAnchorCopy(anchor, event, bri);
      }
    }
  }

  _layoutClockBrightnessCurve() {
    const fill = this._clockBrightnessFillEl;
    const stroke = this._clockBrightnessArcEl;
    const grad = this._clockBrightnessGradEl;
    const r0 = this._clockBrightR0;
    const r1 = this._clockBrightR1;
    if (!fill || !stroke || !grad || r0 == null || r1 == null) {
      return;
    }
    const events = this._sunPath?.events || [];
    const knots = [];
    for (const event of events) {
      const seconds = this._eventButtonSeconds(event);
      if (seconds == null) {
        continue;
      }
      knots.push({
        seconds,
        bri: this._shownEventBrightness(event.id),
      });
    }
    if (knots.length < 2 || !(r1 > r0)) {
      fill.setAttribute("d", "");
      stroke.setAttribute("d", "");
      this._layoutClockThemeBrightDots();
      return;
    }
    grad.setAttribute("r", String(r1));
    while (grad.firstChild) {
      grad.removeChild(grad.firstChild);
    }
    const lightMode = !this.hasAttribute("data-dark-mode");
    const mk = (offset, opacity) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", lightMode ? "#000" : "#fff");
      stop.setAttribute("stop-opacity", String(opacity));
      grad.appendChild(stop);
    };
    const innerPct = (r0 / r1) * 100;
    // Light mode: gray near 0% (path) so the annulus reads on a pale sky;
    // 100% is transparent. Dark mode: white wash that strengthens outward.
    if (lightMode) {
      mk("0%", 0);
      mk(`${innerPct.toFixed(2)}%`, 0.05);
      mk("100%", 0);
    } else {
      mk("0%", 0);
      mk(`${innerPct.toFixed(2)}%`, 0);
      mk(`${Math.min(100, innerPct + (100 - innerPct) * 0.55).toFixed(2)}%`, 0.035);
      mk("100%", 0.08);
    }
    const polar = (seconds, radius) => {
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      return {
        x: 50 + Math.cos(rad) * radius,
        y: 50 + Math.sin(rad) * radius,
      };
    };
    const radiusOf = (bri) => r0 + (bri / 255) * (r1 - r0);
    const strokeD = polarEaseClosedPathD(knots, (seconds, bri) =>
      polar(seconds, radiusOf(bri))
    );
    const innerCircle = `M ${(50 + r0).toFixed(2)} 50 A ${r0.toFixed(2)} ${r0.toFixed(
      2
    )} 0 1 0 ${(50 - r0).toFixed(2)} 50 A ${r0.toFixed(2)} ${r0.toFixed(
      2
    )} 0 1 0 ${(50 + r0).toFixed(2)} 50`;
    stroke.setAttribute("d", strokeD);
    fill.setAttribute("fill-rule", "evenodd");
    fill.setAttribute("d", `${strokeD} ${innerCircle}`);
    this._layoutClockThemeBrightDots();
  }

  _layoutClockThemeBrightDots() {
    const host = this._clockThemeBrightDotsEl;
    const r0 = this._clockBrightR0;
    const r1 = this._clockBrightR1;
    if (!host) {
      return;
    }
    host.replaceChildren();
    const lightId = this._dialBrightnessLightId();
    if (!lightId || r0 == null || !(r1 > r0)) {
      return;
    }
    for (const event of this._sunPath?.events || []) {
      const seconds = this._eventButtonSeconds(event);
      if (seconds == null) {
        continue;
      }
      const themeBri = this._themeEventBrightness(event.id);
      const shown = this._shownEventBrightness(event.id);
      if (Math.abs(shown - themeBri) <= THEME_BRIGHTNESS_SNAP) {
        continue;
      }
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      const radius = r0 + (themeBri / 255) * (r1 - r0);
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("class", "clock-theme-bright-dot");
      dot.setAttribute("cx", (50 + Math.cos(rad) * radius).toFixed(2));
      dot.setAttribute("cy", (50 + Math.sin(rad) * radius).toFixed(2));
      dot.setAttribute("r", "1.15");
      host.appendChild(dot);
    }
  }

  _bindClockEventBrightnessDrag(btn, event, anchor) {
    const onDown = (ev) => {
      if (ev.button != null && ev.button !== 0) {
        return;
      }
      this._clockEventDragMoved = false;
      this._clockEventDragOrigin = { x: ev.clientX, y: ev.clientY };
      this._clockEventDragEventId = event.id;
      this._clockEventDragUndo = false;
      btn.setPointerCapture?.(ev.pointerId);
    };
    const onMove = (ev) => {
      if (this._clockEventDragEventId !== event.id) {
        return;
      }
      const origin = this._clockEventDragOrigin;
      if (!origin) {
        return;
      }
      const dx = ev.clientX - origin.x;
      const dy = ev.clientY - origin.y;
      if (
        !this._clockEventDragMoved &&
        dx * dx + dy * dy <
          CLOCK_EVENT_BRIGHT_DRAG_PX * CLOCK_EVENT_BRIGHT_DRAG_PX
      ) {
        return;
      }
      if (!this._clockEventDragMoved) {
        this._clockEventDragMoved = true;
        this._clockBrightDragging = true;
        this._beginBrightnessScrub();
        this._cancelClockBrightMotion();
        btn.classList.add("bright-dragging");
      }
      ev.preventDefault();
      const face = this._clockFaceEl;
      const r0 = this._clockBrightR0;
      const r1 = this._clockBrightR1;
      const polar = anchor._clockPolar;
      if (!face || r0 == null || r1 == null || !polar || !(r1 > r0)) {
        return;
      }
      const rect = face.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const along = (ev.clientX - cx) * polar.cos + (ev.clientY - cy) * polar.sin;
      const r0Px = (r0 / 100) * rect.width;
      const r1Px = (r1 / 100) * rect.width;
      const t = (along - r0Px) / (r1Px - r0Px);
      const bounded = t < 0 ? 0 : t > 1 ? 1 : t;
      const brightness = Math.round(bounded * 255);
      this._writeDialEventBrightness(event.id, brightness, {
        history: !this._clockEventDragUndo,
      });
      this._clockEventDragUndo = true;
    };
    const onUp = (ev) => {
      if (this._clockEventDragEventId !== event.id) {
        return;
      }
      if (this._clockEventDragMoved) {
        this._clockEventSuppressClick = true;
        ev.preventDefault();
      }
      btn.classList.remove("bright-dragging");
      this._clockEventDragEventId = null;
      this._clockEventDragOrigin = null;
      this._clockBrightDragging = false;
      this._endBrightnessScrub();
    };
    btn.addEventListener("pointerdown", onDown);
    btn.addEventListener("pointermove", onMove);
    btn.addEventListener("pointerup", onUp);
    btn.addEventListener("pointercancel", onUp);
  }

  /**
   * Place event labels to avoid collisions around the dial.
   * Top → above; bottom → below; left/right → first (topmost) above, rest below.
   */
  _layoutClockEventMetas(anchors) {
    if (!anchors?.length) {
      return;
    }
    // Ghosts have no labels — only active buttons compete for placement.
    anchors = anchors.filter((anchor) => !anchor.classList.contains("ghost"));
    if (!anchors.length) {
      return;
    }
    const TOP = -0.4;
    const BOTTOM = 0.4;
    const top = [];
    const bottom = [];
    const left = [];
    const right = [];
    for (const anchor of anchors) {
      const { cos, sin } = anchor._clockPolar || {};
      if (sin == null || cos == null) {
        continue;
      }
      if (sin <= TOP) {
        top.push(anchor);
      } else if (sin >= BOTTOM) {
        bottom.push(anchor);
      } else if (cos < 0) {
        left.push(anchor);
      } else {
        right.push(anchor);
      }
    }
    const setBelow = (anchor, below) => {
      anchor.querySelector(".clock-event-meta")?.classList.toggle("below", below);
    };
    for (const anchor of top) {
      setBelow(anchor, false);
    }
    for (const anchor of bottom) {
      setBelow(anchor, true);
    }
    // Topmost first on each side — that one keeps the label above.
    left.sort((a, b) => a._clockPolar.sin - b._clockPolar.sin);
    right.sort((a, b) => a._clockPolar.sin - b._clockPolar.sin);
    left.forEach((anchor, index) => setBelow(anchor, index !== 0));
    right.forEach((anchor, index) => setBelow(anchor, index !== 0));
  }

  /** Retarget dashed spokes from path dots to mark chrome; clamp links ghost→button. */
  _layoutClockEventSpokes() {
    const spokes = this._clockEventSpokeEls;
    const links = this._clockEventClampLinkEls;
    const face = this._clockFaceEl;
    const core = this._clockSunEl?.parentElement;
    if (!face || !core) {
      return;
    }
    const faceW = face.clientWidth;
    const coreW = core.clientWidth;
    const chrome = parseFloat(
      getComputedStyle(face).getPropertyValue("--clock-chrome")
    );
    if (!(faceW > 8) || !(coreW > 8) || !Number.isFinite(chrome)) {
      return;
    }
    const chromePoint = (seconds, iconR) => {
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const faceXPct = 50 + cos * iconR;
      const faceYPct = 50 + sin * iconR;
      return this._clockFacePctToCore(faceXPct, faceYPct, faceW, coreW, chrome);
    };
    const tipRadius = (eventId) => {
      const ghost = (this._clockEventAnchors || []).find(
        (anchor) =>
          anchor.dataset.eventId === eventId &&
          anchor.classList.contains("ghost") &&
          !anchor.hidden
      );
      if (ghost?._clockIconR != null) {
        return ghost._clockIconR;
      }
      return this._clockEventAnchorRadius(eventId);
    };
    for (const spoke of spokes || []) {
      const id = spoke.dataset.eventId;
      const event = (this._sunPath?.events || []).find((item) => item.id === id);
      const markSeconds = this._eventMarkSeconds(event);
      const iconR = tipRadius(id);
      if (markSeconds == null || iconR == null) {
        continue;
      }
      // Spoke aims at true-solar chrome (ghost when overridden, else button).
      const tip = chromePoint(markSeconds, iconR);
      spoke.setAttribute("x1", tip.x.toFixed(2));
      spoke.setAttribute("y1", tip.y.toFixed(2));
    }
    for (const link of links || []) {
      const id = link.dataset.eventId;
      const event = (this._sunPath?.events || []).find((item) => item.id === id);
      const markSeconds = this._eventMarkSeconds(event);
      const buttonSeconds = this._eventButtonSeconds(event);
      const fromR = this._clockEventAnchorRadius(id, { ghost: true });
      const toR = this._clockEventAnchorRadius(id);
      if (markSeconds == null || buttonSeconds == null || fromR == null || toR == null) {
        continue;
      }
      const from = chromePoint(markSeconds, fromR);
      const to = chromePoint(buttonSeconds, toR);
      const delta = this._shortestSecondsDelta(markSeconds, buttonSeconds);
      const absSpan = Math.abs(delta);
      if (absSpan < 30) {
        link.setAttribute("d", "");
        continue;
      }
      if (Math.abs(fromR - toR) >= 0.2) {
        link.setAttribute(
          "d",
          `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} L ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
        );
        continue;
      }
      const r = Math.hypot(from.x - CLOCK_CX, from.y - CLOCK_CY);
      if (!(r > 1)) {
        continue;
      }
      const large = absSpan / SECONDS_PER_DAY > 0.5 ? 1 : 0;
      const sweep = delta >= 0 ? 1 : 0;
      link.setAttribute(
        "d",
        `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} ${sweep} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
      );
    }
  }

  _paintClockHandle(overlay) {
    const handleInner = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    handleInner.setAttribute("class", "clock-handle");
    handleInner.setAttribute("vector-effect", "non-scaling-stroke");
    handleInner.setAttribute("stroke-width", "1.5px");
    const handleOuter = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    handleOuter.setAttribute("class", "clock-handle");
    handleOuter.setAttribute("vector-effect", "non-scaling-stroke");
    handleOuter.setAttribute("stroke-width", "1.5px");
    overlay.append(handleInner, handleOuter);
    this._clockHandleInnerEl = handleInner;
    this._clockHandleOuterEl = handleOuter;
  }

  _clockMagnetEvents() {
    return (this._sunPath?.events || []).filter(
      (event) => event?.seconds != null
    );
  }

  _nearestClockMagnet(seconds) {
    let best = null;
    let bestAbs = Infinity;
    for (const event of this._clockMagnetEvents()) {
      const delta = this._shortestSecondsDelta(seconds, event.seconds);
      const abs = Math.abs(delta);
      if (abs < bestAbs) {
        bestAbs = abs;
        best = { event, delta, abs };
      }
    }
    return best;
  }

  /** Snap to a solar event only when the pointer is within the capture window. */
  _clockSnapTargetSeconds(pointerSeconds) {
    const nearest = this._nearestClockMagnet(pointerSeconds);
    if (nearest && nearest.abs <= CLOCK_SNAP_CAPTURE_SEC) {
      return nearest.event.seconds;
    }
    return pointerSeconds;
  }

  _bindClockSunDrag(face, handles) {
    const applyLive = (seconds) => {
      this._hoverSeconds = seconds;
      this._clockStickySeconds = seconds;
      this._applyClockSunAppearance(seconds);
      this._fillHoverReadout(seconds, { hovering: true });
      this._scheduleScenePreviewApply({
        transition: SCENE_PLAY_TRANSITION_SEC,
      });
    };
    const onMove = (ev) => {
      if (!this._clockPointerArmed) {
        return;
      }
      const origin = this._clockPointerOrigin;
      if (origin) {
        const dist = Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y);
        if (dist >= CLOCK_DRAG_CLICK_PX) {
          if (!this._clockSunDragging) {
            this._stopScenePlayBecauseTimeChanged();
          }
          this._clockSunDragging = true;
          // Keep the event sidebar open while dragging; close on release.
          if (this._sidebarEventId) {
            this._clockCloseSidebarAfterDrag = true;
          }
        }
      }
      if (!this._clockSunDragging) {
        return;
      }
      this._pendingClockHover = { clientX: ev.clientX, clientY: ev.clientY };
      if (this._clockHoverRaf) {
        return;
      }
      this._clockHoverRaf = window.requestAnimationFrame(() => {
        this._clockHoverRaf = undefined;
        if (!this._pendingClockHover || !this._clockSunDragging) {
          return;
        }
        const pointer = this._secondsFromClockPointer(
          this._pendingClockHover,
          face
        );
        applyLive(pointer);
      });
    };
    const onUp = (ev) => {
      if (!this._clockPointerArmed) {
        return;
      }
      this._clockPointerArmed = false;
      this._pendingClockHover = undefined;
      if (this._clockHoverRaf) {
        window.cancelAnimationFrame(this._clockHoverRaf);
        this._clockHoverRaf = undefined;
      }
      const wasDragging = this._clockSunDragging;
      this._clockSunDragging = false;
      try {
        ev.currentTarget.releasePointerCapture?.(ev.pointerId);
      } catch {
        /* already released */
      }
      if (!wasDragging) {
        // Click — return to wall-clock now.
        this._resetClockSunToNow();
        return;
      }
      const pointer = this._secondsFromClockPointer(ev, face);
      const finalSeconds = this._clockSnapTargetSeconds(pointer);
      this._cancelClockSunArc();
      this._clockStickySeconds = finalSeconds;
      this._hoverSeconds = undefined;
      this._clockSunLive = false;
      // Snap only after release: 1s quintic ease-out (same curve as event pin).
      if (
        Math.abs(
          this._shortestSecondsDelta(
            this._clockSunDisplayedSeconds ?? pointer,
            finalSeconds
          )
        ) >= 1
      ) {
        this._moveClockSunTo(finalSeconds, { durationMs: CLOCK_SUN_MOVE_MS });
      } else {
        this._applyClockSunAppearance(finalSeconds);
      }
      this._fillHoverReadout(finalSeconds, { hovering: false });
      this._scheduleScenePreviewApply({
        force: true,
        transition: SCENE_PLAY_TRANSITION_SEC,
      });
      if (this._clockCloseSidebarAfterDrag) {
        this._clockCloseSidebarAfterDrag = false;
        this._closeSceneSidebar({ animate: true });
      }
    };
    const onDown = (ev) => {
      if (ev.button != null && ev.button !== 0) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      this._clockPointerArmed = true;
      this._clockSunDragging = false;
      this._clockCloseSidebarAfterDrag = false;
      this._clockPointerOrigin = { x: ev.clientX, y: ev.clientY };
      this._cancelClockSunArc();
      this._clockSunLive = true;
      ev.currentTarget.setPointerCapture?.(ev.pointerId);
    };
    for (const el of handles) {
      if (!el) {
        continue;
      }
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    }
  }

  /**
   * Update an existing dial face for year scrub without replaceChildren.
   * Returns false when the light set changed and a full rebuild is required.
   *
   * morphing: mid refine/date morph — update ring fills + sun only. Skip bloom
   * clones and horizon wedge rebuilds (those are translucent layers that stack
   * and flash under the dial when destroyed/recreated every frame).
   */
  /**
   * Year-scrub / date morph may patch rings in place. After the list replaces
   * the body with the linear chart, those nodes are detached — patching them
   * would succeed and skip rebuilding the visible dial.
   */
  _forgetClockDom({ keepOverlay = false } = {}) {
    if (this._clockOutsideClick) {
      this.shadowRoot?.removeEventListener("click", this._clockOutsideClick);
      this._clockOutsideClick = null;
    }
    this._clockResizeObserver?.disconnect();
    this._clockResizeObserver = undefined;
    this._clockRingsHost = undefined;
    this._clockOverlayEl = undefined;
    this._clockGlowLayer = undefined;
    this._layoutDialChromeFn = undefined;
    if (!keepOverlay) {
      this._clockHorizonBackEl?.remove();
      this._dropClockLegends();
    }
    this._clockHorizonBackEl = undefined;
    this._clockFaceEl = undefined;
    this._clockLegendEl = undefined;
    this._clockBrightnessGradEl = undefined;
    this._clockBrightnessFillEl = undefined;
    this._clockBrightnessArcEl = undefined;
    this._clockThemeBrightDotsEl = undefined;
    this._cancelClockBrightMotion();
    this._clockBrightShown = {};
    this._clockBrightTarget = {};
    this._clockBrightFrom = {};
    // A new legend is a flat list. A matching signature must not skip grouping it.
    this._legendGroupSignature = "";
  }

  _patchLightClock(payload, { morphing = false } = {}) {
    const ringsHost = this._clockRingsHost;
    const overlay = this._clockOverlayEl;
    if (
      !ringsHost?.isConnected ||
      !overlay?.isConnected ||
      !payload?.events
    ) {
      return false;
    }
    const ringLights = this._clockRingLights(payload.lights || []);
    const rings = [...ringsHost.querySelectorAll(":scope > .clock-ring")];
    if (rings.length !== ringLights.length) {
      return false;
    }
    const legendLights = this._legendLights(payload.lights || []);
    const legendRows = [
      ...(this._clockLegendEl?.querySelectorAll(
        ".simple-light-selector:not(.add-light-tile)"
      ) || []),
    ];
    if (legendRows.length !== legendLights.length) {
      return false;
    }
    const legendById = new Map(
      legendRows.map((row) => [row.dataset.entityId, row])
    );
    if (legendById.size !== legendLights.length) {
      return false;
    }
    for (const light of legendLights) {
      const row = legendById.get(light.entity_id);
      if (!row) {
        return false;
      }
      if (row.classList.contains("suggested") !== Boolean(light.suggested)) {
        return false;
      }
      if (
        row.classList.contains("removed") !==
        Boolean(light.removed || light.suggested)
      ) {
        return false;
      }
    }
    if (this._lightNameLabels?.length) {
      const byId = new Map(
        legendLights.map((item) => [item.entity_id, item])
      );
      for (const entry of this._lightNameLabels) {
        const next = byId.get(entry.light?.entity_id);
        if (next) {
          entry.light = next;
        }
      }
    }
    for (let index = 0; index < rings.length; index += 1) {
      if (rings[index].dataset.entityId !== ringLights[index].entity_id) {
        return false;
      }
    }
    for (let index = 0; index < rings.length; index += 1) {
      const bg = conicGradientFromSamples(ringLights[index].samples || []);
      const fill = rings[index].querySelector(".clock-ring-fill");
      if (fill) {
        fill.style.background = bg;
      }
    }
    // Bloom is two semi-transparent blurred clones of the same conics. Updating
    // them every morph frame doubles the mid-transition chroma under the dial;
    // sync once when morphing finishes.
    if (!morphing) {
      for (const glow of this._clockGlowLayer?.querySelectorAll(
        ":scope > .sun-light-clock-glow"
      ) || []) {
        const glowRings = glow.querySelectorAll(":scope > .clock-ring");
        for (let index = 0; index < glowRings.length; index += 1) {
          const fill = glowRings[index].querySelector(".clock-ring-fill");
          if (fill && ringLights[index]) {
            fill.style.background = conicGradientFromSamples(
              ringLights[index].samples || []
            );
          }
        }
      }
    }
    for (const sel of [
      ".clock-sun-day",
      ".clock-sun-path-night",
      ".clock-event-dot",
      ".clock-event-ray",
      ".clock-event-clamp-link",
    ]) {
      overlay.querySelectorAll(sel).forEach((el) => el.remove());
    }
    this._paintClockSunPath(overlay, payload.events, { includeSun: false });
    if (!morphing) {
      const sky = this._clockHorizonSkyEl;
      if (sky) {
        while (sky.firstChild) {
          sky.removeChild(sky.firstChild);
        }
        this._paintHorizonShadow(sky, payload.events);
      }
    } else {
      // Keep wedge geometry in sync without tear-down (avoids bottom flash).
      this._syncHorizonShadowPaths(payload.events);
    }
    this._syncClockEventAnchorsForScrub(payload.events);
    this._layoutDialChromeFn?.();
    const seconds =
      this._clockStickySeconds ??
      this._clockSunDisplayedSeconds ??
      this._clockSunIdleSeconds();
    this._applyClockSunAppearance(seconds, { skipHorizonGlow: morphing });
    if (this._hoverReadout) {
      this._fillHoverReadout(seconds, { hovering: false });
    }
    return true;
  }

  /** Update night/day wedge path `d` in place during morph (no node churn). */
  _syncHorizonShadowPaths(events) {
    const sky = this._clockHorizonSkyEl;
    if (!sky) {
      return;
    }
    const sunrise = this._clockEventSeconds(events, "sunrise");
    const sunset = this._clockEventSeconds(events, "sunset");
    const dawn = this._clockEventSeconds(events, "dawn");
    const dusk = this._clockEventSeconds(events, "dusk");
    this._clockSunriseSeconds = sunrise;
    this._clockSunsetSeconds = sunset;
    const dayEl = sky.querySelector(".clock-sky-day");
    const nightEl = sky.querySelector(".clock-sky-night");
    const deepEl = sky.querySelector(".clock-sky-deep");
    if (sunrise != null && sunset != null) {
      if (dayEl) {
        dayEl.setAttribute(
          "d",
          this._clockWedgePath(sunrise, sunset, CLOCK_SKY_R)
        );
        this._clockSkyDayEl = dayEl;
      }
      if (nightEl) {
        nightEl.setAttribute(
          "d",
          this._clockWedgePath(sunset, sunrise, CLOCK_SKY_R)
        );
      }
    }
    if (dusk != null && dawn != null && deepEl) {
      deepEl.setAttribute(
        "d",
        this._clockWedgePath(dusk, dawn, CLOCK_SKY_R)
      );
    }
  }

  /** Reposition / relabel event buttons mid-scrub (ghosts move with solar marks). */
  _syncClockEventAnchorsForScrub(events) {
    const anchors = this._clockEventAnchors || [];
    for (const anchor of anchors) {
      const eventId = anchor.dataset.eventId;
      const event = (events || []).find((item) => item.id === eventId);
      if (event == null) {
        continue;
      }
      const isGhost = anchor.classList.contains("ghost");
      const markSeconds = this._eventMarkSeconds(event);
      const buttonSeconds = this._eventButtonSeconds(event);
      const placeSeconds = isGhost ? markSeconds : buttonSeconds;
      if (placeSeconds == null) {
        continue;
      }
      if (isGhost) {
        const show =
          event.overridden &&
          markSeconds != null &&
          buttonSeconds != null &&
          markSeconds !== buttonSeconds;
        anchor.hidden = !show;
        if (!show) {
          continue;
        }
      }
      const deg = this._clockAngleDeg(placeSeconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      anchor._clockPolar = { cos: Math.cos(rad), sin: Math.sin(rad) };
      if (isGhost) {
        const ghostBtn = anchor.querySelector(".clock-event");
        if (ghostBtn) {
          ghostBtn.title = `${event.name} · solar ${event.solar_time || event.time}`;
        }
        continue;
      }
      const timeText = event.fallback ? `${event.time}*` : event.time;
      const heading = anchor.querySelector(".clock-event-heading");
      if (heading) {
        heading.textContent = `${event.name} · ${timeText}`;
      }
      const btn = anchor.querySelector(".clock-event");
      if (btn) {
        const solarHint =
          event.overridden && event.solar_time
            ? ` (solar ${event.solar_time})`
            : "";
        btn.title = `${event.name} · ${timeText}${solarHint}`;
      }
    }
  }

  _dropClockLegends() {
    // The dial legend is appended beside the face, not inside the clock node.
    // Leaving the editor nulls `_clockLegendEl` while the node stays on the sun
    // path, so the next visit used to append a second strip.
    const nodes = new Set(this._clockLegendEl ? [this._clockLegendEl] : []);
    for (const el of this._sunPathEl?.querySelectorAll(
      ":scope > .sun-light-clock-legend"
    ) || []) {
      nodes.add(el);
    }
    for (const el of nodes) {
      el.remove();
    }
    this._clockLegendEl = null;
  }

  _buildLightClock(events) {
    this._dropClockLegends();
    this._lightNameLabels = [];
    const lights = this._sunPath.lights || [];
    const ringLights = this._clockRingLights(lights);
    const legendLights = this._legendLights(lights);
    const suggested = lights.filter((light) => light.suggested);
    const wrap = document.createElement("div");
    wrap.className = "sun-light-clock";

    const face = document.createElement("div");
    face.className = "sun-light-clock-face";
    face.setAttribute("role", "img");
    face.setAttribute(
      "aria-label",
      "24-hour light rings with sun elevation around the rim; midnight at the bottom"
    );

    // Horizon glow + event shadow sit behind the planet (and outside the core).
    const horizonBack = document.createElement("div");
    horizonBack.className = "clock-horizon-back";
    horizonBack.setAttribute("aria-hidden", "true");
    this._clockHorizonBackEl = horizonBack;
    this._clockFaceEl = face;
    const horizonGlow = document.createElement("div");
    horizonGlow.className = "clock-horizon-glow";
    this._clockHorizonGlowEl = horizonGlow;
    const skyOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    skyOverlay.setAttribute("class", "clock-horizon-sky");
    skyOverlay.setAttribute("viewBox", `0 0 ${CLOCK_VIEW} ${CLOCK_VIEW}`);
    this._paintHorizonShadow(skyOverlay, events);
    horizonBack.append(horizonGlow, skyOverlay);
    this._clockHorizonSkyEl = skyOverlay;

    const core = document.createElement("div");
    core.className = "sun-light-clock-core";

    const ringsHost = document.createElement("div");
    ringsHost.className = "sun-light-clock-rings";
    this._clockRingsHost = ringsHost;
    const n = ringLights.length;
    const hole = 0;
    const usable = 100 - hole;
    const stroke = n ? usable / n : 0;
    // Band edges are the true partitions; --clock-feather bleeds them into
    // neighbors in soft mode and drops to 0% in sharp (hover/selected) mode.
    for (let index = 0; index < n; index += 1) {
      const light = ringLights[index];
      const outer = 100 - index * stroke;
      const inner = Math.max(hole, outer - stroke);
      // --ring-expand / --ring-rim-w grow the hover rim; --clock-feather softens seams.
      const mask = `radial-gradient(farthest-side, transparent calc(var(--ring-inner) - var(--clock-feather) - var(--ring-expand)), #000 calc(var(--ring-inner) + var(--clock-feather) - var(--ring-expand)), #000 calc(var(--ring-outer) - var(--clock-feather) + var(--ring-expand)), transparent calc(var(--ring-outer) + var(--clock-feather) + var(--ring-expand)))`;
      const bg = conicGradientFromSamples(light.samples || []);

      const ring = document.createElement("div");
      ring.className = "clock-ring";
      ring.dataset.entityId = light.entity_id;
      ring.style.setProperty("--ring-inner", `${inner}%`);
      ring.style.setProperty("--ring-outer", `${outer}%`);
      if (light.entity_id === this._sidebarLightId) {
        ring.classList.add("selected");
        ring.setAttribute("aria-current", "true");
      }
      const fill = document.createElement("div");
      fill.className = "clock-ring-fill";
      fill.style.background = bg;
      fill.style.webkitMaskImage = mask;
      fill.style.maskImage = mask;
      ring.appendChild(fill);
      const lightName = this._lightDisplayName(light.entity_id, {
        fallback: light.name,
      });
      const capabilities = this._lightSupportsSubtitle(light.entity_id);
      ring.title = capabilities ? `${lightName} · ${capabilities}` : lightName;
      ring.dataset.lightName = lightName;
      ring.dataset.capabilities = capabilities;
      ringsHost.appendChild(ring);
    }
    const hoverName = document.createElement("div");
    hoverName.className = "clock-ring-hover-name";
    hoverName.setAttribute("aria-live", "polite");
    hoverName.hidden = true;
    const hoverTitle = document.createElement("span");
    const hoverCaps = document.createElement("span");
    hoverCaps.className = "clock-ring-hover-caps";
    hoverName.append(hoverTitle, hoverCaps);
    // On the core (not ringsHost — glow clones copy ringsHost). Positioned at
    // the rings inset so the pill sits flush above the outer light ring.
    const setHoveredRing = (entityId) => {
      let label = "";
      let capabilities = "";
      for (const ring of ringsHost.querySelectorAll(".clock-ring")) {
        const on =
          Boolean(entityId) && ring.dataset.entityId === entityId;
        ring.classList.toggle("hovered", on);
        if (on) {
          label = ring.dataset.lightName || "";
          capabilities = ring.dataset.capabilities || "";
        }
      }
      if (label) {
        if (hoverTitle.textContent !== label) hoverTitle.textContent = label;
        if (hoverCaps.textContent !== capabilities) hoverCaps.textContent = capabilities ? `· ${capabilities}` : "";
        hoverName.hidden = false;
      } else {
        hoverName.hidden = true;
      }
    };
    const updateRingHover = (ev) => {
      // Block page scroll while a finger/pen scrubs across the planet.
      if (ev.cancelable && (ev.pointerType === "touch" || ev.pointerType === "pen")) {
        ev.preventDefault();
      }
      const light = this._lightAtClockPointer(ev, ringsHost, ringLights);
      setHoveredRing(light?.entity_id || null);
    };
    // Touch/pen: open on release (click is unreliable after preventDefault).
    let suppressRingClick = false;
    ringsHost.addEventListener("pointerdown", (ev) => {
      // Touch has no hover: capture so move events keep updating the band.
      if (ev.pointerType === "touch" || ev.pointerType === "pen") {
        if (ev.cancelable) {
          ev.preventDefault();
        }
        try {
          ringsHost.setPointerCapture(ev.pointerId);
        } catch (_err) {
          /* capture optional */
        }
      }
      updateRingHover(ev);
    });
    ringsHost.addEventListener("pointermove", updateRingHover);
    ringsHost.addEventListener("pointerup", (ev) => {
      if (ev.pointerType === "touch" || ev.pointerType === "pen") {
        const light = this._lightAtClockPointer(ev, ringsHost, ringLights);
        if (light) {
          openRingAt(ev, light);
          suppressRingClick = true;
        }
        setHoveredRing(null);
        if (ringsHost.hasPointerCapture?.(ev.pointerId)) {
          try {
            ringsHost.releasePointerCapture(ev.pointerId);
          } catch (_err) {
            /* optional */
          }
        }
      }
    });
    ringsHost.addEventListener("pointercancel", (ev) => {
      setHoveredRing(null);
      if (
        (ev.pointerType === "touch" || ev.pointerType === "pen") &&
        ringsHost.hasPointerCapture?.(ev.pointerId)
      ) {
        try {
          ringsHost.releasePointerCapture(ev.pointerId);
        } catch (_err) {
          /* optional */
        }
      }
    });
    ringsHost.addEventListener("pointerleave", (ev) => {
      // With capture, leave can fire mid-drag; only clear when not captured.
      if (ringsHost.hasPointerCapture?.(ev.pointerId)) {
        return;
      }
      setHoveredRing(null);
    });
    // Non-passive touchmove so preventDefault can block scroll. Once the
    // browser has committed to scrolling, the event is not cancelable.
    ringsHost.addEventListener(
      "touchmove",
      (ev) => {
        if (ev.cancelable) {
          ev.preventDefault();
        }
      },
      { passive: false }
    );
    const openRingAt = (ev, light) => {
      if (!light) {
        return;
      }
      // Clicking the already-selected ring deselects and closes the sidebar.
      if (light.entity_id === this._sidebarLightId) {
        this._requestCloseSceneSidebar();
        return;
      }
      const seconds =
        this._clockSunDisplayedSeconds ??
        this._clockStickySeconds ??
        this._clockSunIdleSeconds();
      if (this._view === "theme") {
        const closest = this._closestEvent(events, seconds);
        if (closest) {
          this._openThemeEventSidebar(closest);
        }
        return;
      }
      const assigned = events.filter((item) => this._eventSceneId(item.id));
      if (!assigned.length) {
        return;
      }
      const closest = this._closestEvent(assigned, seconds);
      if (closest) {
        this._openLightEditDialog(light, closest);
      }
    };
    ringsHost.addEventListener("click", (ev) => {
      // Always stop: planet clicks must not hit the outside-deselect listener.
      ev.stopPropagation();
      if (suppressRingClick) {
        suppressRingClick = false;
        return;
      }
      openRingAt(ev, this._lightAtClockPointer(ev, ringsHost, ringLights));
    });
    ringsHost.tabIndex = 0;
    ringsHost.setAttribute("role", "listbox");
    ringsHost.setAttribute("aria-label", "Light rings");
    ringsHost.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") {
        return;
      }
      ev.preventDefault();
      const selected =
        ringLights.find((light) => light.entity_id === this._sidebarLightId) ||
        ringLights[0];
      openRingAt(ev, selected);
    });
    // Click outside the rings (and outside light-pickers / the sidebar)
    // clears the selection by closing the light editor.
    if (this._clockOutsideClick) {
      this.shadowRoot?.removeEventListener("click", this._clockOutsideClick);
    }
    this._clockOutsideClick = (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) {
        return;
      }
      if (
        t.closest(
          ".scene-sidebar, .sun-light-clock-rings, .simple-light-selector, .light-mode-label, .clock-event, .sun-event, .gm, .hue-wheel-chrome, .simple-level-host, .var-palette, .hue-presets, ha-dialog, ha-dropdown"
        )
      ) {
        return;
      }
      if (this._sidebarLightId) {
        this._requestCloseSceneSidebar();
        return;
      }
      if (this._legendSelectedIds?.size) {
        this._legendSelectedIds = new Set();
        this._syncClockLightSelection();
        revealLightActionsNow(this.shadowRoot);
      }
    };
    this.shadowRoot.addEventListener("click", this._clockOutsideClick);
    // Soft bloom clones behind the interactive rings — same conic colors as the
    // planet (not elevation sky). Large + half-size layers share opacity.
    // Face-level layer (not inside core) so bloom paints over the horizon wash.
    const makeGlow = (mod) => {
      const glow = ringsHost.cloneNode(true);
      glow.className = `sun-light-clock-glow ${mod}`;
      glow.removeAttribute("tabindex");
      glow.removeAttribute("role");
      glow.removeAttribute("aria-label");
      glow.setAttribute("aria-hidden", "true");
      for (const ring of glow.querySelectorAll(".clock-ring")) {
        ring.classList.remove("selected", "hovered");
        ring.removeAttribute("aria-current");
        ring.removeAttribute("title");
      }
      return glow;
    };
    const glowLayer = document.createElement("div");
    glowLayer.className = "sun-light-clock-glow-layer";
    glowLayer.setAttribute("aria-hidden", "true");
    const glowLg = makeGlow("glow-lg");
    const glowMd = makeGlow("glow-md");
    glowLayer.append(glowLg, glowMd);
    this._clockSkyGlow = glowLg;
    this._clockGlowLayer = glowLayer;
    core.append(ringsHost, hoverName);

    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    overlay.setAttribute("class", "sun-light-clock-overlay");
    overlay.setAttribute("viewBox", `0 0 ${CLOCK_VIEW} ${CLOCK_VIEW}`);
    overlay.setAttribute("aria-hidden", "true");
    this._clockOverlayEl = overlay;
    const cx = CLOCK_CX;
    const cy = CLOCK_CY;
    // Hour ticks + numbers live on the face (outer chrome). Core overlay is
    // path / sun / handle only.
    const hourLabels = [];
    const faceTicks = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    faceTicks.setAttribute("class", "clock-face-ticks");
    faceTicks.setAttribute("viewBox", `0 0 ${CLOCK_VIEW} ${CLOCK_VIEW}`);
    faceTicks.setAttribute("aria-hidden", "true");
    const faceTickLines = [];
    for (let hour = 0; hour < 24; hour += 1) {
      const seconds = hour * 3600;
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      const major = hour % 6 === 0;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      if (!major) {
        const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tick.setAttribute("class", "clock-tick");
        faceTicks.appendChild(tick);
        faceTickLines.push({
          el: tick,
          cos,
          sin,
          len: CLOCK_TICK_MINOR_LEN,
        });
      } else {
        const label = document.createElement("div");
        label.className = "clock-hour-label";
        label.textContent = hour === 0 ? "24" : String(hour).padStart(2, "0");
        label._clockPolar = { cos, sin };
        hourLabels.push(label);
      }
    }
    this._paintClockSunPath(overlay, events);
    this._ensureOverrideArc(overlay);

    const handleOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    handleOverlay.setAttribute("class", "sun-light-clock-handle-overlay");
    handleOverlay.setAttribute("viewBox", `0 0 ${CLOCK_VIEW} ${CLOCK_VIEW}`);
    handleOverlay.setAttribute("aria-hidden", "true");
    this._paintClockHandle(handleOverlay);

    const handleHit = document.createElement("div");
    handleHit.className = "clock-handle-hit";
    handleHit.setAttribute("aria-hidden", "true");
    this._clockHandleHitEl = handleHit;
    // Path under sun; rings above handle so the planet occludes it.
    core.append(
      overlay,
      this._clockSunEl,
      handleOverlay,
      this._clockSunHitEl,
      handleHit
    );
    // Horizon → light bloom → planet; face ticks under event buttons / labels.
    face.append(horizonBack, glowLayer, core, faceTicks);

    const editable = this._view === "edit" || this._view === "theme";
    const hadTheme = Boolean(this._themeDraft);
    void this._ensureThemeDraft().then((ok) => {
      if (!ok || hadTheme || !this.isConnected) {
        return;
      }
      if (this._view !== "edit" || this._formData?.kind === "simple") {
        return;
      }
      this._patchDialFromSession({ applyTheme: true });
    });
    const eventLayer = document.createElement("div");
    eventLayer.className = "clock-event-layer";
    const briSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    briSvg.setAttribute("class", "clock-brightness-overlay");
    briSvg.setAttribute("viewBox", "0 0 100 100");
    briSvg.setAttribute("aria-hidden", "true");
    const briDefs = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "defs"
    );
    const briGrad = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "radialGradient"
    );
    briGrad.setAttribute("id", "clock-brightness-glow-grad");
    briGrad.setAttribute("gradientUnits", "userSpaceOnUse");
    briGrad.setAttribute("cx", "50");
    briGrad.setAttribute("cy", "50");
    briGrad.setAttribute("r", "50");
    briDefs.appendChild(briGrad);
    const briFill = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    briFill.setAttribute("class", "clock-brightness-fill");
    briFill.setAttribute("fill", "url(#clock-brightness-glow-grad)");
    const briArc = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    briArc.setAttribute("class", "clock-brightness-arc");
    briArc.setAttribute("vector-effect", "non-scaling-stroke");
    const briThemeDots = document.createElementNS("http://www.w3.org/2000/svg", "g");
    briThemeDots.setAttribute("class", "clock-theme-bright-dots");
    briSvg.append(briDefs, briFill, briArc, briThemeDots);
    eventLayer.appendChild(briSvg);
    this._clockBrightnessGradEl = briGrad;
    this._clockBrightnessFillEl = briFill;
    this._clockBrightnessArcEl = briArc;
    this._clockThemeBrightDotsEl = briThemeDots;
    const eventAnchors = [];
    const polarForSeconds = (seconds) => {
      const deg = this._clockAngleDeg(seconds);
      const rad = ((deg - 90) * Math.PI) / 180;
      return { cos: Math.cos(rad), sin: Math.sin(rad) };
    };
    for (const event of events) {
      const buttonSeconds = this._eventButtonSeconds(event);
      const markSeconds = this._eventMarkSeconds(event);
      if (buttonSeconds == null) {
        continue;
      }
      const { cos, sin } = polarForSeconds(buttonSeconds);
      const timeText = event.fallback ? `${event.time}*` : event.time;

      const anchor = document.createElement("div");
      anchor.className = "clock-event-anchor";
      anchor.dataset.eventId = event.id;
      anchor._clockPolar = { cos, sin };

      const meta = document.createElement("div");
      meta.className = "clock-event-meta";
      meta.setAttribute("aria-hidden", "true");
      const heading = document.createElement("span");
      heading.className = "clock-event-heading";
      heading.textContent = `${event.name} · ${timeText}`;
      const brightEl = document.createElement("span");
      brightEl.className = "clock-event-bright";
      meta.append(heading, brightEl);

      const btn = document.createElement(editable ? "button" : "div");
      btn.className = "clock-event";
      if (editable) {
        btn.type = "button";
        btn.dataset.eventId = event.id;
      }
      const solarHint =
        event.overridden && event.solar_time
          ? ` (solar ${event.solar_time})`
          : "";
      btn.title = `${event.name} · ${timeText}${solarHint}`;
      if (this._sidebarEventId === event.id) {
        btn.classList.add("selected");
        btn.setAttribute("aria-current", "true");
      }
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", event.icon);
      btn.appendChild(icon);
      if (editable) {
        btn.setAttribute("aria-label", `${event.name} ${timeText}`);
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (this._clockEventSuppressClick) {
            this._clockEventSuppressClick = false;
            return;
          }
          this._toggleEventSceneDialog(event);
        });
        this._bindClockEventBrightnessDrag(btn, event, anchor);
      }
      anchor.append(meta, btn);
      eventLayer.appendChild(anchor);
      eventAnchors.push(anchor);

      if (
        event.overridden &&
        markSeconds != null &&
        markSeconds !== buttonSeconds
      ) {
        const ghostPolar = polarForSeconds(markSeconds);
        const ghost = document.createElement("div");
        ghost.className = "clock-event-anchor ghost";
        ghost.dataset.eventId = event.id;
        ghost._clockPolar = ghostPolar;
        ghost.setAttribute("aria-hidden", "true");
        const ghostBtn = document.createElement("div");
        ghostBtn.className = "clock-event ghost";
        ghostBtn.title = `${event.name} · solar ${event.solar_time || timeText}`;
        const ghostIcon = document.createElement("ha-icon");
        ghostIcon.setAttribute("icon", event.icon);
        ghostBtn.appendChild(ghostIcon);
        ghost.appendChild(ghostBtn);
        eventLayer.appendChild(ghost);
        eventAnchors.push(ghost);
      }
    }
    // Hour labels on the face (above event anchors in paint order).
    face.appendChild(eventLayer);
    for (const label of hourLabels) {
      face.appendChild(label);
    }

    const layoutEventAnchors = () => {
      const w = face.clientWidth;
      if (!w) {
        return;
      }
      // Cardinal numerals sit on the old 6h tick tips (near the face edge).
      // Size follows the face so widths between phone and desktop are not a step.
      const labelFontPx = Math.round(w * 0.08);
      face.style.setProperty("--clock-hour-size", `${labelFontPx}px`);
      // Brightness 0% is the sun path. 100% is a shorter span on a smaller face
      // (half of 92px on a phone dial, three quarters on a desktop dial) so the
      // core can use the space the span used to reserve.
      const gapT = Math.min(1, Math.max(0, (w - 360) / (800 - 360)));
      const eventGap = CLOCK_EVENT_GAP_FROM_PATH_PX * (0.5 + 0.25 * gapT);
      const tickOuterPad = w >= 871 ? 10 : 6;
      const labelPad =
        tickOuterPad + labelFontPx * 0.42 - CLOCK_HOUR_LABEL_OUTSET_PX;
      const narrowFace = window.matchMedia("(max-width: 870px)").matches;
      const chromeFloor = Math.ceil(tickOuterPad + labelFontPx * 0.42 + 4);
      let chromePx = chromeFloor;
      const pathR = this._clockSunPathRadius();
      const pathFrac = pathR / 100;
      const half = w / 2;
      const btnClear = CLOCK_EVENT_BTN_PX / 2 + 2;
      const outerNeed = eventGap + btnClear;
      if (pathFrac > 0 && half > outerNeed) {
        const chromeForBri = Math.ceil(half - (half - outerNeed) / pathFrac);
        const maxChrome = Math.max(0, Math.floor((w - 80) / 2));
        chromePx = Math.min(Math.max(chromePx, chromeForBri), maxChrome);
      }
      face.style.setProperty("--clock-chrome", `${chromePx}px`);
      // Derive core size from chrome (do not wait for a second layout pass).
      const coreW = w - 2 * chromePx;
      if (coreW < 8) {
        return;
      }
      // Face SVG viewBox radius 100 ≡ half the face; pad → viewBox r.
      const tickOuterR = 100 * (1 - (2 * tickOuterPad) / w);
      for (const tick of faceTickLines) {
        const outer = tickOuterR;
        const len = narrowFace
          ? CLOCK_TICK_MINOR_LEN
          : CLOCK_TICK_MINOR_LEN * 1.75;
        const inner = tickOuterR - len;
        tick.el.setAttribute("x1", (cx + tick.cos * inner).toFixed(2));
        tick.el.setAttribute("y1", (cy + tick.sin * inner).toFixed(2));
        tick.el.setAttribute("x2", (cx + tick.cos * outer).toFixed(2));
        tick.el.setAttribute("y2", (cy + tick.sin * outer).toFixed(2));
      }
      const labelR = ((w / 2 - labelPad) / w) * 100;
      for (const label of hourLabels) {
        const { cos, sin } = label._clockPolar;
        label.style.left = `${50 + cos * labelR}%`;
        label.style.top = `${50 + sin * labelR}%`;
      }
      const pathPx = pathFrac * (coreW / 2);
      let r1Px = pathPx + eventGap;
      if (r1Px + btnClear > half) {
        r1Px = half - btnClear;
      }
      if (r1Px < pathPx) {
        r1Px = pathPx;
      }
      const r0 = (pathPx / w) * 100;
      const r1 = (r1Px / w) * 100;
      this._clockBrightR0 = r0;
      this._clockBrightR1 = r1;
      this._clockEventIconR = r1;
      const targets = {};
      for (const event of this._sunPath?.events || []) {
        if (this._eventButtonSeconds(event) == null) {
          continue;
        }
        targets[event.id] = this._dialEventBrightness(event.id);
      }
      this._syncClockBrightMotion(targets);
      this._placeClockBrightnessHandles();
      // Override arc/glow on the outer tip of the face hour ticks, in core space.
      const tickOuterPx = (tickOuterR / 100) * (w / 2);
      const overrideR = (tickOuterPx / (coreW / 2)) * 100;
      this._clockOverrideR = overrideR;
      if (this._clockOverrideGlowEl) {
        this._clockOverrideGlowEl.setAttribute("r", String(overrideR));
      }
      this._updateOverrideArc(this._clockStickySeconds);
      this._layoutClockEventMetas(eventAnchors);
      this._layoutClockEventSpokes();
      this._layoutClockBrightnessCurve();
    };
    this._clockEventAnchors = eventAnchors;
    this._layoutDialChromeFn = () => {
      layoutEventAnchors();
      this._layoutClockEventDots();
      this._layoutClockHorizonBack();
      this._alignYearScrubRail();
    };
    layoutEventAnchors();
    const layoutDialChrome = () => {
      this._layoutDialChromeFn?.();
    };
    layoutDialChrome();
    this._clockResizeObserver?.disconnect();
    if (typeof ResizeObserver === "function") {
      this._clockResizeObserver = new ResizeObserver(() => {
        if (this._sidebarLayoutInProgress) {
          return;
        }
        layoutDialChrome();
      });
      this._clockResizeObserver.observe(face);
    }
    requestAnimationFrame(() => layoutDialChrome());

    this._bindClockSunDrag(face, [this._clockSunHitEl, this._clockHandleHitEl]);
    // Enter when arriving from a non-dial surface. Dial→dial skips it.
    // Optimistic paint from the list sun_path has no lights — do not consume
    // the enter flag there; preview rebuild (with rings) should still animate.
    const optimisticListCurve =
      !ringLights.length ||
      String(this._sunPathKey || "").startsWith("list-sun:");
    if (this._clockEnterPlayed || optimisticListCurve) {
      this._applyClockSunAppearance(this._clockSunIdleSeconds());
    } else {
      this._clockEnterPlayed = true;
      this._playClockEnterAnimation(face);
    }
    wrap.appendChild(face);

    if (!ringLights.length && this._view !== "theme") {
      const hint = document.createElement("p");
      hint.className = "sun-light-clock-empty-hint";
      hint.textContent = suggested.length
        ? "Create a native scene from a solar event to fill the dial — area lights are listed below."
        : "No lights in this area yet.";
      wrap.appendChild(hint);
    }

    const legend = document.createElement("div");
    legend.className = "sun-light-clock-legend";
    const scroller = document.createElement("div");
    scroller.className = "light-tiles-scroller";
    const tiles = document.createElement("div");
    tiles.className = "light-tiles";
    for (const light of legendLights) {
      tiles.appendChild(this._clockLegendRow(light, events));
    }
    if (this._view === "edit") {
      tiles.appendChild(
        createAddLightTile({
          label: this._t("frontend.lights.add_light", "Add light"),
          onActivate: (anchor) => this._openAddLightPicker(anchor),
        })
      );
    }
    this._placeLegendModeGroups(tiles);
    if (tiles.childElementCount) {
      scroller.appendChild(tiles);
      bindGroupTitleStick(scroller);
      legend.append(
        scroller,
        createLightTilesHint(
          this._t(
            "frontend.lights.tiles_hint_pick",
            "Select a solar event or a light to edit it, or drag the sun to preview the lights at a point in time"
          )
        )
      );
      this._clockLegendEl = legend;
      this._syncClockLegendBrightEdit();
    } else {
      this._clockLegendEl = null;
    }
    return wrap;
  }

  _legendTileSelected(entityId) {
    const picked = this._legendSelectedIds;
    if (picked) {
      return picked.has(entityId);
    }
    return entityId === this._sidebarLightId;
  }

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
  }

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
  }

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
    const ungrouped = [...tilesEl.querySelectorAll(":scope > .simple-light-selector")].some(
      (el) =>
        !el.classList.contains("add-light-tile") && el.style.position !== "absolute"
    );
    if (signature === this._legendGroupSignature && !ungrouped) {
      return;
    }
    this._legendGroupSignature = signature;
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
    tilesEl.replaceChildren();
    for (const key of groupOrder) {
      const rows = grouped.get(key) || [];
      if (!rows.length) {
        continue;
      }
      const paletteId = key.startsWith("palette:") ? key.slice("palette:".length) : "";
      const label = paletteId
        ? (this._variables || []).find((item) => item.id === paletteId)?.name || paletteId
        : labels[key] || key;
      const ids = rows.map((entry) => entry.light.entity_id);
      const { group, row } = createLightModeGroup({
        label,
        selectAllLabel,
        groupKey: key,
        onSelectAll: (ev) => {
          const result = groupSelectionAfterClick({
            ids,
            selected: [...(this._legendSelectedIds || [])],
            toggleKey: Boolean(ev?.metaKey || ev?.ctrlKey || ev?.shiftKey),
          });
          this._legendSelectedIds = new Set(result.selected);
          this._syncClockLightSelection();
          revealLightActionsNow(this.shadowRoot);
        },
      });
      for (const entry of rows) {
        row.appendChild(entry.selector);
      }
      tilesEl.appendChild(group);
    }
    if (unavailable.length || orphanUnavailable.length) {
      const { group, row } = createLightModeGroup({
        label: this._t("frontend.lights.unavailable", "Unavailable"),
        plain: true,
        groupKey: "unavailable",
      });
      for (const entry of unavailable) {
        row.appendChild(entry.selector);
      }
      for (const node of orphanUnavailable) {
        row.appendChild(node);
      }
      tilesEl.appendChild(group);
    }
    if (leftovers.length) {
      const { group, row } = createLightModeGroup({
        label: this._t("frontend.lights.removed", "Removed"),
        plain: true,
        groupKey: "removed",
      });
      for (const node of leftovers) {
        row.appendChild(node);
      }
      tilesEl.appendChild(group);
    }
    if (add) {
      tilesEl.appendChild(add);
    }
    playLightStripLayout(tilesEl, beforeLayout);
    tilesEl.parentElement?._groupTitleStick?.();
  }

  _toggleLegendLightPower(entityId) {
    const events = this._sunPath?.events || [];
    const assigned = events.filter((item) => this._eventSceneId(item.id));
    const pinned = assigned.find((item) => item.id === this._sidebarEventId);
    const now =
      this._clockSunDisplayedSeconds ??
      this._clockStickySeconds ??
      this._clockSunIdleSeconds();
    const event = pinned || this._closestEvent(assigned, now);
    if (!event) {
      return;
    }
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
    this._writeDialEventBrightness(event.id, next, {
      history: true,
      lightId: entityId,
    });
  }

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
          const pinned = assigned.find(
            (item) => item.id === this._sidebarEventId
          );
          const now =
            this._clockSunDisplayedSeconds ??
            this._clockStickySeconds ??
            this._clockSunIdleSeconds();
          const closest = pinned || this._closestEvent(assigned, now);
          if (closest) {
            this._openLightEditDialog(light, closest);
          }
        };
        tile.addEventListener("click", openClosest);
        tile.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ") {
            return;
          }
          ev.preventDefault();
          openClosest(ev);
        });
        bindLightTileBrightness(tile, hit, {
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
          onRemove: () => this._removeLightFromAssignedScenes(light.entity_id),
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
  }

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
}

function entitySelector(hass, domain, areaId, nativeScenesOnly, extraIds) {
  const config = { domain, multiple: false };
  const include = [];
  const entities = hass.entities || {};
  for (const [entityId, meta] of Object.entries(entities)) {
    if (!entityId.startsWith(`${domain}.`)) {
      continue;
    }
    if (nativeScenesOnly) {
      if (meta.platform && meta.platform !== "homeassistant") {
        continue;
      }
      const state = hass.states[entityId];
      if (state && state.attributes.integration === DOMAIN) {
        continue;
      }
    }
    if (areaId && meta.area_id !== areaId) {
      continue;
    }
    include.push(entityId);
  }
  for (const extra of extraIds || []) {
    if (extra && !include.includes(extra)) {
      include.push(extra);
    }
  }
  if (areaId || nativeScenesOnly) {
    config.include_entities = include;
  }
  return { entity: config };
}

function formatLatLng(lat, lng) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lng).toFixed(2)}° ${ew}`;
}

function sameLocation(a, b) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    Math.abs(a.latitude - b.latitude) < 1e-6 &&
    Math.abs(a.longitude - b.longitude) < 1e-6
  );
}

if (!customElements.get("scene-studio-panel")) {
  customElements.define("scene-studio-panel", SceneStudioPanel);
}
