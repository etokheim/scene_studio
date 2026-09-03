"""Hass-aware snapshot builders for activation, preview, and scene cards."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant

from .color_math import entity_rgb
from .const import KIND_CIRCADIAN, KIND_SIMPLE, SOLAR_EVENTS
from .native_scene import lights_in_area
from .resolve import (
    build_circadian_event_snapshot,
    build_simple_snapshot,
    resolve_membership,
)
from .store import CircadianScenesStore


def supported_modes(hass: HomeAssistant, entity_id: str) -> set[str] | None:
    """Return the lamp's supported_color_modes, or None if unknown."""
    state = hass.states.get(entity_id)
    if state is None:
        return None
    modes = state.attributes.get("supported_color_modes")
    if not modes:
        return None
    return set(modes)


def scene_members(hass: HomeAssistant, scene: dict[str, Any]) -> list[str]:
    """Resolve membership for a stored scene."""
    area_id = scene.get("area")
    area_lights = lights_in_area(hass, area_id) if area_id else []
    return resolve_membership(area_lights, scene.get("membership") or {})


def modes_map(hass: HomeAssistant, entity_ids: list[str]) -> dict[str, set[str] | None]:
    """Map entity_id → supported color modes."""
    return {eid: supported_modes(hass, eid) for eid in entity_ids}


def circadian_anchor(
    hass: HomeAssistant,
    store: CircadianScenesStore,
    scene: dict[str, Any],
    event: str,
) -> dict[str, Any]:
    """In-memory scene dict for one solar event (extrapolate_entities shape)."""
    members = scene_members(hass, scene)
    entities = build_circadian_event_snapshot(
        scene,
        event,
        store.variables,
        store.themes,
        members,
        modes_map(hass, members),
    )
    return {
        "name": event,
        "entity_id": None,
        "entities": entities,
    }


def simple_anchor(
    hass: HomeAssistant,
    store: CircadianScenesStore,
    scene: dict[str, Any],
) -> dict[str, Any]:
    """In-memory scene dict for a simple scene."""
    members = scene_members(hass, scene)
    entities = build_simple_snapshot(
        scene,
        store.variables,
        members,
        modes_map(hass, members),
    )
    return {
        "name": scene.get("scene_name") or "simple",
        "entity_id": None,
        "entities": entities,
    }


def card_colors(
    hass: HomeAssistant,
    store: CircadianScenesStore,
    scene: dict[str, Any],
) -> dict[str, Any]:
    """Resolved RGB for scene-card backgrounds."""
    members = scene_members(hass, scene)
    if scene.get("kind") == KIND_SIMPLE:
        snap = build_simple_snapshot(
            scene, store.variables, members, modes_map(hass, members)
        )
        dots = []
        for eid in members:
            rgb = entity_rgb(snap.get(eid) or {})
            if rgb:
                dots.append({"entity_id": eid, "rgb": list(rgb)})
        return {"kind": KIND_SIMPLE, "dots": dots}
    ramps = []
    if scene.get("kind") == KIND_CIRCADIAN:
        per_event = {
            event: build_circadian_event_snapshot(
                scene,
                event,
                store.variables,
                store.themes,
                members,
                modes_map(hass, members),
            )
            for event in SOLAR_EVENTS
        }
        for eid in members:
            stops = []
            for event in SOLAR_EVENTS:
                rgb = entity_rgb(per_event[event].get(eid) or {})
                if rgb:
                    stops.append(list(rgb))
            if stops:
                ramps.append({"entity_id": eid, "stops": stops})
    return {"kind": scene.get("kind") or KIND_CIRCADIAN, "ramps": ramps}
