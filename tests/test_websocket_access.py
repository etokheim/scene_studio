"""Every Scene Studio WebSocket command gates store and editor access."""

from types import SimpleNamespace

import pytest
from homeassistant.exceptions import Unauthorized

from custom_components.scene_studio import websocket_api


def test_non_admin_cannot_call_any_scene_studio_websocket_command():
    connection = SimpleNamespace(user=SimpleNamespace(is_admin=False))
    handlers = [
        value
        for value in vars(websocket_api).values()
        if callable(value)
        and getattr(value, "_ws_command", "").startswith("scene_studio/")
    ]
    assert handlers
    assert any(
        handler._ws_command.endswith("subscribe_changes") for handler in handlers
    )
    for handler in handlers:
        with pytest.raises(Unauthorized):
            handler(SimpleNamespace(), connection, {"id": 1})
