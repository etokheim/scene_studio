"""Persistent store for circadian scene configurations (v4 schema).

v4 adds house-wide variables, circadian themes, scene kind
(circadian / simple), area-based membership, and per-light overrides.
Native HA YAML scenes are no longer the source of truth.
"""

from __future__ import annotations

import logging
import uuid
from copy import deepcopy
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.storage import Store

from .const import (
    AREA,
    AUTOMATICALLY_UPDATE_LIGHTS,
    CATEGORY,
    DEFAULT_SCENE_NAME,
    DEFAULT_VARIABLE_COLORS,
    DESCRIPTION,
    DISPLAY_SCENES_COMBINED,
    DOMAIN,
    KIND_CIRCADIAN,
    KIND_SIMPLE,
    LABELS,
    LEGACY_STORE_KEY,
    SCENE_DAWN,
    SCENE_DAWN_SUNRISE_SUNSET,
    SCENE_DUSK,
    DATA_STORE,
    SCENE_DUSK_MINIMUM_TIME_OF_DAY,
    SCENE_KEYS,
    SETTINGS_DUSK_MINIMUM_TIME_OF_DAY,
    SCENE_NAME,
    SCENE_NOON,
    SCENE_SUNRISE,
    SCENE_SUNSET,
    SOLAR_EVENTS,
    STORE_KEY,
    VARIABLE_REF,
)

_LOGGER = logging.getLogger(__name__)

# --- Storage version ---
# v2 (dev-only): continuous → follow_up.
# v3: → automatically_update_lights; hide default on.
# v4: variables, themes, scene kind, membership, overrides. Native scenes dropped.
STORAGE_VERSION = 4

DEFAULT_DUSK_MINIMUM_SECONDS = 22 * 3600

