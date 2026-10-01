"""Validate editor payloads before they can replace durable scene data."""

from __future__ import annotations

import math
from typing import Any

from .const import KIND_CIRCADIAN, KIND_SIMPLE, SOLAR_EVENTS, VARIABLE_REF


def _number(value: Any, field: str, minimum: float, maximum: float) -> None:
    # Compare the bounded range first: converting an enormous JSON integer to
    # float for isfinite() can overflow before we can reject it cleanly.
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not minimum <= value <= maximum
        or not math.isfinite(value)
    ):
        raise ValueError(
            f"{field} must be a finite number from {minimum:g} to {maximum:g}"
        )


def _string(value: Any, field: str, *, allow_empty: bool = False) -> None:
    if not isinstance(value, str) or (not allow_empty and not value.strip()):
        raise ValueError(f"{field} must be a non-empty string")


def _integer(value: Any, field: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{field} must be an integer")


def validate_color(value: Any, field: str, *, allow_empty: bool = False) -> None:
    """Check known HA color and Scene Studio reference fields without hardware lookup."""
    if not isinstance(value, dict) or (not value and not allow_empty):
        raise ValueError(f"{field} must be a color object")
    if VARIABLE_REF in value:
        _string(value[VARIABLE_REF], f"{field}.{VARIABLE_REF}")
    # Captured simple scenes may include a temporarily unavailable lamp.
    if "state" in value and value["state"] not in (
        "on",
        "off",
        "unavailable",
        "unknown",
    ):
        raise ValueError(f"{field}.state is unsupported")
    if "color_mode" in value and value["color_mode"] is not None:
        if value["color_mode"] not in (
            "onoff",
            "brightness",
            "hs",
            "color_temp",
            "rgb",
            "rgbw",
            "rgbww",
            "xy",
            "white",
        ):
            raise ValueError(f"{field}.color_mode is unsupported")
    for key in ("brightness", "white"):
        if key in value and value[key] is not None:
            _number(value[key], f"{field}.{key}", 0, 255)
    if "color_temp_kelvin" in value and value["color_temp_kelvin"] is not None:
        _number(value["color_temp_kelvin"], f"{field}.color_temp_kelvin", 1000, 40000)
    for key, length, maximum in (
        ("hs_color", 2, (360, 100)),
        ("rgb_color", 3, (255, 255, 255)),
        ("rgbw_color", 4, (255, 255, 255, 255)),
        ("rgbww_color", 5, (255, 255, 255, 255, 255)),
        ("xy_color", 2, (1, 1)),
    ):
        channels = value.get(key)
        if channels is None:
            continue
        if not isinstance(channels, (list, tuple)) or len(channels) != length:
            raise ValueError(f"{field}.{key} must have {length} channels")
        for index, channel in enumerate(channels):
            _number(channel, f"{field}.{key}[{index}]", 0, maximum[index])
    for key in ("palette_t", "palette_r"):
        if key in value and value[key] is not None:
            _number(value[key], f"{field}.{key}", 0, 1)
    if "assignment_seed" in value and value["assignment_seed"] is not None:
        _integer(value["assignment_seed"], f"{field}.assignment_seed")
    if "effect" in value and value["effect"] is not None:
        _string(value["effect"], f"{field}.effect", allow_empty=True)
    if "color" in value:
        validate_color(value["color"], f"{field}.color")


def validate_scene_input(raw: Any) -> None:
    """Reject broken scene structure while allowing temporarily absent lights/areas."""
    if not isinstance(raw, dict):
        raise ValueError("Scene data must be an object")
    kind = raw.get("kind", KIND_CIRCADIAN)
    if kind not in (KIND_CIRCADIAN, KIND_SIMPLE):
        raise ValueError("Scene kind is unsupported")
    _string(raw.get("scene_name") or raw.get("name"), "Scene name")
    for key in ("area", "theme_id", "palette_id", "icon", "description", "category"):
        if raw.get(key) is not None:
            _string(raw[key], key, allow_empty=True)
    if "labels" in raw:
        if not isinstance(raw["labels"], list):
            raise ValueError("labels must be a list")
        for label in raw["labels"]:
            _string(label, "labels item")
    membership = raw.get("membership", {"include": [], "exclude": []})
    if not isinstance(membership, dict):
        raise ValueError("membership must be an object")
    for key in ("include", "exclude"):
        entries = membership.get(key, [])
        if not isinstance(entries, list):
            raise ValueError(f"membership.{key} must be a list")
        for entity_id in entries:
            _string(entity_id, f"membership.{key} item")
    if kind == KIND_SIMPLE:
        lights = raw.get("lights", {})
        if not isinstance(lights, dict):
            raise ValueError("lights must be an object")
        for entity_id, config in lights.items():
            _string(entity_id, "light entity ID")
            validate_color(config, f"lights.{entity_id}", allow_empty=True)
        if "assignment_seed" in raw:
            _integer(raw["assignment_seed"], "assignment_seed")
        return
    if "automatically_update_lights" in raw and not isinstance(
        raw["automatically_update_lights"], bool
    ):
        raise ValueError("automatically_update_lights must be a boolean")
    overrides = raw.get("overrides", {})
    if not isinstance(overrides, dict):
        raise ValueError("overrides must be an object")
    for entity_id, events in overrides.items():
        _string(entity_id, "override light ID")
        if not isinstance(events, dict):
            raise ValueError(f"overrides.{entity_id} must be an object")
        for event, config in events.items():
            if event not in SOLAR_EVENTS:
                raise ValueError(f"Unsupported override event {event!r}")
            validate_color(config, f"overrides.{entity_id}.{event}", allow_empty=True)
    palettes = raw.get("event_palettes", {})
    if not isinstance(palettes, dict):
        raise ValueError("event_palettes must be an object")
    for event, config in palettes.items():
        if event not in SOLAR_EVENTS or not isinstance(config, dict):
            raise ValueError(f"Invalid event palette {event!r}")
        _string(config.get("palette_id"), f"event_palettes.{event}.palette_id")
        if "assignment_seed" in config:
            _integer(
                config["assignment_seed"], f"event_palettes.{event}.assignment_seed"
            )
        if "brightness_adjustment" in config:
            adjustment = config["brightness_adjustment"]
            field = f"event_palettes.{event}.brightness_adjustment"
            if not isinstance(adjustment, dict):
                raise ValueError(f"{field} must be an object")
            if set(adjustment) == {"level"}:
                _number(adjustment["level"], f"{field}.level", 0, 255)
            elif set(adjustment) == {"scale", "ceiling"}:
                _number(
                    adjustment["scale"],
                    f"{field}.scale",
                    0,
                    float("1.7976931348623157e308"),
                )
                _number(adjustment["ceiling"], f"{field}.ceiling", 0, 255)
            else:
                raise ValueError(f"{field} requires level or scale and ceiling")


def validate_variable_input(raw: Any) -> None:
    """Require complete shared color or five-slot palette data."""
    if not isinstance(raw, dict):
        raise ValueError("Preset data must be an object")
    kind = raw.get("kind") or ("palette" if raw.get("slots") else "color")
    if kind not in ("color", "palette"):
        raise ValueError("Preset kind is unsupported")
    _string(raw.get("name"), "Preset name")
    if kind == "color":
        validate_color(raw.get("color"), "color")
        if VARIABLE_REF in raw["color"]:
            raise ValueError("A color preset cannot reference another preset")
        if "brightness" in raw:
            _number(raw["brightness"], "brightness", 0, 255)
        return
    slots = raw.get("slots")
    if not isinstance(slots, list) or len(slots) != 5:
        raise ValueError("Palette must have exactly five slots")
    for index, slot in enumerate(slots):
        validate_color(slot, f"slots[{index}]")


def validate_theme_input(raw: Any) -> None:
    """Require every solar event and a usable color/brightness structure."""
    if not isinstance(raw, dict):
        raise ValueError("Theme data must be an object")
    _string(raw.get("name"), "Theme name")
    events = raw.get("events")
    if not isinstance(events, dict):
        raise ValueError("Theme events must be an object")
    missing = set(SOLAR_EVENTS) - events.keys()
    if missing:
        raise ValueError("Theme is missing events: " + ", ".join(sorted(missing)))
    for event, config in events.items():
        if event not in SOLAR_EVENTS or not isinstance(config, dict):
            raise ValueError(f"Invalid theme event {event!r}")
        validate_color(config.get("color"), f"events.{event}.color")
        _number(config.get("brightness"), f"events.{event}.brightness", 0, 255)
        if "assignment_seed" in config:
            _integer(config["assignment_seed"], f"events.{event}.assignment_seed")
