"""
Create a scene entity which when activated calculates the appropriate lighting by extrapolating between user configured scenes.
"""  # noqa: D200, D212

import logging
import time
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from astral import LocationInfo
from homeassistant.components.scene import Scene
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    ATTR_ENTITY_ID,
)
from homeassistant.core import Context, HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import (
    async_call_later,
    async_track_time_interval,
)
from homeassistant.util import dt as dt_util

from .activation_cache import cached_solar_events
from .apply_entities import apply_entities_parallel
from .const import (
    AREA,
    CATEGORY,
    DATA_ADD_ENTITIES,
    DATA_ENTITIES,
    DATA_STORE,
    DEFAULT_SCENE_NAME,
    DOMAIN,
    KIND_SIMPLE,
    LABELS,
    SCENE_NAME,
    SOLAR_EVENTS,
)
from .continuous import (
    automatically_update_lights_interval_seconds,
    should_arm_automatically_update_lights,
    snapshot_from_command,
    snapshot_from_state,
)
from .extrapolation_math import (
    SunEvent,
    current_sun_event_index,
    day_transition_percent,
    extrapolate_entities,
    scene_keys_from_day_percent,
    transition_progress_percent,
)
from .palette import scene_palette_image_attributes
from .runtime import scene_runtime
from .snapshots import (
    circadian_anchor,
    modes_map,
    scene_area_exists,
    scene_members,
    simple_anchor,
)
from .solar import EVENT_ORDER, dawn_start_seconds, dusk_start_seconds
from .store import dawn_maximum_seconds, dusk_minimum_seconds

_LOGGER = logging.getLogger(__name__)


def _local_target_datetime(value: datetime | str | None, time_zone: str) -> datetime:
    """Resolve an activation instant on the configured local calendar day."""
    local_zone = ZoneInfo(time_zone)
    if value is None:
        return datetime.now(tz=local_zone)
    if isinstance(value, str):
        value = dt_util.parse_datetime(value)
    if not isinstance(value, datetime):
        raise ValueError("Invalid target datetime")
    if value.tzinfo is None:
        return value.replace(tzinfo=local_zone)
    return value.astimezone(local_zone)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> bool:
    """Configure the platform from stored scene configs."""
    store = hass.data[DOMAIN][DATA_STORE]
    entities = hass.data[DOMAIN][DATA_ENTITIES]
    hass.data[DOMAIN][DATA_ADD_ENTITIES] = async_add_entities

    to_add = []
    for item in store.list():
        entity = _make_entity(hass, config_entry, item)
        entities[item["id"]] = entity
        to_add.append(entity)
    if to_add:
        async_add_entities(to_add)
    return True


def _make_entity(
    hass: HomeAssistant, config_entry: ConfigEntry, item: dict
) -> CircadianScene | SimpleScene:
    """Instantiate the platform entity for a stored scene."""
    if item.get("kind") == KIND_SIMPLE:
        return SimpleScene(hass, config_entry, item)
    return CircadianScene(hass, config_entry, item)


async def async_create_or_update_entity(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    item: dict,
    async_add_entities: AddEntitiesCallback,
    entities: dict,
) -> CircadianScene | SimpleScene:
    """Create or update a scene entity for a stored config."""
    existing = entities.get(item["id"])
    want_simple = item.get("kind") == KIND_SIMPLE
    if existing:
        if want_simple != isinstance(existing, SimpleScene):
            await existing.async_remove(force_remove=True)
            entities.pop(item["id"], None)
        else:
            await existing.async_update_config(item)
            return existing
    entity = _make_entity(hass, config_entry, item)
    entities[item["id"]] = entity
    async_add_entities([entity])
    return entity


async def async_remove_entity(entities: dict, scene_id: str) -> None:
    """Remove a scene entity."""
    entity = entities.pop(scene_id, None)
    if entity is not None:
        await entity.async_remove(force_remove=True)


def _palette_image_attributes(
    hass: HomeAssistant, scene_config: dict
) -> dict[str, Any]:
    """Palette photo URLs for a scene, when a shipped cover exists."""
    store = hass.data.get(DOMAIN, {}).get(DATA_STORE)
    if store is None:
        return {}
    return scene_palette_image_attributes(scene_config, store.variables, store.themes)


def _palette_image_state_key(hass: HomeAssistant, scene_config: dict) -> tuple:
    attrs = _palette_image_attributes(hass, scene_config)
    images = attrs.get("palette_images") or {}
    return (
        attrs.get("palette_image"),
        tuple(sorted(images.items())),
    )


def _configured_icon(scene_config: dict, default: str) -> str:
    """Entity icon from the scene config, or the kind default."""
    icon = scene_config.get("icon")
    if isinstance(icon, str) and icon.strip():
        return icon.strip()
    return default


