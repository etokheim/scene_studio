"""Tests for resolve.py: variable/theme resolution, membership, snapshot building."""

from __future__ import annotations

import pytest
from homeassistant.exceptions import HomeAssistantError

from custom_components.scene_studio.const import VARIABLE_REF
from custom_components.scene_studio.resolve import (
    _adapt_color_for_modes,
    build_circadian_event_snapshot,
    build_simple_snapshot,
    resolve_membership,
    resolve_theme_event,
    resolve_variable,
)

# ---------------------------------------------------------------------------
# resolve_variable
# ---------------------------------------------------------------------------


class TestResolveVariable:
    def test_fixed_color_passthrough(self):
        color = {"color_mode": "hs", "hs_color": [30, 80]}
        assert resolve_variable(color, {}) == color

    def test_variable_ref(self):
        variables = {
            "warm": {
                "id": "warm",
                "name": "Warm",
                "color": {"color_mode": "color_temp", "color_temp_kelvin": 2700},
            },
        }
        result = resolve_variable({VARIABLE_REF: "warm"}, variables)
        assert result == {"color_mode": "color_temp", "color_temp_kelvin": 2700}

    def test_variable_ref_includes_brightness(self):
        variables = {
            "warm": {
                "id": "warm",
                "name": "Warm",
                "brightness": 64,
                "color": {"color_mode": "color_temp", "color_temp_kelvin": 2700},
            },
        }
        result = resolve_variable({VARIABLE_REF: "warm"}, variables)
        assert result["brightness"] == 64
        assert result["color_temp_kelvin"] == 2700

    def test_missing_variable_raises(self):
        with pytest.raises(HomeAssistantError, match="not found"):
            resolve_variable({VARIABLE_REF: "gone"}, {})


# ---------------------------------------------------------------------------
# resolve_theme_event
# ---------------------------------------------------------------------------


class TestResolveThemeEvent:
    def _theme(self):
        return {
            "id": "t1",
            "name": "Test",
            "events": {
                "dawn": {
                    "color": {VARIABLE_REF: "warm"},
                    "brightness": 100,
                },
                "noon": {
                    "color": {"color_mode": "color_temp", "color_temp_kelvin": 5000},
                    "brightness": 255,
                },
            },
        }

    def _variables(self):
        return {
            "warm": {
                "id": "warm",
                "name": "Warm",
                "color": {"color_mode": "color_temp", "color_temp_kelvin": 2700},
            },
        }

    def test_resolves_variable_ref(self):
        result = resolve_theme_event(self._theme(), "dawn", self._variables())
        assert result["brightness"] == 100
        assert result["color_mode"] == "color_temp"
        assert result["color_temp_kelvin"] == 2700

    def test_variable_brightness_overrides_theme_event(self):
        variables = {
            "warm": {
                "id": "warm",
                "name": "Warm",
                "brightness": 40,
                "color": {"color_mode": "color_temp", "color_temp_kelvin": 2700},
            },
        }
        result = resolve_theme_event(self._theme(), "dawn", variables)
        assert result["brightness"] == 40

    def test_fixed_color(self):
        result = resolve_theme_event(self._theme(), "noon", {})
        assert result["brightness"] == 255
        assert result["color_temp_kelvin"] == 5000

    def test_missing_event_raises(self):
        with pytest.raises(HomeAssistantError, match="no event"):
            resolve_theme_event(self._theme(), "sunset", {})


# ---------------------------------------------------------------------------
# resolve_membership
# ---------------------------------------------------------------------------


class TestResolveMembership:
    def test_area_only(self):
        result = resolve_membership(
            ["light.a", "light.b", "light.c"],
            {"exclude": [], "include": []},
        )
        assert result == ["light.a", "light.b", "light.c"]

    def test_exclude(self):
        result = resolve_membership(
            ["light.a", "light.b", "light.c"],
            {"exclude": ["light.b"], "include": []},
        )
        assert result == ["light.a", "light.c"]

    def test_include_extras(self):
        result = resolve_membership(
            ["light.a"],
            {"exclude": [], "include": ["light.z"]},
        )
        assert result == ["light.a", "light.z"]

    def test_include_deduplicates(self):
        result = resolve_membership(
            ["light.a"],
            {"exclude": [], "include": ["light.a", "light.z"]},
        )
        assert result == ["light.a", "light.z"]

    def test_empty_area(self):
        result = resolve_membership(
            [],
            {"exclude": [], "include": ["light.extra"]},
        )
        assert result == ["light.extra"]


# ---------------------------------------------------------------------------
# _adapt_color_for_modes
# ---------------------------------------------------------------------------


