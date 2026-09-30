"""Tests for the v4 store schema: variables, themes, scenes, membership."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest
from homeassistant.exceptions import HomeAssistantError

from custom_components.scene_studio.const import (
    AUTOMATICALLY_UPDATE_LIGHTS,
    KIND_CIRCADIAN,
    KIND_SIMPLE,
    SCENE_DUSK_MINIMUM_TIME_OF_DAY,
    SCENE_NAME,
    SOLAR_EVENTS,
    VARIABLE_REF,
)
from custom_components.scene_studio.store import (
    DEFAULT_SETTINGS,
    SceneStudioStore,
    _migrate_v3_to_v4,
    auto_configure_scene_name,
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
        assert item["icon"] is None

    def test_icon_round_trip(self):
        blank = normalize_simple_scene({SCENE_NAME: "Movie", "icon": "  "})
        assert blank["icon"] is None
        kept = normalize_circadian_scene(
            {SCENE_NAME: "Day", "icon": "mdi:weather-sunny"}
        )
        assert kept["icon"] == "mdi:weather-sunny"
        assert to_form_data(kept)["icon"] == "mdi:weather-sunny"

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
        assert form["palette_id"] is None
        assert form["assignment_seed"] == 0
        assert form["theme_id"] is None
        assert AUTOMATICALLY_UPDATE_LIGHTS not in form

    def test_palette_base_round_trip(self):
        item = normalize_simple_scene(
            {
                SCENE_NAME: "Party",
                "palette_id": "pal-1",
                "assignment_seed": 42,
                "lights": {"light.a": {"variable_ref": "pal-1"}},
            }
        )
        assert item["palette_id"] == "pal-1"
        assert item["assignment_seed"] == 42
        form = to_form_data(item)
        assert form["palette_id"] == "pal-1"
        assert form["assignment_seed"] == 42

    def test_event_palettes_round_trip(self):
        item = normalize_circadian_scene(
            {
                SCENE_NAME: "Day",
                "event_palettes": {
                    "dawn": {"palette_id": "wool", "assignment_seed": 7},
                    "noon": {"palette_id": None},
                    "nope": {"palette_id": "x"},
                },
            }
        )
        assert item["event_palettes"] == {
            "dawn": {"palette_id": "wool", "assignment_seed": 7}
        }
        assert "palette_id" not in item
        form = to_form_data(item)
        assert form["event_palettes"]["dawn"]["palette_id"] == "wool"


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
        assert result["managed_native_scene_ids"] == ["x"]

    def test_empty_store(self):
        result = _migrate_v3_to_v4({})
        assert len(result["variables"]) == 5
        assert "default" in result["themes"]
        assert result["scenes"] == []


def _bare_store() -> SceneStudioStore:
    store = SceneStudioStore.__new__(SceneStudioStore)
    store.variables = {}
    store.themes = {}
    store.scenes = {}
    store.area_names = {}
    store.settings = {}
    store.managed_native_scene_ids = []
    store.pending_hide_sync = False
    store._mutation_lock = asyncio.Lock()
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


def test_delete_variable_rejects_scene_palette_id():
    async def run():
        store = _bare_store()
        store.variables = {"pal": {"id": "pal", "name": "Spring", "kind": "palette"}}
        store.scenes = {
            "scene": {
                "id": "scene",
                "kind": KIND_SIMPLE,
                SCENE_NAME: "Mantel",
                "palette_id": "pal",
            }
        }
        with pytest.raises(HomeAssistantError, match="still referenced"):
            await store.async_delete_variable("pal")
        assert "pal" in store.variables

        store.scenes = {
            "scene": {
                "id": "scene",
                "kind": KIND_CIRCADIAN,
                SCENE_NAME: "Kitchen",
                "event_palettes": {"noon": {"palette_id": "pal"}},
            }
        }
        with pytest.raises(HomeAssistantError, match="still referenced"):
            await store.async_delete_variable("pal")
        assert "pal" in store.variables

    asyncio.run(run())


def test_theme_keeps_builtin_id():
    async def run():
        store = _bare_store()
        events = {
            event: {"color": {"hs_color": [0, 0]}, "brightness": 100}
            for event in SOLAR_EVENTS
        }
        saved = await store.async_upsert_theme(
            {"name": "Daylight", "builtin_id": " daylight ", "events": events}
        )
        assert saved["builtin_id"] == "daylight"
        plain = await store.async_upsert_theme(
            {"name": "Plain", "builtin_id": "  ", "events": events}
        )
        assert "builtin_id" not in plain

    asyncio.run(run())


def test_theme_event_shape_is_validated():
    async def run():
        store = _bare_store()
        bad_events = {
            event: {"color": {"hs_color": [0, 0]}, "brightness": 100}
            for event in SOLAR_EVENTS
        }
        bad_events["dusk"] = {"color": {"hs_color": [0, 0]}, "brightness": "dim"}
        with pytest.raises(ValueError, match="brightness must be a finite number"):
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


def test_last_known_area_name_is_kept_after_registry_removal():
    async def run():
        store = _bare_store()
        store.scenes = {"scene": {"id": "scene", "area": "old-area"}}
        await store.async_remember_area_names({"old-area": "Living room"})
        await store.async_remember_area_names({})
        assert store.area_names == {"old-area": "Living room"}
        store.async_save.assert_awaited_once()

    asyncio.run(run())


def test_auto_configure_is_one_write_and_compensates_entity_failure():
    async def run():
        store = _bare_store()
        items, variables, theme = await store.async_auto_configure(
            [("kitchen", "Kitchen"), ("bed", "Bedroom")]
        )
        assert len(items) == 2
        assert store.async_save.await_count == 1
        assert store.area_names == {"kitchen": "Kitchen", "bed": "Bedroom"}
        await store.async_compensate_auto_configure(
            [item["id"] for item in items], variables, theme
        )
        assert store.scenes == {}
        assert store.themes == {}
        assert store.variables == {}
        assert store.area_names == {}

    asyncio.run(run())


class TestStripSceneDuskMinimum:
    def test_lifts_first_scene_value_and_strips(self):
        from custom_components.scene_studio.store import strip_scene_dusk_minimum

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
        from custom_components.scene_studio.store import strip_scene_dusk_minimum

        scenes = {"a": {"kind": KIND_CIRCADIAN}}
        assert strip_scene_dusk_minimum(scenes) is None


@pytest.mark.parametrize("data", [None, {"variables": seed_variables(), "themes": {}}])
def test_load_keeps_the_circadian_preset_library_empty(data):
    async def run():
        store = _bare_store()
        store._store = AsyncMock()
        store._store.async_load.return_value = data
        store._legacy_stores = []
        await store.async_load()
        assert store.themes == {}
        assert set(store.variables) == {f"default_{event}" for event in SOLAR_EVENTS}
        store.async_save.assert_not_awaited()
        theme = await store.async_ensure_default_theme()
        assert theme["id"] == "default"
        assert store.themes["default"] == theme

    asyncio.run(run())


def test_ensure_default_theme_adds_the_starter_once():
    async def run():
        store = _bare_store()
        store.variables = {"custom": {"id": "custom", "name": "Custom"}}
        theme = await store.async_ensure_default_theme()
        assert theme["id"] == "default"
        assert theme["name"] == "Default"
        assert theme["builtin_id"] == "default"
        assert set(store.variables) == {
            "custom",
            *(f"default_{event}" for event in SOLAR_EVENTS),
        }
        for event in SOLAR_EVENTS:
            assert theme["events"][event]["color"][VARIABLE_REF] == f"default_{event}"
        store.themes["default"]["name"] = "Renamed"
        again = await store.async_ensure_default_theme()
        assert again["name"] == "Renamed"
        assert store.async_save.await_count == 1

    asyncio.run(run())


def test_auto_configure_scene_name_uses_the_default_theme():
    themes = seed_default_theme(seed_variables())
    assert auto_configure_scene_name(themes) == "Default"
    assert auto_configure_scene_name({}) == "Circadian"
    assert auto_configure_scene_name(None) == "Circadian"


def test_reset_restores_the_fresh_install_store():
    async def run():
        store = _bare_store()
        store.scenes = {"room": {SCENE_NAME: "Kitchen Circadian", "id": "room"}}
        store.variables = {"custom": {"id": "custom", "name": "Custom"}}
        store.themes = {"custom": {"id": "custom", "name": "Custom"}}
        store.settings = {"automatically_update_lights_interval": 60}
        store.managed_native_scene_ids = ["old_yaml"]
        store.pending_hide_sync = True
        await store.async_reset_to_fresh()
        assert store.scenes == {}
        assert set(store.variables) == {f"default_{event}" for event in SOLAR_EVENTS}
        assert store.themes == {}
        assert store.settings == DEFAULT_SETTINGS
        assert store.managed_native_scene_ids == ["old_yaml"]
        assert store.pending_hide_sync is False
        store.async_save.assert_awaited()

    asyncio.run(run())


def test_failed_reset_keeps_the_previous_store():
    async def run():
        store = _bare_store()
        store.scenes = {"a": {"id": "a", "kind": KIND_SIMPLE}}
        store.variables = {"custom": {"id": "custom"}}
        store.themes = {"custom": {"id": "custom"}}
        store.settings = {"automatically_update_lights_interval": 60}
        store.managed_native_scene_ids = ["native"]
        store.async_save.side_effect = OSError("disk full")
        with pytest.raises(OSError, match="disk full"):
            await store.async_reset_to_fresh()
        assert list(store.scenes) == ["a"]
        assert list(store.variables) == ["custom"]
        assert list(store.themes) == ["custom"]
        assert store.settings["automatically_update_lights_interval"] == 60
        assert store.managed_native_scene_ids == ["native"]

    asyncio.run(run())


def test_settings_validation_is_atomic():
    async def run():
        store = _bare_store()
        store.settings = dict(DEFAULT_SETTINGS)
        with pytest.raises(HomeAssistantError, match="must be an integer"):
            await store.async_update_settings(
                {
                    "dusk_minimum_time_of_day": 21 * 3600,
                    "automatically_update_lights_interval": "invalid",
                }
            )
        assert store.settings == DEFAULT_SETTINGS
        store.async_save.assert_not_awaited()

    asyncio.run(run())


def test_failed_save_cannot_roll_back_a_later_scene_update():
    async def run():
        store = _bare_store()
        store.scenes = {"a": {"id": "a", "kind": KIND_SIMPLE, SCENE_NAME: "First"}}
        first_started = asyncio.Event()
        release_first = asyncio.Event()
        calls = 0

        async def save():
            nonlocal calls
            calls += 1
            if calls == 1:
                first_started.set()
                await release_first.wait()
                raise OSError("disk full")

        store.async_save.side_effect = save
        first = asyncio.create_task(
            store.async_upsert({"id": "a", "kind": KIND_SIMPLE, SCENE_NAME: "Failed"})
        )
        await first_started.wait()
        second = asyncio.create_task(
            store.async_upsert({"id": "a", "kind": KIND_SIMPLE, SCENE_NAME: "Latest"})
        )
        release_first.set()
        with pytest.raises(OSError, match="disk full"):
            await first
        await second
        assert store.scenes["a"][SCENE_NAME] == "Latest"

    asyncio.run(run())
