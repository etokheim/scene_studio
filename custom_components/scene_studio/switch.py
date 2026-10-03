"""One global Home Assistant automatic-update control, backed by the store."""

from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DATA_STORE, DOMAIN
from .editor_events import SETTINGS_CHANGED_SIGNAL
from .update_controls import async_update_settings


async def async_setup_entry(hass, _entry, async_add_entities):
    """Expose a stable global control without restoring runtime ownership."""
    async_add_entities([AutomaticUpdatesSwitch(hass)])


class AutomaticUpdatesSwitch(SwitchEntity):
    """Mirror the integration preference for dashboards and automations."""

    _attr_unique_id = f"{DOMAIN}_automatic_updates"
    _attr_translation_key = "automatic_updates"
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_icon = "mdi:theme-light-dark"

    def __init__(self, hass):
        self.hass = hass

    @property
    def is_on(self):
        """Return the durable preference, independently of scene ownership."""
        return self.hass.data[DOMAIN][DATA_STORE].settings.get(
            "automatic_updates_enabled", True
        )

    async def async_added_to_hass(self):
        """Keep the HA switch synchronized with admin settings and Reset."""
        await super().async_added_to_hass()
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SETTINGS_CHANGED_SIGNAL, self.async_write_ha_state
            )
        )

    async def async_turn_on(self, **kwargs):
        """HA's switch service enforces this entity's control permissions."""
        await async_update_settings(
            self.hass, {"automatic_updates_enabled": True}, context=self._context
        )

    async def async_turn_off(self, **kwargs):
        """Pause timers while retaining active-scene ownership."""
        await async_update_settings(
            self.hass, {"automatic_updates_enabled": False}, context=self._context
        )
