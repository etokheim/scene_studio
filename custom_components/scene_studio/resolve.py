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
from .palette import (
    resolve_palette_color,
    variable_is_palette,
)

# ---------------------------------------------------------------------------
# Variable resolution
# ---------------------------------------------------------------------------


def resolve_variable(
    color_or_ref: dict[str, Any],
    variables: dict[str, dict[str, Any]],
    *,
    entity_id: str | None = None,
    seed: int = 0,
    palette_t: float | None = None,
    palette_r: float | None = None,
) -> dict[str, Any]:
    """Return a concrete color dict, resolving a variable or palette ref.

    Palettes pick a slot from (seed, entity_id) unless palette_t/r pin a
    position on the palette wheel. Raises HomeAssistantError on a missing
    variable — do not silence.
    """
    ref = color_or_ref.get(VARIABLE_REF)
    if ref is None:
        return dict(color_or_ref)
    var = variables.get(ref)
    if var is None:
        raise HomeAssistantError(
            f"Variable {ref!r} referenced but not found in the store"
        )
    if variable_is_palette(var):
        t = color_or_ref.get("palette_t", palette_t)
        r = color_or_ref.get("palette_r", palette_r)
        return resolve_palette_color(
            var,
            variables,
            entity_id=entity_id,
            seed=int(color_or_ref.get("assignment_seed", seed) or 0),
            palette_t=t,
            palette_r=r,
        )
    resolved = dict(var.get("color") or {})
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
    color = resolve_variable(
        ev["color"],
        variables,
        seed=int(ev.get("assignment_seed") or 0),
    )
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
    reject it. On/off lamps keep only on or off. Brightness-only lamps keep
    level and lose color.
    """
    if not supported_color_modes:
        return dict(color)
    modes = set(supported_color_modes)
    if modes <= {"onoff"}:
        state = color.get("state", "on")
        if state != "off" and color.get("brightness") == 0:
            state = "off"
        return {"state": "off" if state == "off" else "on"}
    mode = color.get("color_mode")
    has_temp = bool({"color_temp"} & modes)
    has_chromatic = bool({"hs", "xy", "rgb", "rgbw", "rgbww"} & modes)
    if not has_temp and not has_chromatic:
        out: dict[str, Any] = {"state": color.get("state", "on")}
        if color.get("brightness") is not None:
            out["brightness"] = color["brightness"]
        elif out["state"] != "off":
            out["brightness"] = 255
        return out
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
    2. Scene event palette
    3. Theme event color (may itself be a variable ref)
    4. Convert for the lamp's supported_color_modes
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
    ev = theme["events"].get(event) or {}
    seed = int(ev.get("assignment_seed") or 0)
    # Scene base for this event. Lights with an override still win. The theme
    # record is left alone.
    event_palette = (scene.get("event_palettes") or {}).get(event) or {}
    scene_palette_id = event_palette.get("palette_id") or None
    scene_palette = variables.get(scene_palette_id) if scene_palette_id else None
    scene_is_palette = variable_is_palette(scene_palette)
    scene_seed = int(event_palette.get("assignment_seed") or 0)
    theme_ref = (ev.get("color") or {}).get(VARIABLE_REF)
    theme_var = variables.get(theme_ref) if theme_ref else None
    theme_is_palette = variable_is_palette(theme_var)

    # Solid theme colors are shared; palettes assign per light.
    theme_state = (
        None if theme_is_palette else resolve_theme_event(theme, event, variables)
    )

    for eid in member_ids:
        light_overrides = overrides.get(eid, {})
        event_override = light_overrides.get(event) or {}
        # Resolve the inherited look first. An override changes only fields
        # it actually stores; brightness-only edits must retain palette color.
        if scene_is_palette or theme_is_palette:
            color_part = resolve_variable(
                (
                    {VARIABLE_REF: scene_palette_id}
                    if scene_is_palette
                    else ev.get("color") or {}
                ),
                variables,
                entity_id=eid,
                seed=scene_seed if scene_is_palette else seed,
            )
            state_dict = {
                "state": "on",
                "brightness": color_part.pop("brightness", ev.get("brightness", 255)),
                **color_part,
            }
        else:
            state_dict = {"state": "on", **theme_state}
        color_override = {
            key: value
            for key, value in event_override.items()
            if key not in ("brightness", "state", "effect")
        }
        if color_override:
            color_part = resolve_variable(
                color_override,
                variables,
                entity_id=eid,
                seed=seed,
            )
            # A color reference does not implicitly override brightness.
            color_part.pop("brightness", None)
            state_dict = {
                key: value
                for key, value in state_dict.items()
                if key in ("brightness", "state", "effect")
            }
            state_dict.update(color_part)
        for key in ("brightness", "state", "effect"):
            if key in event_override:
                state_dict[key] = event_override[key]
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
            # Members with no stored color still inherit the scene palette.
            palette_id = scene.get("palette_id")
            if palette_id:
                raw = {VARIABLE_REF: palette_id}
            else:
                entities[eid] = {"state": "off"}
                continue
        color_part = resolve_variable(
            {k: v for k, v in raw.items() if k not in ("brightness", "state")},
            variables,
            entity_id=eid,
            seed=int(raw.get("assignment_seed") or scene.get("assignment_seed") or 0),
        )
        var_brightness = color_part.pop("brightness", None)
        state_dict = {
            "state": raw.get("state", "on"),
            "brightness": raw.get(
                "brightness", var_brightness if var_brightness is not None else 255
            ),
            **color_part,
        }
        entities[eid] = _adapt_color_for_modes(state_dict, modes.get(eid))
    return entities
