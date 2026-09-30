"""One-time v4 freeze-migration: inline native YAML scenes as overrides."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.scene import DOMAIN as SCENE_DOMAIN
from homeassistant.config import SCENE_CONFIG_PATH
from homeassistant.const import CONF_ID, SERVICE_RELOAD
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .const import (
    KIND_CIRCADIAN,
    SCENE_DAWN,
    SCENE_DUSK,
    SCENE_KEYS,
    SCENE_NOON,
    SCENE_SUNRISE,
    SCENE_SUNSET,
)
from .native_scene import (
    _WRITE_LOCK,
    _read_scenes,
    _write_scenes,
    lights_in_area,
    scene_entity_payload,
)
from .preview import load_native_scenes
from .store import SceneStudioStore

_LOGGER = logging.getLogger(__name__)

_SLOT_TO_EVENT = {
    SCENE_DAWN: "dawn",
    SCENE_SUNRISE: "sunrise",
    SCENE_NOON: "noon",
    SCENE_SUNSET: "sunset",
    SCENE_DUSK: "dusk",
}


def needs_native_freeze(scene: dict[str, Any]) -> bool:
    """True when a store item still points at native scene entity ids."""
    if scene.get("kind") not in (None, KIND_CIRCADIAN):
        return False
    return any(scene.get(key) for key in SCENE_KEYS)


def infer_membership(
    area_light_ids: list[str], union_ids: set[str]
) -> dict[str, list[str]]:
    """Derive exclude/include from the union of native-scene members."""
    area = set(area_light_ids)
    exclude = sorted(area - union_ids)
    include = sorted(union_ids - area)
    return {"exclude": exclude, "include": include}


def freeze_scene_overrides(
    scene: dict[str, Any],
    native: dict[str, dict[str, Any]],
    area_light_ids: list[str],
) -> dict[str, Any]:
    """Inline native YAML states as per-light / per-event overrides.

    Every migrated light/event is an override so the look stays identical.
    theme_id stays as a reset target only.
    """
    overrides: dict[str, dict[str, Any]] = {}
    union: set[str] = set()
    for slot, event in _SLOT_TO_EVENT.items():
        entity_id = scene.get(slot)
        if not entity_id:
            continue
        anchor = native.get(entity_id)
        if not anchor:
            raise HomeAssistantError(
                f"Native scene {entity_id!r} for {event} is not loaded; "
                "the source references were retained"
            )
        for light_id, raw in (anchor.get("entities") or {}).items():
            if not str(light_id).startswith("light."):
                continue
            union.add(light_id)
            payload = scene_entity_payload(raw)
            overrides.setdefault(light_id, {})[event] = payload

    updated = dict(scene)
    updated["kind"] = KIND_CIRCADIAN
    updated["theme_id"] = scene.get("theme_id") or "default"
    updated["membership"] = infer_membership(area_light_ids, union)
    updated["overrides"] = overrides
    for key in SCENE_KEYS:
        updated.pop(key, None)
    updated.pop("display_scenes_combined", None)
    updated.pop("scene_dawn_sunrise_sunset", None)
    return updated


async def async_delete_managed_yaml(hass: HomeAssistant, config_ids: list[str]) -> int:
    """Remove YAML scenes this integration created. User-authored scenes stay."""
    if not config_ids:
        return 0
    wanted = {str(cid) for cid in config_ids}
    path = hass.config.path(SCENE_CONFIG_PATH)
    async with _WRITE_LOCK:
        try:
            current = await hass.async_add_executor_job(_read_scenes, path)
        except (FileNotFoundError, HomeAssistantError):
            return 0
        updated = [item for item in current if str(item.get(CONF_ID)) not in wanted]
        removed = len(current) - len(updated)
        if removed:
            await hass.async_add_executor_job(_write_scenes, path, updated)
            await hass.services.async_call(SCENE_DOMAIN, SERVICE_RELOAD, blocking=True)
        return removed


async def async_freeze_migrate(hass: HomeAssistant, store: SceneStudioStore) -> int:
    """Inline native scenes into the store and delete managed YAML.

    Returns the number of circadian configs that were rewritten.
    """
    pending = [item for item in store.list() if needs_native_freeze(item)]
    if not pending and not store.managed_native_scene_ids:
        return 0
    native = load_native_scenes(hass)
    if pending and any(
        item.get(slot) and item[slot] not in native
        for item in pending
        for slot in SCENE_KEYS
    ):
        _LOGGER.debug("Deferring native-scene freeze until every anchor is loaded")
        return 0
    frozen_items = {}
    for item in pending:
        area_id = item.get("area")
        area_lights = lights_in_area(hass, area_id) if area_id else []
        frozen = freeze_scene_overrides(item, native, area_lights)
        frozen_items[frozen["id"]] = frozen
    changed = len(frozen_items)
    if frozen_items:
        # The migrator uses the store's internal transaction to keep all
        # converted scenes together until their durable save completes.
        await store._async_mutate(  # pylint: disable=protected-access
            lambda: store.scenes.update(frozen_items)
        )
    managed = list(store.managed_native_scene_ids)
    if managed:
        removed = await async_delete_managed_yaml(hass, managed)
        _LOGGER.debug("Removed %s managed native YAML scenes after freeze", removed)

        def clear_managed_ids() -> None:
            store.managed_native_scene_ids.clear()

        await store._async_mutate(clear_managed_ids)  # pylint: disable=protected-access
    if changed:
        _LOGGER.debug("Freeze-migrated %s circadian scenes off native YAML", changed)
    return changed
