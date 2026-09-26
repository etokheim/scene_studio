"""Next-day solar dusk placement vs earliest-dusk floor."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from custom_components.scene_studio.solar import (
    SECONDS_PER_DAY,
    _format_time,
    dusk_start_seconds,
)

TZ = ZoneInfo("UTC")


def test_next_calendar_day_dusk_is_morning_clock_not_end_of_day():
    day_start = datetime(2026, 6, 21, tzinfo=TZ)
    dusk = day_start + timedelta(hours=25)
    seconds, overridden, solar = dusk_start_seconds(dusk, day_start, 22 * 3600)
    assert seconds == 3600
    assert overridden is False
    assert solar is None
    assert _format_time(seconds) == "01:00"


def test_exactly_24h_dusk_is_midnight_not_24_00():
    day_start = datetime(2026, 6, 21, tzinfo=TZ)
    dusk = day_start + timedelta(seconds=SECONDS_PER_DAY)
    seconds, overridden, solar = dusk_start_seconds(dusk, day_start, 22 * 3600)
    assert seconds == 0
    assert overridden is False
    assert solar is None
    assert _format_time(SECONDS_PER_DAY) == "00:00"


def test_same_day_dusk_before_floor_is_still_delayed():
    day_start = datetime(2026, 6, 21, tzinfo=TZ)
    dusk = day_start + timedelta(hours=20)
    seconds, overridden, solar = dusk_start_seconds(dusk, day_start, 22 * 3600)
    assert seconds == 22 * 3600
    assert overridden is True
    assert solar == 20 * 3600
