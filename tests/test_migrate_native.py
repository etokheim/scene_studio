"""Freeze-migration of native YAML scenes into store overrides."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from homeassistant.exceptions import HomeAssistantError

from custom_components.scene_studio.migrate_native import (
    async_freeze_migrate,
    freeze_scene_overrides,
    infer_membership,
    needs_native_freeze,
)
from custom_components.scene_studio.store import SceneStudioStore


def test_needs_native_freeze():
    assert needs_native_freeze(
        {
            "kind": "circadian",
            "scene_dawn": "scene.dawn",
        }
    )
    assert not needs_native_freeze(
        {"kind": "circadian", "theme_id": "default", "overrides": {}}
    )
    assert not needs_native_freeze({"kind": "simple", "scene_dawn": "scene.x"})


def test_infer_membership():
    result = infer_membership(
        ["light.a", "light.b", "light.c"],
        {"light.a", "light.z"},
    )
    assert result["exclude"] == ["light.b", "light.c"]
    assert result["include"] == ["light.z"]


def test_freeze_scene_overrides_inlines_all_events():
    scene = {
        "id": "room1",
        "kind": "circadian",
        "area": "living",
        "scene_dawn": "scene.dawn",
        "scene_sunrise": "scene.dawn",
        "scene_noon": "scene.noon",
        "scene_sunset": "scene.dawn",
        "scene_dusk": "scene.dusk",
        "display_scenes_combined": True,
    }
    native = {
        "scene.dawn": {
            "entities": {
                "light.a": {
                    "state": "on",
                    "brightness": 100,
                    "color_mode": "color_temp",
                    "color_temp_kelvin": 2700,
                }
            }
        },
        "scene.noon": {
            "entities": {
                "light.a": {
                    "state": "on",
                    "brightness": 255,
                    "color_mode": "color_temp",
                    "color_temp_kelvin": 4500,
                }
            }
        },
        "scene.dusk": {
            "entities": {
                "light.a": {
                    "state": "on",
                    "brightness": 64,
                    "color_mode": "color_temp",
                    "color_temp_kelvin": 2200,
                }
            }
        },
    }
    frozen = freeze_scene_overrides(scene, native, ["light.a", "light.b"])
    assert frozen["theme_id"] == "default"
    assert "scene_dawn" not in frozen
    assert frozen["membership"]["exclude"] == ["light.b"]
    assert frozen["overrides"]["light.a"]["dawn"]["color_temp_kelvin"] == 2700
    assert frozen["overrides"]["light.a"]["noon"]["brightness"] == 255
    assert frozen["overrides"]["light.a"]["dusk"]["color_temp_kelvin"] == 2200


def test_missing_anchor_keeps_source_references():
    scene = {"id": "a", "kind": "circadian", "scene_dawn": "scene.missing"}
    with pytest.raises(HomeAssistantError, match="source references were retained"):
        freeze_scene_overrides(scene, {}, [])
    assert scene["scene_dawn"] == "scene.missing"


def test_partial_native_load_defers_the_whole_migration():
    async def run():
        store = SceneStudioStore.__new__(SceneStudioStore)
        scene = {
            "id": "a",
            "kind": "circadian",
            "scene_dawn": "scene.loaded",
            "scene_dusk": "scene.missing",
        }
        store.scenes = {"a": scene}
        store.managed_native_scene_ids = ["managed"]
        store._async_mutate = AsyncMock()
        with patch(
            "custom_components.scene_studio.migrate_native.load_native_scenes",
            return_value={"scene.loaded": {"entities": {}}},
        ):
            changed = await async_freeze_migrate(object(), store)
        assert changed == 0
        assert store.scenes["a"] is scene
        assert store.managed_native_scene_ids == ["managed"]
        store._async_mutate.assert_not_awaited()

    asyncio.run(run())


def test_converted_store_is_saved_before_managed_yaml_is_deleted():
    async def run():
        store = SceneStudioStore.__new__(SceneStudioStore)
        store.scenes = {
            "a": {"id": "a", "kind": "circadian", "scene_dawn": "scene.loaded"}
        }
        store.managed_native_scene_ids = ["managed"]
        operations = []

        async def mutate(change):
            change()
            operations.append("save")

        async def delete_yaml(_hass, _ids):
            operations.append("delete_yaml")
            return 1

        store._async_mutate = mutate
        with (
            patch(
                "custom_components.scene_studio.migrate_native.load_native_scenes",
                return_value={"scene.loaded": {"entities": {}}},
            ),
            patch(
                "custom_components.scene_studio.migrate_native.lights_in_area",
                return_value=[],
            ),
            patch(
                "custom_components.scene_studio.migrate_native.async_delete_managed_yaml",
                side_effect=delete_yaml,
            ),
        ):
            assert await async_freeze_migrate(object(), store) == 1
        assert operations == ["save", "delete_yaml", "save"]
        assert store.managed_native_scene_ids == []
        assert "scene_dawn" not in store.scenes["a"]

    asyncio.run(run())