class CircadianScene(Scene):
    """Representation the CircadianScene."""

    def __init__(
        self, hass: HomeAssistant, config_entry: ConfigEntry, scene_config: dict
    ):
        """Initialize an CircadianScene."""
        name = scene_config.get(SCENE_NAME) or DEFAULT_SCENE_NAME
        # Setting the entity_id to an already existing entity_id throws no errors. Instead a number is
        # appended to the expected entity_id. Ie. [entity_id]_2
        self.entity_id = "scene." + name.replace(" ", "_").casefold()
        self._scene_id = self.entity_id
        self.hass = hass
        self.config_entry = config_entry
        self._scene_config = scene_config

        self._attr_icon = _configured_icon(scene_config, "mdi:auto-fix")
        self._attr_name = name
        self._attr_unique_id = scene_config["id"]
        self._attr_integration = "scene_studio"
        self._brightness_modifier = 0
        self._transition_percent_manual = False
        self._manual_transition_percent = None
        self._unsub_interval = None
        self._target_date_time = None
        self._area_id = scene_config.get(AREA)
        self._overridden: set[str] = set()
        self._interrupted: set[str] = set()
        self._commanded: dict[str, dict[str, Any]] = {}
        self._pre_apply: dict[str, dict[str, Any] | None] = {}
        self._apply_context: Context | None = None
        self._apply_until = 0.0
        self._automatically_update_lights_armed = False
        self._activating_automatically_update_lights = False
        self._only_entity_ids: set[str] | None = None
        self._automatically_update_lights_generation = 0
        self._unsub_automatically_update_lights = None
        self._last_attr_state_key = None

        # Used for calculating solar events when activating the scene
        self.latitude = self.hass.config.latitude
        self.longitude = self.hass.config.longitude
        self.time_zone = self.hass.config.time_zone
        self.city = LocationInfo(
            timezone=self.time_zone, latitude=self.latitude, longitude=self.longitude
        )

    def _cfg(self, key, default=None):
        """Read a value from the stored scene config."""
        value = self._scene_config.get(key)
        if value in (None, ""):
            return default
        return value

    def _automatically_update_lights_enabled(self) -> bool:
        """Persistent scene preference combined with the global HA switch."""
        settings = self.hass.data[DOMAIN][DATA_STORE].settings
        return bool(
            self._cfg("automatically_update_lights", True)
            and settings.get("automatic_updates_enabled", True)
        )

    async def async_added_to_hass(self) -> None:
        """Assign the configured area once the entity is registered."""
        await super().async_added_to_hass()
        await self._async_sync_registry()
        self._unsub_interval = async_track_time_interval(
            self.hass, self._async_refresh_transition_percent, timedelta(minutes=1)
        )

    async def async_will_remove_from_hass(self) -> None:
        """Stop timers and listeners when the entity is removed."""
        if self._unsub_interval:
            self._unsub_interval()
            self._unsub_interval = None
        scene_runtime(self.hass).release(self)
        self._stop_automatically_update_lights(write_state=False)
        await super().async_will_remove_from_hass()

    async def _async_refresh_transition_percent(self, _now) -> None:
        """Rewrite state so auto transition_percent tracks the clock."""
        if self._transition_percent_manual:
            return
        self._write_ha_state_if_attrs_changed()

    def _attr_state_key(self) -> tuple:
        """Comparable slice of attributes that drive recorder traffic."""
        return (
            round(self._current_day_transition_percent(), 1),
            self._transition_percent_manual,
            self._brightness_modifier,
            self._automatically_update_lights_enabled(),
            self._cfg("automatically_update_lights", True),
            self._automatically_update_lights_armed,
            scene_runtime(self.hass).active(self),
            tuple(sorted(self._overridden)),
            tuple(sorted(self._interrupted)),
            self._attr_icon,
            _palette_image_state_key(self.hass, self._scene_config),
        )

    def _write_ha_state_if_attrs_changed(self) -> None:
        """Skip async_write_ha_state when rounded attrs are unchanged."""
        key = self._attr_state_key()
        if key == self._last_attr_state_key:
            return
        self._last_attr_state_key = key
        self.async_write_ha_state()

    async def async_update_config(
        self, scene_config: dict, *, _resume: bool = True
    ) -> None:
        """Apply an updated store item."""
        previous_preference = self._cfg("automatically_update_lights", True)
        if self._area_id != scene_config.get(AREA) or not scene_area_exists(
            self.hass, scene_config
        ):
            scene_runtime(self.hass).release(self)
        self._scene_config = scene_config
        self._attr_name = scene_config.get(SCENE_NAME) or self._attr_name
        self._area_id = scene_config.get(AREA)
        self._attr_icon = _configured_icon(scene_config, "mdi:auto-fix")
        await self._async_sync_registry()
        if _resume and previous_preference != self._cfg(
            "automatically_update_lights", True
        ):
            await self.async_preferences_changed()
            return
        # Disabled preferences stop a running loop without releasing ownership.
        if (
            not self._automatically_update_lights_enabled()
            and self._automatically_update_lights_armed
        ):
            self._stop_automatically_update_lights()
        else:
            self._write_ha_state_if_attrs_changed()

    async def _async_sync_registry(self) -> None:
        """Keep entity registry area, labels, and category in sync."""
        entity_reg = er.async_get(self.hass)
        entry = entity_reg.async_get(self.entity_id)
        if not entry:
            return
        updates: dict[str, Any] = {"area_id": self._area_id, "icon": self._attr_icon}
        labels = self._scene_config.get(LABELS)
        if labels is not None:
            updates["labels"] = set(labels)
        # Always write categories so clearing the scene category is not a no-op.
        categories = dict(entry.categories or {})
        category = self._scene_config.get(CATEGORY)
        if category:
            categories["scene"] = category
        else:
            categories.pop("scene", None)
        updates["categories"] = categories
        entity_reg.async_update_entity(self.entity_id, **updates)

    @property
    def name(self):
        """Return the display name of this device."""
        return self._attr_name

    @property
    def scene_id(self):
        """Return the scene ID."""
        return self._scene_id

    @property
    def unique_id(self):
        """Return the unique ID of this scene."""
        return self._attr_unique_id

    @property
    def extra_state_attributes(self):
        """Return the state attributes."""
        attrs = {
            "brightness_modifier": self._brightness_modifier,
            "transition_percent": round(self._current_day_transition_percent(), 1),
            "transition_percent_manual": self._transition_percent_manual,
            "integration": self._attr_integration,
            "active": scene_runtime(self.hass).active(self),
            "automatically_update_lights": self._cfg(
                "automatically_update_lights", True
            ),
            "automatic_updates_paused": not self._cfg(
                "automatically_update_lights", True
            ),
            "automatically_update_lights_active": self._automatically_update_lights_armed,
            "overridden_lights": sorted(self._overridden),
            "interrupted_lights": sorted(self._interrupted),
        }
        if self._target_date_time is not None:
            attrs["target_date_time"] = self._target_date_time.isoformat()

        attrs["kind"] = "circadian"
        attrs.update(_palette_image_attributes(self.hass, self._scene_config))
        theme_id = self._cfg("theme_id")
        if theme_id:
            attrs["theme_id"] = theme_id
        return attrs

    def _cancel_automatically_update_lights(self) -> None:
        """Drop the pending automatic light update timer and invalidate in-flight ticks."""
        self._automatically_update_lights_generation += 1
        if self._unsub_automatically_update_lights:
            self._unsub_automatically_update_lights()
            self._unsub_automatically_update_lights = None

    def _stop_automatically_update_lights(self, *, write_state: bool = True) -> None:
        """Pause timers without dropping ownership or retained manual changes."""
        self._cancel_automatically_update_lights()
        self._automatically_update_lights_armed = False
        if write_state and self.hass and self.entity_id:
            self._write_ha_state_if_attrs_changed()

    def async_runtime_changed(self, owner, respected) -> None:
        """Mirror shared runtime attributes, including for paused scenes."""
        self._overridden = set(respected)
        self._interrupted = owner.interrupted
        self._commanded = owner.commands
        self._pre_apply = owner.before
        self._apply_context = owner.context
        self._apply_until = owner.until
        if not scene_runtime(self.hass).active(self):
            self._stop_automatically_update_lights(write_state=False)
        self._write_ha_state_if_attrs_changed()

    async def async_preferences_changed(self, context: Context | None = None) -> None:
        """Pause immediately or resume a current owner toward its current target."""
        self._stop_automatically_update_lights(write_state=False)
        interval = automatically_update_lights_interval_seconds(self.hass)
        eligible = should_arm_automatically_update_lights(
            interval,
            enabled=self._automatically_update_lights_enabled(),
            brightness_modifier=self._brightness_modifier,
            transition_percent_manual=self._transition_percent_manual,
        ) and scene_runtime(self.hass).active(self)
        self._write_ha_state_if_attrs_changed()
        if not eligible:
            return
        self._activating_automatically_update_lights = True
        try:
            await self.async_activate(transition=interval, context=context)
        finally:
            # The preference remains durable if a bridge fails. Preserve the
            # next tick while the initiating action still receives the error.
            if self._automatically_update_lights_enabled() and scene_runtime(
                self.hass
            ).active(self):
                self._schedule_automatically_update_lights(interval)

    def _schedule_automatically_update_lights(self, interval: int) -> None:
        """Arm a automatic light update tick `interval` seconds from now."""
        if self._unsub_automatically_update_lights:
            self._unsub_automatically_update_lights()
            self._unsub_automatically_update_lights = None
        self._automatically_update_lights_armed = True
        generation = self._automatically_update_lights_generation

        async def _fire(_now) -> None:
            self._unsub_automatically_update_lights = None
            if generation != self._automatically_update_lights_generation:
                return
            await self._async_automatically_update_lights()

        self._unsub_automatically_update_lights = async_call_later(
            self.hass, interval, _fire
        )
        self._write_ha_state_if_attrs_changed()

    async def _async_automatically_update_lights(self) -> None:
        """Re-apply only the lights still owned by this Scene Studio scene."""
        if not scene_area_exists(self.hass, self._scene_config):
            scene_runtime(self.hass).release(self)
            self._stop_automatically_update_lights()
            return
        interval = automatically_update_lights_interval_seconds(self.hass)
        if not should_arm_automatically_update_lights(
            interval,
            enabled=self._automatically_update_lights_enabled(),
            brightness_modifier=self._brightness_modifier,
            transition_percent_manual=self._transition_percent_manual,
        ):
            self._stop_automatically_update_lights()
            return
        if not self._has_active_ownership():
            _LOGGER.debug(
                "%s no longer owns any lights; stopping automatic updates",
                self.entity_id,
            )
            self._stop_automatically_update_lights()
            return
        self._collect_new_overrides()
        self._activating_automatically_update_lights = True
        generation = self._automatically_update_lights_generation
        try:
            await self.async_activate(transition=interval)
        finally:
            # Propagate handler failures while retaining the next eligible tick.
            if (
                generation == self._automatically_update_lights_generation
                and self._unsub_automatically_update_lights is None
                and self._automatically_update_lights_enabled()
                and self._has_active_ownership()
            ):
                self._schedule_automatically_update_lights(interval)

    def _has_active_ownership(self) -> bool:
        """Only Scene Studio activations transfer ownership."""
        return scene_runtime(self.hass).active(self)

    def _collect_new_overrides(self) -> None:
        scene_runtime(self.hass).collect(self)

    async def async_recover_owned_light(self, entity_id: str) -> None:
        """Recover only a currently owned light while automatic updates run."""
        if not self._automatically_update_lights_armed:
            return
        if entity_id not in scene_runtime(self.hass).eligible_lights(self):
            return
        self._only_entity_ids = {entity_id}
        self._activating_automatically_update_lights = True
        try:
            await self.async_activate(transition=1)
        finally:
            self._only_entity_ids = None

    async def async_activate(self, **kwargs):
        """Keep automatic and explicit commands ordered through handler completion."""
        if not scene_area_exists(self.hass, self._scene_config):
            raise HomeAssistantError("Scene Studio area has been deleted")
        automatic = self._activating_automatically_update_lights
        self._activating_automatically_update_lights = False
        only_ids = self._only_entity_ids
        generation = self._automatically_update_lights_generation
        runtime = scene_runtime(self.hass)
        async with runtime.command_lock:
            if automatic and (
                generation != self._automatically_update_lights_generation
                or not runtime.active(self)
            ):
                return
            try:
                await self._async_apply_scene(
                    _automatic=automatic, _only_ids=only_ids, **kwargs
                )
            finally:
                runtime.pending_context = None
                owner = runtime.owners.get(self.unique_id)
                if owner is not None:
                    self.async_runtime_changed(owner, runtime.respected(owner))

    async def _async_apply_scene(
        self,
        transition=0,
        brightness_modifier=0,
        transition_percent=None,
        target_date_time=None,
        location=None,
        context: Context | None = None,
        _automatic: bool = False,
        _only_ids: set[str] | None = None,
    ):
        """Activate the scene.

        Args:
            transition: Transition time in seconds
            brightness_modifier: Brightness modifier percentage (-100 to 100)
            transition_percent: Absolute 0–100 position along the day (dawn 0,
                sunrise 25, noon 50, sunset 75, dusk 100). None uses the clock.
            target_date_time: Optional datetime to base extrapolation on (defaults to current time)
            location: Optional dict with 'latitude' and 'longitude' keys to override location
                     (defaults to Home Assistant's configured location)
        """
        if not scene_area_exists(self.hass, self._scene_config):
            raise HomeAssistantError("Scene Studio area has been deleted")
        is_auto_update_tick = _automatic
        only_ids = _only_ids
        if not is_auto_update_tick:
            self._cancel_automatically_update_lights()
            self._automatically_update_lights_armed = False
        generation = self._automatically_update_lights_generation

        # Store the brightness modifier and optional manual day percent
        self._brightness_modifier = brightness_modifier
        if transition_percent is None:
            self._transition_percent_manual = False
            self._manual_transition_percent = None
        else:
            self._transition_percent_manual = True
            self._manual_transition_percent = transition_percent

        interval = automatically_update_lights_interval_seconds(self.hass)
        will_follow = should_arm_automatically_update_lights(
            interval,
            enabled=self._automatically_update_lights_enabled(),
            brightness_modifier=brightness_modifier,
            transition_percent_manual=self._transition_percent_manual,
        )
        # Blueprint-style: first activation keeps the caller's transition
        # (usually 0). Auto-update ticks pass transition=interval and target
        # how the room should look at now+interval.
        apply_transition = transition

        # Only an explicit target pins the state attribute to a historical day.
        explicit_target = target_date_time is not None
        target_date_time = _local_target_datetime(target_date_time, self.time_zone)

        # Ordinary activation follows the clock on subsequent attribute writes.
        self._target_date_time = target_date_time if explicit_target else None

        start_time = time.time()  # Used for performance monitoring

        # Trigger a state update to make the attributes visible immediately
        self.async_write_ha_state()

        if apply_transition == 6553:
            _LOGGER.warning(
                "Home Assistant doesn't support transition times longer than 6553 (109 minutes). Anything above this value seems to be disregarded. The integration received a transition time of: %s",
                apply_transition,
            )

        ##############################################
        #          Calculate solar events            #
        ##############################################
        start_time_calculate_solar_events = time.time()

        # Use provided location if specified, otherwise use default from hass.config
        if location is not None:
            location_latitude = location.get("latitude", self.latitude)
            location_longitude = location.get("longitude", self.longitude)
        else:
            location_latitude = self.latitude
            location_longitude = self.longitude
        location_timezone = self.time_zone

        solar_events, _fallbacks = cached_solar_events(
            self.hass,
            latitude=location_latitude,
            longitude=location_longitude,
            time_zone=location_timezone,
            target=target_date_time,
        )

        scene_dusk_minimum_time_of_day = dusk_minimum_seconds(self.hass)

        day_start = target_date_time.replace(hour=0, minute=0, second=0, microsecond=0)
        dusk_seconds, dusk_was_overridden, dusk_solar_seconds = dusk_start_seconds(
            solar_events["dusk"],
            day_start,
            scene_dusk_minimum_time_of_day,
        )
        dusk_original_time = dusk_solar_seconds if dusk_was_overridden else None

        store = self.hass.data[DOMAIN][DATA_STORE]
        members = scene_members(self.hass, self._scene_config)
        modes = modes_map(self.hass, members)
        anchors = {
            event: circadian_anchor(
                self.hass,
                store,
                self._scene_config,
                event,
                members=members,
                modes=modes,
            )
            for event in SOLAR_EVENTS
        }
        sun_events = {
            "dawn": SunEvent(
                name="Dawn",
                key="dawn",
                scene=anchors["dawn"],
                start_time=dawn_start_seconds(
                    solar_events["dawn"], dawn_maximum_seconds(self.hass)
                )[0],
            ),
            "sunrise": SunEvent(
                name="Sunrise",
                key="sunrise",
                scene=anchors["sunrise"],
                start_time=self.datetime_to_seconds_since_midnight(
                    solar_events["sunrise"]
                ),
            ),
            "noon": SunEvent(
                name="Noon",
                key="noon",
                scene=anchors["noon"],
                start_time=self.datetime_to_seconds_since_midnight(
                    solar_events["noon"]
                ),
            ),
            "sunset": SunEvent(
                name="Sunset",
                key="sunset",
                scene=anchors["sunset"],
                start_time=self.datetime_to_seconds_since_midnight(
                    solar_events["sunset"]
                ),
            ),
            "dusk": SunEvent(
                name="Dusk",
                key="dusk",
                scene=anchors["dusk"],
                start_time=dusk_seconds,
            ),
        }

        current_seconds = self.seconds_since_midnight(0)
        final_time = self.seconds_since_midnight(apply_transition)

        if self._transition_percent_manual:
            current_key, next_key, scene_transition_progress_percent = (
                scene_keys_from_day_percent(self._manual_transition_percent)
            )
            current_sun_event = sun_events[current_key]
            next_sun_event = sun_events[next_key]
            day_percent = self._manual_transition_percent
        else:
            current_sun_event = self.get_sun_event(
                offset=0,
                sun_events=sun_events,
                seconds_since_midnight=final_time,
            )
            next_sun_event = self.get_sun_event(
                offset=1,
                sun_events=sun_events,
                seconds_since_midnight=final_time,
            )
            scene_transition_progress_percent = (
                self.get_scene_transition_progress_percent(
                    current_sun_event, next_sun_event, final_time
                )
            )
            day_percent = day_transition_percent(
                current_sun_event.key,
                next_sun_event.key,
                scene_transition_progress_percent,
            )

        # Build the detailed activation trace only when debug logging is enabled.
        if _LOGGER.isEnabledFor(logging.DEBUG):
            current_time_str = self._format_seconds_to_time(current_seconds)
            final_time_str = self._format_seconds_to_time(final_time)

            _LOGGER.debug("=" * 60)
            _LOGGER.debug("Scene Activation Details")
            _LOGGER.debug("=" * 60)
            _LOGGER.debug(
                "Brightness modifier %s, transition time %ss",
                brightness_modifier,
                apply_transition,
            )
            _LOGGER.debug("")
            if (
                hasattr(self, "_target_date_time")
                and self._target_date_time is not None
            ):
                target_datetime_str = self._target_date_time.strftime(
                    "%Y-%m-%d %H:%M:%S"
                )
                _LOGGER.debug(
                    "Target datetime: %s (extrapolation based on this date/time)",
                    target_datetime_str,
                )
                _LOGGER.debug("Base time:       %s", current_time_str)
            else:
                _LOGGER.debug("Current time:    %s", current_time_str)
            _LOGGER.debug("Apply as of:     %s", final_time_str)
            _LOGGER.debug(
                "Day transition:  %s%% (%s)",
                round(day_percent, 1),
                "manual" if self._transition_percent_manual else "auto",
            )

            _LOGGER.debug("")
            _LOGGER.debug("Solar Events:")

            sorted_sun_events = sorted(sun_events.values(), key=lambda x: x.start_time)
            for sun_event in sorted_sun_events:
                event_time_str = self._format_seconds_to_time(sun_event.start_time)
                if sun_event.key == "dusk" and dusk_was_overridden:
                    dusk_original_str = self._format_seconds_to_time(dusk_original_time)
                    event_time_str = (
                        f"{event_time_str} ({dusk_original_str} was overridden)"
                    )
                _LOGGER.debug(
                    "  %s %s",
                    (sun_event.name + ":").ljust(14),
                    event_time_str,
                )

            _LOGGER.debug("")
            _LOGGER.debug(
                "Current state:   %s%% transitioned from %s to %s",
                round(scene_transition_progress_percent, 1),
                current_sun_event.name,
                next_sun_event.name,
            )
            _LOGGER.debug("=" * 60)

        _LOGGER.debug(
            "Time calculating solar events: %.3fs",
            time.time() - start_time_calculate_solar_events,
        )

        ##############################################
        #           Extrapolate entities             #
        ##############################################
        start_time_extrapolation = time.time()

        entity_changes = await extrapolate_entities(
            current_sun_event.scene,
            next_sun_event.scene,
            scene_transition_progress_percent,
            self.hass,
            brightness_modifier,
            skip_entity_ids=(
                (self._overridden | self._interrupted) if is_auto_update_tick else set()
            ),
        )
        if is_auto_update_tick:
            eligible = scene_runtime(self.hass).eligible_lights(self)
            entity_changes = [
                item for item in entity_changes if item.get(ATTR_ENTITY_ID) in eligible
            ]
        if only_ids is not None:
            entity_changes = [
                item for item in entity_changes if item.get(ATTR_ENTITY_ID) in only_ids
            ]
        light_changes = [
            item
            for item in entity_changes
            if str(item.get(ATTR_ENTITY_ID, "")).startswith("light.")
        ]
        if is_auto_update_tick:
            # Stage new snapshots locally; a failed handler must retain the previous runtime targets.
            self._pre_apply = dict(self._pre_apply)
            self._commanded = dict(self._commanded)
            # Keep snapshots for interrupted/overridden lamps we are not touching.
            for item in light_changes:
                eid = item[ATTR_ENTITY_ID]
                self._pre_apply[eid] = snapshot_from_state(self.hass.states.get(eid))
                self._commanded[eid] = snapshot_from_command(item)
        else:
            self._pre_apply = {
                item[ATTR_ENTITY_ID]: snapshot_from_state(
                    self.hass.states.get(item[ATTR_ENTITY_ID])
                )
                for item in light_changes
            }
            self._commanded = {
                item[ATTR_ENTITY_ID]: snapshot_from_command(item)
                for item in light_changes
            }
        if is_auto_update_tick and (
            generation != self._automatically_update_lights_generation
            or not self._has_active_ownership()
        ):
            return
        self._apply_context = context or self._context or Context()
        self._apply_until = time.time() + float(apply_transition or 0)
        scene_runtime(self.hass).pending_context = self._apply_context
        if entity_changes:
            await apply_entities_parallel(
                entity_changes,
                self.hass,
                apply_transition,
                context=self._apply_context,
                skip_noop=is_auto_update_tick,
                can_apply=(
                    (
                        lambda eid: generation
                        == self._automatically_update_lights_generation
                        and eid in scene_runtime(self.hass).eligible_lights(self)
                    )
                    if is_auto_update_tick
                    else None
                ),
            )
        if generation != self._automatically_update_lights_generation:
            return
        runtime = scene_runtime(self.hass)
        if is_auto_update_tick:
            runtime.record_commands(
                self,
                light_changes,
                self._pre_apply,
                self._apply_context,
                apply_transition,
            )
        else:
            runtime.claim(
                self,
                light_changes,
                self._pre_apply,
                self._apply_context,
                apply_transition,
            )
            if hasattr(self, "_async_record_activation"):
                self._async_record_activation()

        if generation != self._automatically_update_lights_generation:
            return
        # Single-light recover must not reset the interval timer.
        if will_follow and only_ids is None:
            self._schedule_automatically_update_lights(interval)
        elif will_follow:
            self._automatically_update_lights_armed = True
            self._write_ha_state_if_attrs_changed()
        else:
            self._automatically_update_lights_armed = False
            self._write_ha_state_if_attrs_changed()

        _LOGGER.debug(
            "Time extrapolating: %.3fs",
            time.time() - start_time_extrapolation,
        )

        _LOGGER.debug("Time total applying scene: %.3fs", time.time() - start_time)

    def datetime_to_seconds_since_midnight(self, datetime_obj):
        """Convert a datetime object to seconds since midnight."""
        # Calculate midnight for the date of the datetime object, not today
        midnight = datetime_obj.replace(hour=0, minute=0, second=0, microsecond=0)
        return (datetime_obj - midnight).total_seconds()

    def get_scene_transition_progress_percent(
        self, current_sun_event, next_sun_event, seconds_since_midnight
    ) -> int:
        """Get a percentage value for how far into the transitioning between the from and to scene we currently are."""
        return transition_progress_percent(
            current_sun_event.start_time,
            next_sun_event.start_time,
            seconds_since_midnight,
        )

    def seconds_since_midnight(self, offset_seconds: int) -> float:
        """Returns the number of seconds since midnight, can be adjusted with an offset."""
        # Use target_date_time if set (from async_activate), otherwise use current time
        if hasattr(self, "_target_date_time") and self._target_date_time is not None:
            target_time = self._target_date_time
        else:
            target_time = datetime.now(tz=ZoneInfo(self.hass.config.time_zone))

        seconds_since_midnight = (
            target_time - target_time.replace(hour=0, minute=0, second=0, microsecond=0)
        ).total_seconds()

        # Current time + the transition time - as we should calculate the lights as they should be when
        # the transition is finished.
        # 86400 is 24 hours in seconds. % so that if the time overshoots 24 hours, the surplus is
        # shaved off.
        seconds_since_midnight_adjusted_for_offset = (
            seconds_since_midnight + offset_seconds
        ) % 86400

        return seconds_since_midnight_adjusted_for_offset  # noqa: RET504

    def _format_seconds_to_time(self, seconds_since_midnight: float) -> str:
        """Format seconds since midnight to HH:MM format."""
        seconds = int(seconds_since_midnight) % 86400  # Ensure within 24 hours
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours:02d}:{minutes:02d}"

    def get_sun_event(self, sun_events, seconds_since_midnight, offset=0) -> SunEvent:
        """Returns the current sun event, according to the current time of day. Can be offset by ie. 1 to get the next sun event instead."""
        # Solar order, not clock-sorted: wrapped dusk (01:00) is still after sunset.
        ordered = [sun_events[key] for key in EVENT_ORDER]
        starts = [event.start_time for event in ordered]
        closest_match_index = current_sun_event_index(
            starts, seconds_since_midnight % 86400
        )
        offset_index = closest_match_index + offset
        return ordered[offset_index % len(ordered)]

    def _current_day_transition_percent(self) -> float:
        """Day position for the state attribute: stored if manual, else from the clock."""
        if self._transition_percent_manual:
            return self._manual_transition_percent
        target = (
            self._target_date_time
            if self._target_date_time is not None
            else datetime.now(tz=ZoneInfo(self.time_zone))
        )
        solar_events, _fallbacks = cached_solar_events(
            self.hass,
            latitude=self.latitude,
            longitude=self.longitude,
            time_zone=self.time_zone,
            target=target,
        )
        dusk_minimum = dusk_minimum_seconds(self.hass)
        day_start = target.replace(hour=0, minute=0, second=0, microsecond=0)
        starts = {
            key: self.datetime_to_seconds_since_midnight(solar_events[key])
            for key in EVENT_ORDER
            if key != "dusk"
        }
        starts["dawn"], _overridden, _solar = dawn_start_seconds(
            solar_events["dawn"], dawn_maximum_seconds(self.hass)
        )
        starts["dusk"], _overridden, _solar = dusk_start_seconds(
            solar_events["dusk"],
            day_start,
            dusk_minimum,
        )
        seconds = self.seconds_since_midnight(0)
        times = [starts[key] for key in EVENT_ORDER]
        index = current_sun_event_index(times, seconds % 86400)
        current_key = EVENT_ORDER[index]
        next_key = EVENT_ORDER[(index + 1) % len(EVENT_ORDER)]
        intra = transition_progress_percent(
            starts[current_key], starts[next_key], seconds
        )
        return day_transition_percent(current_key, next_key, intra)


