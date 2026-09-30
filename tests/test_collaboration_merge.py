"""Shared-editor revisions preserve disjoint fields and report true conflicts."""

import asyncio
from unittest.mock import AsyncMock

import pytest

from custom_components.scene_studio.collaboration import (
    ItemDeleted,
    RevisionConflict,
    merge_fields,
    revision_for,
)
from custom_components.scene_studio.const import SOLAR_EVENTS
from custom_components.scene_studio.store import SceneStudioStore, to_form_data


def test_revisions_ignore_dictionary_order_and_change_with_content():
    assert revision_for({"a": 1, "b": 2}) == revision_for({"b": 2, "a": 1})
    assert revision_for({"a": 1}) != revision_for({"a": 2})


def test_disjoint_light_and_event_settings_merge():
    base = {"overrides": {"light.one": {"dawn": {"brightness": 100}}}}
    mine = {"overrides": {"light.one": {"dawn": {"brightness": 120}}}}
    theirs = {
        "overrides": {
            "light.one": {
                "dawn": {"brightness": 100},
                "noon": {"brightness": 180},
            }
        }
    }
    merged, conflicts = merge_fields(base, mine, theirs)
    assert conflicts == []
    assert merged["overrides"]["light.one"] == {
        "dawn": {"brightness": 120},
        "noon": {"brightness": 180},
    }


def test_two_editors_can_add_different_events_for_the_same_new_light():
    merged, conflicts = merge_fields(
        {"overrides": {}},
        {"overrides": {"light.one": {"dawn": {"brightness": 100}}}},
        {"overrides": {"light.one": {"noon": {"brightness": 200}}}},
    )
    assert conflicts == []
    assert set(merged["overrides"]["light.one"]) == {"dawn", "noon"}


def test_membership_and_color_conflicts_are_atomic():
    base = {
        "membership": {"include": ["light.one"], "exclude": []},
        "color": {"rgb_color": [1, 2, 3]},
    }
    mine = {
        "membership": {"include": ["light.two"], "exclude": []},
        "color": {"rgb_color": [4, 2, 3]},
    }
    theirs = {
        "membership": {"include": ["light.three"], "exclude": []},
        "color": {"rgb_color": [1, 5, 3]},
    }
    merged, conflicts = merge_fields(base, mine, theirs)
    assert conflicts == ["color", "membership"]
    assert merged == mine


def test_deletion_conflicts_with_an_edit_to_the_same_field():
    base = {"events": {"dawn": {"brightness": 80}}}
    mine = {"events": {}}
    theirs = {"events": {"dawn": {"brightness": 100}}}
    merged, conflicts = merge_fields(base, mine, theirs)
    assert merged == mine
    assert conflicts == ["events.dawn"]


def _store():
    store = SceneStudioStore.__new__(SceneStudioStore)
    store.variables = {}
    store.themes = {}
    store.scenes = {}
    store.area_names = {}
    store.settings = {}
    store.managed_native_scene_ids = []
    store.pending_hide_sync = False
    store._mutation_lock = asyncio.Lock()
    store.async_save = AsyncMock()
    return store


def test_scene_rebase_merges_disjoint_edits_and_keeps_one_durable_revision():
    async def run():
        store = _store()
        original = await store.async_upsert(
            {"id": "scene", "kind": "simple", "scene_name": "Morning", "area": "room"}
        )
        base = to_form_data(original)
        revision = revision_for(base)
        await store.async_rebase_scene(
            {**base, "scene_name": "Breakfast"}, base, revision, to_form_data
        )
        updated = await store.async_rebase_scene(
            {**base, "description": "Warm lights"},
            base,
            revision,
            to_form_data,
        )
        assert updated["scene_name"] == "Breakfast"
        assert updated["description"] == "Warm lights"
        assert store.async_save.await_count == 3

    asyncio.run(run())


def test_scene_rebase_reports_same_field_and_never_writes_conflict():
    async def run():
        store = _store()
        original = await store.async_upsert(
            {"id": "scene", "kind": "simple", "scene_name": "Morning", "area": "room"}
        )
        base = to_form_data(original)
        revision = revision_for(base)
        await store.async_rebase_scene(
            {**base, "scene_name": "Breakfast"}, base, revision, to_form_data
        )
        with pytest.raises(RevisionConflict) as error:
            await store.async_rebase_scene(
                {**base, "scene_name": "Sunrise"}, base, revision, to_form_data
            )
        assert error.value.fields == ["scene_name"]
        assert error.value.current["scene_name"] == "Breakfast"
        assert store.async_save.await_count == 2

    asyncio.run(run())


def test_deleted_scene_cannot_be_recreated_by_stale_editor():
    async def run():
        store = _store()
        original = await store.async_upsert(
            {"id": "scene", "kind": "simple", "scene_name": "Morning", "area": "room"}
        )
        base = to_form_data(original)
        await store.async_delete("scene")
        with pytest.raises(ItemDeleted):
            await store.async_rebase_scene(base, base, revision_for(base), to_form_data)
        assert store.scenes == {}

    asyncio.run(run())


def test_library_rebase_merges_independent_fields_and_conflicts_on_color():
    async def run():
        store = _store()
        original = await store.async_upsert_variable(
            {
                "id": "warm",
                "name": "Warm",
                "kind": "color",
                "color": {"color_temp_kelvin": 2700},
                "brightness": 100,
            }
        )
        base = dict(original)
        revision = revision_for(base)
        await store.async_rebase_variable({**base, "name": "Cozy"}, base, revision)
        updated = await store.async_rebase_variable(
            {**base, "brightness": 120}, base, revision
        )
        assert updated["name"] == "Cozy"
        assert updated["brightness"] == 120
        current = dict(updated)
        await store.async_rebase_variable(
            {**current, "color": {"color_temp_kelvin": 3000}},
            current,
            revision_for(current),
        )
        with pytest.raises(RevisionConflict) as error:
            await store.async_rebase_variable(
                {**current, "color": {"color_temp_kelvin": 4000}},
                current,
                revision_for(current),
            )
        assert error.value.fields == ["color"]

    asyncio.run(run())


def test_theme_rebase_merges_independent_event_settings():
    async def run():
        store = _store()
        events = {
            event: {"color": {"rgb_color": [1, 2, 3]}, "brightness": 80}
            for event in SOLAR_EVENTS
        }
        original = await store.async_upsert_theme(
            {"id": "warm", "name": "Warm", "events": events}
        )
        base = dict(original)
        revision = revision_for(base)
        await store.async_rebase_theme({**base, "name": "Cozy"}, base, revision)
        updated = await store.async_rebase_theme(
            {
                **base,
                "events": {**events, "dawn": {**events["dawn"], "brightness": 100}},
            },
            base,
            revision,
        )
        assert updated["name"] == "Cozy"
        assert updated["events"]["dawn"]["brightness"] == 100

    asyncio.run(run())
