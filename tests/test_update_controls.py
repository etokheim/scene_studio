"""Durable pause preferences, permitted actions, and retained override policies."""

import asyncio
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
from homeassistant.core import Context, Event, State
from homeassistant.exceptions import (
    HomeAssistantError,
    ServiceValidationError,
    Unauthorized,
)

from custom_components.scene_studio import async_setup
from custom_components.scene_studio.const import DATA_ENTITIES, DATA_STORE, DOMAIN
from custom_components.scene_studio.runtime import SceneRuntime
from custom_components.scene_studio.scene import CircadianScene
from custom_components.scene_studio.store import DEFAULT_SETTINGS
from custom_components.scene_studio.switch import AutomaticUpdatesSwitch
from custom_components.scene_studio.update_controls import (
    async_set_scene_updates_locked,
)
from tests.test_runtime import _commands, _entity, _hass
from tests.test_store_v4 import _bare_store


def test_zero_interval_migration_preserves_scene_ids_refs_overrides_and_dusk():
    async def run():
        store = _bare_store()
        original = {
            "id": "stable",
            "kind": "circadian",
            "scene_name": "A",
            "theme_id": "existing",
            "overrides": {"light.a": {"dawn": {"brightness": 31}}},
        }
        store._store = SimpleNamespace(
            async_load=AsyncMock(
                return_value={
                    "settings": {
                        "automatically_update_lights_interval": 0,
                        "dusk_minimum_time_of_day": 81000,
                    },
                    "scenes": [deepcopy(original)],
                }
            )
        )
        await store.async_load()
        assert store.settings["automatic_updates_enabled"] is False
        assert store.settings["automatically_update_lights_interval"] == 300
        assert store.settings["dusk_minimum_time_of_day"] == 81000
        scene = store.get("stable")
        for key, value in original.items():
            assert scene[key] == value

    asyncio.run(run())


def test_scene_pause_batch_validates_every_target_and_does_not_mutate_shared_configs_before_save():
    async def run():
        store = _bare_store()
        old = {"id": "a", "kind": "circadian", "automatically_update_lights": True}
        store.scenes = {"a": old, "simple": {"id": "simple", "kind": "simple"}}
        for targets in [["a", "missing"], ["a", "simple"]]:
            with pytest.raises(HomeAssistantError):
                await store.async_set_scene_updates(targets, False)
            assert store.get("a") == old
            store.async_save.assert_not_awaited()
        store.async_save.side_effect = OSError("disk full")
        with pytest.raises(OSError):
            await store.async_set_scene_updates(["a"], False)
        assert old["automatically_update_lights"] is True
        assert store.get("a")["automatically_update_lights"] is True

    asyncio.run(run())


def test_failed_entity_sync_compensates_pause_before_broadcast_or_resume():
    async def run():
        store = _bare_store()
        store.scenes = {
            "a": {"id": "a", "kind": "circadian", "automatically_update_lights": True}
        }
        entity = SimpleNamespace(
            async_update_config=AsyncMock(
                side_effect=[RuntimeError("registry failed"), None]
            ),
            async_preferences_changed=AsyncMock(),
        )
        hass = SimpleNamespace(
            data={DOMAIN: {DATA_STORE: store, DATA_ENTITIES: {"a": entity}}}
        )
        with patch(
            "custom_components.scene_studio.update_controls.publish_change"
        ) as publish:
            with pytest.raises(RuntimeError, match="registry failed"):
                await async_set_scene_updates_locked(hass, ["a"], False)
        assert store.get("a")["automatically_update_lights"] is True
        publish.assert_not_called()
        entity.async_preferences_changed.assert_not_awaited()
        assert entity.async_update_config.await_count == 2

    asyncio.run(run())


def test_pause_action_requires_all_owned_circadian_targets_and_control_permissions():
    async def run():
        handlers = {}
        scenes = {
            "a": SimpleNamespace(
                entity_id="scene.a",
                unique_id="a",
                async_preferences_changed=AsyncMock(),
            ),
            "b": SimpleNamespace(
                entity_id="scene.b",
                unique_id="b",
                async_preferences_changed=AsyncMock(),
            ),
            "simple": SimpleNamespace(entity_id="scene.simple", unique_id="simple"),
        }
        user = SimpleNamespace(
            permissions=SimpleNamespace(
                check_entity=lambda eid, _policy: eid == "scene.a"
            )
        )
        hass = SimpleNamespace(
            data={DOMAIN: {DATA_ENTITIES: scenes}},
            states=SimpleNamespace(get=lambda _id: object()),
            auth=SimpleNamespace(async_get_user=AsyncMock(return_value=user)),
            services=SimpleNamespace(
                async_register=lambda _domain, name, handler, **_kw: handlers.setdefault(
                    name, handler
                )
            ),
        )
        await async_setup(hass, {})
        with patch(
            "custom_components.scene_studio.async_set_scene_updates_locked",
            new=AsyncMock(),
        ) as save:
            for ids, error in [
                (["scene.a", "scene.b"], Unauthorized),
                (["scene.a", "scene.foreign"], ServiceValidationError),
                (["scene.a", "scene.simple"], ServiceValidationError),
            ]:
                with pytest.raises(error):
                    await handlers["set_automatic_updates"](
                        SimpleNamespace(
                            data={"entity_id": ids, "enabled": False},
                            context=Context(user_id="limited"),
                        )
                    )
                save.assert_not_awaited()
            await handlers["set_automatic_updates"](
                SimpleNamespace(
                    data={"entity_id": ["scene.a"], "enabled": False},
                    context=Context(user_id="limited"),
                )
            )
            assert save.await_args.args[1:] == (["a"], False)
            assert save.await_args.kwargs["context"].user_id == "limited"

    asyncio.run(run())


