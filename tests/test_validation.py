"""Malformed editor payloads fail before they can replace saved data."""

import asyncio
from unittest.mock import AsyncMock

import pytest
from homeassistant.exceptions import HomeAssistantError

from custom_components.scene_studio.const import SOLAR_EVENTS
from custom_components.scene_studio.store import SceneStudioStore
from custom_components.scene_studio.validation import (
    validate_scene_input,
    validate_theme_input,
    validate_variable_input,
)


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        ({"kind": "other", "scene_name": "A"}, "kind"),
        ({"kind": "simple", "scene_name": "A", "membership": []}, "membership"),
        (
            {
                "kind": "simple",
                "scene_name": "A",
                "lights": {"light.a": {"brightness": "high"}},
            },
            "brightness",
        ),
        (
            {
                "kind": "circadian",
                "scene_name": "A",
                "overrides": {"light.a": {"other": {}}},
            },
            "event",
        ),
        (
            {
                "kind": "circadian",
                "scene_name": "A",
                "event_palettes": {"dawn": {"palette_id": None}},
            },
            "palette_id",
        ),
    ],
)
def test_scene_validation_rejects_broken_structure(raw, message):
    with pytest.raises(ValueError, match=message):
        validate_scene_input(raw)


def test_temporarily_unavailable_light_is_valid_stored_scene_data():
    validate_scene_input(
        {
            "kind": "simple",
            "scene_name": "A",
            "area": "removed-area",
            "lights": {"light.missing": {"state": "unavailable"}},
        }
    )


def test_palette_needs_exactly_five_valid_slots():
    with pytest.raises(ValueError, match="exactly five"):
        validate_variable_input({"name": "Bad", "kind": "palette", "slots": [{}]})
    with pytest.raises(ValueError, match="slots\\[0\\].brightness"):
        validate_variable_input(
            {
                "name": "Bad",
                "kind": "palette",
                "slots": [{"brightness": float("nan")}] * 5,
            }
        )


def test_theme_rejects_broken_event_color():
    events = {
        event: {"color": {"hs_color": [0, 50]}, "brightness": 100}
        for event in SOLAR_EVENTS
    }
    events["dusk"] = {"color": {"hs_color": [0]}, "brightness": 100}
    with pytest.raises(ValueError, match="two channels|2 channels"):
        validate_theme_input({"name": "Bad", "events": events})


def test_unknown_or_boolean_settings_do_not_persist():
    async def run():
        store = SceneStudioStore.__new__(SceneStudioStore)
        store.settings = {"automatically_update_lights_interval": 300}
        store.async_save = AsyncMock()
        for patch in (
            {"unexpected": 1},
            {"automatically_update_lights_interval": True},
            {"dusk_minimum_time_of_day": 12.5},
        ):
            with pytest.raises(HomeAssistantError):
                await store.async_update_settings(patch)
        assert store.settings == {"automatically_update_lights_interval": 300}
        store.async_save.assert_not_awaited()

    asyncio.run(run())


@pytest.mark.parametrize(
    "adjustment",
    [
        {"scale": float("nan"), "ceiling": 255},
        {"level": True},
        {"scale": 1},
        {"level": 256},
        {"level": 10, "scale": 1},
    ],
)
def test_malformed_event_adjustment_rejected(adjustment):
    with pytest.raises(ValueError, match="brightness_adjustment"):
        validate_scene_input(
            {
                "kind": "circadian",
                "scene_name": "A",
                "event_palettes": {
                    "dawn": {"palette_id": "p", "brightness_adjustment": adjustment}
                },
            }
        )
