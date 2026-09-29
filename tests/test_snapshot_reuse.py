"""Activation uses one resolved membership and capability map for every event."""

from types import SimpleNamespace
from unittest.mock import patch

from custom_components.scene_studio.const import SOLAR_EVENTS
from custom_components.scene_studio.snapshots import circadian_anchor


def test_reused_membership_produces_the_same_event_snapshots():
    scene = {"id": "room", "theme_id": "default"}
    store = SimpleNamespace(variables={}, themes={})
    members = ["light.a", "light.b"]
    modes = {"light.a": {"hs"}, "light.b": {"color_temp"}}

    def build(_scene, event, _variables, _themes, actual_members, actual_modes):
        assert actual_members == members
        assert actual_modes == modes
        return {
            entity_id: {"state": "on", "event": event} for entity_id in actual_members
        }

    with (
        patch(
            "custom_components.scene_studio.snapshots.scene_members",
            return_value=members,
        ) as resolve,
        patch(
            "custom_components.scene_studio.snapshots.modes_map", return_value=modes
        ) as resolve_modes,
        patch(
            "custom_components.scene_studio.snapshots.build_circadian_event_snapshot",
            side_effect=build,
        ),
    ):
        baseline = [
            circadian_anchor(None, store, scene, event) for event in SOLAR_EVENTS
        ]
        resolve.reset_mock()
        resolve_modes.reset_mock()
        reused = [
            circadian_anchor(None, store, scene, event, members=members, modes=modes)
            for event in SOLAR_EVENTS
        ]
        assert reused == baseline
        resolve.assert_not_called()
        resolve_modes.assert_not_called()
