"""Regression tests for activation failures and interpolation invariants."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

from custom_components.scene_studio import _validate_turn_on_parameters
from custom_components.scene_studio.apply_entities import (
    apply_entities_parallel,
    apply_single_entity,
)
from custom_components.scene_studio.extrapolation_math import (
    current_sun_event_index,
    extrapolate_number,
    scene_keys_from_day_percent,
    transition_progress_percent,
)


class _Services:
    def __init__(self, side_effect=None):
        self.async_call = AsyncMock(side_effect=side_effect)


class _Hass:
    def __init__(self, side_effect=None):
        self.services = _Services(side_effect)


def test_apply_rejects_missing_state():
    async def run():
        with pytest.raises(HomeAssistantError, match="missing a state"):
            await apply_single_entity({"entity_id": "light.desk"}, _Hass())

    asyncio.run(run())


def test_parallel_apply_propagates_service_failure():
    async def run():
        hass = _Hass(RuntimeError("bridge unavailable"))
        with pytest.raises(HomeAssistantError, match="Failed to apply 1 of 1"):
            await apply_entities_parallel(
                [{"entity_id": "light.desk", "state": "on", "brightness": 100}],
                hass,
            )

    asyncio.run(run())


def test_apply_waits_for_service_handler_completion():
    async def run():
        async def call(**kwargs):
            if kwargs.get("blocking"):
                raise RuntimeError("handler failed after scheduling")

        hass = _Hass()
        hass.services.async_call.side_effect = call
        with pytest.raises(HomeAssistantError, match="handler failed after scheduling"):
            await apply_single_entity(
                {"entity_id": "light.desk", "state": "on", "brightness": 100},
                hass,
            )
        assert hass.services.async_call.await_args.kwargs["blocking"] is True

    asyncio.run(run())


def test_extrapolate_number_rejects_non_numeric_endpoint():
    with pytest.raises(HomeAssistantError, match="must be numbers"):
        extrapolate_number("100", 200, 50)


@pytest.mark.parametrize(
    ("brightness", "transition", "percent"),
    [(101, 0, None), (0, 6554, None), (0, 0, -1)],
)
def test_turn_on_parameters_raise_service_validation_error(
    brightness, transition, percent
):
    with pytest.raises(ServiceValidationError):
        _validate_turn_on_parameters(brightness, transition, percent)


def test_transition_boundaries_and_midnight_wrap():
    starts = [6 * 3600, 7 * 3600, 12 * 3600, 18 * 3600, 20 * 3600]
    assert current_sun_event_index(starts, 7 * 3600) == 1
    assert transition_progress_percent(20 * 3600, 6 * 3600, 20 * 3600) == 0
    assert transition_progress_percent(20 * 3600, 6 * 3600, 6 * 3600) == 100
    assert scene_keys_from_day_percent(100) == ("dusk", "dawn", 0.0)


def test_wrapped_dusk_stays_after_sunset_on_the_clock():
    dawn, sunrise, noon, sunset, dusk = (
        3 * 3600,
        5 * 3600,
        12 * 3600,
        23 * 3600,
        1 * 3600,
    )
    starts = [dawn, sunrise, noon, sunset, dusk]
    assert current_sun_event_index(starts, 23.5 * 3600) == 3
    assert current_sun_event_index(starts, 0) == 3
    assert current_sun_event_index(starts, 0.5 * 3600) == 3
    assert current_sun_event_index(starts, 1 * 3600) == 4
    assert current_sun_event_index(starts, 2 * 3600) == 4
    assert current_sun_event_index(starts, 3 * 3600) == 0
    assert transition_progress_percent(sunset, dusk, 0) == 50
    assert transition_progress_percent(sunset, dusk, 1 * 3600) == 100
    assert transition_progress_percent(dusk, dawn, 2 * 3600) == 50
