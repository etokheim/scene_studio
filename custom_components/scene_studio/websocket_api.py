"""WebSocket API for the Scene Studio panel."""

from __future__ import annotations

import logging
from functools import wraps
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import floor_registry as fr
from homeassistant.helpers.dispatcher import (
    async_dispatcher_connect,
    async_dispatcher_send,
)

from .activation_cache import invalidate_activation_cache
from .collaboration import ItemDeleted, RevisionConflict, revision_for
from .const import (
    DATA_ADD_ENTITIES,
    DATA_CONFIG_ENTRY,
    DATA_ENTITIES,
    DATA_STORE,
    DOMAIN,
    VARIABLE_REF,
)
from .editor_events import EDITOR_CHANGED_SIGNAL as _CHANGED_SIGNAL
from .editor_events import SETTINGS_CHANGED_SIGNAL
from .editor_events import publish_change as _publish_change
from .editor_events import scene_operation_lock as _scene_operation_lock
from .migrate_native import async_delete_managed_yaml
from .native_scene import lights_in_area
from .preview import build_preview
from .scene import async_create_or_update_entity, async_remove_entity
from .snapshots import card_colors
from .solar import build_sun_path
from .store import SceneStudioStore, to_form_data
from .update_controls import (
    async_set_scene_updates_locked,
    async_update_settings_locked,
)
from .validation import validate_scene_input

_LOGGER = logging.getLogger(__name__)


def async_setup_websocket(hass: HomeAssistant) -> None:
    """Register websocket commands."""
    websocket_api.async_register_command(hass, ws_list)
    websocket_api.async_register_command(hass, ws_catalog_changes)
    websocket_api.async_register_command(hass, ws_subscribe_changes)
    websocket_api.async_register_command(hass, ws_get)
    websocket_api.async_register_command(hass, ws_save)
    websocket_api.async_register_command(hass, ws_delete)
    websocket_api.async_register_command(hass, ws_reset)
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
    websocket_api.async_register_command(hass, ws_ensure_default_theme)
    websocket_api.async_register_command(hass, ws_auto_configure)
    websocket_api.async_register_command(hass, ws_areas)
    websocket_api.async_register_command(hass, ws_move_deleted_area)
    websocket_api.async_register_command(hass, ws_delete_deleted_area)


def _store(hass: HomeAssistant) -> SceneStudioStore:
    domain_data = hass.data.get(DOMAIN)
    if not domain_data or domain_data.get(DATA_CONFIG_ENTRY) is None:
        raise HomeAssistantError("Scene Studio is not loaded")
    return domain_data[DATA_STORE]


def _serialized_write(handler):
    """Serialize a store write with scene/entity compensation operations."""

    @wraps(handler)
    async def wrapped(hass, connection, msg):
        async with _scene_operation_lock(hass):
            await handler(hass, connection, msg)

    return wrapped


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
    store = _store(hass)
    missing_ids = {
        item.get("area")
        for item in store.list()
        if item.get("area") and item["area"] not in area_reg.areas
    }
    for area_id in missing_ids:
        unfloored["areas"].append(
            {
                "id": area_id,
                "name": store.area_names.get(area_id),
                "icon": None,
                "floor_id": None,
                "lights": [],
                "deleted": True,
            }
        )
    ordered = sorted(
        floors.values(),
        key=lambda item: (
            item["level"] is None,
            item["level"] if item["level"] is not None else 0,
            (item["name"] or "").casefold(),
        ),
    )
    if unfloored["areas"]:
        unfloored["areas"].sort(
            key=lambda item: (item["name"] or item["id"]).casefold()
        )
        ordered.append(unfloored)
    for floor in ordered:
        floor["areas"].sort(key=lambda item: (item["name"] or item["id"]).casefold())
    return ordered


def _scene_payload(hass: HomeAssistant, item: dict[str, Any]) -> dict[str, Any]:
    area_reg = ar.async_get(hass)
    area_id = item.get("area")
    area_name = None
    if area_id and area_id in area_reg.areas:
        area_name = area_reg.areas[area_id].name
    elif area_id:
        area_name = _store(hass).area_names.get(area_id)
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
        "hidden": bool(getattr(entry, "hidden_by", None)) if entry else False,
        "disabled": bool(getattr(entry, "disabled_by", None)) if entry else False,
        "form": form,
        "revision": revision_for(form),
        "card": colors,
    }


