"""Persistent store for circadian scene configurations (v4 schema).

v4 adds house-wide variables, circadian themes, scene kind
(circadian / simple), area-based membership, and per-light overrides.
Native HA YAML scenes are no longer the source of truth.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from copy import deepcopy
from typing import Any, Callable, TypeVar

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.storage import Store
from homeassistant.util.file import WriteError
from homeassistant.util.json import SerializationError

from .collaboration import ItemDeleted, RevisionConflict, merge_fields, revision_for
from .const import (
    AREA,
    AUTOMATICALLY_UPDATE_LIGHTS,
    CATEGORY,
    DATA_STORE,
    DEFAULT_SCENE_NAME,
    DEFAULT_VARIABLE_COLORS,
    DESCRIPTION,
    DISPLAY_SCENES_COMBINED,
    DOMAIN,
    KIND_CIRCADIAN,
    KIND_SIMPLE,
    LABELS,
    LEGACY_STORE_KEYS,
    SCENE_DAWN,
    SCENE_DAWN_SUNRISE_SUNSET,
    SCENE_DUSK,
    SCENE_DUSK_MINIMUM_TIME_OF_DAY,
    SCENE_KEYS,
    SCENE_NAME,
    SCENE_NOON,
    SCENE_SUNRISE,
    SCENE_SUNSET,
    SETTINGS_DUSK_MINIMUM_TIME_OF_DAY,
    SOLAR_EVENTS,
    STORE_KEY,
    VARIABLE_REF,
)
from .palette import KIND_PALETTE, normalize_palette_slots, optional_builtin_id
from .validation import (
    validate_scene_input,
    validate_theme_input,
    validate_variable_input,
)

_LOGGER = logging.getLogger(__name__)
_Result = TypeVar("_Result")

# --- Storage version ---
# v2 (dev-only): continuous → follow_up.
# v3: → automatically_update_lights; hide default on.
# v4: variables, themes, scene kind, membership, overrides. Native scenes dropped.
STORAGE_VERSION = 4

DEFAULT_DUSK_MINIMUM_SECONDS = 22 * 3600
DEFAULT_DAWN_MAXIMUM_SECONDS = 6 * 3600

DEFAULT_SETTINGS: dict[str, Any] = {
    # Positive seconds; also the light transition on automatic-update ticks.
    "automatically_update_lights_interval": 300,
    "automatic_updates_enabled": True,
    "respect_manual_changes": True,
    "always_follow_scene": [],
    "always_respect_manual_changes": [],
    # Seconds since midnight; delays dusk until this clock time when solar dusk is earlier.
    SETTINGS_DUSK_MINIMUM_TIME_OF_DAY: DEFAULT_DUSK_MINIMUM_SECONDS,
    "dusk_minimum_enabled": True,
    "dawn_maximum_time_of_day": DEFAULT_DAWN_MAXIMUM_SECONDS,
    "dawn_maximum_enabled": True,
}

# ---------------------------------------------------------------------------
# Seed helpers — called on first load (empty store) or auto-configure.
# ---------------------------------------------------------------------------

_DEFAULT_VARIABLE_NAMES: dict[str, str] = {
    "dawn": "Dawn",
    "sunrise": "Sunrise",
    "noon": "Noon",
    "sunset": "Sunset",
    "dusk": "Dusk",
}


def auto_configure_scene_name(themes: dict[str, dict[str, Any]] | None) -> str:
    """Name auto-configured scenes from the default theme, never the area."""
    theme = (themes or {}).get("default") or {}
    name = theme.get("name") if isinstance(theme, dict) else None
    if isinstance(name, str) and name.strip():
        return name.strip()
    return "Circadian"


def seed_variables() -> dict[str, dict[str, Any]]:
    """Create the five default color variables keyed by stable id."""
    result: dict[str, dict[str, Any]] = {}
    for event in SOLAR_EVENTS:
        var_id = f"default_{event}"
        brightness, kelvin = DEFAULT_VARIABLE_COLORS[event]
        result[var_id] = {
            "id": var_id,
            "name": _DEFAULT_VARIABLE_NAMES[event],
            "color": {
                "color_mode": "color_temp",
                "color_temp_kelvin": kelvin,
            },
            # Brightness lives on the variable so themes and lights that
            # reference it pick up both color and level. resolve_variable
            # returns the color dict plus brightness when present.
            "brightness": brightness,
        }
    return result


def seed_default_theme(
    variables: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Create the default circadian theme that references the seed variables."""
    theme_id = "default"
    events: dict[str, Any] = {}
    for event in SOLAR_EVENTS:
        var_id = f"default_{event}"
        var = variables.get(var_id)
        events[event] = {
            "color": {VARIABLE_REF: var_id},
            "brightness": (
                var["brightness"] if var else DEFAULT_VARIABLE_COLORS[event][0]
            ),
        }
    return {
        theme_id: {
            "id": theme_id,
            "name": "Default",
            "events": events,
        }
    }


# ---------------------------------------------------------------------------
# Time helpers (kept for dusk minimum, shared with the panel).
# ---------------------------------------------------------------------------


def time_to_seconds(value: Any) -> int:
    """Convert a time string or seconds value to seconds since midnight."""
    if value is None or value == "":
        return DEFAULT_DUSK_MINIMUM_SECONDS
    if isinstance(value, (int, float)):
        return int(value)
    parts = str(value).split(":")
    hours = int(parts[0])
    minutes = int(parts[1]) if len(parts) > 1 else 0
    seconds = int(parts[2]) if len(parts) > 2 else 0
    return hours * 3600 + minutes * 60 + seconds


