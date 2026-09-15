"""Palette variables: five slots, stable per-light assignment, polar wheel sample."""

from __future__ import annotations

from typing import Any

from homeassistant.exceptions import HomeAssistantError

from .color_math import clamp_rgb, hs_to_rgb, kelvin_to_rgb, rgb_to_hs
from .const import VARIABLE_REF

PALETTE_SLOT_COUNT = 5
KIND_COLOR = "color"
KIND_PALETTE = "palette"

_EMPTY_SLOT = {
    "color_mode": "hs",
    "hs_color": [0, 0],
    "brightness": 255,
}


def variable_is_palette(var: dict[str, Any] | None) -> bool:
    """True when this catalog item is a 5-slot palette."""
    if not var:
        return False
    return var.get("kind") == KIND_PALETTE or bool(var.get("slots"))


def assignment_slot(entity_id: str, seed: int) -> int:
    """Stable slot 0–4. Same (seed, entity_id) always maps to the same slot.

    New lights do not reshuffle existing ones. Changing seed (Randomize)
    remaps every unpinned light. FNV-1a so the panel can match without SHA.
    """
    h = (2166136261 ^ (int(seed) & 0xFFFFFFFF)) & 0xFFFFFFFF
    for byte in f"{entity_id}".encode("utf-8"):
        h ^= byte
        h = (h * 16777619) & 0xFFFFFFFF
    return h % PALETTE_SLOT_COUNT


def assignment_t_r(entity_id: str, seed: int) -> tuple[float, float]:
    """Rim stop for an auto-assigned slot (center of that wedge)."""
    slot = assignment_slot(entity_id, seed)
    return ((slot + 0.5) / PALETTE_SLOT_COUNT) % 1.0, 1.0


def _color_to_rgb(color: dict[str, Any]) -> tuple[int, int, int]:
    if color.get("hs_color"):
        hue, sat = color["hs_color"]
        return hs_to_rgb(float(hue), float(sat))
    if color.get("rgb_color"):
        rgb = color["rgb_color"]
        return clamp_rgb(rgb[0], rgb[1], rgb[2])
    if color.get("color_temp_kelvin") is not None:
        return kelvin_to_rgb(color["color_temp_kelvin"])
    return (255, 255, 255)


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def resolve_slot(
    palette: dict[str, Any],
    index: int,
    variables: dict[str, dict[str, Any]],
    *,
    _stack: frozenset[str] | None = None,
) -> dict[str, Any]:
    """Concrete color+brightness for one palette slot. Slots may ref solid variables only."""
    slots = list(palette.get("slots") or [])
    while len(slots) < PALETTE_SLOT_COUNT:
        slots.append(dict(_EMPTY_SLOT))
    slot = slots[index % PALETTE_SLOT_COUNT]
    if not isinstance(slot, dict):
        slot = dict(_EMPTY_SLOT)
    pal_id = palette.get("id")
    stack = set(_stack or ())
    if pal_id:
        stack.add(str(pal_id))
    ref = slot.get(VARIABLE_REF)
    if ref:
        if ref in stack:
            raise HomeAssistantError(
                f"Palette {pal_id!r} slot {index} cycles through {ref!r}"
            )
        nested = variables.get(ref)
        if nested is None:
            raise HomeAssistantError(
                f"Variable {ref!r} referenced but not found in the store"
            )
        if variable_is_palette(nested):
            raise HomeAssistantError(
                f"Palette slot cannot reference another palette ({ref!r})"
            )
        resolved = dict(nested.get("color") or {})
        if "brightness" in nested:
            resolved["brightness"] = nested["brightness"]
        return resolved
    color = slot.get("color") if isinstance(slot.get("color"), dict) else slot
    out = {
        k: v
        for k, v in color.items()
        if k not in ("brightness", VARIABLE_REF, "slots", "kind")
    }
    if "brightness" in slot:
        out["brightness"] = slot["brightness"]
    elif "brightness" in color:
        out["brightness"] = color["brightness"]
    else:
        out["brightness"] = 255
    if not out.get("color_mode") and not out.get("hs_color") and not out.get(
        "rgb_color"
    ) and out.get("color_temp_kelvin") is None:
        out.update(_EMPTY_SLOT)
    return out


def sample_palette_wheel(
    palette: dict[str, Any],
    t: float,
    r: float,
    variables: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Color at polar (t around rim, r from white center) on the palette wheel."""
    turns = t % 1.0
    sat = max(0.0, min(1.0, float(r)))
    scaled = turns * PALETTE_SLOT_COUNT
    i0 = int(scaled) % PALETTE_SLOT_COUNT
    i1 = (i0 + 1) % PALETTE_SLOT_COUNT
    frac = scaled - int(scaled)
    a = resolve_slot(palette, i0, variables)
    b = resolve_slot(palette, i1, variables)
    rgb_a = _color_to_rgb(a)
    rgb_b = _color_to_rgb(b)
    rim = tuple(_lerp(rgb_a[c], rgb_b[c], frac) for c in range(3))
    mixed = tuple(_lerp(255.0, rim[c], sat) for c in range(3))
    rgb = clamp_rgb(mixed[0], mixed[1], mixed[2])
    bri = int(
        round(
            _lerp(
                float(a.get("brightness", 255)),
                float(b.get("brightness", 255)),
                frac,
            )
        )
    )
    hs = rgb_to_hs(*rgb)
    return {
        "color_mode": "hs",
        "hs_color": [hs[0], hs[1]],
        "rgb_color": list(rgb),
        "brightness": max(0, min(255, bri)),
    }


def resolve_palette_color(
    palette: dict[str, Any],
    variables: dict[str, dict[str, Any]],
    *,
    entity_id: str | None = None,
    seed: int = 0,
    palette_t: float | None = None,
    palette_r: float | None = None,
) -> dict[str, Any]:
    """Auto-assign from seed+entity, or sample a stored wheel position."""
    if palette_t is not None and palette_r is not None:
        t, r = float(palette_t), float(palette_r)
    elif entity_id:
        t, r = assignment_t_r(entity_id, seed)
    else:
        t, r = 0.1, 1.0
    return sample_palette_wheel(palette, t, r, variables)


def normalize_palette_slots(raw: Any) -> list[dict[str, Any]]:
    """Always five slot dicts for storage."""
    slots_in = list(raw or [])
    out: list[dict[str, Any]] = []
    for i in range(PALETTE_SLOT_COUNT):
        item = slots_in[i] if i < len(slots_in) and isinstance(slots_in[i], dict) else {}
        if item.get(VARIABLE_REF):
            out.append({VARIABLE_REF: item[VARIABLE_REF]})
            continue
        color = item.get("color") if isinstance(item.get("color"), dict) else item
        slot = {
            "color": {
                k: v
                for k, v in (color or {}).items()
                if k not in ("brightness", VARIABLE_REF, "slots", "kind", "color")
            },
            "brightness": item.get("brightness", color.get("brightness", 255) if isinstance(color, dict) else 255),
        }
        if not slot["color"]:
            hue = (i / PALETTE_SLOT_COUNT) * 360.0
            slot["color"] = {"color_mode": "hs", "hs_color": [hue, 70]}
            slot["brightness"] = 255
        out.append(slot)
    return out
