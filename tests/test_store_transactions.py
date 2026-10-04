"""Localized edits preserve unrelated objects and retain complete rollback."""

import asyncio
from unittest.mock import AsyncMock

import pytest

from custom_components.scene_studio.store import SceneStudioStore


def bare_store():
    store = SceneStudioStore.__new__(SceneStudioStore)
    for field in ("scenes", "variables", "themes", "area_names", "settings"):
        setattr(store, field, {})
    store.managed_native_scene_ids = []
    store.pending_hide_sync = False
    store._mutation_lock = asyncio.Lock()  # pylint: disable=protected-access
    store.async_save = AsyncMock()
    return store


class Unrelated(dict):
    """A sentinel proving localized transactions do not deepcopy other items."""

    def __deepcopy__(self, _memo):
        raise AssertionError("unrelated item was copied")


def test_localized_scene_variable_theme_and_settings_edits_do_not_copy_catalog():
    async def run():
        store = bare_store()
        untouched = Unrelated(id="untouched")
        store.scenes["untouched"] = untouched
        await store.async_upsert(
            {"id": "simple", "kind": "simple", "scene_name": "Room", "lights": {}}
        )
        await store.async_upsert_variable(
            {"id": "color", "name": "Color", "color": {"hs_color": [20, 30]}}
        )
        await store.async_upsert_theme(
            {
                "id": "theme",
                "name": "Theme",
                "events": {
                    event: {"color": {"hs_color": [20, 30]}, "brightness": 100}
                    for event in ("dawn", "sunrise", "noon", "sunset", "dusk")
                },
            }
        )
        await store.async_update_settings({"automatic_updates_enabled": False})
        await store.async_delete("simple")
        assert store.scenes["untouched"] is untouched
        assert store.async_save.await_count == 5

    asyncio.run(run())


@pytest.mark.parametrize("operation", ["edit", "insert", "delete"])
def test_scoped_rollback_restores_only_affected_item(operation):
    async def run():
        store = bare_store()
        untouched = Unrelated(id="untouched")
        store.scenes = {
            "one": {"id": "one", "nested": {"brightness": 100}},
            "untouched": untouched,
        }
        store.async_save.side_effect = OSError("failed")

        def change():
            if operation == "edit":
                store.scenes["one"]["nested"]["brightness"] = 200
            elif operation == "insert":
                store.scenes["new"] = {"id": "new"}
            else:
                store.scenes.pop("one")

        key = "new" if operation == "insert" else "one"
        with pytest.raises(OSError):
            await store._async_mutate(
                change, scope={"scenes": [key]}
            )  # pylint: disable=protected-access
        assert "new" not in store.scenes
        assert store.scenes["one"]["nested"]["brightness"] == 100
        assert store.scenes["untouched"] is untouched

    asyncio.run(run())


def test_unchanged_revision_aware_item_skips_durable_write():
    async def run():
        store = bare_store()
        store.scenes = {"one": {"id": "one"}, "untouched": Unrelated()}
        await store._async_mutate(
            lambda: None, scope={"scenes": ["one"]}, skip_if_unchanged=True
        )  # pylint: disable=protected-access
        store.async_save.assert_not_awaited()

    asyncio.run(run())
