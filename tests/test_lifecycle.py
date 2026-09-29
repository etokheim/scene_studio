"""Entry-owned setup and cache listeners."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
from homeassistant.core import Event

from custom_components.scene_studio import async_setup_entry, async_unload_entry
from custom_components.scene_studio.activation_cache import (
    DATA_ACTIVATION_CACHE,
    ensure_activation_cache_listener,
    unload_activation_cache,
)
from custom_components.scene_studio.const import DOMAIN


def test_cache_reload_event_uses_its_own_hass_and_unsubscribes():
    listeners = {}

    def listen(event_type, handler):
        listeners[event_type] = handler
        return lambda: listeners.pop(event_type, None)

    hass = SimpleNamespace(
        data={}, is_running=True, bus=SimpleNamespace(async_listen=listen)
    )
    ensure_activation_cache_listener(hass)
    cache = hass.data[DOMAIN][DATA_ACTIVATION_CACHE]
    cache["solar"]["day"] = "cached"
    listeners["call_service"](
        Event("call_service", {"domain": "scene", "service": "reload"})
    )
    assert cache["solar"] == {}
    unload_activation_cache(hass)
    assert "call_service" not in listeners
    assert DATA_ACTIVATION_CACHE not in hass.data[DOMAIN]


def test_failed_setup_removes_its_panel_and_start_listener():
    async def run():
        listeners = {}

        def listen_once(event_type, handler):
            listeners[event_type] = handler
            return lambda: listeners.pop(event_type, None)

        entry = SimpleNamespace(data={}, options={}, entry_id="one")
        hass = SimpleNamespace(
            data={},
            is_running=False,
            bus=SimpleNamespace(async_listen_once=listen_once),
            config_entries=SimpleNamespace(
                async_forward_entry_setups=AsyncMock(
                    side_effect=RuntimeError("failed")
                ),
                async_unload_platforms=AsyncMock(return_value=True),
            ),
            async_create_task=Mock(side_effect=lambda coroutine: coroutine.close()),
        )
        store = SimpleNamespace(async_load=AsyncMock(), list=Mock(return_value=[]))
        with (
            patch(
                "custom_components.scene_studio.SceneStudioStore", return_value=store
            ),
            patch("custom_components.scene_studio._purge_legacy_platform_entities"),
            patch("custom_components.scene_studio.async_setup_websocket"),
            patch("custom_components.scene_studio.async_setup_panel", new=AsyncMock()),
            patch(
                "custom_components.scene_studio.async_unload_panel", new=AsyncMock()
            ) as unload_panel,
        ):
            with pytest.raises(RuntimeError, match="failed"):
                await async_setup_entry(hass, entry)
            unload_panel.assert_awaited_once()
        assert DOMAIN not in hass.data
        assert listeners == {}
        hass.config_entries.async_unload_platforms.assert_awaited_once()

    asyncio.run(run())


def test_unload_cancels_retry_for_partially_loaded_native_scenes():
    async def run():
        entry = SimpleNamespace(data={}, options={}, entry_id="one")
        config_entries = SimpleNamespace(
            async_forward_entry_setups=AsyncMock(),
            async_unload_platforms=AsyncMock(return_value=True),
        )
        hass = SimpleNamespace(
            data={"scene": object()},
            is_running=True,
            config_entries=config_entries,
            async_create_task=Mock(side_effect=lambda coroutine: coroutine.close()),
        )
        store = SimpleNamespace(
            async_load=AsyncMock(),
            list=Mock(return_value=[{"kind": "circadian", "scene_dawn": "scene.late"}]),
        )
        cancel_retry = Mock()
        with (
            patch(
                "custom_components.scene_studio.SceneStudioStore", return_value=store
            ),
            patch("custom_components.scene_studio._purge_legacy_platform_entities"),
            patch("custom_components.scene_studio.async_setup_websocket"),
            patch(
                "custom_components.scene_studio.async_freeze_migrate",
                new=AsyncMock(return_value=0),
            ),
            patch(
                "custom_components.scene_studio.async_call_later",
                return_value=cancel_retry,
            ),
            patch("custom_components.scene_studio.async_setup_panel", new=AsyncMock()),
            patch("custom_components.scene_studio.async_unload_panel", new=AsyncMock()),
        ):
            assert await async_setup_entry(hass, entry)
            assert await async_unload_entry(hass, entry)
        cancel_retry.assert_called_once()
        assert DOMAIN not in hass.data

    asyncio.run(run())