def seconds_to_time(value: Any) -> str:
    """Convert seconds since midnight to HH:MM:SS."""
    if value is None or value == "":
        return "22:00:00"
    if isinstance(value, str) and ":" in value:
        parts = value.split(":")
        if len(parts) == 2:
            return f"{parts[0]}:{parts[1]}:00"
        return value
    seconds = int(value)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def strip_scene_dusk_minimum(scenes: dict[str, dict[str, Any]]) -> int | None:
    """Remove legacy per-scene dusk floors; return the first value found."""
    found = None
    for item in scenes.values():
        if not isinstance(item, dict) or SCENE_DUSK_MINIMUM_TIME_OF_DAY not in item:
            continue
        value = time_to_seconds(item.pop(SCENE_DUSK_MINIMUM_TIME_OF_DAY))
        if found is None:
            found = value
    return found


def dusk_minimum_seconds(
    hass: HomeAssistant, override: int | None = None
) -> int | None:
    """House-wide earliest dusk in seconds since midnight."""
    if override is not None:
        return int(override)
    domain_data = hass.data.get(DOMAIN) or {}
    store = domain_data.get(DATA_STORE)
    if store is None:
        return DEFAULT_DUSK_MINIMUM_SECONDS
    if not store.settings.get("dusk_minimum_enabled", True):
        return None
    return time_to_seconds(
        store.settings.get(
            SETTINGS_DUSK_MINIMUM_TIME_OF_DAY, DEFAULT_DUSK_MINIMUM_SECONDS
        )
    )


def dawn_maximum_seconds(hass: HomeAssistant) -> int | None:
    """House-wide latest dawn, preserving the saved time while disabled."""
    store = (hass.data.get(DOMAIN) or {}).get(DATA_STORE)
    settings = store.settings if store is not None else DEFAULT_SETTINGS
    if not settings.get("dawn_maximum_enabled", True):
        return None
    return time_to_seconds(
        settings.get("dawn_maximum_time_of_day", DEFAULT_DAWN_MAXIMUM_SECONDS)
    )


# ---------------------------------------------------------------------------
# Scene normalizers (v4).
# ---------------------------------------------------------------------------


def _optional_icon(raw: dict[str, Any]) -> str | None:
    """Keep a non-blank icon; drop empty strings so the entity default applies."""
    icon = raw.get("icon")
    if not isinstance(icon, str):
        return None
    icon = icon.strip()
    return icon or None


def _normalize_event_palettes(raw: Any) -> dict[str, dict[str, Any]]:
    """Keep event-local assignment and brightness without changing its preset."""
    if not isinstance(raw, dict):
        return {}
    result: dict[str, dict[str, Any]] = {}
    for event in SOLAR_EVENTS:
        entry = raw.get(event)
        if not isinstance(entry, dict):
            continue
        palette_id = entry.get("palette_id") or None
        if not palette_id and "brightness_adjustment" not in entry:
            continue
        result[event] = {}
        if palette_id:
            result[event].update(
                palette_id=palette_id,
                assignment_seed=int(entry.get("assignment_seed") or 0),
            )
        if "brightness_adjustment" in entry:
            result[event]["brightness_adjustment"] = dict(
                entry["brightness_adjustment"]
            )
    return result


def normalize_circadian_scene(
    raw: dict[str, Any],
    scene_id: str | None = None,
) -> dict[str, Any]:
    """Normalize input into a stored circadian scene config."""
    name = (raw.get(SCENE_NAME) or raw.get("name") or DEFAULT_SCENE_NAME).strip()
    if not name:
        raise ValueError("Scene name is required")

    labels = raw.get(LABELS) or []
    if isinstance(labels, str):
        labels = [labels] if labels else []

    automatically_update_lights = raw.get(AUTOMATICALLY_UPDATE_LIGHTS, True)
    if not isinstance(automatically_update_lights, bool):
        automatically_update_lights = bool(automatically_update_lights)

    membership = raw.get("membership") or {"exclude": [], "include": []}

    return {
        "id": scene_id or raw.get("id") or str(uuid.uuid4()),
        "kind": KIND_CIRCADIAN,
        SCENE_NAME: name,
        DESCRIPTION: (raw.get(DESCRIPTION) or "").strip() or None,
        LABELS: [str(label) for label in labels if label],
        CATEGORY: raw.get(CATEGORY) or None,
        AREA: raw.get(AREA) or None,
        "icon": _optional_icon(raw),
        "theme_id": raw.get("theme_id") or "default",
        "membership": {
            "exclude": list(membership.get("exclude") or []),
            "include": list(membership.get("include") or []),
        },
        "overrides": raw.get("overrides") or {},
        AUTOMATICALLY_UPDATE_LIGHTS: automatically_update_lights,
        # One palette per solar event. Not the theme, and not palette_id.
        "event_palettes": _normalize_event_palettes(raw.get("event_palettes")),
    }


def normalize_simple_scene(
    raw: dict[str, Any],
    scene_id: str | None = None,
) -> dict[str, Any]:
    """Normalize input into a stored simple scene config."""
    name = (raw.get(SCENE_NAME) or raw.get("name") or "").strip()
    if not name:
        raise ValueError("Scene name is required")

    labels = raw.get(LABELS) or []
    if isinstance(labels, str):
        labels = [labels] if labels else []

    membership = raw.get("membership") or {"exclude": [], "include": []}

    return {
        "id": scene_id or raw.get("id") or str(uuid.uuid4()),
        "kind": KIND_SIMPLE,
        SCENE_NAME: name,
        DESCRIPTION: (raw.get(DESCRIPTION) or "").strip() or None,
        LABELS: [str(label) for label in labels if label],
        CATEGORY: raw.get(CATEGORY) or None,
        AREA: raw.get(AREA) or None,
        "icon": _optional_icon(raw),
        "membership": {
            "exclude": list(membership.get("exclude") or []),
            "include": list(membership.get("include") or []),
        },
        "lights": raw.get("lights") or {},
        "palette_id": raw.get("palette_id") or None,
        "assignment_seed": int(raw.get("assignment_seed") or 0),
        "theme_id": raw.get("theme_id") or None,
    }


