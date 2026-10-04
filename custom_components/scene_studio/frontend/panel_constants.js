/* Shared editor geometry, timing, and legacy compatibility constants. */
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
const DIAL_FACE_MAX_PX = 900;
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

export { DOMAIN, PANEL_URL_PATH, LEGACY_DOMAINS, SECONDS_PER_DAY, CLOCK_VIEW, CLOCK_CX, CLOCK_CY, CLOCK_RINGS_OUTER, CLOCK_SUN_PATH_PAD, CLOCK_SUN_PATH_WIDTH_PX, CLOCK_SNAP_CAPTURE_SEC, CLOCK_DRAG_CLICK_PX, CLOCK_EVENT_ICON_R, CLOCK_CHROME_PX, CLOCK_EVENT_BTN_PX, CLOCK_SCRUB_RAIL_PX, CLOCK_SCRUB_RAIL_PAD_PX, CLOCK_LANDSCAPE_SCRUB_MIN_WIDTH_PX, WHEEL_FACE_MIN_PX, DIAL_FACE_MIN_PX, WHEEL_FACE_MAX_PX, DIAL_FACE_MAX_PX, CLOCK_RINGS_INSET_PCT, CLOCK_SKY_R, CLOCK_NIGHT_OUTER_LIGHT, CLOCK_NIGHT_DEEP_LIGHT, CLOCK_NIGHT_OUTER_DARK, CLOCK_NIGHT_DEEP_DARK, CLOCK_DAY_SKY_LIGHT, CLOCK_SUN_SIZE_PCT, CLOCK_SUN_R_VIEW, CLOCK_SUN_SCALE_MAX, CLOCK_TICK_OUTER, CLOCK_TICK_MINOR_LEN, CLOCK_HOUR_LABEL_OUTSET_PX, CLOCK_EVENT_GAP_FROM_PATH_PX, CLOCK_EVENT_BRIGHT_DRAG_PX, CLOCK_BRIGHT_MOVE_MS, CLOCK_OVERRIDE_R, CLOCK_SUN_STROKE_MIN_PX, CLOCK_SUN_STROKE_MAX_PX, SIDEBAR_ANIMATION_MS, SIDEBAR_SWAP_MS, CLOCK_SUN_MOVE_MS, DATE_MORPH_MS, PREVIEW_REFINE_MS, UNDO_STACK_LIMIT, LIVE_EDIT_STORAGE_VERSION, ROOM_PREVIEW_STORAGE_VERSION, SCENE_PLAY_STORAGE_VERSION, SCENE_PLAY_TICK_MS, SCENE_PLAY_TRANSITION_SEC, SCENE_PLAY_DURATION_DEFAULT_SEC, SCENE_PLAY_DURATION_OPTIONS_SEC, EXTERNAL_SCENE_WARN_STORAGE_VERSION, CLOCK_FEATHER_PCT, LINKED_EVENTS, SETUP_AUTOMATIC, EVENT_LIGHT_DEFAULTS, EVENT_SCENE_KEYS, LABELS, HELPERS };
