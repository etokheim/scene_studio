"""Apply extrapolated entity states to Home Assistant."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.components.fan import DOMAIN as FAN_DOMAIN
from homeassistant.components.light import ATTR_TRANSITION
from homeassistant.components.light import DOMAIN as LIGHT_DOMAIN
from homeassistant.components.lock import LockState
from homeassistant.const import (
    ATTR_ENTITY_ID,
    SERVICE_LOCK,
    SERVICE_TURN_OFF,
    SERVICE_TURN_ON,
    SERVICE_UNLOCK,
    STATE_CLOSED,
    STATE_CLOSING,
    STATE_OPEN,
    STATE_OPENING,
    STATE_PROBLEM,
    STATE_UNAVAILABLE,
    STATE_UNKNOWN,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .continuous import snapshot_from_command, snapshot_from_state, states_match

_LOGGER = logging.getLogger(__name__)


async def apply_entities_parallel(
    entities,
    hass: HomeAssistant,
    transition_time=0,
    context=None,
    *,
    skip_noop: bool = False,
):
    """Apply multiple entity states in parallel for better performance.

    When skip_noop is True (automatic light-update ticks only), lights whose current state
    already matches the commanded target are not sent another service call.
    """
    _LOGGER.debug("Starting parallel processing of %d entities", len(entities))

    tasks = []
    for entity in entities:
        task = asyncio.create_task(
            apply_single_entity(
                entity,
                hass,
                transition_time,
                context=context,
                skip_noop=skip_noop,
            )
        )
        tasks.append(task)

    if tasks:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        failures = [result for result in results if isinstance(result, BaseException)]
        if failures:
            raise HomeAssistantError(
                f"Failed to apply {len(failures)} of {len(tasks)} entities: "
                f"{failures[0]}"
            ) from failures[0]
        _LOGGER.debug("Completed parallel processing of %d entities", len(entities))


def light_command_is_noop(hass: HomeAssistant, entity: dict[str, Any]) -> bool:
    """True when a light already matches the commanded on/off + color/brightness."""
    entity_id = entity.get(ATTR_ENTITY_ID)
    if not entity_id or not str(entity_id).startswith("light."):
        return False
    actual = snapshot_from_state(hass.states.get(entity_id))
    if actual is None:
        return False
    commanded = snapshot_from_command(entity)
    return states_match(actual, commanded)


async def apply_single_entity(
    entity,
    hass: HomeAssistant,
    transition_time=0,
    context=None,
    *,
    skip_noop: bool = False,
):
    """Apply a single entity state."""
    domain = entity[ATTR_ENTITY_ID].split(".")[0]
    if "state" not in entity:
        raise HomeAssistantError(
            f"Entity {entity.get(ATTR_ENTITY_ID)!r} is missing a state property"
        )
    state = entity["state"]
    if state in (STATE_UNAVAILABLE, STATE_UNKNOWN, STATE_PROBLEM, LockState.JAMMED):
        raise HomeAssistantError(
            f"Entity {entity[ATTR_ENTITY_ID]!r} has non-applicable state {state!r}"
        )

    if skip_noop and domain == LIGHT_DOMAIN and light_command_is_noop(hass, entity):
        _LOGGER.debug(
            "Skipping no-op automatic light update for %s", entity[ATTR_ENTITY_ID]
        )
        return False

    if domain == LIGHT_DOMAIN:
        entity[ATTR_TRANSITION] = transition_time

    if domain == FAN_DOMAIN:
        _LOGGER.warning(
            "Extrapolation of fans only support turning them on/off. Direction, speed etc will be ignored until it's implemented. Please open an issue or PR if this is something you want"
        )

    entity_applied = entity.copy()
    service_type = None
    if state == "on":
        service_type = SERVICE_TURN_ON
    elif state == "off":
        service_type = SERVICE_TURN_OFF
    elif state in (LockState.LOCKED, LockState.LOCKING):
        service_type = SERVICE_LOCK
    elif state in (LockState.UNLOCKED, LockState.UNLOCKING):
        service_type = SERVICE_UNLOCK
    elif state in (STATE_OPEN, STATE_OPENING):
        if domain == "cover":
            service_type = "open_cover"
        elif domain == "valve":
            service_type = "open_valve"
        else:
            service_type = SERVICE_TURN_ON
    elif state in (STATE_CLOSED, STATE_CLOSING):
        if domain == "cover":
            service_type = "close_cover"
        elif domain == "valve":
            service_type = "close_valve"
        else:
            service_type = SERVICE_TURN_OFF
    if service_type is None:
        raise HomeAssistantError(
            f"Entity {entity[ATTR_ENTITY_ID]!r} has unsupported state {state!r}"
        )

    del entity_applied["state"]

    if domain == LIGHT_DOMAIN and service_type == SERVICE_TURN_OFF:
        entity_applied = {
            ATTR_ENTITY_ID: entity_applied[ATTR_ENTITY_ID],
            ATTR_TRANSITION: transition_time,
        }
    else:
        entity_applied = {
            key: value for key, value in entity_applied.items() if value is not None
        }

    # Service data can contain sensitive attributes for migrated non-light
    # entities. Keep debug logs useful without copying that payload.
    _LOGGER.debug("Applying %s.%s to %s", domain, service_type, entity[ATTR_ENTITY_ID])

    try:
        await hass.services.async_call(
            domain=domain,
            service=service_type,
            service_data=entity_applied,
            context=context,
            blocking=True,
        )
    except Exception as error:  # pylint: disable=broad-exception-caught
        raise HomeAssistantError(
            f"Failed to apply {entity[ATTR_ENTITY_ID]} via {domain}.{service_type}: "
            f"{error}"
        ) from error

    return True
