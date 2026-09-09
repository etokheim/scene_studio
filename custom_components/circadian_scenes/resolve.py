"""Resolve variables, themes, and membership into concrete light snapshots.

Pure helpers — no hass dependency. Callers pass area-light lists and store
data; these functions resolve refs and build the dicts that
extrapolation_math / apply_entities expect.
"""

from __future__ import annotations

from typing import Any

from homeassistant.exceptions import HomeAssistantError
from homeassistant.util.color import color_temperature_to_hs

from .const import VARIABLE_REF

# ---------------------------------------------------------------------------
# Variable resolution
# ---------------------------------------------------------------------------


def resolve_variable(
    color_or_ref: dict[str, Any],
    variables: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Return a concrete color dict, resolving a variable ref if present.

    Raises HomeAssistantError on a missing variable — do not silence.
    """
    ref = color_or_ref.get(VARIABLE_REF)
    if ref is None:
        return dict(color_or_ref)
    var = variables.get(ref)
    if var is None:
        raise HomeAssistantError(
            f"Variable {ref!r} referenced but not found in the store"
        )
    resolved = dict(var["color"])
    if "brightness" in var:
        resolved["brightness"] = var["brightness"]
    return resolved


def resolve_theme_event(
    theme: dict[str, Any],
    event: str,
    variables: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Return concrete {brightness, color_mode, <color_attr>} for one theme event.

    Each theme event stores brightness separately alongside a color-or-ref.
    """
    ev = theme["events"].get(event)
    if ev is None:
        raise HomeAssistantError(
            f"Theme {theme.get('name', theme.get('id'))!r} has no event {event!r}"
        )
    color = resolve_variable(ev["color"], variables)
    brightness = color.pop("brightness", ev["brightness"])
    return {
        "brightness": brightness,
        **color,
    }


# ---------------------------------------------------------------------------
# Membership
# ---------------------------------------------------------------------------


def resolve_membership(
    area_light_ids: list[str],
    membership: dict[str, Any],
) -> list[str]:
    """Return the ordered entity_id list for a scene.

    membership = {exclude: [...], include: [...]}
    Result = (area_light_ids - exclude) ∪ include, preserving area order then
    include order for extras.
    """
    exclude = set(membership.get("exclude") or [])
    include = list(membership.get("include") or [])
    result = [eid for eid in area_light_ids if eid not in exclude]
    seen = set(result)
    for eid in include:
        if eid not in seen:
            result.append(eid)
            seen.add(eid)
    return result


# ---------------------------------------------------------------------------
# Snapshot building
# ---------------------------------------------------------------------------


def _adapt_color_for_modes(
    color: dict[str, Any],
    supported_color_modes: set[str] | None,
) -> dict[str, Any]:
    """Convert a color dict to something the lamp supports.

    Kelvin variable on an HS-only light → convert. Missing ref = error (not here).
    If supported_color_modes is None/empty we pass through unchanged and let HA
    reject it.
    """
    if not supported_color_modes:
        return dict(color)
    mode = color.get("color_mode")
    has_temp = bool({"color_temp"} & supported_color_modes)
    has_chromatic = bool({"hs", "xy", "rgb", "rgbw", "rgbww"} & supported_color_modes)
    if mode == "color_temp" and not has_temp and has_chromatic:
        kelvin = color.get("color_temp_kelvin", 4000)
        hs = color_temperature_to_hs(kelvin)
        out = {
            k: v
            for k, v in color.items()
            if k not in ("color_mode", "color_temp_kelvin")
        }
        out["color_mode"] = "hs"
        out["hs_color"] = list(hs)
        return out
    if mode in ("hs", "rgb", "rgbw", "rgbww") and not has_chromatic and has_temp:
        # Cannot represent chromatic on a temp-only light; drop the color,
        # keep brightness. The lamp will use its last-known temp.
        return {k: v for k, v in color.items() if k in ("brightness",)}
    return dict(color)


def build_circadian_event_snapshot(
    scene: dict[str, Any],
    event: str,
    variables: dict[str, dict[str, Any]],
    themes: dict[str, dict[str, Any]],
    member_ids: list[str],
    supported_modes: dict[str, set[str] | None] | None = None,
) -> dict[str, dict[str, Any]]:
    """Build a {entity_id: {state, brightness, color_mode, ...}} for one solar event.

    Resolution order per light:
    1. Per-light / per-event override in scene["overrides"]
    2. Theme event color (may itself be a variable ref)
    3. Convert for the lamp's supported_color_modes
    """
    theme_id = scene.get("theme_id")
    theme = themes.get(theme_id) if theme_id else None
    if theme is None:
        raise HomeAssistantError(
            f"Circadian scene {scene.get('scene_name', scene.get('id'))!r} "
            f"references theme {theme_id!r} which does not exist"
        )
    overrides = scene.get("overrides") or {}
    modes = supported_modes or {}
    entities: dict[str, dict[str, Any]] = {}

    # Resolve the theme event once (all un-overridden lights share it).
    theme_state = resolve_theme_event(theme, event, variables)

    for eid in member_ids:
        light_overrides = overrides.get(eid, {})
        event_override = light_overrides.get(event)
        if event_override is not None:
            # Override may itself contain a variable ref for color.
            color_part = resolve_variable(
                {
                    k: v
                    for k, v in event_override.items()
                    if k not in ("brightness", "state")
                },
                variables,
            )
            var_brightness = color_part.pop("brightness", None)
            state_dict = {
                "state": event_override.get("state", "on"),
                "brightness": event_override.get(
                    "brightness",
                    var_brightness
                    if var_brightness is not None
                    else theme_state["brightness"],
                ),
                **color_part,
            }
        else:
            state_dict = {
                "state": "on",
                **theme_state,
            }
        entities[eid] = _adapt_color_for_modes(state_dict, modes.get(eid))
    return entities


def build_simple_snapshot(
    scene: dict[str, Any],
    variables: dict[str, dict[str, Any]],
    member_ids: list[str],
    supported_modes: dict[str, set[str] | None] | None = None,
) -> dict[str, dict[str, Any]]:
    """Build a {entity_id: {state, brightness, color_mode, ...}} for a simple scene.

    Each light has its own stored state (which may contain a variable ref).
    """
    lights = scene.get("lights") or {}
    modes = supported_modes or {}
    entities: dict[str, dict[str, Any]] = {}
    for eid in member_ids:
        raw = lights.get(eid)
        if raw is None:
            entities[eid] = {"state": "off"}
            continue
        color_part = resolve_variable(
            {k: v for k, v in raw.items() if k not in ("brightness", "state")},
            variables,
        )
        var_brightness = color_part.pop("brightness", None)
        state_dict = {
            "state": raw.get("state", "on"),
            "brightness": raw.get("brightness", var_brightness if var_brightness is not None else 255),
            **color_part,
        }
        entities[eid] = _adapt_color_for_modes(state_dict, modes.get(eid))
    return entities
