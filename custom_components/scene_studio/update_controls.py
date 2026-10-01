"""Durable update preferences shared by admin editing and permitted HA actions."""

import asyncio
from copy import deepcopy

from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import DATA_ENTITIES, DATA_STORE, DOMAIN
from .editor_events import SETTINGS_CHANGED_SIGNAL, publish_change, scene_operation_lock
from .runtime import scene_runtime


async def _refresh_owners(hass, context=None):
    runtime = scene_runtime(hass)
    tasks = []
    for owner in list(runtime.owners.values()):
        runtime.refresh_attributes(owner.entity)
        if handler := getattr(owner.entity, "async_preferences_changed", None):
            tasks.append(handler(context=context))
    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        failures = [result for result in results if isinstance(result, BaseException)]
        if failures:
            raise failures[0]


async def async_update_settings_locked(
    hass, patch: dict, source=None, context=None
) -> dict:
    """Caller owns the scene lock; settings are durable before notifications."""
    settings = await hass.data[DOMAIN][DATA_STORE].async_update_settings(patch)
    async_dispatcher_send(hass, SETTINGS_CHANGED_SIGNAL)
    publish_change(hass, source, "settings", None, "save")
    if any(
        key in patch
        for key in (
            "automatic_updates_enabled",
            "automatically_update_lights_interval",
            "respect_manual_changes",
            "always_follow_scene",
            "always_respect_manual_changes",
        )
    ):
        await _refresh_owners(hass, context)
    return settings


async def async_update_settings(hass, patch: dict, context=None) -> dict:
    """HA switch actions share serialization with editor settings changes."""
    async with scene_operation_lock(hass):
        return await async_update_settings_locked(hass, patch, context=context)


async def async_set_scene_updates_locked(
    hass, scene_ids: list[str], enabled: bool, source=None, context=None
) -> list[dict]:
    """Persist a complete scene batch and compensate failed entity synchronization."""
    store = hass.data[DOMAIN][DATA_STORE]
    previous = {scene_id: deepcopy(store.get(scene_id)) for scene_id in scene_ids}
    items = await store.async_set_scene_updates(scene_ids, enabled)
    entities = hass.data[DOMAIN][DATA_ENTITIES]
    try:
        for item in items:
            if entity := entities.get(item["id"]):
                await entity.async_update_config(item, _resume=False)
    except Exception:
        # pylint: disable=protected-access
        await store._async_mutate(lambda: store.scenes.update(previous))
        for scene_id, item in previous.items():
            if entity := entities.get(scene_id):
                await entity.async_update_config(item, _resume=False)
        raise
    for item in items:
        publish_change(hass, source, "scene", item["id"], "save")
    tasks = [
        entities[item["id"]].async_preferences_changed(context=context)
        for item in items
        if item["id"] in entities
    ]
    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        failures = [result for result in results if isinstance(result, BaseException)]
        if failures:
            raise failures[0]
    return items
