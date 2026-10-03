"""Light groups are omitted when their bulbs are already listed."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from custom_components.scene_studio.native_scene import without_redundant_light_groups


def _hass(groups: dict[str, list[str]]) -> MagicMock:
    hass = MagicMock()

    def get_state(entity_id: str):
        members = groups.get(entity_id)
        if members is None:
            return SimpleNamespace(attributes={})
        return SimpleNamespace(attributes={"entity_id": members})

    hass.states.get.side_effect = get_state
    return hass


def test_group_is_omitted_when_a_member_is_listed():
    hass = _hass({"light.kitchen": ["light.a", "light.b"]})
    assert without_redundant_light_groups(
        hass, ["light.a", "light.b", "light.kitchen"]
    ) == ["light.a", "light.b"]


def test_group_stays_when_members_are_hidden():
    hass = _hass({"light.kitchen": ["light.a", "light.b"]})
    assert without_redundant_light_groups(hass, ["light.kitchen"]) == ["light.kitchen"]