def normalize_scene(
    raw: dict[str, Any],
    scene_id: str | None = None,
) -> dict[str, Any]:
    """Route to the correct normalizer based on kind."""
    kind = raw.get("kind", KIND_CIRCADIAN)
    if kind == KIND_SIMPLE:
        return normalize_simple_scene(raw, scene_id)
    return normalize_circadian_scene(raw, scene_id)


# ---------------------------------------------------------------------------
# Legacy v3 helpers (kept for migration path only).
# ---------------------------------------------------------------------------

_PREF_ALIASES = ("continuous", "follow_up")
_INTERVAL_ALIASES = ("continuous_interval", "follow_up_interval")


def _migrate_preference_keys(item: dict[str, Any]) -> None:
    """Map legacy per-scene preference keys onto automatically_update_lights."""
    if AUTOMATICALLY_UPDATE_LIGHTS in item:
        for alias in _PREF_ALIASES:
            item.pop(alias, None)
        return
    for alias in _PREF_ALIASES:
        if alias in item:
            item[AUTOMATICALLY_UPDATE_LIGHTS] = bool(item.pop(alias))
            for leftover in _PREF_ALIASES:
                item.pop(leftover, None)
            return
    item[AUTOMATICALLY_UPDATE_LIGHTS] = True


def _migrate_interval_settings(settings: dict[str, Any]) -> None:
    """Keep the legacy off preference while restoring a usable positive interval."""
    if "automatically_update_lights_interval" not in settings:
        for alias in _INTERVAL_ALIASES:
            if alias in settings:
                settings["automatically_update_lights_interval"] = settings[alias]
                break
    for alias in _INTERVAL_ALIASES:
        settings.pop(alias, None)
    if settings.get("automatically_update_lights_interval") == 0:
        settings["automatic_updates_enabled"] = False
        settings["automatically_update_lights_interval"] = DEFAULT_SETTINGS[
            "automatically_update_lights_interval"
        ]


def _migrate_v3_to_v4(data: dict[str, Any]) -> dict[str, Any]:
    """Migrate a v3 store document to v4 shape (in-memory only).

    The real native-scene inlining happens at runtime in the migrator step
    (needs hass to load scenes.yaml). This structural migration:
    - Seeds variables + default theme if absent.
    - Adds kind=circadian and empty membership/overrides to old scene items.
    - Keeps managed_native_scene_ids until managed YAML cleanup is durable.
    - Drops hide_managed_native_scenes.
    - Keeps legacy scene_dawn…scene_dusk keys so the runtime migrator can
      look up native scenes before removing them.
    """
    variables = data.get("variables") or {}
    themes = data.get("themes") or {}
    if not variables:
        variables = seed_variables()
    if not themes:
        themes = seed_default_theme(variables)

    scenes = list(data.get("scenes") or [])
    for item in scenes:
        if isinstance(item, dict):
            _migrate_preference_keys(item)
            if "kind" not in item:
                item["kind"] = KIND_CIRCADIAN
            if "membership" not in item:
                item["membership"] = {"exclude": [], "include": []}
            if "overrides" not in item:
                item["overrides"] = {}
            if "theme_id" not in item:
                item["theme_id"] = "default"

    settings = dict(data.get("settings") or {})
    _migrate_interval_settings(settings)
    # Drop v3-only settings.
    settings.pop("hide_managed_native_scenes", None)

    return {
        "variables": variables,
        "themes": themes,
        "scenes": scenes,
        "settings": settings,
        "managed_native_scene_ids": list(data.get("managed_native_scene_ids") or []),
    }


def _migrate_store(old_version: int, data: dict[str, Any]) -> dict[str, Any]:
    """Migrate persisted store payloads between STORAGE_VERSION values."""
    if data is None:
        # Colors only. The Default circadian preset is a starter the user
        # adds, or that Auto configure adds. A v3 upgrade still seeds it,
        # because those scenes already point at theme id "default".
        return {
            "variables": seed_variables(),
            "themes": {},
            "scenes": [],
            "settings": deepcopy(DEFAULT_SETTINGS),
        }
    # v1/v2/v3 → v4: structural migration.
    if old_version < 4:
        # Apply v3 preference migrations first.
        scenes = list(data.get("scenes") or [])
        for item in scenes:
            if isinstance(item, dict):
                _migrate_preference_keys(item)
        settings = dict(data.get("settings") or {})
        _migrate_interval_settings(settings)
        data = {
            **data,
            "scenes": scenes,
            "settings": settings,
        }
        data = _migrate_v3_to_v4(data)
    return data


# Legacy normalizer kept so existing callers that import it do not break
# during the transition.  Will be removed once all v3 consumers are gone.
def normalize_scene_config(
    raw: dict[str, Any], scene_id: str | None = None
) -> dict[str, Any]:
    """Normalize UI/legacy input into a stored scene config (v3 compat shim)."""
    # If the input has a "kind" key it is v4; route to the new normalizer.
    if "kind" in raw:
        return normalize_scene(raw, scene_id)
    # Otherwise treat as a legacy v3 circadian config and wrap.
    combined = bool(raw.get(DISPLAY_SCENES_COMBINED, False))
    name = (raw.get(SCENE_NAME) or DEFAULT_SCENE_NAME).strip()
    if not name:
        raise ValueError("Scene name is required")

    labels = raw.get(LABELS) or []
    if isinstance(labels, str):
        labels = [labels] if labels else []
    automatically_update_lights = raw.get(AUTOMATICALLY_UPDATE_LIGHTS, True)
    if not isinstance(automatically_update_lights, bool):
        automatically_update_lights = bool(automatically_update_lights)

    item: dict[str, Any] = {
        "id": scene_id or raw.get("id") or str(uuid.uuid4()),
        "kind": KIND_CIRCADIAN,
        SCENE_NAME: name,
        DESCRIPTION: (raw.get(DESCRIPTION) or "").strip() or None,
        LABELS: [str(label) for label in labels if label],
        CATEGORY: raw.get(CATEGORY) or None,
        AREA: raw.get(AREA) or None,
        DISPLAY_SCENES_COMBINED: combined,
        AUTOMATICALLY_UPDATE_LIGHTS: automatically_update_lights,
        "theme_id": raw.get("theme_id") or "default",
        "membership": raw.get("membership") or {"exclude": [], "include": []},
        "overrides": raw.get("overrides") or {},
    }

    if combined:
        shared = raw.get(SCENE_DAWN_SUNRISE_SUNSET) or raw.get(SCENE_DAWN)
        item[SCENE_DAWN] = shared
        item[SCENE_SUNRISE] = shared
        item[SCENE_SUNSET] = shared
        item[SCENE_NOON] = raw.get(SCENE_NOON)
        item[SCENE_DUSK] = raw.get(SCENE_DUSK)
    else:
        for key in SCENE_KEYS:
            item[key] = raw.get(key)

    missing = [key for key in SCENE_KEYS if not item.get(key)]
    if missing:
        raise ValueError(f"Missing required scenes: {', '.join(missing)}")

    return item


