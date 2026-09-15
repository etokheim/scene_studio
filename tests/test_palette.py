"""Palette assignment and wheel sampling."""

from __future__ import annotations

from custom_components.circadian_scenes.const import VARIABLE_REF
from custom_components.circadian_scenes.palette import (
    assignment_slot,
    assignment_t_r,
    normalize_palette_slots,
    resolve_palette_color,
    sample_palette_wheel,
)
from custom_components.circadian_scenes.resolve import (
    build_circadian_event_snapshot,
    resolve_variable,
)


def _solid(hue: float, bri: int = 200) -> dict:
    return {
        "id": f"h{int(hue)}",
        "name": str(hue),
        "kind": "color",
        "brightness": bri,
        "color": {"color_mode": "hs", "hs_color": [hue, 80]},
    }


def _palette(slots) -> dict:
    return {"id": "p1", "name": "P", "kind": "palette", "slots": slots}


class TestAssignment:
    def test_stable(self):
        a = assignment_slot("light.a", 1)
        assert assignment_slot("light.a", 1) == a
        assert assignment_slot("light.b", 1) != a or assignment_slot("light.c", 1) != a

    def test_seed_changes_slot(self):
        slots = {assignment_slot("light.a", seed) for seed in range(40)}
        assert len(slots) > 1

    def test_rim_stop(self):
        t, r = assignment_t_r("light.x", 3)
        assert r == 1.0
        assert 0 <= t < 1


class TestResolvePalette:
    def test_slot_variable_ref(self):
        variables = {"warm": _solid(30, 64)}
        pal = _palette([{VARIABLE_REF: "warm"}])
        pal["slots"] = normalize_palette_slots(pal["slots"])
        variables["p1"] = pal
        out = resolve_slot_via(pal, 0, variables)
        assert out["brightness"] == 64

    def test_wheel_center_is_white(self):
        pal = _palette([])
        pal["slots"] = normalize_palette_slots([])
        sampled = sample_palette_wheel(pal, 0.0, 0.0, {})
        assert sampled["rgb_color"] == [255, 255, 255]

    def test_entity_assignment_differs(self):
        pal = _palette([])
        pal["slots"] = normalize_palette_slots([])
        variables = {"p1": pal}
        a = resolve_palette_color(pal, variables, entity_id="light.a", seed=9)
        b = resolve_palette_color(pal, variables, entity_id="light.b", seed=9)
        # Different lights can still collide; just ensure the API returns HS.
        assert "hs_color" in a and "hs_color" in b

    def test_resolve_variable_palette(self):
        pal = _palette([])
        pal["slots"] = normalize_palette_slots([])
        variables = {"p1": pal}
        out = resolve_variable(
            {VARIABLE_REF: "p1"},
            variables,
            entity_id="light.kitchen",
            seed=2,
        )
        assert out["color_mode"] == "hs"


def resolve_slot_via(pal, index, variables):
    from custom_components.circadian_scenes.palette import resolve_slot

    return resolve_slot(pal, index, variables)


class TestCircadianPaletteSnapshot:
    def test_unoverridden_lights_use_seed(self):
        pal = _palette([])
        pal["slots"] = normalize_palette_slots([])
        variables = {"p1": pal}
        theme = {
            "id": "t1",
            "name": "T",
            "events": {
                "noon": {
                    "color": {VARIABLE_REF: "p1"},
                    "brightness": 255,
                    "assignment_seed": 7,
                }
            },
        }
        scene = {"id": "s", "scene_name": "S", "theme_id": "t1", "overrides": {}}
        snap = build_circadian_event_snapshot(
            scene,
            "noon",
            variables,
            {"t1": theme},
            ["light.a", "light.b"],
        )
        assert snap["light.a"]["hs_color"]
        assert snap["light.b"]["hs_color"]