class TestAdaptColorForModes:
    def test_no_modes_passthrough(self):
        color = {
            "color_mode": "color_temp",
            "color_temp_kelvin": 3000,
            "brightness": 200,
        }
        assert _adapt_color_for_modes(color, None) == color

    def test_kelvin_to_hs(self):
        color = {
            "color_mode": "color_temp",
            "color_temp_kelvin": 4000,
            "brightness": 200,
        }
        result = _adapt_color_for_modes(color, {"hs"})
        assert result["color_mode"] == "hs"
        assert "hs_color" in result
        assert "color_temp_kelvin" not in result
        assert result.get("brightness") == 200

    def test_chromatic_on_temp_only(self):
        color = {"color_mode": "hs", "hs_color": [30, 80], "brightness": 128}
        result = _adapt_color_for_modes(color, {"color_temp"})
        assert "hs_color" not in result
        assert result.get("brightness") == 128

    def test_native_mode_passthrough(self):
        color = {"color_mode": "color_temp", "color_temp_kelvin": 3000}
        assert _adapt_color_for_modes(color, {"color_temp", "hs"}) == color

    def test_onoff_drops_color_and_brightness(self):
        color = {
            "state": "on",
            "color_mode": "hs",
            "hs_color": [30, 80],
            "brightness": 180,
        }
        assert _adapt_color_for_modes(color, {"onoff"}) == {"state": "on"}

    def test_onoff_zero_brightness_is_off(self):
        color = {"state": "on", "brightness": 0, "color_mode": "hs", "hs_color": [0, 0]}
        assert _adapt_color_for_modes(color, {"onoff"}) == {"state": "off"}

    def test_brightness_only_keeps_level(self):
        color = {
            "state": "on",
            "color_mode": "hs",
            "hs_color": [30, 80],
            "brightness": 180,
        }
        assert _adapt_color_for_modes(color, {"brightness"}) == {
            "state": "on",
            "brightness": 180,
        }


# ---------------------------------------------------------------------------
# build_circadian_event_snapshot
# ---------------------------------------------------------------------------


class TestBuildCircadianEventSnapshot:
    def _setup(self):
        variables = {
            "warm": {
                "id": "warm",
                "name": "Warm",
                "color": {"color_mode": "color_temp", "color_temp_kelvin": 2700},
            },
        }
        themes = {
            "default": {
                "id": "default",
                "name": "Default",
                "events": {
                    "dawn": {"color": {VARIABLE_REF: "warm"}, "brightness": 100},
                    "sunrise": {"color": {VARIABLE_REF: "warm"}, "brightness": 200},
                    "noon": {
                        "color": {
                            "color_mode": "color_temp",
                            "color_temp_kelvin": 5000,
                        },
                        "brightness": 255,
                    },
                    "sunset": {"color": {VARIABLE_REF: "warm"}, "brightness": 180},
                    "dusk": {"color": {VARIABLE_REF: "warm"}, "brightness": 64},
                },
            }
        }
        scene = {
            "id": "s1",
            "kind": "circadian",
            "theme_id": "default",
            "membership": {"exclude": [], "include": []},
            "overrides": {},
        }
        return variables, themes, scene

    def test_all_lights_get_theme_color(self):
        variables, themes, scene = self._setup()
        snap = build_circadian_event_snapshot(
            scene,
            "dawn",
            variables,
            themes,
            member_ids=["light.a", "light.b"],
        )
        assert len(snap) == 2
        assert snap["light.a"]["brightness"] == 100
        assert snap["light.a"]["color_temp_kelvin"] == 2700
        assert snap["light.b"]["state"] == "on"

    def test_override_takes_precedence(self):
        variables, themes, scene = self._setup()
        scene["overrides"] = {
            "light.a": {
                "dawn": {
                    "state": "on",
                    "brightness": 50,
                    "color_mode": "hs",
                    "hs_color": [0, 100],
                }
            }
        }
        snap = build_circadian_event_snapshot(
            scene,
            "dawn",
            variables,
            themes,
            member_ids=["light.a", "light.b"],
        )
        assert snap["light.a"]["brightness"] == 50
        assert snap["light.a"]["hs_color"] == [0, 100]
        # light.b still gets theme color.
        assert snap["light.b"]["color_temp_kelvin"] == 2700

    def test_override_with_variable_ref(self):
        variables, themes, scene = self._setup()
        scene["overrides"] = {
            "light.a": {
                "dawn": {
                    VARIABLE_REF: "warm",
                    "brightness": 30,
                }
            }
        }
        snap = build_circadian_event_snapshot(
            scene,
            "dawn",
            variables,
            themes,
            member_ids=["light.a"],
        )
        assert snap["light.a"]["color_temp_kelvin"] == 2700
        assert snap["light.a"]["brightness"] == 30

    def test_missing_theme_raises(self):
        variables, themes, scene = self._setup()
        scene["theme_id"] = "nonexistent"
        with pytest.raises(HomeAssistantError, match="does not exist"):
            build_circadian_event_snapshot(
                scene,
                "dawn",
                variables,
                themes,
                member_ids=["light.a"],
            )

    def test_color_adapted_for_hs_only_lamp(self):
        variables, themes, scene = self._setup()
        snap = build_circadian_event_snapshot(
            scene,
            "dawn",
            variables,
            themes,
            member_ids=["light.a"],
            supported_modes={"light.a": {"hs"}},
        )
        assert snap["light.a"]["color_mode"] == "hs"
        assert "hs_color" in snap["light.a"]
        assert "color_temp_kelvin" not in snap["light.a"]