def _revisioned(item: dict[str, Any]) -> dict[str, Any]:
    """Expose an immutable item revision without putting it in storage."""
    return {**item, "revision": revision_for(item)}


def _list_payload(hass: HomeAssistant) -> dict[str, Any]:
    store = _store(hass)
    scenes = [_scene_payload(hass, item) for item in store.list()]
    scenes.sort(key=lambda item: (item.get("scene_name") or "").casefold())
    return {
        "scenes": scenes,
        "variables": [_revisioned(item) for item in store.list_variables()],
        "themes": [_revisioned(item) for item in store.list_themes()],
        "floors": _area_tree(hass),
        "settings": dict(store.settings),
    }


def _catalog_changes_payload(hass: HomeAssistant, changes: list[dict]) -> dict:
    """Resolve changed items and transitive preset dependents, including deletions."""
    store = _store(hass)
    ids = {
        kind: {c["id"] for c in changes if c["kind"] == kind}
        for kind in ("scene", "theme", "variable")
    }
    variables = set(ids["variable"])

    def references(value: Any, targets: set[str]) -> bool:
        if isinstance(value, dict):
            return any(
                (
                    key in (VARIABLE_REF, "palette_id")
                    and isinstance(child, str)
                    and child in targets
                )
                or references(child, targets)
                for key, child in value.items()
            )
        if isinstance(value, list):
            return any(references(child, targets) for child in value)
        return False

    # Palette slots can refer to colors; retain the transitive closure so a
    # changed color also refreshes scenes using a referencing palette/theme.
    while variables:
        expanded = variables | {
            key for key, item in store.variables.items() if references(item, variables)
        }
        if expanded == variables:
            break
        variables = expanded
    themes = ids["theme"] | {
        key
        for key, item in store.themes.items()
        if variables and references(item, variables)
    }
    scenes = ids["scene"] | {
        key
        for key, item in (store.scenes.items() if themes or variables else ())
        if (themes and item.get("theme_id") in themes)
        or (variables and references(item, variables))
    }
    return {
        "partial": True,
        "scene_ids": sorted(scenes),
        "variable_ids": sorted(ids["variable"]),
        "theme_ids": sorted(ids["theme"]),
        "scenes": [
            _scene_payload(hass, store.scenes[key])
            for key in sorted(scenes)
            if key in store.scenes
        ],
        "variables": [
            _revisioned(store.variables[key])
            for key in sorted(ids["variable"])
            if key in store.variables
        ],
        "themes": [
            _revisioned(store.themes[key])
            for key in sorted(ids["theme"])
            if key in store.themes
        ],
    }


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/catalog_changes",
        vol.Required("changes"): vol.All(
            [
                {
                    vol.Required("kind"): vol.In(("scene", "theme", "variable")),
                    vol.Required("id"): vol.All(str, vol.Length(min=1)),
                }
            ],
            vol.Length(min=1),
        ),
    }
)
@websocket_api.require_admin
@callback
def ws_catalog_changes(hass, connection, msg) -> None:
    """Admin-only catalog patches; full list remains the reconnect snapshot."""
    connection.send_result(msg["id"], _catalog_changes_payload(hass, msg["changes"]))


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


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe_changes"})
@websocket_api.require_admin
@callback
def ws_subscribe_changes(hass, connection, msg) -> None:
    """Admin-only stream of successfully saved editor changes."""
    subscription_id = msg["id"]

    def notify(source, event) -> None:
        if source is not connection:
            connection.send_event(subscription_id, event)

    unsubscribe = async_dispatcher_connect(
        hass,
        _CHANGED_SIGNAL,
        notify,
    )
    connection.subscriptions[subscription_id] = unsubscribe
    connection.send_result(subscription_id)


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
        vol.Optional("base"): dict,
        vol.Optional("base_revision"): str,
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
    async with _scene_operation_lock(hass):
        await _ws_save_locked(hass, connection, msg)


