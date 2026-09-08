"""Tests for the v4 store schema: variables, themes, scenes, membership."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest
from homeassistant.exceptions import HomeAssistantError

from custom_components.circadian_scenes.const import (
    AUTOMATICALLY_UPDATE_LIGHTS,
    KIND_CIRCADIAN,
    KIND_SIMPLE,
    SCENE_DUSK_MINIMUM_TIME_OF_DAY,
    SCENE_NAME,
    SOLAR_EVENTS,
    VARIABLE_REF,
)
from custom_components.circadian_scenes.store import (
    CircadianScenesStore,
    _migrate_v3_to_v4,
    normalize_circadian_scene,
    normalize_scene,
    normalize_simple_scene,
    seed_default_theme,
    seed_variables,
    to_form_data,
)

# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------


class TestSeedVariables:
    def test_creates_five_variables(self):
        variables = seed_variables()
        assert set(variables.keys()) == {f"default_{e}" for e in SOLAR_EVENTS}

    def test_each_has_color_and_brightness(self):
        for var in seed_variables().values():
            assert "color" in var
            assert "brightness" in var
            assert var["color"]["color_mode"] == "color_temp"
            assert isinstance(var["color"]["color_temp_kelvin"], int)

    def test_dawn_values(self):
        var = seed_variables()["default_dawn"]
        assert var["brightness"] == 102
        assert var["color"]["color_temp_kelvin"] == 2700
        assert var["name"] == "Dawn"


class TestSeedDefaultTheme:
    def test_references_all_events(self):
        variables = seed_variables()
        themes = seed_default_theme(variables)
        theme = themes["default"]
        assert theme["name"] == "Default"
        for event in SOLAR_EVENTS:
            ev = theme["events"][event]
            assert VARIABLE_REF in ev["color"]
            assert ev["color"][VARIABLE_REF] == f"default_{event}"
            assert "brightness" in ev


# ---------------------------------------------------------------------------
# Scene normalizers
# ---------------------------------------------------------------------------


class TestNormalizeCircadianScene:
    def test_minimal(self):
        item = normalize_circadian_scene({SCENE_NAME: "Living Room"})
        assert item["kind"] == KIND_CIRCADIAN
        assert item[SCENE_NAME] == "Living Room"
        assert item["theme_id"] == "default"
        assert item["membership"] == {"exclude": [], "include": []}
        assert item["overrides"] == {}
        assert item[AUTOMATICALLY_UPDATE_LIGHTS] is True
        assert "id" in item

    def test_preserves_membership(self):
        item = normalize_circadian_scene(
            {
                SCENE_NAME: "Office",
                "membership": {"exclude": ["light.a"], "include": ["light.b"]},
            }
        )
        assert item["membership"]["exclude"] == ["light.a"]
        assert item["membership"]["include"] == ["light.b"]

    def test_empty_name_raises(self):
        with pytest.raises(ValueError, match="name is required"):
            normalize_circadian_scene({SCENE_NAME: "  "})

    def test_custom_theme_id(self):
        item = normalize_circadian_scene(
            {
                SCENE_NAME: "X",
                "theme_id": "warm_evening",
            }
        )
        assert item["theme_id"] == "warm_evening"


class TestNormalizeSimpleScene:
    def test_minimal(self):
        item = normalize_simple_scene({SCENE_NAME: "Movie"})
        assert item["kind"] == KIND_SIMPLE
        assert item[SCENE_NAME] == "Movie"
        assert item["membership"] == {"exclude": [], "include": []}
        assert item["lights"] == {}

    def test_lights_preserved(self):
        lights = {
            "light.a": {
                "state": "on",
                "brightness": 128,
                "color_mode": "hs",
                "hs_color": [30, 80],
            },
        }
        item = normalize_simple_scene({SCENE_NAME: "Warm", "lights": lights})
        assert item["lights"] == lights

    def test_empty_name_raises(self):
        with pytest.raises(ValueError, match="name is required"):
            normalize_simple_scene({SCENE_NAME: ""})


class TestNormalizeSceneRouter:
    def test_defaults_to_circadian(self):
        item = normalize_scene({SCENE_NAME: "Default Kind"})
        assert item["kind"] == KIND_CIRCADIAN

    def test_routes_simple(self):
        item = normalize_scene({"kind": KIND_SIMPLE, SCENE_NAME: "S"})
        assert item["kind"] == KIND_SIMPLE


# ---------------------------------------------------------------------------
# to_form_data
# ---------------------------------------------------------------------------


class TestToFormData:
    def test_circadian(self):
        item = normalize_circadian_scene(
            {
                SCENE_NAME: "Bed",
                "theme_id": "cozy",
                "area": "bedroom",
            }
        )
        form = to_form_data(item)
        assert form["kind"] == KIND_CIRCADIAN
        assert form["theme_id"] == "cozy"
        assert form[SCENE_NAME] == "Bed"
        assert SCENE_DUSK_MINIMUM_TIME_OF_DAY not in form
        assert SCENE_DUSK_MINIMUM_TIME_OF_DAY not in item

    def test_simple(self):
        item = normalize_simple_scene(
            {SCENE_NAME: "Party", "lights": {"light.a": {"state": "on"}}}
        )
        form = to_form_data(item)
        assert form["kind"] == KIND_SIMPLE
        assert form["lights"] == {"light.a": {"state": "on"}}
        assert AUTOMATICALLY_UPDATE_LIGHTS not in form


# ---------------------------------------------------------------------------
# v3 → v4 migration
# ---------------------------------------------------------------------------


class TestMigrateV3ToV4:
    def test_seeds_variables_and_themes(self):
        v3 = {
            "scenes": [
                {
                    "id": "abc",
                    "scene_name": "Room",
                    "scene_dawn": "scene.dawn",
                    "scene_sunrise": "scene.sunrise",
                    "scene_noon": "scene.noon",
                    "scene_sunset": "scene.sunset",
                    "scene_dusk": "scene.dusk",
                }
            ],
            "settings": {"hide_managed_native_scenes": True},
            "managed_native_scene_ids": ["x"],
        }
        result = _migrate_v3_to_v4(v3)
        assert "default_dawn" in result["variables"]
        assert "default" in result["themes"]
        scene = result["scenes"][0]
        assert scene["kind"] == KIND_CIRCADIAN
        assert scene["theme_id"] == "default"
        assert scene["membership"] == {"exclude": [], "include": []}
        # Legacy keys preserved for runtime migrator.
        assert scene["scene_dawn"] == "scene.dawn"
        # v3-only setting dropped.
        assert "hide_managed_native_scenes" not in result["settings"]

    def test_empty_store(self):
        result = _migrate_v3_to_v4({})
        assert len(result["variables"]) == 5
        assert "default" in result["themes"]
        assert result["scenes"] == []


def _bare_store() -> CircadianScenesStore:
    store = CircadianScenesStore.__new__(CircadianScenesStore)
    store.variables = {}
    store.themes = {}
    store.scenes = {}
    store.settings = {}
    store.async_save = AsyncMock()
    return store


def test_delete_variable_rejects_circadian_override_reference():
    async def run():
        store = _bare_store()
        store.variables = {"warm": {"id": "warm", "color": {"hs_color": [10, 20]}}}
        store.scenes = {
            "scene": {
                "id": "scene",
                "kind": KIND_CIRCADIAN,
                SCENE_NAME: "Room",
                "overrides": {
                    "light.one": {"dawn": {VARIABLE_REF: "warm", "brightness": 100}}
                },
            }
        }
        with pytest.raises(HomeAssistantError, match="still referenced"):
            await store.async_delete_variable("warm")
        assert "warm" in store.variables

    asyncio.run(run())


def test_theme_event_shape_is_validated():
    async def run():
        store = _bare_store()
        bad_events = {
            event: {"color": {"hs_color": [0, 0]}, "brightness": 100}
            for event in SOLAR_EVENTS
        }
        bad_events["dusk"] = {"color": {"hs_color": [0, 0]}, "brightness": "dim"}
        with pytest.raises(ValueError, match="brightness must be a number"):
            await store.async_upsert_theme({"name": "Bad", "events": bad_events})

    asyncio.run(run())


def test_scene_memory_rolls_back_when_save_fails():
    async def run():
        store = _bare_store()
        store.async_save.side_effect = OSError("disk full")
        with pytest.raises(OSError, match="disk full"):
            await store.async_upsert({SCENE_NAME: "New"})
        assert store.scenes == {}

    asyncio.run(run())


class TestStripSceneDuskMinimum:
    def test_lifts_first_scene_value_and_strips(self):
        from custom_components.circadian_scenes.store import strip_scene_dusk_minimum

        scenes = {
            "a": {
                "kind": KIND_CIRCADIAN,
                SCENE_DUSK_MINIMUM_TIME_OF_DAY: "21:30:00",
            },
            "b": {
                "kind": KIND_CIRCADIAN,
                SCENE_DUSK_MINIMUM_TIME_OF_DAY: "22:00:00",
            },
        }
        found = strip_scene_dusk_minimum(scenes)
        assert found == 21 * 3600 + 30 * 60
        assert SCENE_DUSK_MINIMUM_TIME_OF_DAY not in scenes["a"]
        assert SCENE_DUSK_MINIMUM_TIME_OF_DAY not in scenes["b"]

    def test_returns_none_when_absent(self):
        from custom_components.circadian_scenes.store import strip_scene_dusk_minimum

        scenes = {"a": {"kind": KIND_CIRCADIAN}}
        assert strip_scene_dusk_minimum(scenes) is None