def test_policy_changes_reevaluate_retained_records_without_reclaiming_transferred_lights():
    hass = _hass()
    runtime = SceneRuntime(hass)
    entity = _entity("a", "one")
    with patch(
        "custom_components.scene_studio.runtime.async_track_state_change_event",
        return_value=Mock(),
    ):
        runtime.claim(entity, _commands("light.a", "light.b"), {}, Context(), 0)
        for eid in ["light.a", "light.b"]:
            runtime._state_changed(
                Event(
                    "state_changed",
                    {"entity_id": eid, "new_state": State(eid, "off")},
                    context=Context(),
                )
            )
        assert not runtime.active(entity)
        settings = hass.data[DOMAIN][DATA_STORE].settings
        settings.update(
            respect_manual_changes=False, always_respect_manual_changes=["light.a"]
        )
        assert runtime.eligible_lights(entity) == {"light.b"}
        settings.update(always_follow_scene=["light.b"])
        assert runtime.owners["a"].manual == {"light.a", "light.b"}
        runtime.claim(_entity("b", "two"), _commands("light.b"), {}, Context(), 0)
        settings.update(respect_manual_changes=False, always_respect_manual_changes=[])
        assert runtime.eligible_lights(entity) == {"light.a"}


def test_policy_validation_is_atomic_and_exceptions_are_mutually_exclusive():
    async def run():
        store = _bare_store()
        store.settings = deepcopy(DEFAULT_SETTINGS)
        for patch in [
            {"automatic_updates_enabled": 1},
            {"respect_manual_changes": "yes"},
            {"always_follow_scene": "light.a"},
            {"always_follow_scene": ["switch.a"]},
            {"always_follow_scene": ["light.a", "light.a"]},
            {
                "always_follow_scene": ["light.a"],
                "always_respect_manual_changes": ["light.a"],
            },
            {"automatically_update_lights_interval": 0},
        ]:
            with pytest.raises(HomeAssistantError):
                await store.async_update_settings(patch)
            assert store.settings == DEFAULT_SETTINGS
        store.async_save.assert_not_awaited()

    asyncio.run(run())


def test_resume_keeps_ownership_and_uses_interval_transition_only_for_current_owners():
    async def run():
        hass = _hass()
        hass.data[DOMAIN][DATA_STORE].settings = dict(DEFAULT_SETTINGS)
        panel = SimpleNamespace(
            hass=hass,
            _brightness_modifier=0,
            _transition_percent_manual=False,
            _stop_automatically_update_lights=Mock(),
            _write_ha_state_if_attrs_changed=Mock(),
            _automatically_update_lights_enabled=lambda: True,
            async_activate=AsyncMock(),
            _schedule_automatically_update_lights=Mock(),
        )
        with patch(
            "custom_components.scene_studio.scene.scene_runtime",
            return_value=SimpleNamespace(active=lambda _entity: True),
        ):
            await CircadianScene.async_preferences_changed(panel)
        panel.async_activate.assert_awaited_once_with(transition=300, context=None)
        panel._schedule_automatically_update_lights.assert_called_once_with(300)
        panel.async_activate.reset_mock()
        with patch(
            "custom_components.scene_studio.scene.scene_runtime",
            return_value=SimpleNamespace(active=lambda _entity: False),
        ):
            await CircadianScene.async_preferences_changed(panel)
        panel.async_activate.assert_not_awaited()

    asyncio.run(run())


def test_global_switch_mirrors_store_and_has_stable_identity():
    async def run():
        hass = _hass()
        switch = AutomaticUpdatesSwitch(hass)
        assert switch.is_on
        hass.data[DOMAIN][DATA_STORE].settings["automatic_updates_enabled"] = False
        assert not switch.is_on
        with patch(
            "custom_components.scene_studio.switch.async_update_settings",
            new=AsyncMock(),
        ) as update:
            await switch.async_turn_on()
            update.assert_awaited_once_with(
                hass, {"automatic_updates_enabled": True}, context=switch._context
            )
        assert switch.unique_id == AutomaticUpdatesSwitch(_hass()).unique_id

    asyncio.run(run())


def test_failed_tick_reports_error_but_retains_next_retry_without_reclaiming():
    async def run():
        hass = _hass()
        hass.data[DOMAIN][DATA_STORE].settings = dict(DEFAULT_SETTINGS)
        scene = SimpleNamespace(
            hass=hass,
            _scene_config={},
            _brightness_modifier=0,
            _transition_percent_manual=False,
            _automatically_update_lights_generation=1,
            _unsub_automatically_update_lights=None,
            _automatically_update_lights_enabled=lambda: True,
            _has_active_ownership=lambda: True,
            _collect_new_overrides=Mock(),
            async_activate=AsyncMock(side_effect=HomeAssistantError("bridge failed")),
            _schedule_automatically_update_lights=Mock(),
        )
        with pytest.raises(HomeAssistantError, match="bridge failed"):
            await CircadianScene._async_automatically_update_lights(scene)
        scene._schedule_automatically_update_lights.assert_called_once_with(300)

    asyncio.run(run())