def legacy_entry_to_config(
    entry_data: dict[str, Any], options: dict[str, Any]
) -> dict[str, Any]:
    """Convert an old per-room config entry into a store item."""
    merged = {**entry_data, **options}
    return normalize_scene_config(
        {
            **merged,
            DISPLAY_SCENES_COMBINED: merged.get(SCENE_DAWN)
            and merged.get(SCENE_DAWN)
            == merged.get(SCENE_SUNRISE)
            == merged.get(SCENE_SUNSET),
        },
        scene_id=merged.get("unique_id"),
    )


def to_form_data(item: dict[str, Any]) -> dict[str, Any]:
    """Shape a stored item for the panel form.

    Works for both v3-compat and v4 scenes.
    """
    kind = item.get("kind", KIND_CIRCADIAN)
    data: dict[str, Any] = {
        "id": item.get("id"),
        "kind": kind,
        SCENE_NAME: item.get(SCENE_NAME),
        DESCRIPTION: item.get(DESCRIPTION) or "",
        LABELS: list(item.get(LABELS) or []),
        CATEGORY: item.get(CATEGORY),
        AREA: item.get(AREA),
        "icon": item.get("icon") or "",
        "membership": item.get("membership") or {"exclude": [], "include": []},
    }
    if kind == KIND_CIRCADIAN:
        data["theme_id"] = item.get("theme_id") or "default"
        data["overrides"] = item.get("overrides") or {}
        data["event_palettes"] = _normalize_event_palettes(item.get("event_palettes"))
        data[AUTOMATICALLY_UPDATE_LIGHTS] = bool(
            item.get(AUTOMATICALLY_UPDATE_LIGHTS, True)
        )
    elif kind == KIND_SIMPLE:
        data["lights"] = item.get("lights") or {}
        data["palette_id"] = item.get("palette_id") or None
        data["assignment_seed"] = int(item.get("assignment_seed") or 0)
        data["theme_id"] = item.get("theme_id") or None
    return data


def normalize_variable(raw: dict[str, Any], var_id: str) -> dict[str, Any]:
    """Validate and shape one shared color or palette library item."""
    validate_variable_input(raw)
    kind = raw.get("kind") or ("palette" if raw.get("slots") else "color")
    name = (raw.get("name") or "").strip()
    if not name:
        raise ValueError("Variable name is required")
    if kind == "palette":
        var = {
            "id": var_id,
            "name": name,
            "kind": KIND_PALETTE,
            "slots": normalize_palette_slots(raw.get("slots")),
        }
        builtin_id = optional_builtin_id(raw)
        if builtin_id:
            var["builtin_id"] = builtin_id
        return var
    color = raw.get("color")
    if not color or not isinstance(color, dict):
        raise ValueError("Variable must have a color dict")
    return {
        "id": var_id,
        "name": name,
        "kind": "color",
        "color": color,
        "brightness": raw.get("brightness", 255),
    }


def normalize_theme(raw: dict[str, Any], theme_id: str) -> dict[str, Any]:
    """Validate and shape one shared circadian theme."""
    validate_theme_input(raw)
    name = (raw.get("name") or "").strip()
    if not name:
        raise ValueError("Theme name is required")
    events = raw.get("events")
    if not events or not isinstance(events, dict):
        raise ValueError("Theme must have an events dict")
    missing = [event for event in SOLAR_EVENTS if event not in events]
    if missing:
        raise ValueError(f"Theme is missing events: {', '.join(missing)}")
    for event in SOLAR_EVENTS:
        value = events[event]
        if not isinstance(value, dict) or not isinstance(value.get("color"), dict):
            raise ValueError(f"Theme event {event!r} must have a color dict")
        brightness = value.get("brightness")
        if (
            not isinstance(brightness, (int, float))
            or isinstance(brightness, bool)
            or not 0 <= brightness <= 255
        ):
            raise ValueError(
                f"Theme event {event!r} brightness must be a number from 0 to 255"
            )
    theme = {"id": theme_id, "name": name, "events": events}
    builtin_id = optional_builtin_id(raw)
    if builtin_id:
        theme["builtin_id"] = builtin_id
    return theme


# ---------------------------------------------------------------------------
# Store class
# ---------------------------------------------------------------------------


