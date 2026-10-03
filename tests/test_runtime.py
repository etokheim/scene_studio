"""Runtime ownership persists across pauses and is never inferred from HA timestamps."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
from homeassistant.core import Context, Event, State
from homeassistant.exceptions import HomeAssistantError

from custom_components.scene_studio.const import DATA_STORE, DOMAIN
from custom_components.scene_studio.runtime import (
    SceneRuntime,
    scene_runtime,
    unload_runtime,
)
from custom_components.scene_studio.scene import CircadianScene, SimpleScene


def _hass():
    return SimpleNamespace(
        data={DOMAIN: {DATA_STORE: SimpleNamespace(settings={})}},
        states=SimpleNamespace(get=lambda _id: State(_id, "on", {"brightness": 100})),
        services=SimpleNamespace(async_call=AsyncMock()),
        async_create_task=lambda coroutine: asyncio.create_task(coroutine),
    )


def _entity(key, area):
    return SimpleNamespace(unique_id=key, _area_id=area, async_runtime_changed=Mock())


def _commands(*ids):
    return [{"entity_id": eid, "state": "on", "brightness": 100} for eid in ids]


def test_same_area_replaces_owner_and_cross_area_transfers_only_shared_lights():
    hass = _hass()
    runtime = SceneRuntime(hass)
    a, b, c = (_entity("a", "one"), _entity("b", "two"), _entity("c", "one"))
    with patch(
        "custom_components.scene_studio.runtime.async_track_state_change_event",
        return_value=Mock(),
    ):
        runtime.claim(a, _commands("light.shared", "light.a"), {}, Context(), 0)
        runtime.claim(b, _commands("light.shared", "light.b"), {}, Context(), 0)
        assert runtime.active(a) and runtime.active(b)
        assert runtime.eligible_lights(a) == {"light.a"}
        assert runtime.eligible_lights(b) == {"light.shared", "light.b"}
        runtime.claim(c, _commands("light.c"), {}, Context(), 0)
        assert not runtime.active(a)
        assert runtime.active(b) and runtime.active(c)
        assert runtime.eligible_lights(a) == set()


def test_manual_changes_mark_simple_or_paused_owner_inactive_but_unavailability_does_not():
    hass = _hass()
    runtime = SceneRuntime(hass)
    entity = _entity("paused", "one")
    with patch(
        "custom_components.scene_studio.runtime.async_track_state_change_event",
        return_value=Mock(),
    ):
        runtime.claim(entity, _commands("light.a", "light.b"), {}, Context(), 0)
    runtime._state_changed(
        Event(
            "state_changed",
            {"entity_id": "light.a", "new_state": State("light.a", "unavailable")},
            context=Context(),
        )
    )
    assert runtime.active(entity)
    assert runtime.owners["paused"].manual == set()
    for eid in ["light.a", "light.b"]:
        runtime._state_changed(
            Event(
                "state_changed",
                {"entity_id": eid, "new_state": State(eid, "off")},
                context=Context(user_id="person"),
            )
        )
    assert not runtime.active(entity)
    assert runtime.owners["paused"].manual == {"light.a", "light.b"}


def test_own_user_context_and_transition_reports_never_become_manual_overrides():
    runtime = SceneRuntime(_hass())
    entity = _entity("a", "one")
    context = Context(user_id="person")
    with patch(
        "custom_components.scene_studio.runtime.async_track_state_change_event",
        return_value=Mock(),
    ):
        runtime.claim(entity, _commands("light.a"), {}, context, 300)
    for report_context in [
        context,
        Context(parent_id=context.id, user_id="person"),
        Context(),
    ]:
        runtime._state_changed(
            Event(
                "state_changed",
                {
                    "entity_id": "light.a",
                    "new_state": State("light.a", "on", {"brightness": 5}),
                },
                context=report_context,
            )
        )
    assert runtime.owners["a"].manual == set()
    assert runtime.active(entity)


def test_failed_simple_activation_does_not_transfer_ownership():
    async def run():
        hass = _hass()
        runtime = scene_runtime(hass)
        old = _entity("old", "one")
        entity = object.__new__(SimpleScene)
        entity.hass, entity._attr_unique_id, entity._area_id = hass, "new", "one"
        entity._scene_config = {"id": "new"}
        entity._context = Context()
        entity.async_write_ha_state = Mock()
        with patch(
            "custom_components.scene_studio.runtime.async_track_state_change_event",
            return_value=Mock(),
        ):
            runtime.claim(old, _commands("light.a"), {}, Context(), 0)
            hass.services.async_call.side_effect = RuntimeError("handler failed")
            with patch(
                "custom_components.scene_studio.scene.simple_anchor",
                return_value={
                    "entities": {"light.a": {"state": "on", "brightness": 100}}
                },
            ):
                with pytest.raises(HomeAssistantError, match="handler failed"):
                    await entity.async_activate()
        assert runtime.active(old)
        assert not runtime.active(entity)
        assert runtime.pending_context is None

    asyncio.run(run())


def test_queued_automatic_tick_rechecks_owner_after_lock_is_available():
    async def run():
        hass = _hass()
        runtime = scene_runtime(hass)
        entity = object.__new__(CircadianScene)
        entity.hass, entity._attr_unique_id, entity._area_id = hass, "old", "one"
        entity._scene_config = {"id": "old"}
        entity._activating_automatically_update_lights = True
        entity._only_entity_ids = None
        entity._automatically_update_lights_generation = 0
        entity.async_runtime_changed = Mock()
        entity._async_apply_scene = AsyncMock()
        with patch(
            "custom_components.scene_studio.runtime.async_track_state_change_event",
            return_value=Mock(),
        ):
            runtime.claim(entity, _commands("light.a"), {}, Context(), 0)
            await runtime.command_lock.acquire()
            waiting = asyncio.create_task(entity.async_activate(transition=300))
            await asyncio.sleep(0)
            runtime.claim(_entity("new", "one"), _commands("light.a"), {}, Context(), 0)
            runtime.command_lock.release()
            await waiting
        entity._async_apply_scene.assert_not_awaited()

    asyncio.run(run())


def test_runtime_unload_unsubscribes_and_restart_has_no_owner():
    hass = _hass()
    runtime = scene_runtime(hass)
    cancel = Mock()
    with patch(
        "custom_components.scene_studio.runtime.async_track_state_change_event",
        return_value=cancel,
    ):
        runtime.claim(_entity("a", "one"), _commands("light.a"), {}, Context(), 0)
    unload_runtime(hass)
    cancel.assert_called_once()
    assert runtime.owners == {}
    assert scene_runtime(hass).owners == {}


def test_removed_area_releases_ownership_without_removing_saved_scene():
    hass = _hass()
    runtime = SceneRuntime(hass)
    entity = _entity("a", "deleted")
    with patch(
        "custom_components.scene_studio.runtime.async_track_state_change_event",
        return_value=Mock(),
    ):
        runtime.claim(entity, _commands("light.a"), {}, Context(), 0)
        runtime.areas_changed({"remaining"})
    assert not runtime.active(entity)
    assert runtime.owners == {}
    entity.async_runtime_changed.assert_called()


def test_command_guard_is_checked_in_each_handler_before_sending():
    from custom_components.scene_studio.apply_entities import apply_entities_parallel

    async def run():
        hass = _hass()
        ownership = {"light.a", "light.b"}

        async def call(**kwargs):
            ownership.discard("light.b")

        hass.services.async_call.side_effect = call
        await apply_entities_parallel(
            _commands("light.a", "light.b"),
            hass,
            can_apply=lambda eid: eid in ownership,
        )
        assert hass.services.async_call.await_count == 1
        assert (
            hass.services.async_call.await_args.kwargs["service_data"]["entity_id"]
            == "light.a"
        )

    asyncio.run(run())
