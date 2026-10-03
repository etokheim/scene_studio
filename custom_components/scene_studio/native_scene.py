"""Shared area membership and native scene payloads used by migration."""

from __future__ import annotations

import asyncio
from typing import Any

from homeassistant.components.scene import DOMAIN as SCENE_DOMAIN
from homeassistant.config import SCENE_CONFIG_PATH
from homeassistant.const import ATTR_STATE
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util.file import write_utf8_file_atomic
from homeassistant.util.yaml import dump, load_yaml

_COLOR_ATTR_FOR_MODE = {
    "color_temp": "color_temp_kelvin",
    "hs": "hs_color",
    "xy": "hs_color",
    "rgb": "rgb_color",
    "rgbw": "rgbw_color",
    "rgbww": "rgbww_color",
}

_COLOR_ATTR_PRIORITY = (
    "rgbww_color",
    "rgbw_color",
    "hs_color",
    "rgb_color",
    "color_temp_kelvin",
)

_MODE_FOR_COLOR_ATTR = {
    "color_temp_kelvin": "color_temp",
    "hs_color": "hs",
    "rgb_color": "rgb",
    "rgbw_color": "rgbw",
    "rgbww_color": "rgbww",
}

_WRITE_LOCK = asyncio.Lock()


def _jsonable(value: Any) -> Any:
    if isinstance(value, tuple):
        return [_jsonable(item) for item in value]
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value


def scene_entity_payload(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Strip live-only attributes down to what a YAML scene should store.

    Home Assistant's light reproduce path uses ``color_mode`` when present,
    otherwise the first of hs / color_temp_kelvin / rgb / …. Storing several
    color attrs without ``color_mode`` (common in live snapshots) made kelvin
    scenes reopen as RGB in our wheel. Keep color_mode + exactly one color
    attribute.
    """
    if not raw:
        return {ATTR_STATE: "off"}
    payload: dict[str, Any] = {}
    state = raw.get(ATTR_STATE) or raw.get("state") or "off"
    payload[ATTR_STATE] = state
    for key in ("brightness", "effect"):
        value = raw.get(key)
        if value is None or value == "none":
            continue
        payload[key] = _jsonable(value)

    color_mode = raw.get("color_mode")
    if isinstance(color_mode, str):
        color_mode = color_mode.strip() or None
    else:
        color_mode = None

    chosen_attr: str | None = None
    if color_mode in _COLOR_ATTR_FOR_MODE:
        attr = _COLOR_ATTR_FOR_MODE[color_mode]
        value = raw.get(attr)
        if value is not None and value != "none":
            chosen_attr = attr
            payload["color_mode"] = (
                "hs" if color_mode == "xy" and attr == "hs_color" else color_mode
            )

    if chosen_attr is None:
        for attr in _COLOR_ATTR_PRIORITY:
            value = raw.get(attr)
            if value is None or value == "none":
                continue
            chosen_attr = attr
            mode = _MODE_FOR_COLOR_ATTR.get(attr)
            if mode:
                payload["color_mode"] = mode
            break

    if chosen_attr is not None:
        payload[chosen_attr] = _jsonable(raw.get(chosen_attr))
    return payload


def scenes_in_area(hass: HomeAssistant, area_id: str) -> list[str]:
    """Enabled scene entity ids in an area (entity area, else device).

    Includes hidden scenes — last-activated still counts if the user hid
    managed native scenes in the HA UI.
    """
    entity_reg = er.async_get(hass)
    device_reg = dr.async_get(hass)
    device_ids = {
        device.id for device in device_reg.devices.values() if device.area_id == area_id
    }
    scenes: list[str] = []
    for entry in entity_reg.entities.values():
        if entry.domain != SCENE_DOMAIN or entry.disabled:
            continue
        if entry.area_id == area_id or (
            entry.area_id is None and entry.device_id in device_ids
        ):
            scenes.append(entry.entity_id)
    return sorted(scenes)


def light_group_member_ids(hass: HomeAssistant, entity_id: str) -> list[str]:
    """Other lights controlled by this entity, when it is a light group."""
    state = hass.states.get(entity_id)
    if state is None:
        return []
    raw = state.attributes.get("entity_id")
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, (list, tuple)):
        return []
    return [
        member
        for member in raw
        if isinstance(member, str)
        and member.startswith("light.")
        and member != entity_id
    ]


def without_redundant_light_groups(
    hass: HomeAssistant, entity_ids: list[str]
) -> list[str]:
    """Drop a group when any of its member lights are already in the list.

    Hide members hides the bulbs (``hidden_by``), so they are not in the list
    and the group stays. Stored membership is left unchanged; callers filter
    the resolved list.
    """
    present = set(entity_ids)
    kept: list[str] = []
    for entity_id in entity_ids:
        members = light_group_member_ids(hass, entity_id)
        if members and any(member in present for member in members):
            continue
        kept.append(entity_id)
    return kept


def lights_in_area(hass: HomeAssistant, area_id: str) -> list[str]:
    """Return enabled light entity ids in an area (entity area, else device)."""
    entity_reg = er.async_get(hass)
    device_reg = dr.async_get(hass)
    device_ids = {
        device.id for device in device_reg.devices.values() if device.area_id == area_id
    }
    lights: list[str] = []
    for entry in entity_reg.entities.values():
        if entry.domain != "light" or entry.disabled or entry.hidden_by:
            continue
        if entry.entity_category is not None:
            continue
        if entry.area_id == area_id or (
            entry.area_id is None and entry.device_id in device_ids
        ):
            lights.append(entry.entity_id)
    return without_redundant_light_groups(hass, sorted(lights))


def _read_scenes(path: str) -> list[dict[str, Any]]:
    data = load_yaml(path)
    if data is None:
        return []
    if not isinstance(data, list):
        raise HomeAssistantError(f"{SCENE_CONFIG_PATH} must be a list of scenes")
    return data


def _write_scenes(path: str, data: list[dict[str, Any]]) -> None:
    write_utf8_file_atomic(path, dump(data))