class SimpleScene(Scene):
    """Fixed lighting scene that can reference color variables."""

    def __init__(
        self, hass: HomeAssistant, config_entry: ConfigEntry, scene_config: dict
    ):
        """Initialize a simple scene entity."""
        name = scene_config.get(SCENE_NAME) or DEFAULT_SCENE_NAME
        self.entity_id = "scene." + name.replace(" ", "_").casefold()
        self._scene_id = self.entity_id
        self.hass = hass
        self.config_entry = config_entry
        self._scene_config = scene_config
        self._attr_icon = _configured_icon(scene_config, "mdi:palette")
        self._attr_name = name
        self._attr_unique_id = scene_config["id"]
        self._attr_integration = "scene_studio"
        self._area_id = scene_config.get(AREA)

    @property
    def name(self):
        """Return the display name."""
        return self._attr_name

    @property
    def unique_id(self):
        """Return the unique ID."""
        return self._attr_unique_id

    @property
    def extra_state_attributes(self):
        """Return state attributes."""
        attrs = {
            "kind": KIND_SIMPLE,
            "integration": self._attr_integration,
            "active": scene_runtime(self.hass).active(self),
        }
        attrs.update(_palette_image_attributes(self.hass, self._scene_config))
        return attrs

    async def async_added_to_hass(self) -> None:
        """Assign the configured area once the entity is registered."""
        await super().async_added_to_hass()
        await self._async_sync_registry()

    async def async_update_config(self, scene_config: dict) -> None:
        """Apply an updated store item."""
        if self._area_id != scene_config.get(AREA) or not scene_area_exists(
            self.hass, scene_config
        ):
            scene_runtime(self.hass).release(self)
        self._scene_config = scene_config
        self._attr_name = scene_config.get(SCENE_NAME) or self._attr_name
        self._area_id = scene_config.get(AREA)
        self._attr_icon = _configured_icon(scene_config, "mdi:palette")
        await self._async_sync_registry()
        self.async_write_ha_state()

    async def _async_sync_registry(self) -> None:
        """Keep entity registry area, labels, and category in sync."""
        entity_reg = er.async_get(self.hass)
        entry = entity_reg.async_get(self.entity_id)
        if not entry:
            return
        updates: dict[str, Any] = {"area_id": self._area_id, "icon": self._attr_icon}
        labels = self._scene_config.get(LABELS)
        if labels is not None:
            updates["labels"] = set(labels)
        categories = dict(entry.categories or {})
        category = self._scene_config.get(CATEGORY)
        if category:
            categories["scene"] = category
        else:
            categories.pop("scene", None)
        updates["categories"] = categories
        entity_reg.async_update_entity(self.entity_id, **updates)

    def async_runtime_changed(self, _owner, _respected) -> None:
        """Ordinary scenes also expose current ownership while no timer runs."""
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self) -> None:
        """Release ordinary-scene ownership on unload/removal."""
        scene_runtime(self.hass).release(self)
        await super().async_will_remove_from_hass()

    async def async_activate(self, **kwargs):
        """Serialize explicit activation with circadian update handlers."""
        if not scene_area_exists(self.hass, self._scene_config):
            raise HomeAssistantError("Scene Studio area has been deleted")
        runtime = scene_runtime(self.hass)
        async with runtime.command_lock:
            try:
                await self._async_apply_scene(**kwargs)
            finally:
                runtime.pending_context = None

    async def _async_apply_scene(
        self, transition=0, context: Context | None = None, **kwargs
    ):
        """Apply the resolved fixed snapshot."""
        if not scene_area_exists(self.hass, self._scene_config):
            raise HomeAssistantError("Scene Studio area has been deleted")
        store = self.hass.data[DOMAIN][DATA_STORE]
        anchor = simple_anchor(self.hass, store, self._scene_config)
        entity_changes = []
        for entity_id, state in (anchor.get("entities") or {}).items():
            item = {ATTR_ENTITY_ID: entity_id, **state}
            entity_changes.append(item)
        apply_context = context or self._context or Context()
        runtime = scene_runtime(self.hass)
        runtime.pending_context = apply_context
        before = {
            item[ATTR_ENTITY_ID]: snapshot_from_state(
                self.hass.states.get(item[ATTR_ENTITY_ID])
            )
            for item in entity_changes
        }
        if entity_changes:
            await apply_entities_parallel(
                entity_changes, self.hass, transition, context=apply_context
            )
        runtime.claim(self, entity_changes, before, apply_context, transition)
        if hasattr(self, "_async_record_activation"):
            self._async_record_activation()
