"""WebSocket API for the Scene Studio panel."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import floor_registry as fr

from .const import (
    DATA_ADD_ENTITIES,
    DATA_CONFIG_ENTRY,
    DATA_ENTITIES,
    DATA_STORE,
    DOMAIN,
    KIND_CIRCADIAN,
    SCENE_NAME,
)
from .native_scene import lights_in_area
from .preview import build_preview
from .scene import async_create_or_update_entity, async_remove_entity
from .snapshots import card_colors
from .solar import build_sun_path
from .store import SceneStudioStore, to_form_data

_LOGGER = logging.getLogger(__name__)


def async_setup_websocket(hass: HomeAssistant) -> None:
    """Register websocket commands."""
    websocket_api.async_register_command(hass, ws_list)
    websocket_api.async_register_command(hass, ws_get)
    websocket_api.async_register_command(hass, ws_save)
    websocket_api.async_register_command(hass, ws_delete)
    websocket_api.async_register_command(hass, ws_sun_path)
    websocket_api.async_register_command(hass, ws_preview)
    websocket_api.async_register_command(hass, ws_get_settings)
    websocket_api.async_register_command(hass, ws_update_settings)
    websocket_api.async_register_command(hass, ws_set_automatically_update_lights)
    websocket_api.async_register_command(hass, ws_list_variables)
    websocket_api.async_register_command(hass, ws_save_variable)
    websocket_api.async_register_command(hass, ws_delete_variable)
    websocket_api.async_register_command(hass, ws_list_themes)
    websocket_api.async_register_command(hass, ws_save_theme)
    websocket_api.async_register_command(hass, ws_delete_theme)
    websocket_api.async_register_command(hass, ws_auto_configure)
    websocket_api.async_register_command(hass, ws_areas)


def _store(hass: HomeAssistant) -> SceneStudioStore:
    return hass.data[DOMAIN][DATA_STORE]


def _registry_entry(hass: HomeAssistant, scene_id: str):
    entity_reg = er.async_get(hass)
    for registry_entry in entity_reg.entities.values():
        if registry_entry.unique_id == scene_id and registry_entry.domain == "scene":
            return registry_entry
    return None


def _form_payload(item: dict[str, Any], entry=None) -> dict[str, Any]:
    form = to_form_data(item)
    if entry:
        form["labels"] = list(entry.labels)
        form["category"] = (entry.categories or {}).get("scene")
        if entry.icon:
            form["icon"] = entry.icon
    return form


def _area_tree(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Floors with nested areas (unfloored last)."""
    area_reg = ar.async_get(hass)
    floor_reg = fr.async_get(hass)
    floors: dict[str | None, dict[str, Any]] = {}
    for floor in floor_reg.floors.values():
        floors[floor.floor_id] = {
            "id": floor.floor_id,
            "name": floor.name,
            "level": floor.level,
            "areas": [],
        }
    unfloored = {"id": None, "name": None, "level": None, "areas": []}
    for area in area_reg.areas.values():
        row = {
            "id": area.id,
            "name": area.name,
            "icon": area.icon,
            "floor_id": area.floor_id,
            "lights": lights_in_area(hass, area.id),
        }
        if area.floor_id and area.floor_id in floors:
            floors[area.floor_id]["areas"].append(row)
        else:
            unfloored["areas"].append(row)
    ordered = sorted(
        floors.values(),
        key=lambda item: (
            item["level"] is None,
            item["level"] if item["level"] is not None else 0,
            (item["name"] or "").casefold(),
        ),
    )
    if unfloored["areas"]:
        unfloored["areas"].sort(key=lambda item: item["name"].casefold())
        ordered.append(unfloored)
    for floor in ordered:
        floor["areas"].sort(key=lambda item: item["name"].casefold())
    return ordered


def _scene_payload(hass: HomeAssistant, item: dict[str, Any]) -> dict[str, Any]:
    area_reg = ar.async_get(hass)
    area_id = item.get("area")
    area_name = None
    if area_id and area_id in area_reg.areas:
        area_name = area_reg.areas[area_id].name
    entry = _registry_entry(hass, item["id"])
    form = _form_payload(item, entry)
    store = _store(hass)
    colors = card_colors(hass, store, item)
    return {
        **item,
        "area_name": area_name,
        "entity_id": entry.entity_id if entry else None,
        "labels": form.get("labels") or [],
        "category": form.get("category"),
        "form": form,
        "card": colors,
    }