async def _ws_save_locked(hass, connection, msg) -> None:
    """Complete persistence, entity sync, and compensation as one operation."""
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
    area = ar.async_get(hass).areas.get(raw.get("area"))
    try:
        validate_scene_input(raw)
        if msg.get("scene_id"):
            if "base" not in msg or "base_revision" not in msg:
                connection.send_error(
                    msg["id"], "reload_required", "Reload this scene before saving"
                )
                return
            item = await _store(hass).async_rebase_scene(
                raw,
                msg["base"],
                msg["base_revision"],
                lambda current: _form_payload(
                    current, _registry_entry(hass, current["id"])
                ),
                area_name=area.name if area else None,
            )
        else:
            item = await _store(hass).async_upsert(
                raw, area_name=area.name if area else None
            )
    except RevisionConflict as err:
        connection.send_result(
            msg["id"],
            {
                "status": "conflict",
                "fields": err.fields,
                "current": err.current,
                "revision": err.revision,
            },
        )
        return
    except ItemDeleted:
        connection.send_error(msg["id"], "deleted", "Scene was deleted")
        return
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
    _publish_change(hass, connection, "scene", item["id"], "save")


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
    async with _scene_operation_lock(hass):
        await _ws_delete_locked(hass, connection, msg)


async def _ws_delete_locked(hass, connection, msg) -> None:
    """Complete deletion and entity removal under the scene operation lock."""
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
    _publish_change(hass, connection, "scene", scene_id, "delete")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/reset"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_reset(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete every scene and restore the fresh-install store.

    Lights, areas, and the config entry stay. Scene entities and managed
    native YAML are removed first so a failed reset can put them back.
    """
    async with _scene_operation_lock(hass):
        await _ws_reset_locked(hass, connection, msg)


async def _ws_reset_locked(hass, connection, msg) -> None:
    """Reset persistence and entity state under the scene operation lock."""
    store = _store(hass)
    previous_scenes = {item["id"]: item for item in store.list()}
    scene_ids = list(previous_scenes)
    managed = list(store.managed_native_scene_ids)
    removed: list[str] = []
    try:
        entities = hass.data[DOMAIN][DATA_ENTITIES]
        for scene_id in scene_ids:
            await async_remove_entity(entities, scene_id)
            removed.append(scene_id)
        await store.async_reset_to_fresh()
    except Exception as err:  # pylint: disable=broad-exception-caught
        for scene_id in removed:
            item = previous_scenes[scene_id]
            await async_create_or_update_entity(
                hass,
                hass.data[DOMAIN][DATA_CONFIG_ENTRY],
                item,
                hass.data[DOMAIN][DATA_ADD_ENTITIES],
                hass.data[DOMAIN][DATA_ENTITIES],
            )
        connection.send_error(msg["id"], "reset_failed", str(err))
        return
    if managed:
        try:
            await async_delete_managed_yaml(hass, managed)
            await store._async_mutate(  # pylint: disable=protected-access
                store.managed_native_scene_ids.clear
            )
        except Exception as err:  # pylint: disable=broad-exception-caught
            connection.send_error(msg["id"], "cleanup_failed", str(err))
            return
    invalidate_activation_cache(hass)
    connection.send_result(msg["id"], {"ok": True})
    async_dispatcher_send(hass, SETTINGS_CHANGED_SIGNAL)
    _publish_change(hass, connection, "catalog", None, "reset")


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/sun_path",
        vol.Optional("dusk_minimum"): vol.Any(None, int),
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
        vol.Optional("dusk_minimum"): vol.Any(None, int),
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
@_serialized_write
async def ws_update_settings(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Update integration-wide settings."""
    _store(hass)
    settings = await async_update_settings_locked(
        hass,
        dict(msg.get("settings") or {}),
        connection,
        context=Context(user_id=connection.user.id),
    )
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
    async with _scene_operation_lock(hass):
        await _ws_set_automatically_update_lights_locked(hass, connection, msg)


