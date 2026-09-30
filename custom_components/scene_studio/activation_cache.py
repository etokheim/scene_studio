"""In-process caches for automatic light-update activation (invalidated on scene.reload)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_START
from homeassistant.core import Event, HomeAssistant, callback

from .const import DOMAIN
from .solar import resolve_solar_events

DATA_ACTIVATION_CACHE = "activation_cache"


def _cache(hass: HomeAssistant) -> dict[str, Any]:
    domain = hass.data.setdefault(DOMAIN, {})
    return domain.setdefault(
        DATA_ACTIVATION_CACHE,
        {
            "solar": {},
            "listener": None,
            "start_listener": None,
        },
    )


def invalidate_activation_cache(hass: HomeAssistant) -> None:
    """Drop cached solar events after scene.reload or a catalog reset."""
    cache = _cache(hass)
    cache["solar"] = {}


@callback
def _on_call_service(hass: HomeAssistant, event: Event) -> None:
    domain = event.data.get("domain")
    service = event.data.get("service")
    if domain == "scene" and service == "reload":
        invalidate_activation_cache(hass)


def ensure_activation_cache_listener(hass: HomeAssistant) -> None:
    """Listen once for scene.reload to invalidate caches."""
    cache = _cache(hass)
    if cache.get("listener") or cache.get("start_listener"):
        return

    @callback
    def _attach(_event: Event | None = None) -> None:
        cache["start_listener"] = None
        if cache.get("listener"):
            return
        cache["listener"] = hass.bus.async_listen(
            "call_service", lambda event: _on_call_service(hass, event)
        )

    if hass.is_running:
        _attach()
    else:
        cache["start_listener"] = hass.bus.async_listen_once(
            EVENT_HOMEASSISTANT_START, _attach
        )


def unload_activation_cache(hass: HomeAssistant) -> None:
    """Release cache listeners when the integration entry unloads."""
    domain = hass.data.get(DOMAIN)
    if not domain or DATA_ACTIVATION_CACHE not in domain:
        return
    cache = domain.pop(DATA_ACTIVATION_CACHE)
    for key in ("listener", "start_listener"):
        if unsubscribe := cache.get(key):
            unsubscribe()


def cached_solar_events(
    hass: HomeAssistant,
    *,
    latitude: float,
    longitude: float,
    time_zone: str,
    target: datetime,
) -> tuple[dict[str, datetime], set[str]]:
    """Day-scoped solar event datetimes for activation."""
    ensure_activation_cache_listener(hass)
    cache = _cache(hass)
    day_key = (
        round(latitude, 5),
        round(longitude, 5),
        time_zone,
        target.date().isoformat(),
    )
    solar = cache["solar"]
    if day_key in solar:
        return solar[day_key]
    result = resolve_solar_events(
        latitude=latitude,
        longitude=longitude,
        time_zone=time_zone,
        target=target,
    )
    if len(solar) > 8:
        solar.clear()
    solar[day_key] = result
    return result
