"""Deleted HA areas stay visible and cannot activate saved scenes."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from custom_components.scene_studio.const import (
    DATA_ADD_ENTITIES,
    DATA_CONFIG_ENTRY,
    DATA_ENTITIES,
    DATA_STORE,
    DOMAIN,
)
from custom_components.scene_studio.scene import CircadianScene, SimpleScene
from custom_components.scene_studio.snapshots import scene_area_exists, scene_members
from custom_components.scene_studio.store import SceneStudioStore
from custom_components.scene_studio.websocket_api import (
    _area_tree,
    _ws_delete_deleted_area_locked,
    _ws_move_deleted_area_locked,
)


def _store():
    store = SceneStudioStore.__new__(SceneStudioStore)
    store.scenes = {
        "one": {
            "id": "one",
            "area": "gone",
            "membership": {"include": ["light.old"], "exclude": []},
            "overrides": {"light.old": {"dawn": {"brightness": 90}}},
        },
        "two": {
            "id": "two",
            "area": "gone",
            "membership": {"include": [], "exclude": []},
        },
    }
    store.area_names = {"gone": "Old room"}
    store.variables = {}
    store.themes = {}
    store.settings = {}
    store.managed_native_scene_ids = []
    store.pending_hide_sync = False
    store._mutation_lock = asyncio.Lock()
    store.async_save = AsyncMock()
    return store


def test_orphan_area_is_listed_with_last_known_name():
    store = _store()
    hass = SimpleNamespace(
        data={DOMAIN: {DATA_CONFIG_ENTRY: object(), DATA_STORE: store}}
    )
    with (
        patch(
            "custom_components.scene_studio.websocket_api.ar.async_get",
            return_value=SimpleNamespace(areas={}),
        ),
        patch(
            "custom_components.scene_studio.websocket_api.fr.async_get",
            return_value=SimpleNamespace(floors={}),
        ),
    ):
        tree = _area_tree(hass)
    assert tree[0]["areas"] == [
        {
            "id": "gone",
            "name": "Old room",
            "icon": None,
            "floor_id": None,
            "lights": [],
            "deleted": True,
        }
    ]


def test_missing_area_blocks_explicit_membership_and_activation():
    hass = SimpleNamespace()
    with patch(
        "custom_components.scene_studio.snapshots.ar.async_get",
        return_value=SimpleNamespace(areas={}),
    ):
        scene = _store().scenes["one"]
        assert not scene_area_exists(hass, scene)
        assert scene_members(hass, scene) == []
        for entity_class in (CircadianScene, SimpleScene):
            entity = object.__new__(entity_class)
            entity.hass = hass
            entity._scene_config = scene
            try:
                asyncio.run(entity.async_activate())
            except Exception as error:
                assert "deleted" in str(error)
            else:
                raise AssertionError("deleted area activated")


def test_move_and_delete_are_single_store_mutations_and_keep_overrides():
    async def run():
        store = _store()
        moved = await store.async_move_area("gone", "new")
        assert len(moved) == 2
        assert store.async_save.await_count == 1
        assert all(
            item["membership"] == {"exclude": [], "include": []} for item in moved
        )
        assert moved[0]["overrides"] == {"light.old": {"dawn": {"brightness": 90}}}
        assert "gone" not in store.area_names

        removed = await store.async_delete_area("new")
        assert len(removed) == 2
        assert store.scenes == {}
        assert store.async_save.await_count == 2

    asyncio.run(run())


def test_failed_area_move_restores_all_saved_scenes_and_entities():
    async def run():
        store = _store()
        connection = SimpleNamespace(send_error=lambda *args: errors.append(args))
        errors = []
        hass = SimpleNamespace(
            data={
                DOMAIN: {
                    DATA_CONFIG_ENTRY: object(),
                    DATA_STORE: store,
                    DATA_ADD_ENTITIES: object(),
                    DATA_ENTITIES: {},
                }
            }
        )
        with (
            patch(
                "custom_components.scene_studio.websocket_api.ar.async_get",
                return_value=SimpleNamespace(
                    areas={"new": SimpleNamespace(id="new", name="New room")}
                ),
            ),
            patch(
                "custom_components.scene_studio.websocket_api.async_create_or_update_entity",
                new_callable=AsyncMock,
            ) as update,
        ):
            update.side_effect = [RuntimeError("entity failed"), None, None]
            await _ws_move_deleted_area_locked(
                hass,
                connection,
                {"id": 1, "area_id": "gone", "target_area_id": "new"},
            )
        assert errors[0][:2] == (1, "move_failed")
        assert all(item["area"] == "gone" for item in store.list())
        assert store.area_names == {"gone": "Old room"}
        assert update.await_count == 3

    asyncio.run(run())


def test_failed_area_delete_restores_all_saved_scenes_and_entities():
    async def run():
        store = _store()
        connection = SimpleNamespace(send_error=lambda *args: errors.append(args))
        errors = []
        hass = SimpleNamespace(
            data={
                DOMAIN: {
                    DATA_CONFIG_ENTRY: object(),
                    DATA_STORE: store,
                    DATA_ADD_ENTITIES: object(),
                    DATA_ENTITIES: {},
                }
            }
        )
        with (
            patch(
                "custom_components.scene_studio.websocket_api.ar.async_get",
                return_value=SimpleNamespace(areas={}),
            ),
            patch(
                "custom_components.scene_studio.websocket_api.async_remove_entity",
                new_callable=AsyncMock,
            ) as remove,
            patch(
                "custom_components.scene_studio.websocket_api.async_create_or_update_entity",
                new_callable=AsyncMock,
            ) as update,
        ):
            remove.side_effect = RuntimeError("entity failed")
            await _ws_delete_deleted_area_locked(
                hass, connection, {"id": 1, "area_id": "gone"}
            )
        assert errors[0][:2] == (1, "delete_failed")
        assert len(store.list()) == 2
        assert store.area_names == {"gone": "Old room"}
        assert update.await_count == 2

    asyncio.run(run())
