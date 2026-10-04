"""Scoped catalog resolution follows transitive preset references."""

from types import SimpleNamespace
from unittest.mock import patch

from custom_components.scene_studio.websocket_api import _catalog_changes_payload


def test_changed_color_resolves_only_dependent_scenes():
    store = SimpleNamespace(
        variables={
            "color": {"id": "color"},
            "palette": {"id": "palette", "slots": [{"variable_ref": "color"}]},
        },
        themes={
            "theme": {
                "id": "theme",
                "events": {"dawn": {"color": {"variable_ref": "palette"}}},
            }
        },
        scenes={
            "direct": {"id": "direct", "palette_id": "palette"},
            "themed": {"id": "themed", "theme_id": "theme"},
            "unrelated": {"id": "unrelated"},
        },
    )
    with (
        patch(
            "custom_components.scene_studio.websocket_api._store", return_value=store
        ),
        patch(
            "custom_components.scene_studio.websocket_api._scene_payload",
            side_effect=lambda _hass, scene: scene,
        ) as resolved,
    ):
        result = _catalog_changes_payload(None, [{"kind": "variable", "id": "color"}])
    assert result["scene_ids"] == ["direct", "themed"]
    assert resolved.call_count == 2
    assert result["variables"][0]["id"] == "color"
    assert result["themes"] == []


def test_missing_items_are_explicit_deletions_without_card_work():
    store = SimpleNamespace(variables={}, themes={}, scenes={})
    with (
        patch(
            "custom_components.scene_studio.websocket_api._store", return_value=store
        ),
        patch(
            "custom_components.scene_studio.websocket_api._scene_payload"
        ) as resolved,
    ):
        result = _catalog_changes_payload(None, [{"kind": "scene", "id": "deleted"}])
    assert result["scene_ids"] == ["deleted"]
    assert result["scenes"] == []
    resolved.assert_not_called()


def test_scene_only_change_does_not_scan_other_scenes():
    class NoScan(dict):
        def items(self):
            raise AssertionError("scene-only refresh must not scan unrelated scenes")

    store = SimpleNamespace(
        variables={}, themes={}, scenes=NoScan({"one": {"id": "one"}})
    )
    with (
        patch(
            "custom_components.scene_studio.websocket_api._store", return_value=store
        ),
        patch(
            "custom_components.scene_studio.websocket_api._scene_payload",
            side_effect=lambda _hass, item: item,
        ),
    ):
        result = _catalog_changes_payload(None, [{"kind": "scene", "id": "one"}])
    assert result["scenes"] == [{"id": "one"}]
