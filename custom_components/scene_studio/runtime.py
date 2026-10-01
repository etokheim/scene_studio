"""Instance-local scene ownership and light reports, independent of update timers."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

from homeassistant.core import Context, Event, HomeAssistant, callback
from homeassistant.helpers.event import async_track_state_change_event

from .const import DATA_STORE, DOMAIN
from .continuous import (
    classify_light_report,
    context_is_ours,
    snapshot_from_command,
    snapshot_from_state,
)

DATA_RUNTIME = "runtime"


@dataclass
class Ownership:
    """One successful activation, including retained manual-change records."""

    entity: Any
    area: str | None
    lights: set[str]
    commands: dict[str, dict]
    before: dict[str, dict | None]
    context: Context | None
    until: float
    manual: set[str] = field(default_factory=set)
    interrupted: set[str] = field(default_factory=set)


class SceneRuntime:
    """Serialize command handlers and transfer ownership only after success."""

    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self.command_lock = asyncio.Lock()
        self.owners: dict[str, Ownership] = {}
        self._unsubscribe = None
        self.pending_context: Context | None = None

    def respected(self, owner: Ownership) -> set[str]:
        """Retain all records so policy changes can reevaluate current owners."""
        store = self.hass.data.get(DOMAIN, {}).get(DATA_STORE)
        settings = store.settings if store is not None else {}
        follow = set(settings.get("always_follow_scene", []))
        respect = set(settings.get("always_respect_manual_changes", []))
        manual = owner.manual - follow
        if settings.get("respect_manual_changes", True):
            return manual & owner.lights
        return manual & respect & owner.lights

    def active(self, entity) -> bool:
        """Whether this scene still owns any light not manually relinquished."""
        owner = self.owners.get(entity.unique_id)
        return bool(owner and owner.lights - self.respected(owner))

    def eligible_lights(self, entity) -> set[str]:
        """Targets still owned, excluding respected overrides and interruptions."""
        owner = self.owners.get(entity.unique_id)
        if owner is None:
            return set()
        return owner.lights - self.respected(owner) - owner.interrupted

    def claim(self, entity, commands: list[dict], before: dict, context, transition):
        """Commit ownership after all requested light handlers have completed."""
        lights = {item["entity_id"] for item in commands}
        area = entity._area_id  # pylint: disable=protected-access
        for key, previous in list(self.owners.items()):
            if key == entity.unique_id:
                continue
            if area is not None and previous.area == area:
                previous.lights.clear()
            else:
                previous.lights.difference_update(lights)
            self._changed(previous)
        owner = Ownership(
            entity=entity,
            area=area,
            lights=lights,
            commands={
                item["entity_id"]: snapshot_from_command(item) for item in commands
            },
            before=before,
            context=context,
            until=time.time() + float(transition or 0),
        )
        self.owners[entity.unique_id] = owner
        self._changed(owner)
        self._listen()

    def record_commands(self, entity, commands, before, context, transition):
        """Update current targets without replacing ownership or override records."""
        owner = self.owners.get(entity.unique_id)
        if owner is None:
            return
        for item in commands:
            eid = item["entity_id"]
            if eid in owner.lights:
                owner.commands[eid] = snapshot_from_command(item)
                owner.before[eid] = before.get(eid)
        owner.context = context
        owner.until = time.time() + float(transition or 0)
        self._changed(owner)

    def release(self, entity):
        """Removal/move/deleted area releases ownership, without store mutation."""
        owner = self.owners.pop(entity.unique_id, None)
        if owner is not None:
            owner.lights.clear()
            self._changed(owner)
            self._listen()

    def areas_changed(self, area_ids: set[str]):
        """A removed area immediately relinquishes lights and stops its timers."""
        for owner in list(self.owners.values()):
            if owner.area is not None and owner.area not in area_ids:
                self.release(owner.entity)

    def close(self):
        """Unload every instance-owned listener and forget runtime ownership."""
        if self._unsubscribe:
            self._unsubscribe()
            self._unsubscribe = None
        self.owners.clear()
        self.pending_context = None

    def _listen(self):
        if self._unsubscribe:
            self._unsubscribe()
            self._unsubscribe = None
        lights = set().union(*(owner.lights for owner in self.owners.values()))
        if lights:
            self._unsubscribe = async_track_state_change_event(
                self.hass, list(lights), self._state_changed
            )

    def _changed(self, owner):
        handler = getattr(owner.entity, "async_runtime_changed", None)
        if handler:
            handler(owner, self.respected(owner))

    def collect(self, entity):
        """Detect silent reports before a tick, using the same classifier."""
        owner = self.owners.get(entity.unique_id)
        if owner is None:
            return
        for eid in owner.lights:
            self._report(owner, eid, self.hass.states.get(eid), None, None)

    @callback
    def _state_changed(self, event: Event):
        if context_is_ours(event.context, self.pending_context):
            return
        eid = event.data["entity_id"]
        for owner in self.owners.values():
            if eid in owner.lights:
                self._report(
                    owner,
                    eid,
                    event.data.get("new_state"),
                    event.data.get("old_state"),
                    event.context,
                )

    def _report(self, owner, eid, new_state, old_state, context):
        command = owner.commands.get(eid)
        if command is None:
            return
        kind = classify_light_report(
            actual=snapshot_from_state(new_state),
            commanded=command,
            pre=owner.before.get(eid),
            user_id=getattr(context, "user_id", None),
            from_our_context=context_is_ours(context, owner.context),
            mid_transition=time.time() < owner.until,
            previous_was_down=old_state is not None
            and snapshot_from_state(old_state) is None,
            was_interrupted=eid in owner.interrupted,
        )
        if kind == "interrupt":
            owner.interrupted.add(eid)
        elif kind == "override":
            owner.manual.add(eid)
            owner.interrupted.discard(eid)
        elif kind in ("sync", "drift", "recover"):
            owner.interrupted.discard(eid)
        else:
            return
        self._changed(owner)
        if kind == "recover" and eid not in self.respected(owner):
            recover = getattr(owner.entity, "async_recover_owned_light", None)
            if recover:
                self.hass.async_create_task(recover(eid))


def scene_runtime(hass: HomeAssistant) -> SceneRuntime:
    """Return this entry's runtime; it is deliberately never restored from disk."""
    data = hass.data.setdefault(DOMAIN, {})
    if DATA_RUNTIME not in data:
        data[DATA_RUNTIME] = SceneRuntime(hass)
    return data[DATA_RUNTIME]


def unload_runtime(hass: HomeAssistant):
    """Remove runtime state on failed setup and successful unload."""
    runtime = hass.data.get(DOMAIN, {}).pop(DATA_RUNTIME, None)
    if runtime is not None:
        runtime.close()