class _ScenesStore(Store):
    """HA Store that migrates scene_studio.scenes between major versions."""

    async def _async_write_data(self, data: dict) -> None:
        """Let transaction callers observe failures that HA otherwise only logs."""
        try:
            await super()._async_write_data(data)
        except (SerializationError, WriteError) as err:
            # Store._async_handle_write_data suppresses these two types. Convert
            # at the write boundary so rollback/notifications await durability.
            raise HomeAssistantError("Could not persist Scene Studio data") from err

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Migrate stored JSON when STORAGE_VERSION advances."""
        return _migrate_store(old_major_version, old_data)


class SceneStudioStore:  # pylint: disable=too-many-public-methods
    """Load and persist circadian scene configs, variables, and themes."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the store."""
        self.hass = hass
        self._store = _ScenesStore(hass, STORAGE_VERSION, STORE_KEY, atomic_writes=True)
        self._legacy_stores = [
            _ScenesStore(hass, STORAGE_VERSION, key) for key in LEGACY_STORE_KEYS
        ]
        self.variables: dict[str, dict[str, Any]] = {}
        self.themes: dict[str, dict[str, Any]] = {}
        self.scenes: dict[str, dict[str, Any]] = {}
        self.area_names: dict[str, str] = {}
        self.settings: dict[str, Any] = deepcopy(DEFAULT_SETTINGS)
        # Legacy — only populated during v3→v4 migration.
        self.managed_native_scene_ids: list[str] = []
        self.pending_hide_sync = False
        self._mutation_lock = asyncio.Lock()

    async def async_load(self) -> None:
        """Load from disk (migrate from an older domain's store once)."""
        data = await self._store.async_load()
        if not data:
            for legacy_store, legacy_key in zip(self._legacy_stores, LEGACY_STORE_KEYS):
                legacy = await legacy_store.async_load()
                if not legacy:
                    continue
                _LOGGER.info(
                    "Migrating store from %s to %s",
                    legacy_key,
                    STORE_KEY,
                )
                data = legacy
                await self._store.async_save(legacy)
                break
        raw = data or {}

        # --- Variables ---
        vars_raw = raw.get("variables") or {}
        if not vars_raw:
            vars_raw = seed_variables()
        if isinstance(vars_raw, list):
            vars_raw = {v["id"]: v for v in vars_raw if "id" in v}
        self.variables = vars_raw

        # --- Themes ---
        # An empty library stays empty. Default is added by Auto configure
        # or by adopting the starter preset, not by opening the integration.
        themes_raw = raw.get("themes") or {}
        if isinstance(themes_raw, list):
            themes_raw = {t["id"]: t for t in themes_raw if "id" in t}
        self.themes = themes_raw

        # --- Scenes ---
        items = raw.get("scenes", [])
        self.scenes = {}
        for item in items:
            if not isinstance(item, dict) or "id" not in item:
                continue
            if "kind" not in item:
                item["kind"] = KIND_CIRCADIAN
            if (
                AUTOMATICALLY_UPDATE_LIGHTS not in item
                and item["kind"] == KIND_CIRCADIAN
            ):
                item[AUTOMATICALLY_UPDATE_LIGHTS] = True
            for alias in ("continuous", "follow_up"):
                item.pop(alias, None)
            self.scenes[item["id"]] = item
        self.area_names = {
            area_id: name
            for area_id, name in (raw.get("area_names") or {}).items()
            if isinstance(area_id, str) and isinstance(name, str) and name.strip()
        }

        # --- Settings ---
        raw_settings = dict(raw.get("settings") or {})
        _migrate_interval_settings(raw_settings)
        lifted = strip_scene_dusk_minimum(self.scenes)
        if SETTINGS_DUSK_MINIMUM_TIME_OF_DAY not in raw_settings and lifted is not None:
            raw_settings[SETTINGS_DUSK_MINIMUM_TIME_OF_DAY] = lifted
        settings = {
            **DEFAULT_SETTINGS,
            **raw_settings,
        }
        for alias in ("continuous_interval", "follow_up_interval"):
            settings.pop(alias, None)
        settings.pop("hide_managed_native_scenes", None)
        settings[SETTINGS_DUSK_MINIMUM_TIME_OF_DAY] = time_to_seconds(
            settings.get(SETTINGS_DUSK_MINIMUM_TIME_OF_DAY)
        )
        self.settings = settings

        # Legacy migration data (only present during v3→v4 transition).
        ids = raw.get("managed_native_scene_ids") or []
        self.managed_native_scene_ids = [str(item) for item in ids if item]

    async def async_save(self) -> None:
        """Write the full store to disk."""
        payload: dict[str, Any] = {
            "variables": self.variables,
            "themes": self.themes,
            "scenes": list(self.scenes.values()),
            "area_names": dict(self.area_names),
            "settings": dict(self.settings),
        }
        # Keep managed ids during migration transition; drop when empty.
        if self.managed_native_scene_ids:
            payload["managed_native_scene_ids"] = list(self.managed_native_scene_ids)
        await self._store.async_save(payload)

    async def _async_mutate(
        self, change: Callable[[], _Result], *, skip_if_unchanged: bool = False
    ) -> _Result:
        """Serialize a complete in-memory change and restore it if saving fails."""
        async with self._mutation_lock:
            previous = (
                deepcopy(self.scenes),
                deepcopy(self.area_names),
                deepcopy(self.variables),
                deepcopy(self.themes),
                deepcopy(self.settings),
                list(self.managed_native_scene_ids),
                self.pending_hide_sync,
            )
            try:
                result = change()
                if (
                    not skip_if_unchanged
                    or (
                        self.scenes,
                        self.area_names,
                        self.variables,
                        self.themes,
                        self.settings,
                        self.managed_native_scene_ids,
                        self.pending_hide_sync,
                    )
                    != previous
                ):
                    await self.async_save()
            except Exception:
                (
                    self.scenes,
                    self.area_names,
                    self.variables,
                    self.themes,
                    self.settings,
                    self.managed_native_scene_ids,
                    self.pending_hide_sync,
                ) = previous
                raise
            return result

    # --- Variable CRUD ---

    def list_variables(self) -> list[dict[str, Any]]:
        """Return all variables."""
        return list(self.variables.values())

    def get_variable(self, var_id: str) -> dict[str, Any] | None:
        """Return one variable."""
        return self.variables.get(var_id)

    async def async_upsert_variable(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Create or update a color variable."""
        var_id = raw.get("id") or str(uuid.uuid4())
        var = normalize_variable(raw, var_id)

        def change() -> dict[str, Any]:
            self.variables[var_id] = var
            return var

        return await self._async_mutate(change)

    async def async_rebase_variable(
        self, raw: dict[str, Any], base: dict[str, Any], base_revision: str
    ) -> dict[str, Any]:
        """Merge a variable update under the same lock as persistence."""
        var_id = raw.get("id")
        if not var_id or revision_for(base) != base_revision:
            raise ValueError("Variable base snapshot and revision do not match")

        def change() -> dict[str, Any]:
            current = self.variables.get(var_id)
            if current is None:
                raise ItemDeleted("Variable was deleted")
            merged, conflicts = merge_fields(base, raw, current)
            if conflicts:
                raise RevisionConflict(conflicts, current, revision_for(current))
            if merged.get("id") != var_id:
                raise ValueError("Variable ID cannot change")
            item = normalize_variable(merged, var_id)
            self.variables[var_id] = item
            return item

        return await self._async_mutate(change, skip_if_unchanged=True)

    async def async_delete_variable(self, var_id: str) -> bool:
        """Delete a variable.  Raises if still referenced by themes or scenes."""
        if var_id not in self.variables:
            return False
        name = self.variables[var_id].get("name") or var_id

        def still_used(where: str) -> None:
            raise HomeAssistantError(f"{name} is still referenced by {where}")

        for other in self.variables.values():
            if other.get("id") == var_id:
                continue
            for slot in other.get("slots") or []:
                if isinstance(slot, dict) and slot.get(VARIABLE_REF) == var_id:
                    still_used(f"palette {other.get('name', other.get('id'))}")
        # Check theme refs.
        for theme in self.themes.values():
            for ev in (theme.get("events") or {}).values():
                if isinstance(ev, dict):
                    color = ev.get("color") or {}
                    if color.get(VARIABLE_REF) == var_id:
                        still_used(f"theme {theme.get('name', theme['id'])}")
        # Check scene light refs.
        for sc in self.scenes.values():
            scene_name = sc.get(SCENE_NAME, sc["id"])
            if sc.get("palette_id") == var_id:
                still_used(f"scene {scene_name}")
            for entry in (sc.get("event_palettes") or {}).values():
                if isinstance(entry, dict) and entry.get("palette_id") == var_id:
                    still_used(f"scene {scene_name}")
            if sc.get("kind") == KIND_SIMPLE:
                for light in (sc.get("lights") or {}).values():
                    color = light.get("color") if isinstance(light, dict) else None
                    if isinstance(light, dict) and (
                        light.get(VARIABLE_REF) == var_id
                        or (
                            isinstance(color, dict)
                            and color.get(VARIABLE_REF) == var_id
                        )
                    ):
                        still_used(f"scene {scene_name}")
            elif sc.get("kind") == KIND_CIRCADIAN:
                for light_overrides in (sc.get("overrides") or {}).values():
                    for override in (
                        light_overrides.values()
                        if isinstance(light_overrides, dict)
                        else ()
                    ):
                        color = (
                            override.get("color")
                            if isinstance(override, dict)
                            else None
                        )
                        if isinstance(override, dict) and (
                            override.get(VARIABLE_REF) == var_id
                            or (
                                isinstance(color, dict)
                                and color.get(VARIABLE_REF) == var_id
                            )
                        ):
                            still_used(f"scene {scene_name}")
        return await self._async_mutate(
            lambda: self.variables.pop(var_id, None) is not None
        )

    # --- Theme CRUD ---

    def list_themes(self) -> list[dict[str, Any]]:
        """Return all themes."""
        return list(self.themes.values())

    def get_theme(self, theme_id: str) -> dict[str, Any] | None:
        """Return one theme."""
        return self.themes.get(theme_id)

    async def async_ensure_default_theme(self) -> dict[str, Any]:
        """Return the Default circadian preset, creating it when missing.

        Restores any of the five seed colors that were deleted, because the
        preset references them. An existing theme with id ``default`` is
        left as the user saved it.
        """

        def change() -> dict[str, Any]:
            for var_id, var in seed_variables().items():
                self.variables.setdefault(var_id, var)
            theme = self.themes.get("default")
            if theme is None:
                theme = seed_default_theme(self.variables)["default"]
                theme["builtin_id"] = "default"
                self.themes["default"] = theme
            return theme

        return await self._async_mutate(change, skip_if_unchanged=True)

    async def async_auto_configure(
        self, areas: list[tuple[str, str]]
    ) -> tuple[list[dict[str, Any]], list[str], bool]:
        """Create the starter theme and all area scenes in one durable write."""

        def change() -> tuple[list[dict[str, Any]], list[str], bool]:
            if self.scenes:
                raise HomeAssistantError("Auto configure requires an empty scene store")
            created_variables = []
            for var_id, var in seed_variables().items():
                if var_id not in self.variables:
                    self.variables[var_id] = var
                    created_variables.append(var_id)
            created_theme = "default" not in self.themes
            if created_theme:
                theme = seed_default_theme(self.variables)["default"]
                theme["builtin_id"] = "default"
                self.themes["default"] = theme
            items = []
            for area_id, area_name in areas:
                item = normalize_scene(
                    {
                        "kind": KIND_CIRCADIAN,
                        SCENE_NAME: auto_configure_scene_name(self.themes),
                        AREA: area_id,
                        "theme_id": "default",
                    }
                )
                self.scenes[item["id"]] = item
                self.area_names[area_id] = area_name
                items.append(item)
            return items, created_variables, created_theme

        return await self._async_mutate(change)

    async def async_compensate_auto_configure(
        self, scene_ids: list[str], variable_ids: list[str], created_theme: bool
    ) -> None:
        """Restore the previous empty state if entity registration fails."""

        def change() -> None:
            for scene_id in scene_ids:
                item = self.scenes.pop(scene_id, None)
                if item:
                    self.area_names.pop(item.get(AREA), None)
            for variable_id in variable_ids:
                self.variables.pop(variable_id, None)
            if created_theme:
                self.themes.pop("default", None)

        await self._async_mutate(change)

    async def async_upsert_theme(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Create or update a circadian theme."""
        theme_id = raw.get("id") or str(uuid.uuid4())
        theme = normalize_theme(raw, theme_id)

        def change() -> dict[str, Any]:
            self.themes[theme_id] = theme
            return theme

        return await self._async_mutate(change)

    async def async_rebase_theme(
        self, raw: dict[str, Any], base: dict[str, Any], base_revision: str
    ) -> dict[str, Any]:
        """Merge a theme update under the same lock as persistence."""
        theme_id = raw.get("id")
        if not theme_id or revision_for(base) != base_revision:
            raise ValueError("Theme base snapshot and revision do not match")

        def change() -> dict[str, Any]:
            current = self.themes.get(theme_id)
            if current is None:
                raise ItemDeleted("Theme was deleted")
            merged, conflicts = merge_fields(base, raw, current)
            if conflicts:
                raise RevisionConflict(conflicts, current, revision_for(current))
            if merged.get("id") != theme_id:
                raise ValueError("Theme ID cannot change")
            item = normalize_theme(merged, theme_id)
            self.themes[theme_id] = item
            return item

        return await self._async_mutate(change, skip_if_unchanged=True)

    async def async_delete_theme(self, theme_id: str) -> bool:
        """Delete a theme.  Raises if still referenced by circadian scenes."""
        if theme_id not in self.themes:
            return False
        for sc in self.scenes.values():
            if sc.get("kind") == KIND_CIRCADIAN and sc.get("theme_id") == theme_id:
                raise HomeAssistantError(
                    f"Theme {theme_id!r} is still referenced by "
                    f"scene {sc.get(SCENE_NAME, sc['id'])!r}"
                )
        return await self._async_mutate(
            lambda: self.themes.pop(theme_id, None) is not None
        )

    # --- Scene CRUD ---

    def list(self) -> list[dict[str, Any]]:
        """Return all scene configs."""
        return list(self.scenes.values())

    async def async_remember_area_names(self, names: dict[str, str]) -> None:
        """Retain the last known names of areas that own saved scenes."""

        def change() -> None:
            used = {item.get(AREA) for item in self.scenes.values()}
            for area_id in used:
                if area_id in names and names[area_id].strip():
                    self.area_names[area_id] = names[area_id]

        await self._async_mutate(change, skip_if_unchanged=True)

    async def async_move_area(
        self, old_area_id: str, target_area_id: str
    ) -> list[dict[str, Any]]:
        """Move every scene together; target membership comes from its area."""

        def change() -> list[dict[str, Any]]:
            moved = []
            for scene_id, item in self.scenes.items():
                if item.get(AREA) != old_area_id:
                    continue
                next_item = deepcopy(item)
                next_item[AREA] = target_area_id
                next_item["membership"] = {"exclude": [], "include": []}
                self.scenes[scene_id] = next_item
                moved.append(next_item)
            self.area_names.pop(old_area_id, None)
            return moved

        return await self._async_mutate(change)

    async def async_delete_area(self, area_id: str) -> list[dict[str, Any]]:
        """Delete all scenes in a removed area and forget its name together."""

        def change() -> list[dict[str, Any]]:
            removed = [
                item for item in self.scenes.values() if item.get(AREA) == area_id
            ]
            for item in removed:
                self.scenes.pop(item["id"])
            self.area_names.pop(area_id, None)
            return removed

        return await self._async_mutate(change)

    async def async_restore_area(
        self, scenes: list[dict[str, Any]], area_id: str, area_name: str | None
    ) -> None:
        """Compensate a failed HA entity update after an area batch write."""

        def change() -> None:
            for item in scenes:
                self.scenes[item["id"]] = deepcopy(item)
            if area_name:
                self.area_names[area_id] = area_name

        await self._async_mutate(change)

    def get(self, scene_id: str) -> dict[str, Any] | None:
        """Return one scene config."""
        return self.scenes.get(scene_id)

    async def async_upsert(
        self, raw: dict[str, Any], area_name: str | None = None
    ) -> dict[str, Any]:
        """Create or update a scene config."""
        scene_id = raw.get("id")
        # Preserve play/pause preference when editor omits it.
        if (
            scene_id
            and scene_id in self.scenes
            and AUTOMATICALLY_UPDATE_LIGHTS not in raw
            and raw.get("kind", KIND_CIRCADIAN) == KIND_CIRCADIAN
        ):
            raw = {
                **raw,
                AUTOMATICALLY_UPDATE_LIGHTS: self.scenes[scene_id].get(
                    AUTOMATICALLY_UPDATE_LIGHTS, True
                ),
            }
        item = normalize_scene(raw, scene_id=scene_id)

        def change() -> dict[str, Any]:
            self.scenes[item["id"]] = item
            if area_name and item.get(AREA):
                self.area_names[item[AREA]] = area_name
            return item

        return await self._async_mutate(change)

    async def async_rebase_scene(
        self,
        raw: dict[str, Any],
        base: dict[str, Any],
        base_revision: str,
        form_of: Callable[[dict[str, Any]], dict[str, Any]],
        area_name: str | None = None,
    ) -> dict[str, Any]:
        """Validate and merge a scene update inside the persistence lock."""
        scene_id = raw.get("id")
        if not scene_id or not isinstance(base, dict):
            raise ValueError("A saved scene and base snapshot are required")
        if revision_for(base) != base_revision:
            raise ValueError("Base snapshot and revision do not match")

        def change() -> dict[str, Any]:
            current = self.scenes.get(scene_id)
            if current is None:
                raise ItemDeleted("Scene was deleted")
            current_form = form_of(current)
            current_revision = revision_for(current_form)
            merged, conflicts = merge_fields(base, raw, current_form)
            if conflicts:
                raise RevisionConflict(conflicts, current_form, current_revision)
            if merged.get("id") != scene_id:
                raise ValueError("Scene ID cannot change")
            validate_scene_input(merged)
            item = normalize_scene(merged, scene_id=scene_id)
            self.scenes[scene_id] = item
            if area_name and item.get(AREA):
                self.area_names[item[AREA]] = area_name
            return item

        return await self._async_mutate(change, skip_if_unchanged=True)

    async def async_set_automatically_update_lights(
        self, scene_id: str, automatically_update_lights: bool
    ) -> dict[str, Any] | None:
        """Toggle per-scene automatic light-update preference."""
        if scene_id not in self.scenes:
            return None

        def change() -> dict[str, Any]:
            item = self.scenes[scene_id]
            item[AUTOMATICALLY_UPDATE_LIGHTS] = bool(automatically_update_lights)
            return item

        return await self._async_mutate(change)

    async def async_set_scene_updates(
        self, scene_ids: list[str], enabled: bool
    ) -> list[dict]:
        """Validate every target and durably change the complete preference batch."""
        if not isinstance(enabled, bool):
            raise HomeAssistantError("enabled must be a boolean")

        def change():
            items = [deepcopy(self.scenes.get(scene_id)) for scene_id in scene_ids]
            if any(
                item is None or item.get("kind", "circadian") != "circadian"
                for item in items
            ):
                raise HomeAssistantError(
                    "Automatic updates require circadian Scene Studio scenes"
                )
            for item in items:
                item[AUTOMATICALLY_UPDATE_LIGHTS] = enabled
                self.scenes[item["id"]] = item
            return items

        return await self._async_mutate(change)

    async def async_reset_to_fresh(self) -> None:
        """Replace scenes, library, and settings with a fresh install.

        The config entry stays. Managed YAML ids remain until cleanup is
        confirmed, so a failed cleanup can be retried after restart.
        """

        def change() -> None:
            self.scenes = {}
            self.area_names = {}
            self.variables = seed_variables()
            self.themes = {}
            self.settings = deepcopy(DEFAULT_SETTINGS)
            # Keep cleanup metadata until managed YAML deletion succeeds.
            self.pending_hide_sync = False

        await self._async_mutate(change)

    async def async_delete(self, scene_id: str) -> bool:
        """Delete a scene config."""
        if scene_id not in self.scenes:
            return False
        return await self._async_mutate(
            lambda: self.scenes.pop(scene_id, None) is not None
        )

    async def async_update_settings(self, patch: dict[str, Any]) -> dict[str, Any]:
        """Merge integration-wide settings and persist."""
        validated = {}
        for key, value in patch.items():
            if key not in DEFAULT_SETTINGS:
                raise HomeAssistantError(f"Unknown setting {key!r}")
            if key == "automatically_update_lights_interval":
                if isinstance(value, bool) or not isinstance(value, int):
                    raise HomeAssistantError(
                        "automatically_update_lights_interval must be an integer"
                    )
                if value <= 0 or value > 30 * 60:
                    raise HomeAssistantError(
                        "automatically_update_lights_interval must be 1–1800 seconds"
                    )
            if key in (
                "dusk_minimum_enabled",
                "dawn_maximum_enabled",
                "automatic_updates_enabled",
                "respect_manual_changes",
            ):
                if not isinstance(value, bool):
                    raise HomeAssistantError(f"{key} must be a boolean")
            if key in (SETTINGS_DUSK_MINIMUM_TIME_OF_DAY, "dawn_maximum_time_of_day"):
                if isinstance(value, bool) or (not isinstance(value, (str, int))):
                    raise HomeAssistantError(f"{key} must be a time or whole seconds")
                try:
                    value = time_to_seconds(value)
                except (TypeError, ValueError) as err:
                    raise HomeAssistantError(
                        f"{key} must be a time or seconds since midnight"
                    ) from err
                if value < 0 or value > 24 * 3600:
                    raise HomeAssistantError(f"{key} must be 0–86400 seconds")
            if key in ("always_follow_scene", "always_respect_manual_changes"):
                if not isinstance(value, list) or any(
                    not isinstance(eid, str)
                    or not eid.startswith("light.")
                    or len(eid) <= 6
                    for eid in value
                ):
                    raise HomeAssistantError(
                        f"{key} must be a list of light entity IDs"
                    )
                if len(set(value)) != len(value):
                    raise HomeAssistantError(f"{key} contains duplicate lights")
                value = list(value)
            validated[key] = value

        def change() -> dict[str, Any]:
            settings = {**self.settings, **validated}
            if set(settings.get("always_follow_scene", [])) & set(
                settings.get("always_respect_manual_changes", [])
            ):
                raise HomeAssistantError(
                    "A light cannot always follow and always respect manual changes"
                )
            self.settings.update(validated)
            return dict(self.settings)

        return await self._async_mutate(change)

    # --- Legacy helpers (migration only, will be removed) ---

    async def async_register_managed_native_scene(self, config_id: str) -> None:
        """Remember a YAML scene id this integration created."""
        cid = str(config_id)
        if cid in self.managed_native_scene_ids:
            return
        await self._async_mutate(lambda: self.managed_native_scene_ids.append(cid))

    async def async_unregister_managed_native_scene(self, config_id: str) -> None:
        """Drop a managed YAML scene id after delete."""
        cid = str(config_id)
        if cid not in self.managed_native_scene_ids:
            return
        await self._async_mutate(
            lambda: setattr(
                self,
                "managed_native_scene_ids",
                [item for item in self.managed_native_scene_ids if item != cid],
            )
        )

    async def async_import_legacy(
        self, entry_data: dict[str, Any], options: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Import a legacy config entry if it is not already stored."""
        if SCENE_NAME not in entry_data and SCENE_DAWN not in entry_data:
            return None
        try:
            item = legacy_entry_to_config(entry_data, options)
        except (ValueError, TypeError):
            _LOGGER.exception("Could not migrate legacy %s entry", DOMAIN)
            return None
        if item["id"] not in self.scenes:
            await self._async_mutate(lambda: self.scenes.__setitem__(item["id"], item))
        return item
