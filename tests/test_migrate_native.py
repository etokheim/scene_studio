"""Freeze-migration of native YAML scenes into store overrides."""

from __future__ import annotations

from custom_components.circadian_scenes.migrate_native import (
    freeze_scene_overrides,
    infer_membership,
    needs_native_freeze,
)


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