# ---------------------------------------------------------------------------
# build_simple_snapshot
# ---------------------------------------------------------------------------


class TestBuildSimpleSnapshot:
    def test_basic(self):
        variables = {
            "cool": {
                "id": "cool",
                "name": "Cool",
                "color": {"color_mode": "color_temp", "color_temp_kelvin": 5000},
            },
        }
        scene = {
            "id": "s2",
            "kind": "simple",
            "lights": {
                "light.a": {
                    "state": "on",
                    "brightness": 200,
                    "color_mode": "color_temp",
                    "color_temp_kelvin": 3000,
                },
                "light.b": {"state": "on", "brightness": 128, VARIABLE_REF: "cool"},
            },
        }
        snap = build_simple_snapshot(scene, variables, ["light.a", "light.b"])
        assert snap["light.a"]["color_temp_kelvin"] == 3000
        assert snap["light.b"]["color_temp_kelvin"] == 5000
        assert snap["light.b"]["brightness"] == 128

    def test_missing_light_inherits_palette_base(self):
        palette = {
            "id": "pal",
            "kind": "palette",
            "slots": [
                {
                    "color": {"color_mode": "hs", "hs_color": [i * 72, 80]},
                    "brightness": 200,
                }
                for i in range(5)
            ],
        }
        scene = {
            "id": "s",
            "kind": "simple",
            "palette_id": "pal",
            "assignment_seed": 3,
            "lights": {
                "light.kept": {
                    "state": "on",
                    "brightness": 40,
                    "color_mode": "hs",
                    "hs_color": [10, 10],
                }
            },
        }
        snap = build_simple_snapshot(
            scene, {"pal": palette}, ["light.kept", "light.a", "light.b"]
        )
        assert snap["light.kept"]["hs_color"] == [10, 10]
        assert snap["light.kept"]["brightness"] == 40
        assert snap["light.a"]["state"] == "on"
        assert snap["light.b"]["state"] == "on"
        assert "hs_color" in snap["light.a"]
        assert "hs_color" in snap["light.b"]

    def test_missing_light_defaults_off(self):
        snap = build_simple_snapshot(
            {"id": "x", "kind": "simple", "lights": {}},
            {},
            ["light.missing"],
        )
        assert snap["light.missing"]["state"] == "off"

    def test_variable_ref_in_light(self):
        variables = {
            "v1": {
                "id": "v1",
                "name": "V",
                "color": {"color_mode": "hs", "hs_color": [120, 50]},
            },
        }
        scene = {
            "id": "x",
            "kind": "simple",
            "lights": {
                "light.a": {"state": "on", "brightness": 100, VARIABLE_REF: "v1"}
            },
        }
        snap = build_simple_snapshot(scene, variables, ["light.a"])
        assert snap["light.a"]["hs_color"] == [120, 50]


@pytest.mark.parametrize(
    ("override", "brightness", "kelvin"),
    [
        ({"brightness": 40}, 40, None),
        ({"color_mode": "color_temp", "color_temp_kelvin": 4000}, 100, 4000),
        ({"state": "off"}, 100, None),
    ],
)
def test_partial_event_overrides_inherit_other_palette_fields(
    override, brightness, kelvin
):
    palette = {
        "id": "p",
        "kind": "palette",
        "slots": [
            {
                "color": {"color_mode": "rgb", "rgb_color": [255, 0, 0]},
                "brightness": 100,
            }
            for _ in range(5)
        ],
    }
    scene = {
        "theme_id": "t",
        "event_palettes": {"dawn": {"palette_id": "p", "assignment_seed": 2}},
        "overrides": {"light.a": {"dawn": override}},
    }
    themes = {
        "t": {
            "events": {
                "dawn": {
                    "brightness": 20,
                    "color": {"color_mode": "color_temp", "color_temp_kelvin": 2700},
                }
            }
        }
    }
    snapshot = build_circadian_event_snapshot(
        scene, "dawn", {"p": palette}, themes, ["light.a"]
    )["light.a"]
    assert snapshot["brightness"] == brightness
    if kelvin:
        assert snapshot["color_temp_kelvin"] == kelvin
        assert "rgb_color" not in snapshot
    else:
        assert snapshot["rgb_color"] == [255, 0, 0]
    assert snapshot["state"] == override.get("state", "on")
