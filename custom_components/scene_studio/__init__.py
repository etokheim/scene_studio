"""The Scene Studio integration (domain: scene_studio)."""

from __future__ import annotations

import logging

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_CONTROL
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, Platform
from homeassistant.core import Event, HomeAssistant
from homeassistant.exceptions import ServiceValidationError, Unauthorized, UnknownUser
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import selector
from homeassistant.helpers.event import async_call_later

from .activation_cache import unload_activation_cache
from .const import (
    AREA,
    DATA_ADD_ENTITIES,
    DATA_CONFIG_ENTRY,
    DATA_ENTITIES,
    DATA_STORE,
    DOMAIN,
    LEGACY_DOMAINS,
    SCENE_NAME,
)
from .migrate_native import async_freeze_migrate, needs_native_freeze
from .panel import async_setup_panel, async_unload_panel
from .runtime import DATA_RUNTIME, unload_runtime
from .store import SceneStudioStore
from .websocket_api import async_setup_websocket

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SCENE]

SERVICE_TURN_ON = "turn_on"
ATTR_BRIGHTNESS_MODIFIER = "brightness_modifier"
ATTR_TRANSITION = "transition"
ATTR_TRANSITION_PERCENT = "transition_percent"
ATTR_TARGET_DATE_TIME = "target_date_time"
ATTR_LOCATION = "location"


def _validate_turn_on_parameters(
    brightness_modifier: float,
    transition: float,
    transition_percent: float | None,
) -> None:
    """Raise a service error for invalid Scene Studio activation input."""
    if not -100 <= brightness_modifier <= 100:
        raise ServiceValidationError(
            "Brightness modifier must be between -100 and 100, "
            f"got {brightness_modifier}"
        )
    if not 0 <= transition <= 6553:
        raise ServiceValidationError(
            f"Transition must be between 0 and 6553 seconds, got {transition}"
        )
    if transition_percent is not None and not 0 <= transition_percent <= 100:
        raise ServiceValidationError(
            "Transition percent must be between 0 and 100, " f"got {transition_percent}"
        )


async def async_setup(hass, config):
    """Set up is called when Home Assistant is loading our component."""

    async def handle_turn_on(call):
        """Handle the turn_on service call."""
        entity_ids = call.data.get("entity_id", [])
        brightness_modifier = call.data.get(ATTR_BRIGHTNESS_MODIFIER, 0)
        transition = call.data.get(ATTR_TRANSITION, 0)
        transition_percent = call.data.get(ATTR_TRANSITION_PERCENT)
        target_date_time = call.data.get(ATTR_TARGET_DATE_TIME)
        location = call.data.get(ATTR_LOCATION)

        _validate_turn_on_parameters(
            brightness_modifier, transition, transition_percent
        )

        owned = hass.data.get(DOMAIN, {}).get(DATA_ENTITIES, {})
        scenes = {scene.entity_id: scene for scene in owned.values()}
        for entity_id in entity_ids:
            if not entity_id.startswith("scene."):
                raise ServiceValidationError(
                    f"Entity {entity_id!r} is not a scene entity"
                )
            if entity_id not in scenes or not hass.states.get(entity_id):
                raise ServiceValidationError(
                    f"Scene entity {entity_id!r} is not owned by Scene Studio"
                )
        if call.context.user_id:
            user = await hass.auth.async_get_user(call.context.user_id)
            if user is None:
                raise UnknownUser(context=call.context)
            for entity_id in entity_ids:
                if not user.permissions.check_entity(entity_id, POLICY_CONTROL):
                    raise Unauthorized(context=call.context, entity_id=entity_id)
        for entity_id in entity_ids:
            await scenes[entity_id].async_activate(
                transition=transition,
                brightness_modifier=brightness_modifier,
                transition_percent=transition_percent,
                target_date_time=target_date_time,
                location=location,
                context=call.context,
            )

    hass.services.async_register(
        DOMAIN,
        SERVICE_TURN_ON,
        handle_turn_on,
        schema=vol.Schema(
            {
                vol.Required("entity_id"): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain="scene",
                        integration="scene_studio",
                        multiple=True,
                    )
                ),
                vol.Optional(
                    ATTR_BRIGHTNESS_MODIFIER, default=0
                ): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=-100,
                        max=100,
                        step=1,
                        unit_of_measurement="%",
                        mode="slider",
                    )
                ),
                vol.Optional(ATTR_TRANSITION, default=0): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0,
                        max=6553,
                        step=1,
                        unit_of_measurement="s",
                        mode="slider",
                    )
                ),
                vol.Optional(ATTR_TRANSITION_PERCENT): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0,
                        max=100,
                        step=1,
                        unit_of_measurement="%",
                        mode="slider",
                    )
                ),
                vol.Optional(ATTR_TARGET_DATE_TIME): selector.DateTimeSelector(
                    selector.DateTimeSelectorConfig()
                ),
                vol.Optional(ATTR_LOCATION): selector.LocationSelector(),
            }
        ),
    )

    return True


