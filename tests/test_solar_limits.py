"""Solar limits share wall-clock semantics across seasons and preview paths."""

import asyncio
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from zoneinfo import ZoneInfo

import pytest
from homeassistant.exceptions import HomeAssistantError

from custom_components.scene_studio.const import DATA_STORE, DOMAIN
from custom_components.scene_studio.solar import build_sun_path, dawn_start_seconds
from custom_components.scene_studio.store import (
    DEFAULT_SETTINGS,
    dawn_maximum_seconds,
    dusk_minimum_seconds,
)
from tests.test_store_v4 import _bare_store


def _hass(latitude=59.9, settings=None):
    return SimpleNamespace(
        config=SimpleNamespace(
            latitude=latitude, longitude=10.75, time_zone="Europe/Oslo"
        ),
        data={
            DOMAIN: {
                DATA_STORE: SimpleNamespace(settings=settings or dict(DEFAULT_SETTINGS))
            }
        },
    )


@pytest.mark.parametrize(
    "day", ["2026-01-15", "2026-06-21", "2026-03-29", "2026-10-25"]
)
@pytest.mark.parametrize("latitude", [59.9, 78.2])
def test_limits_preserve_raw_solar_positions_and_event_order(day, latitude):
    hass = _hass(latitude)
    enabled = build_sun_path(hass, target_date=day)
    hass.data[DOMAIN][DATA_STORE].settings.update(
        dawn_maximum_enabled=False, dusk_minimum_enabled=False
    )
    disabled = build_sun_path(hass, target_date=day)
    by_id = {event["id"]: event for event in enabled["events"]}
    raw = {event["id"]: event for event in disabled["events"]}
    assert by_id["dawn"]["seconds"] == min(raw["dawn"]["seconds"], 21600)
    assert (
        by_id["dawn"]["seconds"]
        <= by_id["sunrise"]["seconds"]
        <= by_id["noon"]["seconds"]
    )
    assert by_id["noon"]["seconds"] <= by_id["sunset"]["seconds"]
    if by_id["dawn"]["overridden"]:
        assert by_id["dawn"]["solar_seconds"] == raw["dawn"]["seconds"]
    assert not raw["dawn"]["overridden"]
    assert not raw["dusk"]["overridden"]


def test_dawn_limit_uses_local_wall_clock_on_dst_days():
    for month, day in [(3, 29), (10, 25)]:
        late = datetime(2026, month, day, 8, 15, tzinfo=ZoneInfo("Europe/Oslo"))
        assert dawn_start_seconds(late, 21600) == (21600, True, 29700)
        assert dawn_start_seconds(late, None) == (29700, False, None)
    midnight = datetime(2026, 6, 21, tzinfo=ZoneInfo("Europe/Oslo"))
    assert dawn_start_seconds(midnight, 21600) == (0, False, None)


def test_existing_settings_enable_limits_and_disabled_switches_retain_times():
    hass = _hass(settings={"dusk_minimum_time_of_day": 81000})
    assert dusk_minimum_seconds(hass) == 81000
    assert dawn_maximum_seconds(hass) == 21600
    hass.data[DOMAIN][DATA_STORE].settings.update(
        dawn_maximum_enabled=False, dusk_minimum_enabled=False
    )
    assert dusk_minimum_seconds(hass) is None
    assert dawn_maximum_seconds(hass) is None
    assert hass.data[DOMAIN][DATA_STORE].settings["dusk_minimum_time_of_day"] == 81000


def test_limit_settings_validate_before_mutation_and_roll_back_failed_save():
    async def run():
        store = _bare_store()
        store.settings = dict(DEFAULT_SETTINGS)
        for patch in [
            {"dawn_maximum_enabled": 1},
            {"dusk_minimum_enabled": "false"},
            {"dawn_maximum_time_of_day": True},
            {"dawn_maximum_time_of_day": -1},
        ]:
            with pytest.raises(HomeAssistantError):
                await store.async_update_settings(patch)
            assert store.settings == DEFAULT_SETTINGS
        await store.async_update_settings(
            {"dawn_maximum_time_of_day": "05:30:00", "dawn_maximum_enabled": False}
        )
        assert store.settings["dawn_maximum_time_of_day"] == 19800
        assert store.settings["dawn_maximum_enabled"] is False
        before = dict(store.settings)
        store.async_save = AsyncMock(side_effect=OSError("disk full"))
        with pytest.raises(OSError):
            await store.async_update_settings({"dawn_maximum_enabled": True})
        assert store.settings == before

    asyncio.run(run())