def _list_payload(hass: HomeAssistant) -> dict[str, Any]:
    store = _store(hass)
    scenes = [_scene_payload(hass, item) for item in store.list()]
    scenes.sort(key=lambda item: (item.get("scene_name") or "").casefold())
    return {
        "scenes": scenes,
        "variables": store.list_variables(),
        "themes": store.list_themes(),
        "floors": _area_tree(hass),
        "settings": dict(store.settings),
    }


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list"})
@websocket_api.require_admin
@callback
def ws_list(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """List scenes, variables, themes, and the area tree."""
    connection.send_result(msg["id"], _list_payload(hass))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/areas"})
@websocket_api.require_admin
@callback
def ws_areas(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return floors and areas with light membership."""
    connection.send_result(msg["id"], {"floors": _area_tree(hass)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/get",
        vol.Required("scene_id"): str,
    }
)
@websocket_api.require_admin
@callback
def ws_get(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Get one scene."""
    item = _store(hass).get(msg["scene_id"])
    if item is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Scene not found")
        return
    connection.send_result(msg["id"], _scene_payload(hass, item))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save",
        vol.Optional("scene_id"): str,
        vol.Required("data"): dict,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create or update a scene."""
    domain_data = hass.data[DOMAIN]
    add_entities = domain_data.get(DATA_ADD_ENTITIES)
    if add_entities is None:
        connection.send_error(
            msg["id"], "not_loaded", "Scene platform is not ready yet"
        )
        return
    raw = dict(msg["data"])
    if msg.get("scene_id"):
        raw["id"] = msg["scene_id"]
    previous = _store(hass).get(raw.get("id")) if raw.get("id") else None
    try:
        item = await _store(hass).async_upsert(raw)
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return

    try:
        await async_create_or_update_entity(
            hass,
            domain_data[DATA_CONFIG_ENTRY],
            item,
            add_entities,
            domain_data[DATA_ENTITIES],
        )
    except Exception as err:  # pylint: disable=broad-exception-caught
        # Store and entity registry cannot share a transaction; compensate so
        # a failed response never leaves a configuration the panel did not save.
        if previous is None:
            await _store(hass).async_delete(item["id"])
            await async_remove_entity(domain_data[DATA_ENTITIES], item["id"])
        else:
            await _store(hass).async_upsert(previous)
            await async_create_or_update_entity(
                hass,
                domain_data[DATA_CONFIG_ENTRY],
                previous,
                add_entities,
                domain_data[DATA_ENTITIES],
            )
        connection.send_error(msg["id"], "save_failed", str(err))
        return
    connection.send_result(msg["id"], _scene_payload(hass, item))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete",
        vol.Required("scene_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete a scene."""
    scene_id = msg["scene_id"]
    previous = _store(hass).get(scene_id)
    if previous is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Scene not found")
        return
    deleted = await _store(hass).async_delete(scene_id)
    if not deleted:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Scene not found")
        return
    try:
        await async_remove_entity(hass.data[DOMAIN][DATA_ENTITIES], scene_id)
    except Exception as err:  # pylint: disable=broad-exception-caught
        # Recreate both sides if entity removal failed after the store write.
        await _store(hass).async_upsert(previous)
        await async_create_or_update_entity(
            hass,
            hass.data[DOMAIN][DATA_CONFIG_ENTRY],
            previous,
            hass.data[DOMAIN][DATA_ADD_ENTITIES],
            hass.data[DOMAIN][DATA_ENTITIES],
        )
        connection.send_error(msg["id"], "delete_failed", str(err))
        return
    connection.send_result(msg["id"], {"scene_id": scene_id})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/sun_path",
        vol.Optional("dusk_minimum"): int,
        vol.Optional("date"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_sun_path(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return solar events and elevation curve for a date."""
    dusk_minimum = msg.get("dusk_minimum")
    payload = await hass.async_add_executor_job(
        build_sun_path, hass, dusk_minimum, msg.get("date")
    )
    connection.send_result(msg["id"], payload)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/preview",
        vol.Optional("dusk_minimum"): int,
        vol.Optional("date"): str,
        vol.Optional("scene_id"): str,
        vol.Optional("scene"): dict,
        vol.Optional("location"): {
            vol.Required("latitude"): vol.All(
                vol.Coerce(float), vol.Range(min=-90, max=90)
            ),
            vol.Required("longitude"): vol.All(
                vol.Coerce(float), vol.Range(min=-180, max=180)
            ),
        },
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_preview(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return sun path plus per-light brightness/color samples."""
    store = _store(hass)
    scene = msg.get("scene")
    if scene is None and msg.get("scene_id"):
        scene = store.get(msg["scene_id"])
    payload = await hass.async_add_executor_job(
        lambda: build_preview(
            hass,
            dusk_minimum=msg.get("dusk_minimum"),
            target_date=msg.get("date"),
            scene=scene,
            location=msg.get("location"),
        )
    )
    connection.send_result(msg["id"], payload)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_settings"})
@websocket_api.require_admin
@callback
def ws_get_settings(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return integration-wide settings."""
    connection.send_result(msg["id"], dict(_store(hass).settings))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_settings",
        vol.Required("settings"): dict,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_update_settings(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Update integration-wide settings."""
    store = _store(hass)
    before_interval = int(
        store.settings.get("automatically_update_lights_interval") or 0
    )
    settings = await store.async_update_settings(dict(msg.get("settings") or {}))
    after_interval = int(settings.get("automatically_update_lights_interval") or 0)
    if before_interval != after_interval:
        for entity in hass.data[DOMAIN][DATA_ENTITIES].values():
            if hasattr(entity, "async_on_automatically_update_lights_settings_changed"):
                entity.async_on_automatically_update_lights_settings_changed()
    connection.send_result(msg["id"], {"settings": settings})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_automatically_update_lights",
        vol.Required("scene_id"): str,
        vol.Required("automatically_update_lights"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_set_automatically_update_lights(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Toggle per-scene automatic light-update preference."""
    item = await _store(hass).async_set_automatically_update_lights(
        msg["scene_id"], bool(msg["automatically_update_lights"])
    )
    if item is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Scene not found")
        return
    entity = hass.data[DOMAIN][DATA_ENTITIES].get(msg["scene_id"])
    if entity is not None and hasattr(entity, "async_update_config"):
        await entity.async_update_config(item)
    connection.send_result(msg["id"], _scene_payload(hass, item))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list_variables"})
@websocket_api.require_admin
@callback
def ws_list_variables(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """List color variables."""
    connection.send_result(msg["id"], _store(hass).list_variables())


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_variable",
        vol.Required("data"): dict,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_variable(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create or update a color variable."""
    try:
        item = await _store(hass).async_upsert_variable(dict(msg["data"]))
    except (ValueError, HomeAssistantError) as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"], item)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_variable",
        vol.Required("variable_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete_variable(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete a color variable if it is unused."""
    try:
        deleted = await _store(hass).async_delete_variable(msg["variable_id"])
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "in_use", str(err))
        return
    if not deleted:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Variable not found"
        )
        return
    connection.send_result(msg["id"], {"variable_id": msg["variable_id"]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list_themes"})
@websocket_api.require_admin
@callback
def ws_list_themes(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """List circadian themes."""
    connection.send_result(msg["id"], _store(hass).list_themes())


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_theme",
        vol.Required("data"): dict,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save_theme(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create or update a circadian theme."""
    try:
        item = await _store(hass).async_upsert_theme(dict(msg["data"]))
    except (ValueError, HomeAssistantError) as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"], item)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_theme",
        vol.Required("theme_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete_theme(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete a theme if unused."""
    try:
        deleted = await _store(hass).async_delete_theme(msg["theme_id"])
    except HomeAssistantError as err:
        connection.send_error(msg["id"], "in_use", str(err))
        return
    if not deleted:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Theme not found")
        return
    connection.send_result(msg["id"], {"theme_id": msg["theme_id"]})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/auto_configure"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_auto_configure(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create one default-theme circadian scene per area that has lights.

    Only allowed when the store has zero scenes (empty-state onboarding).
    """
    store = _store(hass)
    if store.list():
        connection.send_error(
            msg["id"],
            "not_empty",
            "Auto configure is only available when there are no scenes yet",
        )
        return
    if hass.data[DOMAIN].get(DATA_ADD_ENTITIES) is None:
        connection.send_error(
            msg["id"], "not_loaded", "Scene platform is not ready yet"
        )
        return
    created = []
    area_reg = ar.async_get(hass)
    for area in area_reg.areas.values():
        lights = lights_in_area(hass, area.id)
        if not lights:
            continue
        item = await store.async_upsert(
            {
                "kind": KIND_CIRCADIAN,
                SCENE_NAME: f"{area.name} Circadian",
                "area": area.id,
                "theme_id": "default",
            }
        )
        await async_create_or_update_entity(
            hass,
            hass.data[DOMAIN][DATA_CONFIG_ENTRY],
            item,
            hass.data[DOMAIN][DATA_ADD_ENTITIES],
            hass.data[DOMAIN][DATA_ENTITIES],
        )
        created.append(_scene_payload(hass, item))
    connection.send_result(msg["id"], {"scenes": created, **_list_payload(hass)})
