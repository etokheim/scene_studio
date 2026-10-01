"""Regression tests for activation failures and interpolation invariants."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from homeassistant.core import Context
from homeassistant.exceptions import (
    HomeAssistantError,
    ServiceValidationError,
    Unauthorized,
)

from custom_components.scene_studio import _validate_turn_on_parameters, async_setup
from custom_components.scene_studio.apply_entities import (
    apply_entities_parallel,
    apply_single_entity,
)
from custom_components.scene_studio.const import DATA_ENTITIES, DOMAIN
from custom_components.scene_studio.extrapolation_math import (
    current_sun_event_index,
    extrapolate_entities,
    extrapolate_number,
    scene_keys_from_day_percent,
    transition_progress_percent,
)
from custom_components.scene_studio.scene import (
    CircadianScene,
    _local_target_datetime,
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


def test_debug_logging_does_not_copy_service_payload(caplog):
    async def run():
        hass = _Hass()
        await apply_single_entity(
            {"entity_id": "switch.desk", "state": "on", "access_code": "private"},
            hass,
        )
        assert hass.services.async_call.await_count == 1

    with caplog.at_level("DEBUG"):
        asyncio.run(run())
    assert "private" not in caplog.text
    assert "Applying switch.turn_on to switch.desk" in caplog.text


def test_extrapolate_number_rejects_non_numeric_endpoint():
    with pytest.raises(HomeAssistantError, match="must be numbers"):
        extrapolate_number("100", 200, 50)


def test_extrapolation_rejects_missing_anchor_state_without_dumping_attributes():
    async def run():
        with pytest.raises(HomeAssistantError, match="missing its state") as error:
            await extrapolate_entities(
                {"entities": {"light.desk": {"brightness": 80, "secret": "private"}}},
                {"entities": {"light.desk": {"state": "on"}}},
                50,
                SimpleNamespace(),
            )
        assert "private" not in str(error.value)

    asyncio.run(run())


@pytest.mark.parametrize(
    ("brightness", "transition", "percent"),
    [(101, 0, None), (0, 6554, None), (0, 0, -1)],
)
def test_turn_on_parameters_raise_service_validation_error(
    brightness, transition, percent
):
    with pytest.raises(ServiceValidationError):
        _validate_turn_on_parameters(brightness, transition, percent)


def test_custom_service_requires_owned_entities_and_user_control_before_activation():
    async def run():
        owned = SimpleNamespace(entity_id="scene.owned", async_activate=AsyncMock())
        foreign = SimpleNamespace(entity_id="scene.foreign", async_activate=AsyncMock())
        handlers = {}
        user = SimpleNamespace(
            permissions=SimpleNamespace(
                check_entity=Mock(
                    side_effect=lambda entity_id, _policy: entity_id == "scene.owned"
                )
            )
        )
        hass = SimpleNamespace(
            data={
                DOMAIN: {DATA_ENTITIES: {"owned-id": owned}},
                "scene": SimpleNamespace(entities=[foreign]),
            },
            services=SimpleNamespace(
                async_register=lambda _domain, name, handler, **_kwargs: handlers.setdefault(
                    name, handler
                )
            ),
            states=SimpleNamespace(get=lambda entity_id: object()),
            auth=SimpleNamespace(async_get_user=AsyncMock(return_value=user)),
        )
        await async_setup(hass, {})
        context = Context(user_id="limited-user")

        async def call(entity_ids):
            await handlers["turn_on"](
                SimpleNamespace(data={"entity_id": entity_ids}, context=context)
            )

        with pytest.raises(ServiceValidationError, match="not owned"):
            await call(["scene.foreign"])
        with pytest.raises(ServiceValidationError, match="not owned"):
            await call(["scene.owned", "scene.foreign"])
        owned.async_activate.assert_not_awaited()

        await call(["scene.owned"])
        owned.async_activate.assert_awaited_once()
        assert owned.async_activate.await_args.kwargs["context"] is context

        user.permissions.check_entity.return_value = False
        user.permissions.check_entity.side_effect = None
        with pytest.raises(Unauthorized):
            await call(["scene.owned"])
        owned.async_activate.assert_awaited_once()

    asyncio.run(run())


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


def test_explicit_offset_target_uses_local_date_and_dst_offset():
    winter = _local_target_datetime("2026-01-01T23:30:00+00:00", "Europe/Oslo")
    assert (winter.year, winter.month, winter.day, winter.hour) == (2026, 1, 2, 0)
    summer = _local_target_datetime(
        datetime(2026, 7, 1, 22, 30, tzinfo=timezone.utc), "Europe/Oslo"
    )
    assert (summer.day, summer.hour) == (2, 0)


def test_ordinary_day_position_reads_the_clock_when_no_explicit_target():
    scene = object.__new__(CircadianScene)
    scene._target_date_time = None
    scene.hass = SimpleNamespace(config=SimpleNamespace(time_zone="Europe/Oslo"))
    actual = CircadianScene.seconds_since_midnight(scene, 0)
    now = _local_target_datetime(None, "Europe/Oslo")
    expected = now.hour * 3600 + now.minute * 60 + now.second
    assert abs(actual - expected) < 2


def test_captured_light_command_sends_only_its_declared_color_mode():
    async def run():
        hass = _Hass()
        await apply_single_entity(
            {
                "entity_id": "light.desk",
                "state": "on",
                "brightness": 100,
                "color_mode": "color_temp",
                "color_temp_kelvin": 2700,
                "hs_color": [30, 50],
                "rgb_color": [255, 160, 70],
            },
            hass,
            transition_time=2,
        )
        data = hass.services.async_call.await_args.kwargs["service_data"]
        assert data == {
            "entity_id": "light.desk",
            "brightness": 100,
            "color_temp_kelvin": 2700,
            "transition": 2,
        }

    asyncio.run(run())


def test_invalid_color_payload_fails_before_any_light_handler_runs():
    async def run():
        hass = _Hass()
        with pytest.raises(HomeAssistantError, match="ambiguous color"):
            await apply_entities_parallel(
                [
                    {"entity_id": "light.good", "state": "on", "brightness": 100},
                    {
                        "entity_id": "light.bad",
                        "state": "on",
                        "hs_color": [30, 50],
                        "rgb_color": [255, 160, 70],
                    },
                ],
                hass,
            )
        hass.services.async_call.assert_not_awaited()
        with pytest.raises(HomeAssistantError, match="missing its rgb_color"):
            await apply_single_entity(
                {"entity_id": "light.bad", "state": "on", "color_mode": "rgb"}, hass
            )
        hass.services.async_call.assert_not_awaited()

    asyncio.run(run())
