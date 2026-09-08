"""Constants for the Circadian Scenes integration."""

DOMAIN = "circadian_scenes"
# Pre-rename domain — used to migrate Store + entity registry once.
LEGACY_DOMAIN = "scene_extrapolation"
AREA = "area"
SCENE_NAME = "scene_name"
DESCRIPTION = "description"
LABELS = "labels"
CATEGORY = "category"

# --- Legacy v3 scene-slot keys (kept for migration only) ---
SCENE_DAWN = "scene_dawn"
SCENE_SUNRISE = "scene_sunrise"
SCENE_NOON = "scene_noon"
SCENE_SUNSET = "scene_sunset"
SCENE_DUSK = "scene_dusk"
SCENE_DUSK_MINIMUM_TIME_OF_DAY = "scene_dusk_minimum_time_of_day"
# House-wide earliest dusk (seconds since midnight). Legacy per-scene key above.
SETTINGS_DUSK_MINIMUM_TIME_OF_DAY = "dusk_minimum_time_of_day"
SCENE_DAWN_SUNRISE_SUNSET = "scene_dawn_sunrise_sunset"
DISPLAY_SCENES_COMBINED = "display_scenes_combined"

# Per-scene preference: keep applying on an interval after activation (default on).
AUTOMATICALLY_UPDATE_LIGHTS = "automatically_update_lights"
# Default friendly name when area is unknown; prefer "{area} Circadian" in the panel.
DEFAULT_SCENE_NAME = "Circadian"

PANEL_URL_PATH = "circadian_scenes"

DATA_STORE = "store"
DATA_ENTITIES = "entities"
DATA_ADD_ENTITIES = "add_entities"
DATA_CONFIG_ENTRY = "config_entry"

STORE_KEY = f"{DOMAIN}.scenes"
LEGACY_STORE_KEY = f"{LEGACY_DOMAIN}.scenes"

# Legacy tuple — still used by the v3→v4 migrator.
SCENE_KEYS = (
    SCENE_DAWN,
    SCENE_SUNRISE,
    SCENE_NOON,
    SCENE_SUNSET,
    SCENE_DUSK,
)

# --- v4 schema: solar event ids ---
SOLAR_EVENTS = ("dawn", "sunrise", "noon", "sunset", "dusk")

# Scene kinds (discriminated union).
KIND_CIRCADIAN = "circadian"
KIND_SIMPLE = "simple"

# Variable ref prefix in color fields — e.g. {"variable_ref": "<id>"}.
VARIABLE_REF = "variable_ref"

# Default seed variable colors: (brightness 0-255, kelvin).
DEFAULT_VARIABLE_COLORS: dict[str, tuple[int, int]] = {
    "dawn": (102, 2700),
    "sunrise": (191, 3500),
    "noon": (255, 4500),
    "sunset": (179, 3000),
    "dusk": (64, 2200),
}