async def _ws_set_automatically_update_lights_locked(hass, connection, msg) -> None:
    """Keep the saved preference and entity config in one scene operation."""
    store = _store(hass)
    if store.get(msg["scene_id"]) is None:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Scene not found")
        return
    items = await async_set_scene_updates_locked(
        hass,
        [msg["scene_id"]],
        msg["automatically_update_lights"],
        connection,
        context=Context(user_id=connection.user.id),
    )
    item = items[0]
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
    connection.send_result(
        msg["id"], [_revisioned(item) for item in _store(hass).list_variables()]
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_variable",
        vol.Required("data"): dict,
        vol.Optional("base"): dict,
        vol.Optional("base_revision"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
@_serialized_write
async def ws_save_variable(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create or update a color variable."""
    raw = dict(msg["data"])
    try:
        if raw.get("id"):
            if "base" not in msg or "base_revision" not in msg:
                connection.send_error(
                    msg["id"], "reload_required", "Reload this preset before saving"
                )
                return
            item = await _store(hass).async_rebase_variable(
                raw, msg["base"], msg["base_revision"]
            )
        else:
            item = await _store(hass).async_upsert_variable(raw)
    except RevisionConflict as err:
        connection.send_result(
            msg["id"],
            {
                "status": "conflict",
                "fields": err.fields,
                "current": err.current,
                "revision": err.revision,
            },
        )
        return
    except ItemDeleted:
        connection.send_error(msg["id"], "deleted", "Preset was deleted")
        return
    except (ValueError, HomeAssistantError) as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"], _revisioned(item))
    _publish_change(hass, connection, "variable", item["id"], "save")


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_variable",
        vol.Required("variable_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
@_serialized_write
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
    _publish_change(hass, connection, "variable", msg["variable_id"], "delete")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list_themes"})
@websocket_api.require_admin
@callback
def ws_list_themes(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """List circadian themes."""
    connection.send_result(
        msg["id"], [_revisioned(item) for item in _store(hass).list_themes()]
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_theme",
        vol.Required("data"): dict,
        vol.Optional("base"): dict,
        vol.Optional("base_revision"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
@_serialized_write
async def ws_save_theme(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create or update a circadian theme."""
    raw = dict(msg["data"])
    try:
        if raw.get("id"):
            if "base" not in msg or "base_revision" not in msg:
                connection.send_error(
                    msg["id"], "reload_required", "Reload this preset before saving"
                )
                return
            item = await _store(hass).async_rebase_theme(
                raw, msg["base"], msg["base_revision"]
            )
        else:
            item = await _store(hass).async_upsert_theme(raw)
    except RevisionConflict as err:
        connection.send_result(
            msg["id"],
            {
                "status": "conflict",
                "fields": err.fields,
                "current": err.current,
                "revision": err.revision,
            },
        )
        return
    except ItemDeleted:
        connection.send_error(msg["id"], "deleted", "Preset was deleted")
        return
    except (ValueError, HomeAssistantError) as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    connection.send_result(msg["id"], _revisioned(item))
    _publish_change(hass, connection, "theme", item["id"], "save")


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/ensure_default_theme"}
)
@websocket_api.require_admin
@websocket_api.async_response
@_serialized_write
async def ws_ensure_default_theme(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Add the Default circadian preset when the library does not have it."""
    store = _store(hass)
    theme = await store.async_ensure_default_theme()
    connection.send_result(
        msg["id"],
        {
            "theme": _revisioned(theme),
            "variables": [_revisioned(item) for item in store.list_variables()],
        },
    )
    _publish_change(hass, connection, "theme", theme["id"], "save")


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_theme",
        vol.Required("theme_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
@_serialized_write
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
    _publish_change(hass, connection, "theme", msg["theme_id"], "delete")


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
    async with _scene_operation_lock(hass):
        await _ws_auto_configure_locked(hass, connection, msg)


async def _ws_auto_configure_locked(hass, connection, msg) -> None:
    """Persist and register auto-configured scenes without another scene write."""
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
    area_reg = ar.async_get(hass)
    selected = []
    for area in area_reg.areas.values():
        lights = lights_in_area(hass, area.id)
        if not lights:
            continue
        selected.append((area.id, area.name))
    items, created_variables, created_theme = await store.async_auto_configure(selected)
    try:
        for item in items:
            await async_create_or_update_entity(
                hass,
                hass.data[DOMAIN][DATA_CONFIG_ENTRY],
                item,
                hass.data[DOMAIN][DATA_ADD_ENTITIES],
                hass.data[DOMAIN][DATA_ENTITIES],
            )
    except Exception as err:  # pylint: disable=broad-exception-caught
        await store.async_compensate_auto_configure(
            [item["id"] for item in items], created_variables, created_theme
        )
        for item in items:
            await async_remove_entity(hass.data[DOMAIN][DATA_ENTITIES], item["id"])
        connection.send_error(msg["id"], "auto_configure_failed", str(err))
        return
    created = [_scene_payload(hass, item) for item in items]
    connection.send_result(msg["id"], {"scenes": created, **_list_payload(hass)})
    _publish_change(hass, connection, "catalog", None, "auto_configure")


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/move_deleted_area",
        vol.Required("area_id"): str,
        vol.Required("target_area_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_move_deleted_area(hass, connection, msg) -> None:
    """Move all scenes from an orphan area to a current area."""
    async with _scene_operation_lock(hass):
        await _ws_move_deleted_area_locked(hass, connection, msg)


async def _ws_move_deleted_area_locked(hass, connection, msg) -> None:
    """Move an orphan area's scenes under the scene operation lock."""
    area_id = msg["area_id"]
    target_id = msg["target_area_id"]
    areas = ar.async_get(hass).areas
    if area_id in areas or target_id not in areas or area_id == target_id:
        connection.send_error(msg["id"], "invalid_area", "Select a current target area")
        return
    store = _store(hass)
    previous = [item.copy() for item in store.list() if item.get("area") == area_id]
    if not previous:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Area has no scenes"
        )
        return
    old_name = store.area_names.get(area_id)
    try:
        moved = await store.async_move_area(area_id, target_id)
        for item in moved:
            await async_create_or_update_entity(
                hass,
                hass.data[DOMAIN][DATA_CONFIG_ENTRY],
                item,
                hass.data[DOMAIN][DATA_ADD_ENTITIES],
                hass.data[DOMAIN][DATA_ENTITIES],
            )
    except Exception as err:  # pylint: disable=broad-exception-caught
        await store.async_restore_area(previous, area_id, old_name)
        for item in previous:
            await async_create_or_update_entity(
                hass,
                hass.data[DOMAIN][DATA_CONFIG_ENTRY],
                item,
                hass.data[DOMAIN][DATA_ADD_ENTITIES],
                hass.data[DOMAIN][DATA_ENTITIES],
            )
        connection.send_error(msg["id"], "move_failed", str(err))
        return
    invalidate_activation_cache(hass)
    connection.send_result(msg["id"], _list_payload(hass))
    _publish_change(hass, connection, "area", area_id, "move")


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_deleted_area",
        vol.Required("area_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete_deleted_area(hass, connection, msg) -> None:
    """Delete all scenes in an orphan area as a recoverable operation."""
    async with _scene_operation_lock(hass):
        await _ws_delete_deleted_area_locked(hass, connection, msg)


async def _ws_delete_deleted_area_locked(hass, connection, msg) -> None:
    """Remove an orphan area's scenes under the scene operation lock."""
    area_id = msg["area_id"]
    if area_id in ar.async_get(hass).areas:
        connection.send_error(msg["id"], "invalid_area", "Area still exists")
        return
    store = _store(hass)
    previous = [item.copy() for item in store.list() if item.get("area") == area_id]
    old_name = store.area_names.get(area_id)
    if not previous:
        connection.send_error(
            msg["id"], websocket_api.ERR_NOT_FOUND, "Area has no scenes"
        )
        return
    try:
        await store.async_delete_area(area_id)
        for item in previous:
            await async_remove_entity(hass.data[DOMAIN][DATA_ENTITIES], item["id"])
    except Exception as err:  # pylint: disable=broad-exception-caught
        await store.async_restore_area(previous, area_id, old_name)
        for item in previous:
            await async_create_or_update_entity(
                hass,
                hass.data[DOMAIN][DATA_CONFIG_ENTRY],
                item,
                hass.data[DOMAIN][DATA_ADD_ENTITIES],
                hass.data[DOMAIN][DATA_ENTITIES],
            )
        connection.send_error(msg["id"], "delete_failed", str(err))
        return
    invalidate_activation_cache(hass)
    connection.send_result(msg["id"], _list_payload(hass))
    _publish_change(hass, connection, "area", area_id, "delete")