DEFAULT_SETTINGS: dict[str, Any] = {
    # Seconds; 0 disables. Same value is the light transition on auto-update ticks.
    "automatically_update_lights_interval": 300,
    # Seconds since midnight; delays dusk until this clock time when solar dusk is earlier.
    SETTINGS_DUSK_MINIMUM_TIME_OF_DAY: DEFAULT_DUSK_MINIMUM_SECONDS,
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
            # Brightness lives on the variable so the default theme can
            # reference it fully.  resolve_variable returns the color dict;
            # brightness is read separately by theme-event resolution.
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


def dusk_minimum_seconds(hass: HomeAssistant, override: int | None = None) -> int:
    """House-wide earliest dusk in seconds since midnight."""
    if override is not None:
        return int(override)
    domain_data = hass.data.get(DOMAIN) or {}
    store = domain_data.get(DATA_STORE)
    if store is None:
        return DEFAULT_DUSK_MINIMUM_SECONDS
    return time_to_seconds(
        store.settings.get(
            SETTINGS_DUSK_MINIMUM_TIME_OF_DAY, DEFAULT_DUSK_MINIMUM_SECONDS
        )
    )


# ---------------------------------------------------------------------------
# Scene normalizers (v4).
# ---------------------------------------------------------------------------


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
        "theme_id": raw.get("theme_id") or "default",
        "membership": {
            "exclude": list(membership.get("exclude") or []),
            "include": list(membership.get("include") or []),
        },
        "overrides": raw.get("overrides") or {},
        AUTOMATICALLY_UPDATE_LIGHTS: automatically_update_lights,
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
        "membership": {
            "exclude": list(membership.get("exclude") or []),
            "include": list(membership.get("include") or []),
        },
        "lights": raw.get("lights") or {},
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
    """Map legacy interval keys onto automatically_update_lights_interval."""
    if "automatically_update_lights_interval" in settings:
        for alias in _INTERVAL_ALIASES:
            settings.pop(alias, None)
        return
    for alias in _INTERVAL_ALIASES:
        if alias in settings:
            settings["automatically_update_lights_interval"] = settings.pop(alias)
            for leftover in _INTERVAL_ALIASES:
                settings.pop(leftover, None)
            return


def _migrate_v3_to_v4(data: dict[str, Any]) -> dict[str, Any]:
    """Migrate a v3 store document to v4 shape (in-memory only).

    The real native-scene inlining happens at runtime in the migrator step
    (needs hass to load scenes.yaml). This structural migration:
    - Seeds variables + default theme if absent.
    - Adds kind=circadian and empty membership/overrides to old scene items.
    - Drops managed_native_scene_ids, hide_managed_native_scenes.
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
    }


def _migrate_store(old_version: int, data: dict[str, Any]) -> dict[str, Any]:
    """Migrate persisted store payloads between STORAGE_VERSION values."""
    if data is None:
        variables = seed_variables()
        themes = seed_default_theme(variables)
        return {
            "variables": variables,
            "themes": themes,
            "scenes": [],
            "settings": dict(DEFAULT_SETTINGS),
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
        "membership": item.get("membership") or {"exclude": [], "include": []},
    }
    if kind == KIND_CIRCADIAN:
        data["theme_id"] = item.get("theme_id") or "default"
        data["overrides"] = item.get("overrides") or {}
        data[AUTOMATICALLY_UPDATE_LIGHTS] = bool(
            item.get(AUTOMATICALLY_UPDATE_LIGHTS, True)
        )
    elif kind == KIND_SIMPLE:
        data["lights"] = item.get("lights") or {}
    return data


# ---------------------------------------------------------------------------
# Store class
# ---------------------------------------------------------------------------


class _ScenesStore(Store):
    """HA Store that migrates circadian_scenes.scenes between major versions."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Migrate stored JSON when STORAGE_VERSION advances."""
        return _migrate_store(old_major_version, old_data)


class CircadianScenesStore:
    """Load and persist circadian scene configs, variables, and themes."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the store."""
        self.hass = hass
        self._store = _ScenesStore(hass, STORAGE_VERSION, STORE_KEY)
        self._legacy_store = _ScenesStore(hass, STORAGE_VERSION, LEGACY_STORE_KEY)
        self.variables: dict[str, dict[str, Any]] = {}
        self.themes: dict[str, dict[str, Any]] = {}
        self.scenes: dict[str, dict[str, Any]] = {}
        self.settings: dict[str, Any] = dict(DEFAULT_SETTINGS)
        # Legacy — only populated during v3→v4 migration.
        self.managed_native_scene_ids: list[str] = []
        self.pending_hide_sync = False

    async def async_load(self) -> None:
        """Load from disk (migrate from scene_extrapolation.scenes once)."""
        data = await self._store.async_load()
        if not data:
            legacy = await self._legacy_store.async_load()
            if legacy:
                _LOGGER.info(
                    "Migrating store from %s to %s",
                    LEGACY_STORE_KEY,
                    STORE_KEY,
                )
                data = legacy
                await self._store.async_save(legacy)
        raw = data or {}

        # --- Variables ---
        vars_raw = raw.get("variables") or {}
        if not vars_raw:
            vars_raw = seed_variables()
        if isinstance(vars_raw, list):
            vars_raw = {v["id"]: v for v in vars_raw if "id" in v}
        self.variables = vars_raw

        # --- Themes ---
        themes_raw = raw.get("themes") or {}
        if not themes_raw:
            themes_raw = seed_default_theme(self.variables)
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

        # --- Settings ---
        raw_settings = dict(raw.get("settings") or {})
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
            "settings": dict(self.settings),
        }
        # Keep managed ids during migration transition; drop when empty.
        if self.managed_native_scene_ids:
            payload["managed_native_scene_ids"] = list(self.managed_native_scene_ids)
        await self._store.async_save(payload)

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
        name = (raw.get("name") or "").strip()
        if not name:
            raise ValueError("Variable name is required")
        color = raw.get("color")
        if not color or not isinstance(color, dict):
            raise ValueError("Variable must have a color dict")
        var = {
            "id": var_id,
            "name": name,
            "color": color,
            "brightness": raw.get("brightness", 255),
        }
        previous = deepcopy(self.variables.get(var_id))
        self.variables[var_id] = var
        try:
            await self.async_save()
        except Exception:  # pylint: disable=broad-exception-caught
            if previous is None:
                self.variables.pop(var_id, None)
            else:
                self.variables[var_id] = previous
            raise
        return var

    async def async_delete_variable(self, var_id: str) -> bool:
        """Delete a variable.  Raises if still referenced by themes or scenes."""
        if var_id not in self.variables:
            return False
        # Check theme refs.
        for theme in self.themes.values():
            for ev in (theme.get("events") or {}).values():
                if isinstance(ev, dict):
                    color = ev.get("color") or {}
                    if color.get(VARIABLE_REF) == var_id:
                        raise HomeAssistantError(
                            f"Variable {var_id!r} is still referenced by "
                            f"theme {theme.get('name', theme['id'])!r}"
                        )
        # Check scene light refs.
        for sc in self.scenes.values():
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
                        raise HomeAssistantError(
                            f"Variable {var_id!r} is still referenced by "
                            f"scene {sc.get(SCENE_NAME, sc['id'])!r}"
                        )
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
                            raise HomeAssistantError(
                                f"Variable {var_id!r} is still referenced by "
                                f"scene {sc.get(SCENE_NAME, sc['id'])!r}"
                            )
        previous = self.variables.pop(var_id)
        try:
            await self.async_save()
        except Exception:  # pylint: disable=broad-exception-caught
            self.variables[var_id] = previous
            raise
        return True

    # --- Theme CRUD ---

    def list_themes(self) -> list[dict[str, Any]]:
        """Return all themes."""
        return list(self.themes.values())

    def get_theme(self, theme_id: str) -> dict[str, Any] | None:
        """Return one theme."""
        return self.themes.get(theme_id)

    async def async_upsert_theme(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Create or update a circadian theme."""
        theme_id = raw.get("id") or str(uuid.uuid4())
        name = (raw.get("name") or "").strip()
        if not name:
            raise ValueError("Theme name is required")
        events = raw.get("events")
        if not events or not isinstance(events, dict):
            raise ValueError("Theme must have an events dict")
        missing = [e for e in SOLAR_EVENTS if e not in events]
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
        theme = {
            "id": theme_id,
            "name": name,
            "events": events,
        }
        previous = deepcopy(self.themes.get(theme_id))
        self.themes[theme_id] = theme
        try:
            await self.async_save()
        except Exception:  # pylint: disable=broad-exception-caught
            if previous is None:
                self.themes.pop(theme_id, None)
            else:
                self.themes[theme_id] = previous
            raise
        return theme

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
        previous = self.themes.pop(theme_id)
        try:
            await self.async_save()
        except Exception:  # pylint: disable=broad-exception-caught
            self.themes[theme_id] = previous
            raise
        return True

    # --- Scene CRUD ---

    def list(self) -> list[dict[str, Any]]:
        """Return all scene configs."""
        return list(self.scenes.values())

    def get(self, scene_id: str) -> dict[str, Any] | None:
        """Return one scene config."""
        return self.scenes.get(scene_id)

    async def async_upsert(self, raw: dict[str, Any]) -> dict[str, Any]:
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
        previous = deepcopy(self.scenes.get(item["id"]))
        self.scenes[item["id"]] = item
        try:
            await self.async_save()
        except Exception:  # pylint: disable=broad-exception-caught
            if previous is None:
                self.scenes.pop(item["id"], None)
            else:
                self.scenes[item["id"]] = previous
            raise
        return item

    async def async_set_automatically_update_lights(
        self, scene_id: str, automatically_update_lights: bool
    ) -> dict[str, Any] | None:
        """Toggle per-scene automatic light-update preference."""
        item = self.scenes.get(scene_id)
        if item is None:
            return None
        item[AUTOMATICALLY_UPDATE_LIGHTS] = bool(automatically_update_lights)
        await self.async_save()
        return item

    async def async_delete(self, scene_id: str) -> bool:
        """Delete a scene config."""
        if scene_id not in self.scenes:
            return False
        previous = self.scenes.pop(scene_id)
        try:
            await self.async_save()
        except Exception:  # pylint: disable=broad-exception-caught
            self.scenes[scene_id] = previous
            raise
        return True

    async def async_update_settings(self, patch: dict[str, Any]) -> dict[str, Any]:
        """Merge integration-wide settings and persist."""
        for key, value in patch.items():
            if key not in DEFAULT_SETTINGS:
                continue
            if key == "automatically_update_lights_interval":
                try:
                    value = int(value)
                except (TypeError, ValueError) as err:
                    raise HomeAssistantError(
                        "automatically_update_lights_interval must be an integer"
                    ) from err
                if value < 0 or value > 30 * 60:
                    raise HomeAssistantError(
                        "automatically_update_lights_interval must be 0–1800 seconds"
                    )
            if key == SETTINGS_DUSK_MINIMUM_TIME_OF_DAY:
                try:
                    value = time_to_seconds(value)
                except (TypeError, ValueError) as err:
                    raise HomeAssistantError(
                        "dusk_minimum_time_of_day must be a time or seconds since midnight"
                    ) from err
                if value < 0 or value > 24 * 3600:
                    raise HomeAssistantError(
                        "dusk_minimum_time_of_day must be 0–86400 seconds"
                    )
            self.settings[key] = value
        await self.async_save()
        return dict(self.settings)

    # --- Legacy helpers (migration only, will be removed) ---

    async def async_register_managed_native_scene(self, config_id: str) -> None:
        """Remember a YAML scene id this integration created."""
        cid = str(config_id)
        if cid in self.managed_native_scene_ids:
            return
        self.managed_native_scene_ids.append(cid)
        await self.async_save()

    async def async_unregister_managed_native_scene(self, config_id: str) -> None:
        """Drop a managed YAML scene id after delete."""
        cid = str(config_id)
        if cid not in self.managed_native_scene_ids:
            return
        self.managed_native_scene_ids = [
            item for item in self.managed_native_scene_ids if item != cid
        ]
        await self.async_save()

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
            self.scenes[item["id"]] = item
            await self.async_save()
        return item