async def async_migrate_entry(hass: HomeAssistant, config_entry: ConfigEntry) -> bool:
    """Keep older config entries loadable after the single-instance flow."""
    if config_entry.version < 2:
        hass.config_entries.async_update_entry(config_entry, version=2)
    return True


def _is_legacy_entry(entry: ConfigEntry) -> bool:
    return SCENE_NAME in entry.data or AREA in entry.data or "unique_id" in entry.data


def _purge_legacy_platform_entities(hass: HomeAssistant) -> int:
    """Drop entity-registry rows from the old domain so unique_ids can reclaim ids."""
    registry = er.async_get(hass)
    removed = 0
    for entry in list(registry.entities.values()):
        if entry.platform not in LEGACY_DOMAINS:
            continue
        registry.async_remove(entry.entity_id)
        removed += 1
    if removed:
        _LOGGER.info(
            "Removed %s entity registry entries from legacy platforms %s",
            removed,
            ", ".join(LEGACY_DOMAINS),
        )
    return removed


async def async_setup_entry(hass: HomeAssistant, config_entry: ConfigEntry) -> bool:
    """Set up Scene Studio from a config entry."""
    domain_data = hass.data.setdefault(
        DOMAIN,
        {
            DATA_STORE: SceneStudioStore(hass),
            DATA_ENTITIES: {},
            DATA_ADD_ENTITIES: None,
            DATA_CONFIG_ENTRY: None,
            "websocket_setup": False,
            "panel_setup": False,
            "store_loaded": False,
            "legacy_entities_purged": False,
            "freeze_start_unsub": None,
            "freeze_retry_unsub": None,
            "area_unsub": None,
            "area_tasks": set(),
        },
    )
    store: SceneStudioStore = domain_data[DATA_STORE]
    forwarding_started = False
    panel_attempted = False
    try:
        if not domain_data["store_loaded"]:
            await store.async_load()
            domain_data["store_loaded"] = True

        async def _remember_areas(_event: Event | None = None) -> None:
            names = {area.id: area.name for area in ar.async_get(hass).areas.values()}
            await store.async_remember_area_names(names)
            if runtime := domain_data.get(DATA_RUNTIME):
                runtime.areas_changed(set(names))

        await _remember_areas()
        if domain_data["area_unsub"] is None:

            def _queue_area_refresh(event: Event) -> None:
                task = hass.async_create_task(_remember_areas(event))
                if task is not None:
                    domain_data["area_tasks"].add(task)
                    task.add_done_callback(domain_data["area_tasks"].discard)

            domain_data["area_unsub"] = hass.bus.async_listen(
                ar.EVENT_AREA_REGISTRY_UPDATED,
                _queue_area_refresh,
            )

        if not domain_data["legacy_entities_purged"]:
            _purge_legacy_platform_entities(hass)
            domain_data["legacy_entities_purged"] = True

        if _is_legacy_entry(config_entry):
            await store.async_import_legacy(
                dict(config_entry.data), dict(config_entry.options)
            )

        if domain_data[DATA_CONFIG_ENTRY] is not None:
            hass.async_create_task(
                hass.config_entries.async_remove(config_entry.entry_id)
            )
            return True

        async def _freeze(_event: Event | None = None) -> None:
            domain_data["freeze_start_unsub"] = None
            domain_data["freeze_retry_unsub"] = None
            if hass.data.get(DOMAIN) is not domain_data:
                return
            changed = await async_freeze_migrate(hass, store)
            if not changed:
                if (
                    hass.is_running
                    and any(needs_native_freeze(item) for item in store.list())
                    and domain_data["freeze_retry_unsub"] is None
                ):
                    domain_data["freeze_retry_unsub"] = async_call_later(
                        hass, 30, _freeze
                    )
                return
            entities = hass.data.get(DOMAIN, {}).get(DATA_ENTITIES) or {}
            for item in store.list():
                entity = entities.get(item["id"])
                if entity is not None:
                    await entity.async_update_config(item)

        if hass.data.get("scene") or hass.is_running:
            await _freeze()
        if not hass.is_running:
            domain_data["freeze_start_unsub"] = hass.bus.async_listen_once(
                EVENT_HOMEASSISTANT_STARTED, _freeze
            )

        domain_data[DATA_CONFIG_ENTRY] = config_entry
        if not domain_data["websocket_setup"]:
            async_setup_websocket(hass)
            domain_data["websocket_setup"] = True
        if not domain_data["panel_setup"]:
            panel_attempted = True
            await async_setup_panel(hass)
            domain_data["panel_setup"] = True

        forwarding_started = True
        await hass.config_entries.async_forward_entry_setups(config_entry, PLATFORMS)
        hass.async_create_task(
            _async_normalize_primary_entry(hass, config_entry.entry_id)
        )
        return True
    except Exception:
        if domain_data[DATA_CONFIG_ENTRY] not in (None, config_entry):
            raise
        if forwarding_started:
            try:
                await hass.config_entries.async_unload_platforms(
                    config_entry, PLATFORMS
                )
            except Exception:
                _LOGGER.exception("Failed to unload a partially set up scene platform")
        if panel_attempted:
            try:
                await async_unload_panel(hass)
            except Exception:
                _LOGGER.exception(
                    "Failed to remove a partially set up Scene Studio panel"
                )
        if unsubscribe := domain_data.get("freeze_start_unsub"):
            unsubscribe()
        if unsubscribe := domain_data.get("freeze_retry_unsub"):
            unsubscribe()
        if unsubscribe := domain_data.get("area_unsub"):
            unsubscribe()
        for task in domain_data["area_tasks"]:
            task.cancel()
        unload_activation_cache(hass)
        unload_runtime(hass)
        hass.data.pop(DOMAIN, None)
        raise


async def _async_normalize_primary_entry(hass: HomeAssistant, entry_id: str) -> None:
    """Collapse a migrated entry to the single-instance shape after setup."""
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None:
        return
    if entry.data or entry.options or entry.unique_id != DOMAIN:
        hass.config_entries.async_update_entry(
            entry,
            unique_id=DOMAIN,
            title="Scene Studio",
            data={},
            options={},
        )


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    domain_data = hass.data.get(DOMAIN)
    if not domain_data or domain_data.get(DATA_CONFIG_ENTRY) is not entry:
        return True

    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        await async_unload_panel(hass)
        if unsubscribe := domain_data.get("freeze_start_unsub"):
            unsubscribe()
        if unsubscribe := domain_data.get("freeze_retry_unsub"):
            unsubscribe()
        if unsubscribe := domain_data.get("area_unsub"):
            unsubscribe()
        for task in domain_data["area_tasks"]:
            task.cancel()
        unload_activation_cache(hass)
        unload_runtime(hass)
        hass.data.pop(DOMAIN, None)
    return unload_ok
