"""Durable editor-change notifications and the shared scene operation lock."""

import asyncio

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import DOMAIN

EDITOR_CHANGED_SIGNAL = f"{DOMAIN}_editor_changed"
SETTINGS_CHANGED_SIGNAL = f"{DOMAIN}_settings_changed"


def publish_change(
    hass: HomeAssistant, source, kind: str, item_id: str | None, action: str
) -> None:
    """Notify admin editor subscriptions after save and entity synchronization."""
    async_dispatcher_send(
        hass,
        EDITOR_CHANGED_SIGNAL,
        source,
        {"kind": kind, "id": item_id, "action": action},
    )


def scene_operation_lock(hass: HomeAssistant) -> asyncio.Lock:
    """Serialize durable store changes with their HA entity compensation."""
    return hass.data[DOMAIN].setdefault("scene_operation_lock", asyncio.Lock())
